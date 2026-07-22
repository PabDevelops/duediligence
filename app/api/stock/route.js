import { supabase } from '../../../lib/supabase.js';
import { getYahooAuth } from '../../../lib/yahooFinance.js';
import { fetchForm4Transactions, computeInsiderOwnershipPct } from '../../../lib/secInsiders.js';
import { getCapTier, isSmallOrMicro } from '../../../lib/marketCap.js';

const FH_KEY = process.env.FINNHUB_API_KEY;
const AV_KEY = process.env.ALPHA_VANTAGE_API_KEY;
const CACHE_HOURS = 24;

// SEC's company_tickers.json is a large (~1-2MB), slow-changing file — re-fetching it fresh on
// every single uncached stock lookup needlessly hammers SEC's rate limit (officially ~10
// req/sec, shared across this server's *entire* traffic), and once that limit trips, SEC
// returns an HTML "Request Rate Threshold Exceeded" page instead of JSON — which crashed the
// *whole* request with an unrelated-looking JSON.parse error for any ticker not already in the
// Supabase cache (verified against real data: this is exactly what broke a real ticker lookup
// that had worked the day before). Cached in memory for a day; on a failed refetch, serves the
// last good copy rather than erroring — and if there's no copy yet either, returns null so the
// caller falls through to the Finnhub+Yahoo path below, which doesn't depend on this file.
let tickerMapCache = null; // { map: Map<TICKER, company>, expires: number }
async function getSecTickerMap() {
  if (tickerMapCache && Date.now() < tickerMapCache.expires) return tickerMapCache.map;
  try {
    const res = await fetch('https://www.sec.gov/files/company_tickers.json', {
      headers: { 'User-Agent': 'DueDiligenceApp contact@example.com' },
    });
    if (!res.ok) throw new Error(`SEC ticker list returned ${res.status}`);
    const data = await res.json();
    const map = new Map(Object.values(data).map(c => [c.ticker.toUpperCase(), c]));
    tickerMapCache = { map, expires: Date.now() + 24 * 60 * 60 * 1000 };
    return map;
  } catch (e) {
    console.error('SEC ticker list fetch failed, falling back:', e.message);
    return tickerMapCache?.map ?? null;
  }
}

// Unofficial endpoint (no key, no official support) — used only as a fallback for tickers
// with an exchange suffix (e.g. LLOY.L) that Finnhub's free plan doesn't cover.
async function fetchYahooQuote(ticker) {
  const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}`, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  const data = await res.json();
  const meta = data?.chart?.result?.[0]?.meta;
  if (!meta || meta.regularMarketPrice == null) return null;

  let currency = meta.currency || null;
  let price = meta.regularMarketPrice;
  let prevClose = meta.previousClose ?? meta.chartPreviousClose ?? null;
  let high52 = meta.fiftyTwoWeekHigh ?? null;
  let low52 = meta.fiftyTwoWeekLow ?? null;

  // GBp = pence sterling, not pounds — normalize to GBP so it matches our currency selector.
  if (currency === 'GBp') {
    currency = 'GBP';
    price /= 100;
    if (prevClose != null) prevClose /= 100;
    if (high52 != null) high52 /= 100;
    if (low52 != null) low52 /= 100;
  }

  return {
    name: meta.longName || meta.shortName || ticker,
    exchange: meta.fullExchangeName || meta.exchangeName || null,
    currency,
    currentPrice: price,
    prevClose,
    priceChange: prevClose != null ? +(price - prevClose).toFixed(4) : null,
    priceChangePct: prevClose ? +(((price - prevClose) / prevClose) * 100).toFixed(2) : null,
    high52,
    low52,
  };
}

const YAHOO_TS_TYPES = [
  'annualTotalRevenue', 'annualNetIncomeCommonStockholders', 'annualNetIncome', 'annualOperatingIncome',
  'annualOperatingCashFlow', 'annualFreeCashFlow', 'annualTotalAssets', 'annualStockholdersEquity',
  'annualTotalDebt', 'annualLongTermDebt', 'annualCashAndCashEquivalents', 'annualGrossProfit',
  'annualBasicEPS', 'annualDilutedEPS', 'annualBasicAverageShares', 'annualDilutedAverageShares',
  'annualResearchAndDevelopment', 'annualCostOfRevenue', 'annualSellingGeneralAndAdministration',
  'annualPretaxIncome', 'annualTaxProvision', 'annualInterestExpense', 'annualCapitalExpenditure',
  'annualInventory', 'annualAccountsReceivable', 'annualAccountsPayable', 'annualStockBasedCompensation',
  'annualDepreciationAndAmortization', 'annualCommonStockDividendPaid', 'annualInvestingCashFlow',
  'annualFinancingCashFlow', 'annualCurrentAssets', 'annualCurrentLiabilities',
  'annualTotalLiabilitiesNetMinorityInterest', 'annualRetainedEarnings', 'annualChangeInWorkingCapital',
].join(',');

// Reads a fundamentals-timeseries response for the first candidate type with data,
// returning up to the 6 most recent years in the same { year, val } shape as buildHistory().
function tsSeries(tsJson, ...candidateTypes) {
  const results = tsJson?.timeseries?.result || [];
  for (const type of candidateTypes) {
    const entry = results.find(r => r.meta?.type?.[0] === type);
    const arr = entry?.[type];
    if (arr && arr.some(x => x?.reportedValue?.raw != null)) {
      return arr
        .filter(x => x?.reportedValue?.raw != null)
        .map(x => ({ year: x.asOfDate.slice(0, 4), val: x.reportedValue.raw }))
        .slice(-6);
    }
  }
  return [];
}

// Joins operating cash flow and capex by year to derive free cash flow (OCF - capex) when
// Yahoo's own annualFreeCashFlow field isn't populated for this ticker. Yahoo reports capex as
// a negative (cash outflow); Math.abs guards against a source that instead reports it positive.
// Only returns years present in both series — a year missing capex data shouldn't silently
// pass its full operating cash flow through as if no capex had been spent.
function ocfMinusCapex(ocfSeries, capexSeries) {
  const capexByYear = {};
  capexSeries.forEach(c => { capexByYear[c.year] = c.val; });
  return ocfSeries
    .filter(o => capexByYear[o.year] != null)
    .map(o => ({ year: o.year, val: o.val - Math.abs(capexByYear[o.year]) }));
}

// A single-year share-count jump landing within a few percent of a clean split ratio (2x, 3x,
// 4x, 5x, 10x, 15x, 20x, 25x, 30x, 40x — forward splits — or their inverses for reverse splits)
// is a stock split, not dilution: a split changes the share count without changing anyone's
// proportional ownership, so counting it as "dilution" produces nonsense. Verified against real
// data: NVDA's sharesHistory reads 620M (2021) -> 2.5B (2022) -> 24.5B (2025), landing on 4x then
// 10x — its actual 2021 4-for-1 and 2024 10-for-1 splits, with zero real share issuance behind
// either jump, yet the naive (latest-oldest)/oldest calc below used to read this as 3820%
// "dilution." Detected splits are normalized out by rescaling every value before the split by the
// split ratio, so the whole series lands on one consistent basis before the oldest-to-latest
// delta is measured — the same adjustment every stock price chart already applies, just for
// share count instead of price.
const SPLIT_RATIOS = [2, 3, 4, 5, 10, 15, 20, 25, 30, 40];
const SPLIT_TOLERANCE = 0.08;

function isCleanSplitRatio(ratio) {
  return SPLIT_RATIOS.some(r => Math.abs(ratio - r) / r < SPLIT_TOLERANCE || Math.abs(ratio - 1 / r) / (1 / r) < SPLIT_TOLERANCE);
}

// Split-adjusts a { year, val } share-count series (ascending, oldest first) and, separately,
// drops a leading print that's implausibly tiny next to the rest of the series — a pre-IPO or
// pre-spin-off founder share count, not a real baseline any current investor could have bought
// into. Verified against real data: RDX.AX's sharesHistory reads 2.3M (2022) -> 430.6M (2023) ->
// 524.9M (2024) -> 525.9M (2025) — a ~185x jump that isn't a clean split ratio (it's the 2023
// IPO itself), so the split check alone doesn't catch it; the oldest print sitting at <5% of the
// median of everything after it does. Dropping it re-bases "dilution" to the company's actual
// post-IPO trading history (525.9M/430.6M - 1 ≈ 22%) instead of a 22,512% artifact of comparing
// against a share count that predates the stock being tradable at all.
function splitAdjustedShares(sharesHistory) {
  if (!sharesHistory || sharesHistory.length < 2) return sharesHistory;
  const adjusted = sharesHistory.map(h => ({ ...h }));

  for (let i = 1; i < adjusted.length; i++) {
    const prevVal = adjusted[i - 1].val;
    const curVal = adjusted[i].val;
    if (!prevVal || !curVal) continue;
    const ratio = curVal / prevVal;
    if (isCleanSplitRatio(ratio)) {
      for (let j = 0; j < i; j++) {
        if (adjusted[j].val != null) adjusted[j].val *= ratio;
      }
    }
  }

  const vals = adjusted.map(h => h.val).filter(v => v > 0);
  if (vals.length >= 3) {
    const rest = vals.slice(1).sort((a, b) => a - b);
    const mid = Math.floor(rest.length / 2);
    const medianRest = rest.length % 2 ? rest[mid] : (rest[mid - 1] + rest[mid]) / 2;
    if (adjusted[0].val > 0 && adjusted[0].val < medianRest * 0.05) {
      return adjusted.slice(1);
    }
  }
  return adjusted;
}

function computeShareDilutionPct(sharesHistory) {
  const adjusted = splitAdjustedShares(sharesHistory);
  const sharesLatest = adjusted?.[adjusted.length - 1]?.val;
  const sharesOldest = adjusted?.[0]?.val;
  return sharesLatest && sharesOldest
    ? +(((sharesLatest - sharesOldest) / sharesOldest) * 100).toFixed(1)
    : null;
}

// Same ratio/margin/history math as the SEC-EDGAR path below, but operating on
// ascending { year, val } arrays (latest = last element) instead of raw XBRL facts.
function computeDerivedFinancials(h) {
  const latest = (arr) => arr.length ? arr[arr.length - 1].val : null;
  const prev = (arr) => arr.length > 1 ? arr[arr.length - 2].val : null;

  const revVal = latest(h.revHistory), revPrev = prev(h.revHistory);
  const niVal = latest(h.niHistory);
  const oiVal = latest(h.oiHistory);
  const fcfVal = latest(h.fcfHistory);
  const assetsVal = latest(h.assetsHistory);
  const equityVal = latest(h.equityHistory);
  const debtVal = latest(h.debtHistory);
  const cashVal = latest(h.cashHistory);
  const rdVal = latest(h.rdHistory);
  const cogsVal = latest(h.cogsHistory);
  const sgaVal = latest(h.sgaHistory);
  const ebtVal = latest(h.ebtHistory);
  const taxVal = latest(h.taxHistory);
  const interestVal = latest(h.interestHistory);
  const sharesBasicVal = latest(h.sharesBasicHistory);
  const sharesDilutedVal = latest(h.sharesDilutedHistory);
  const currentAssetsVal = latest(h.currentAssetsHistory);
  const currentLiabilitiesVal = latest(h.currentLiabilitiesHistory);
  const totalLiabilitiesVal = latest(h.totalLiabilitiesHistory);
  const retainedEarningsVal = latest(h.retainedEarningsHistory);
  const capexVal = latest(h.capexHistory);
  const inventoryVal = latest(h.inventoryHistory);
  const receivablesVal = latest(h.receivablesHistory);
  const payablesVal = latest(h.payablesHistory);
  const sbcVal = latest(h.sbcHistory);
  const daVal = latest(h.daHistory);
  const dividendsPaidVal = latest(h.dividendsPaidHistory);
  const investingCFVal = latest(h.investingCFHistory);
  const financingCFVal = latest(h.financingCFHistory);

  const dso = receivablesVal && revVal ? +((receivablesVal / revVal) * 365).toFixed(1) : null;
  const dio = inventoryVal && cogsVal ? +((inventoryVal / cogsVal) * 365).toFixed(1) : null;
  const dpo = payablesVal && cogsVal ? +((payablesVal / cogsVal) * 365).toFixed(1) : null;
  const ccc = dso !== null && dio !== null && dpo !== null ? +(dso + dio - dpo).toFixed(1) : null;
  const inventoryTurnover = cogsVal && inventoryVal ? +(cogsVal / inventoryVal).toFixed(2) : null;

  const gpVal = latest(h.gpHistory);
  const opMargin = revVal && oiVal ? +((oiVal / revVal) * 100).toFixed(1) : null;
  const netMargin = revVal && niVal ? +((niVal / revVal) * 100).toFixed(1) : null;
  const grossMargin = revVal && gpVal ? +((gpVal / revVal) * 100).toFixed(1) : null;
  const revGrowth = revVal && revPrev ? +(((revVal - revPrev) / Math.abs(revPrev)) * 100).toFixed(1) : null;
  const roe = equityVal && niVal ? +((niVal / equityVal) * 100).toFixed(1) : null;
  const roa = assetsVal && niVal ? +((niVal / assetsVal) * 100).toFixed(1) : null;
  const effectiveDebtVal = equityVal != null ? (debtVal ?? 0) : debtVal;
  const investedCapital = (equityVal ?? 0) + (effectiveDebtVal ?? 0);
  const roic = investedCapital > 0 && oiVal !== null ? +((oiVal / investedCapital) * 100).toFixed(1) : null;
  const debtToEquity = equityVal && effectiveDebtVal != null ? +(effectiveDebtVal / equityVal).toFixed(2) : null;
  const netDebt = (effectiveDebtVal ?? 0) - (cashVal ?? 0);

  const marginHistory = h.revHistory.map((r, i) => {
    const oi = h.oiHistory[i];
    if (!oi || !r.val) return { year: r.year, margin: null };
    return { year: r.year, margin: +((oi.val / r.val) * 100).toFixed(1) };
  });

  const shareDilution = computeShareDilutionPct(h.sharesHistory);

  const epsHistory = h.niHistory.map((ni, i) => {
    const sh = h.sharesHistory[i];
    if (!ni || !sh || !sh.val) return null;
    return { year: ni.year, eps: +(ni.val / sh.val).toFixed(2) };
  }).filter(Boolean);

  const epsOldest = epsHistory[0]?.eps;
  const epsLatest = epsHistory[epsHistory.length - 1]?.eps;
  const epsYears = epsHistory.length > 1 ? epsHistory.length - 1 : 1;
  const epsCagrRaw = epsOldest && epsLatest && epsOldest > 0 && epsLatest > 0
    ? +(((Math.pow(epsLatest / epsOldest, 1 / epsYears)) - 1) * 100).toFixed(1)
    : null;
  const epsCagr = epsCagrRaw !== null && epsCagrRaw > 0 && epsCagrRaw < 50
    ? epsCagrRaw
    : revGrowth !== null && revGrowth > 0 ? Math.min(revGrowth, 20) : null;

  return {
    revVal, niVal, oiVal, fcfVal, assetsVal, equityVal, debtVal, cashVal, gpVal, rdVal,
    cogsVal, sgaVal, ebtVal, taxVal, interestVal, sharesBasicVal, sharesDilutedVal,
    currentAssetsVal, currentLiabilitiesVal, totalLiabilitiesVal, retainedEarningsVal,
    capexVal, inventoryVal, receivablesVal, payablesVal, sbcVal, daVal, dividendsPaidVal,
    investingCFVal, financingCFVal,
    dso, dio, dpo, ccc, inventoryTurnover, opMargin, netMargin, grossMargin, revGrowth,
    roe, roa, roic, debtToEquity, netDebt, marginHistory, shareDilution, epsHistory, epsCagr,
  };
}

// Full fundamentals for tickers not covered by SEC EDGAR (non-US filers), sourced from
// Foreign private issuers (Novo Nordisk, Shell, etc.) file statements in their home
// currency while their US-listed shares trade in USD — Yahoo tags the statement currency
// via financialData.financialCurrency, separate from the quote currency. Left unconverted,
// e.g. NVO's DKK-denominated FCF gets divided by USD share count in the DCF, inflating
// fair value ~6-7x (observed: $801 "fair value" vs a $49 quote). No crumb needed, same
// unauthenticated chart endpoint as fetchYahooQuote.
async function fetchFxRate(from, to) {
  if (!from || !to || from === to) return 1;
  try {
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${from}${to}=X`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    const data = await res.json();
    const rate = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
    return typeof rate === 'number' && rate > 0 ? rate : 1;
  } catch {
    return 1;
  }
}

// Yahoo Finance's quoteSummary + fundamentals-timeseries endpoints (unofficial, needs the
// crumb/cookie above). Returns null if Yahoo has no usable financial statement data at all,
// so the caller can fall back to a price-only quote.
async function fetchYahooFundamentals(ticker) {
  try {
    const auth = await getYahooAuth();
    const headers = { 'User-Agent': 'Mozilla/5.0', Cookie: auth.cookie };
    const now = Math.floor(Date.now() / 1000);
    const tenYearsAgo = now - 10 * 365 * 24 * 3600;

    const [qsRes, tsRes] = await Promise.all([
      fetch(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=assetProfile,summaryDetail,defaultKeyStatistics,financialData,balanceSheetHistory,cashFlowStatementHistory&crumb=${encodeURIComponent(auth.crumb)}`, { headers }),
      fetch(`https://query2.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${ticker}?symbol=${ticker}&type=${YAHOO_TS_TYPES}&period1=${tenYearsAgo}&period2=${now}&crumb=${encodeURIComponent(auth.crumb)}`, { headers }),
    ]);

    const qs = await qsRes.json();
    const ts = await tsRes.json();
    const r = qs?.quoteSummary?.result?.[0];
    if (!r) return null;

    const profile = r.assetProfile || {};
    const summary = r.summaryDetail || {};
    const keyStats = r.defaultKeyStatistics || {};
    const fin = r.financialData || {};
    const num = (m) => (m && m.raw != null ? m.raw : null);

    // financialData.financialCurrency is the statement currency (e.g. DKK for Novo Nordisk);
    // summaryDetail.currency is the quote/share currency (USD for the NYSE-listed ADR). See
    // fetchFxRate above for why these can diverge and what happens if left unconverted.
    const financialCurrency = fin.financialCurrency || null;
    const quoteCurrency = (summary.currency === 'GBp' ? 'GBP' : summary.currency) || null;
    const fx = await fetchFxRate(financialCurrency, quoteCurrency);

    // Helper: convert Yahoo balanceSheetHistory / cashFlowStatementHistory entries to
    // the same { year, val } shape used by tsSeries(), as a fallback when the
    // fundamentals-timeseries endpoint has no data for this ticker (common for ADRs).
    const bsStatements = (r.balanceSheetHistory?.balanceSheetStatements || [])
      .filter(s => s.endDate?.raw)
      .sort((a, b) => a.endDate.raw - b.endDate.raw)
      .slice(-6);
    const cfStatements = (r.cashFlowStatementHistory?.cashflowStatements || [])
      .filter(s => s.endDate?.raw)
      .sort((a, b) => a.endDate.raw - b.endDate.raw)
      .slice(-6);

    const bsSeries = (key) => bsStatements
      .filter(s => s[key]?.raw != null)
      .map(s => ({ year: new Date(s.endDate.raw * 1000).getFullYear().toString(), val: s[key].raw }));
    const cfSeries = (key) => cfStatements
      .filter(s => s[key]?.raw != null)
      .map(s => ({ year: new Date(s.endDate.raw * 1000).getFullYear().toString(), val: s[key].raw }));

    // True free cash flow (OCF - capex), not operating cash flow alone. Prefer Yahoo's own
    // annualFreeCashFlow when it's populated; otherwise join OCF and capex by year via
    // ocfMinusCapex; only fall all the way back to raw OCF (still technically mislabeled, but
    // better than nothing) when capex data isn't available at all for this ticker. Previously
    // this field defaulted straight to annualOperatingCashFlow with capex never subtracted —
    // every DCF valuation (which discounts this number directly) was discounting operating
    // cash flow, overstating true free cash flow by the full capex spend every single year.
    const capexSeries = tsSeries(ts, 'annualCapitalExpenditure').length ? tsSeries(ts, 'annualCapitalExpenditure') : cfSeries('capitalExpenditures');
    const ocfSeries = tsSeries(ts, 'annualOperatingCashFlow');
    const fcfDirect = tsSeries(ts, 'annualFreeCashFlow');
    const fcfDerived = ocfMinusCapex(ocfSeries, capexSeries);

    const histories = {
      revHistory: tsSeries(ts, 'annualTotalRevenue'),
      niHistory: tsSeries(ts, 'annualNetIncomeCommonStockholders', 'annualNetIncome'),
      oiHistory: tsSeries(ts, 'annualOperatingIncome'),
      fcfHistory: fcfDirect.length ? fcfDirect : (fcfDerived.length ? fcfDerived : ocfSeries),
      // Genuine operating cash flow, kept separate from fcfHistory above — the Financials tab's
      // "Operating Cash Flow" row displays this, and it should never silently become free cash
      // flow (or vice versa) just because one of them happened to be easier to source.
      ocfHistory: ocfSeries,
      assetsHistory: tsSeries(ts, 'annualTotalAssets').length ? tsSeries(ts, 'annualTotalAssets') : bsSeries('totalAssets'),
      equityHistory: tsSeries(ts, 'annualStockholdersEquity').length ? tsSeries(ts, 'annualStockholdersEquity') : bsSeries('totalStockholderEquity'),
      debtHistory: tsSeries(ts, 'annualTotalDebt', 'annualLongTermDebt').length ? tsSeries(ts, 'annualTotalDebt', 'annualLongTermDebt') : bsSeries('longTermDebt'),
      cashHistory: tsSeries(ts, 'annualCashAndCashEquivalents').length ? tsSeries(ts, 'annualCashAndCashEquivalents') : bsSeries('cash'),
      gpHistory: tsSeries(ts, 'annualGrossProfit'),
      rdHistory: tsSeries(ts, 'annualResearchAndDevelopment'),
      cogsHistory: tsSeries(ts, 'annualCostOfRevenue'),
      sgaHistory: tsSeries(ts, 'annualSellingGeneralAndAdministration'),
      ebtHistory: tsSeries(ts, 'annualPretaxIncome'),
      taxHistory: tsSeries(ts, 'annualTaxProvision'),
      interestHistory: tsSeries(ts, 'annualInterestExpense'),
      sharesHistory: tsSeries(ts, 'annualDilutedAverageShares', 'annualBasicAverageShares'),
      sharesBasicHistory: tsSeries(ts, 'annualBasicAverageShares'),
      sharesDilutedHistory: tsSeries(ts, 'annualDilutedAverageShares'),
      capexHistory: capexSeries,
      investingCFHistory: tsSeries(ts, 'annualInvestingCashFlow').length ? tsSeries(ts, 'annualInvestingCashFlow') : cfSeries('totalCashFromInvestingActivities'),
      financingCFHistory: tsSeries(ts, 'annualFinancingCashFlow').length ? tsSeries(ts, 'annualFinancingCashFlow') : cfSeries('totalCashFlowsFromFinancingActivities'),
      currentAssetsHistory: tsSeries(ts, 'annualCurrentAssets').length ? tsSeries(ts, 'annualCurrentAssets') : bsSeries('totalCurrentAssets'),
      currentLiabilitiesHistory: tsSeries(ts, 'annualCurrentLiabilities').length ? tsSeries(ts, 'annualCurrentLiabilities') : bsSeries('totalCurrentLiabilities'),
      totalLiabilitiesHistory: tsSeries(ts, 'annualTotalLiabilitiesNetMinorityInterest').length ? tsSeries(ts, 'annualTotalLiabilitiesNetMinorityInterest') : bsSeries('totalLiab'),
      inventoryHistory: tsSeries(ts, 'annualInventory').length ? tsSeries(ts, 'annualInventory') : bsSeries('inventory'),
      receivablesHistory: tsSeries(ts, 'annualAccountsReceivable').length ? tsSeries(ts, 'annualAccountsReceivable') : bsSeries('netReceivables'),
      payablesHistory: tsSeries(ts, 'annualAccountsPayable').length ? tsSeries(ts, 'annualAccountsPayable') : bsSeries('accountsPayable'),
      sbcHistory: tsSeries(ts, 'annualStockBasedCompensation').length ? tsSeries(ts, 'annualStockBasedCompensation') : cfSeries('issuanceOfStock'),
      daHistory: tsSeries(ts, 'annualDepreciationAndAmortization').length ? tsSeries(ts, 'annualDepreciationAndAmortization') : cfSeries('depreciation'),
      dividendsPaidHistory: tsSeries(ts, 'annualCommonStockDividendPaid').length ? tsSeries(ts, 'annualCommonStockDividendPaid') : cfSeries('dividendsPaid'),
      retainedEarningsHistory: tsSeries(ts, 'annualRetainedEarnings').length ? tsSeries(ts, 'annualRetainedEarnings') : bsSeries('retainedEarnings'),
      // Cash-flow-statement-signed (negative = cash used, i.e. working capital grew) — used
      // by computeReinvestmentGrowth in stockScoring.js. No balanceSheetHistory/cfStatements
      // fallback: deriving this from current-assets/liabilities deltas would double-count
      // cash and short-term debt that don't belong in a working-capital reinvestment figure.
      wcChangeHistory: tsSeries(ts, 'annualChangeInWorkingCapital'),
    };

    // Also fill FCF from operating CF - capex if the timeseries FCF is missing
    if (!histories.fcfHistory.length && cfStatements.length) {
      histories.fcfHistory = cfStatements
        .filter(s => s.totalCashFromOperatingActivities?.raw != null)
        .map(s => {
          const ocf = s.totalCashFromOperatingActivities.raw;
          const capex = s.capitalExpenditures?.raw ?? 0;
          return { year: new Date(s.endDate.raw * 1000).getFullYear().toString(), val: ocf + capex };
        });
    }
    if (!histories.ocfHistory.length && cfStatements.length) {
      histories.ocfHistory = cfSeries('totalCashFromOperatingActivities');
    }

    // For international tickers (e.g. Nokia ADR) where Yahoo's fundamentals-timeseries
    // has no data, synthesize single-point entries from the current-period values in
    // financialData / defaultKeyStatistics. Do this BEFORE the null-guard so tickers
    // that only have quoteSummary data still produce a usable result.
    const thisYear = new Date().getFullYear().toString();
    const fill1 = (history, val) => {
      if (history.length === 0 && val != null) return [{ year: thisYear, val }];
      return history;
    };
    histories.revHistory     = fill1(histories.revHistory,     num(fin.totalRevenue));
    histories.niHistory      = fill1(histories.niHistory,      num(fin.netIncomeToCommon) ?? num(keyStats.netIncomeToCommon));
    histories.gpHistory      = fill1(histories.gpHistory,      num(fin.grossProfits));
    histories.oiHistory      = fill1(histories.oiHistory,      num(fin.ebit));
    histories.fcfHistory     = fill1(histories.fcfHistory,     num(fin.freeCashflow));
    histories.debtHistory    = fill1(histories.debtHistory,    num(fin.totalDebt));
    histories.cashHistory    = fill1(histories.cashHistory,    num(fin.totalCash));

    // Convert every monetary (non-share-count) history from statement currency to quote
    // currency now, before anything downstream (WACC, DCF, per-share ratios) divides these
    // by USD-denominated shares/market cap. Must run before the book-value equity fallback
    // below, since bookValue/sharesOutstanding are already quote-currency and must not be
    // converted again.
    if (fx !== 1) {
      const MONETARY_HISTORY_KEYS = [
        'revHistory', 'niHistory', 'oiHistory', 'fcfHistory', 'assetsHistory', 'equityHistory',
        'debtHistory', 'cashHistory', 'gpHistory', 'rdHistory', 'cogsHistory', 'sgaHistory',
        'ebtHistory', 'taxHistory', 'interestHistory', 'capexHistory', 'investingCFHistory',
        'financingCFHistory', 'currentAssetsHistory', 'currentLiabilitiesHistory',
        'totalLiabilitiesHistory', 'inventoryHistory', 'receivablesHistory', 'payablesHistory',
        'sbcHistory', 'daHistory', 'dividendsPaidHistory', 'retainedEarningsHistory', 'wcChangeHistory',
      ];
      for (const key of MONETARY_HISTORY_KEYS) {
        histories[key] = histories[key].map(pt => ({ ...pt, val: pt.val * fx }));
      }
    }

    // Equity: derive from book value per share × shares outstanding when history is empty
    if (histories.equityHistory.length === 0) {
      const bvps = num(keyStats.bookValue);
      const shs  = num(keyStats.sharesOutstanding);
      if (bvps != null && shs != null) histories.equityHistory = [{ year: thisYear, val: bvps * shs }];
    }

    if (histories.revHistory.length === 0 && histories.niHistory.length === 0) return null;

    const d = computeDerivedFinancials(histories);

    let currentPrice = num(fin.currentPrice) ?? num(summary.regularMarketPreviousClose) ?? null;
    const sharesOutstanding = num(keyStats.sharesOutstanding);
    if (summary.currency === 'GBp' && currentPrice != null) {
      currentPrice /= 100;
    }
    const marketCap = num(summary.marketCap) ?? (sharesOutstanding && currentPrice ? currentPrice * sharesOutstanding : null);
    const debtToEquity = num(fin.debtToEquity) != null ? +(num(fin.debtToEquity) / 100).toFixed(2) : d.debtToEquity;

    let high52 = num(summary.fiftyTwoWeekHigh) ?? null;
    let low52 = num(summary.fiftyTwoWeekLow) ?? null;
    let analystTarget = num(fin.targetMeanPrice) ?? null;
    if (summary.currency === 'GBp') {
      if (high52 != null) high52 /= 100;
      if (low52 != null) low52 /= 100;
      if (analystTarget != null) analystTarget /= 100;
    }

    return {
      sector: profile.sector || null,
      industry: profile.industry || null,
      description: profile.longBusinessSummary || null,
      employees: profile.fullTimeEmployees || null,
      weburl: profile.website || null,
      cik: null,

      revVal: d.revVal, niVal: d.niVal, oiVal: d.oiVal, fcfVal: d.fcfVal,
      assetsVal: d.assetsVal, equityVal: d.equityVal, debtVal: d.debtVal, cashVal: d.cashVal,
      sharesVal: histories.sharesHistory.length ? histories.sharesHistory[histories.sharesHistory.length - 1].val : null,
      rdVal: d.rdVal, cogsVal: d.cogsVal, sgaVal: d.sgaVal, ebtVal: d.ebtVal, taxVal: d.taxVal,
      interestVal: d.interestVal, sharesBasicVal: d.sharesBasicVal, sharesDilutedVal: d.sharesDilutedVal,
      currentAssetsVal: d.currentAssetsVal, currentLiabilitiesVal: d.currentLiabilitiesVal,
      totalLiabilitiesVal: d.totalLiabilitiesVal, retainedEarningsVal: d.retainedEarningsVal,
      capexVal: d.capexVal, investingCFVal: d.investingCFVal, financingCFVal: d.financingCFVal,
      inventoryVal: d.inventoryVal, receivablesVal: d.receivablesVal, payablesVal: d.payablesVal,
      sbcVal: d.sbcVal, dividendsPaidVal: d.dividendsPaidVal, daVal: d.daVal,
      dso: d.dso, dio: d.dio, dpo: d.dpo, ccc: d.ccc, inventoryTurnover: d.inventoryTurnover,

      opMargin: d.opMargin ?? (num(fin.operatingMargins) != null ? +(num(fin.operatingMargins) * 100).toFixed(1) : null),
      netMargin: d.netMargin ?? (num(fin.profitMargins) != null ? +(num(fin.profitMargins) * 100).toFixed(1) : null),
      grossMargin: d.grossMargin ?? (num(fin.grossMargins) != null ? +(num(fin.grossMargins) * 100).toFixed(1) : null),
      revGrowth: d.revGrowth ?? (num(fin.revenueGrowth) != null ? +(num(fin.revenueGrowth) * 100).toFixed(1) : null),
      roe: d.roe ?? (num(fin.returnOnEquity) != null ? +(num(fin.returnOnEquity) * 100).toFixed(1) : null),
      roa: d.roa ?? (num(fin.returnOnAssets) != null ? +(num(fin.returnOnAssets) * 100).toFixed(1) : null),
      roic: d.roic,
      debtToEquity,

      revHistory: histories.revHistory, niHistory: histories.niHistory,
      fcfHistory: histories.fcfHistory, oiHistory: histories.oiHistory,
      sharesHistory: histories.sharesHistory, gpHistory: histories.gpHistory,
      marginHistory: d.marginHistory, shareDilution: d.shareDilution,
      cogsHistory: histories.cogsHistory, sgaHistory: histories.sgaHistory,
      rdHistory: histories.rdHistory, ebtHistory: histories.ebtHistory, taxHistory: histories.taxHistory,
      sharesBasicHistory: histories.sharesBasicHistory, sharesDilutedHistory: histories.sharesDilutedHistory,
      currentAssetsHistory: histories.currentAssetsHistory,
      currentLiabilitiesHistory: histories.currentLiabilitiesHistory,
      totalLiabilitiesHistory: histories.totalLiabilitiesHistory,
      capexHistory: histories.capexHistory, operatingCFHistory: histories.ocfHistory,
      investingCFHistory: histories.investingCFHistory, financingCFHistory: histories.financingCFHistory,
      daHistory: histories.daHistory, debtHistory: histories.debtHistory,
      equityHistory: histories.equityHistory, wcChangeHistory: histories.wcChangeHistory,
      epsCagr: d.epsCagr, epsHistory: d.epsHistory,

      eps: num(keyStats.trailingEps) ?? null,
      pe: num(summary.trailingPE) ?? null,
      forwardPE: num(summary.forwardPE) ?? num(keyStats.forwardPE) ?? null,
      marketCap,
      pfcf: marketCap && d.fcfVal && d.fcfVal > 0 ? +(marketCap / d.fcfVal).toFixed(1) : null,
      fcfYield: marketCap && d.fcfVal ? +((d.fcfVal / marketCap) * 100).toFixed(2) : null,
      high52,
      low52,
      beta: num(keyStats.beta) ?? num(summary.beta) ?? null,
      sharesOutstanding,
      dividendYield: num(summary.dividendYield) != null ? +(num(summary.dividendYield) * 100).toFixed(2) : null,
      netDebt: d.netDebt,
      evEbitda: num(keyStats.enterpriseToEbitda) ?? null,
      priceToBook: num(keyStats.priceToBook) ?? null,
      analystTarget,
      operatingCFVal: histories.ocfHistory.length ? histories.ocfHistory[histories.ocfHistory.length - 1].val : null,
    };
  } catch (e) {
    return null;
  }
}

async function fetchDescription(ticker) {
  if (!AV_KEY) return null;
  try {
    // Deliberately uncached: our Supabase-level stock_cache already re-attempts this on
    // every request where description is missing, so Next's fetch cache only adds risk —
    // if a rate-limited AV response (no Description field, still HTTP 200) ever got cached
    // here, it would silently poison this ticker's description for a full day.
    const res = await fetch(
      `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${ticker}&apikey=${AV_KEY}`,
      { cache: 'no-store' }
    );
    const d = await res.json();
    return d.Description && d.Description !== 'None' ? d.Description : null;
  } catch { return null; }
}

// 10-year Treasury yield, used as the risk-free rate in the WACC/DCF model. Same value
// for every ticker, so unlike fetchDescription this is safe (good, even) to let Next
// cache — an hour-stale risk-free rate doesn't meaningfully change a WACC estimate.
async function fetchRiskFreeRate() {
  try {
    const res = await fetch(
      'https://query1.finance.yahoo.com/v8/finance/chart/%5ETNX?interval=1d&range=5d',
      { headers: { 'User-Agent': 'Mozilla/5.0' }, next: { revalidate: 3600 } }
    );
    const data = await res.json();
    const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
    return price != null ? price / 100 : 0.045;
  } catch {
    return 0.045;
  }
}

function normalizeStockData(data) {
  if (!data) return data;
  if (data.equityVal != null && (data.debtToEquity == null || data.debtVal == null)) {
    const debtVal = data.debtVal ?? 0;
    const debtToEquity = data.debtToEquity ?? +(debtVal / data.equityVal).toFixed(2);
    const netDebt = (debtVal ?? 0) - (data.cashVal ?? 0);
    return { ...data, debtVal, debtToEquity, netDebt };
  }
  return data;
}

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get('ticker')?.toUpperCase();

  if (!ticker) {
    return Response.json({ error: 'Ticker requerido' }, { status: 400 });
  }

  const riskFreeRate = await fetchRiskFreeRate();

  // Set from the cache read below and reused by every fetch/upsert branch further down —
  // without this, refetching a ticker that /api/etfs previously marked isEtf:true (e.g. once
  // its 24h cache goes stale) silently drops that flag, since none of the Yahoo-fallback
  // branches below know a ticker is a fund on their own. That flip is what put VUAG.L in the
  // "STOCKS" bucket in search despite /api/etfs having correctly seeded it as an ETF.
  let cachedIsEtf = false;

  try {
    const { data: cached } = await supabase
      .from('stock_cache')
      .select('data, updated_at')
      .eq('ticker', ticker)
      .single();

    cachedIsEtf = cached?.data?.isEtf === true;

    const forceRefresh = searchParams.get('refresh') === 'true';
    if (cached && !forceRefresh) {
      const hoursOld = (Date.now() - new Date(cached.updated_at).getTime()) / (1000 * 60 * 60);
      // description alone isn't a strong enough signal that this snapshot is complete — a
      // request where Finnhub's profile/metric calls partially failed (rate limit, timeout)
      // still has a description (that comes from a separate source) but marketCap, beta,
      // sector and the 52-week range all silently end up null, and used to get cached and
      // served as-is for the full CACHE_HOURS window (verified against real data: DECK sat
      // cached for hours with marketCap/beta/sector/52w all null while description was fine).
      // marketCap is the cheapest reliable proxy for "did that call actually succeed."
      // marketCap/description alone still isn't enough — they come from Finnhub, which is
      // independent of the SEC EDGAR fetch that supplies fcfVal/debtVal/revVal/etc. A snapshot
      // where SEC EDGAR timed out or returned no usable tags for this filer still passes the
      // marketCap check and got cached with every financial field null, showing N/A on every
      // subsequent open for the full CACHE_HOURS window. Require a minimum number of the core
      // financial fields to be populated too, so a partial failure falls through to a re-fetch
      // instead of being trusted as a complete snapshot.
      const KEY_FIN_FIELDS = ['revVal', 'niVal', 'fcfVal', 'assetsVal', 'debtVal', 'cashVal'];
      const normData = normalizeStockData(cached.data);
      const validFinCount = KEY_FIN_FIELDS.filter(f => normData?.[f] != null).length;
      // A cache row written by app/api/etfs/route.js (expense ratio, holdings, AUM — no
      // marketCap or SEC-style financials at all) used to fail every check below: no
      // revVal/niVal/etc. (validFinCount stays 0) and no marketCap, so it was never
      // considered "complete" and got silently overwritten with company-fundamentals-shaped
      // data on every view here, destroying isEtf/holdings/expenseRatio for good (verified:
      // GET-ing this route for an ETF ticker made it vanish from /api/etfs's list). The
      // `data->>isEtf` flag is the reliable signal that this row's shape isn't meant to have
      // those company fields in the first place.
      const isEtf = cached.data?.isEtf === true || cached.data?.sector === 'ETF' || cached.data?.industry === 'ETF';
      // Rows written before insiderOwnershipPct existed (lib/secInsiders.js) don't have the key
      // at all — distinct from a row that computed it and got null because no Form 4 ownership
      // signal was found, which does have the key (with value null). This used to force
      // `isComplete = false`, sending every pre-existing cached ticker down the full
      // Finnhub+SEC EDGAR refetch pipeline (not just the Form4 call) on its first view after
      // this field shipped — with screener/watchlist/portfolio pages loading dozens of tickers
      // in parallel, that fanned out into a simultaneous burst against SEC EDGAR's shared
      // ~10 req/sec limit (see getSecTickerMap's comment above for what that does: an HTML
      // "Request Rate Threshold Exceeded" page instead of JSON, crashing the request) and blew
      // through Finnhub's rate limit at the same time — which is what was taking the stock page
      // down. Backfilling this one field is not worth re-running the whole pipeline for, so it
      // no longer gates isComplete; missing rows get it filled in the background instead (below).
      const missingInsiderData = cached.data?.cik != null && !('insiderOwnershipPct' in (cached.data || {}));
      const isComplete = validFinCount >= 2 || isEtf;
      if (hoursOld < CACHE_HOURS && (cached.data?.marketCap != null || isEtf) && isComplete) {
        if (missingInsiderData) backfillInsiderOwnership(cached.data.cik, ticker, cached.data.sharesOutstanding);
        const minsOld = hoursOld * 60;
        if (minsOld < 2) {
          return Response.json({ ...normData, cached: true });
        } else {
          // Cache is valid for heavy financials, but update the stock price in real-time
          try {
            let freshPriceData = null;
            if (ticker.includes('.')) {
              freshPriceData = await fetchYahooQuote(ticker).catch(() => null);
            } else {
              const fhRes = await fetch(`https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${FH_KEY}`);
              if (fhRes.ok) {
                const fh = await fhRes.json();
                if (fh.c != null) {
                  freshPriceData = {
                    currentPrice: fh.c,
                    priceChange: fh.d || null,
                    priceChangePct: fh.dp || null,
                    prevClose: fh.pc || null
                  };
                }
              }
            }
            if (freshPriceData && freshPriceData.currentPrice != null) {
              const updatedData = normalizeStockData({
                ...cached.data,
                currentPrice: freshPriceData.currentPrice,
                priceChange: freshPriceData.priceChange,
                priceChangePct: freshPriceData.priceChangePct,
                prevClose: freshPriceData.prevClose
              });
              // Update DB cache in background asynchronously
              supabase
                .from('stock_cache')
                .upsert({ ticker, data: updatedData, updated_at: new Date().toISOString() })
                .then(() => {})
                .catch(() => {});
              return Response.json({ ...updatedData, cached: true, priceUpdated: true });
            }
          } catch (err) {
            console.error('Error doing fast price update:', err);
          }
          return Response.json({ ...normData, cached: true });
        }
      }
    }
  } catch (e) {}

  try {
    const tickerMap = await getSecTickerMap();
    const company = tickerMap?.get(ticker) ?? null;

    if (!company && ticker.includes('.')) {
      // International ticker with an exchange suffix (e.g. LLOY.L) — our Finnhub plan
      // doesn't cover non-US exchanges, so source price from Yahoo's chart endpoint and,
      // when available, full financials from Yahoo's quoteSummary/timeseries endpoints.
      const [yh, fundamentals] = await Promise.all([
        fetchYahooQuote(ticker).catch(() => null),
        fetchYahooFundamentals(ticker).catch(() => null),
      ]);
      if (!yh) return Response.json({ error: 'Ticker no encontrado' }, { status: 404 });

      const empty = {
        cik: null, sector: null, industry: null, description: null,
        marketCap: null, eps: null, pe: null, forwardPE: null, beta: null,
        sharesOutstanding: null, dividendYield: null,
        grossMargin: null, opMargin: null, netMargin: null,
        roe: null, roa: null, roic: null,
        revGrowth: null, debtToEquity: null,
        revVal: null, niVal: null, oiVal: null, fcfVal: null,
        assetsVal: null, equityVal: null, debtVal: null, cashVal: null,
        netDebt: null, pfcf: null, fcfYield: null,
        revHistory: [], niHistory: [], fcfHistory: [], oiHistory: [],
        marginHistory: [], sharesHistory: [], gpHistory: [],
        cogsHistory: [], sgaHistory: [], rdHistory: [], ebtHistory: [],
        taxHistory: [], sharesBasicHistory: [], sharesDilutedHistory: [],
        capexHistory: [], operatingCFHistory: [], investingCFHistory: [], financingCFHistory: [],
        epsCagr: null, epsHistory: [], analystTarget: null,
        evEbitda: null, priceToBook: null,
      };

      const result = {
        riskFreeRate,
        ...empty,
        ...(fundamentals || {}),
        name: yh.name,
        ticker,
        exchange: yh.exchange,
        description: fundamentals?.description || null,
        currentPrice: yh.currentPrice,
        priceChange: yh.priceChange,
        priceChangePct: yh.priceChangePct,
        prevClose: yh.prevClose,
        high52: fundamentals?.high52 ?? yh.high52,
        low52: fundamentals?.low52 ?? yh.low52,
        currency: yh.currency,
        finnhubFallback: !fundamentals,
        internationalSource: 'yahoo',
        isEtf: cachedIsEtf,
      };

      try {
        await supabase.from('stock_cache').upsert({ ticker, data: result, updated_at: new Date().toISOString() });
      } catch (e) {}

      return Response.json(result);
    }

    let hasSecFacts = false;
    let facts = null;
    let cik = null;

    if (company) {
      cik = String(company.cik_str).padStart(10, '0');
      try {
        const factsRes = await fetch(
          `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`,
          { headers: { 'User-Agent': 'DueDiligenceApp contact@example.com' } }
        );
        if (factsRes.ok) {
          facts = await factsRes.json();
          // Foreign private issuers (e.g. Nokia) file under the 'ifrs-full' taxonomy
          // instead of 'us-gaap' — every getMetric() call below only reads us-gaap tags,
          // so a facts blob with no us-gaap data would otherwise pass this check and
          // silently return an object full of nulls instead of falling through to Finnhub.
          if (facts?.facts?.['us-gaap'] && Object.keys(facts.facts['us-gaap']).length > 0) {
            hasSecFacts = true;
          }
        }
      } catch (err) {
        console.warn(`Failed to fetch SEC facts for CIK ${cik}, falling back to Finnhub/Yahoo:`, err);
      }
    }

    if (!company || !hasSecFacts) {
      // Fallback for stocks not covered by SEC EDGAR (non-US filers, IFRS reporters, etc.).
      // Fetch Finnhub and Yahoo fundamentals in parallel so we can combine the best of each:
      // Finnhub for price/profile/TTM metrics, Yahoo for full financial-statement history.
      const safeFinnhubJson = (res) => res.ok ? res.json().catch(() => ({})) : Promise.resolve({});
      const [fhRes, fhBasicRes, fhProfileRes, yhFundamentals] = await Promise.all([
        fetch(`https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${FH_KEY}`).catch(() => null),
        fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${ticker}&metric=all&token=${FH_KEY}`).catch(() => null),
        fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${ticker}&token=${FH_KEY}`).catch(() => null),
        fetchYahooFundamentals(ticker).catch(() => null),
      ]);

      const fh = fhRes ? await safeFinnhubJson(fhRes) : {};
      const fhBasic = fhBasicRes ? await safeFinnhubJson(fhBasicRes) : {};
      const fhProfile = fhProfileRes ? await safeFinnhubJson(fhProfileRes) : {};

      if (!fhProfile.name) {
        // Finnhub's profile2 is company-oriented and often comes back empty for ETFs/funds
        // and international names without a US listing — try Yahoo (price always, full
        // financials when Yahoo has statement data) before giving up.
        const [yh, fundamentals] = await Promise.all([
          fetchYahooQuote(ticker).catch(() => null),
          fetchYahooFundamentals(ticker).catch(() => null),
        ]);
        if (!yh) return Response.json({ error: 'Ticker no encontrado' }, { status: 404 });

        const empty = {
          cik: null, sector: null, industry: null, description: null,
          marketCap: null, eps: null, pe: null, forwardPE: null, beta: null,
          sharesOutstanding: null, dividendYield: null,
          grossMargin: null, opMargin: null, netMargin: null, roe: null, roa: null, roic: null,
          revGrowth: null, debtToEquity: null,
          revVal: null, niVal: null, oiVal: null, fcfVal: null,
          assetsVal: null, equityVal: null, debtVal: null, cashVal: null,
          netDebt: null, pfcf: null, fcfYield: null,
          revHistory: [], niHistory: [], fcfHistory: [], oiHistory: [],
          marginHistory: [], sharesHistory: [], gpHistory: [],
          cogsHistory: [], sgaHistory: [], rdHistory: [], ebtHistory: [],
          taxHistory: [], sharesBasicHistory: [], sharesDilutedHistory: [],
          capexHistory: [], operatingCFHistory: [], investingCFHistory: [], financingCFHistory: [],
          epsCagr: null, epsHistory: [], analystTarget: null,
          evEbitda: null, priceToBook: null,
        };

        const yhResult = {
          riskFreeRate,
          ...empty,
          ...(fundamentals || {}),
          name: yh.name,
          ticker,
          exchange: yh.exchange,
          description: fundamentals?.description || null,
          currentPrice: yh.currentPrice,
          priceChange: yh.priceChange,
          priceChangePct: yh.priceChangePct,
          prevClose: yh.prevClose,
          high52: fundamentals?.high52 ?? yh.high52,
          low52: fundamentals?.low52 ?? yh.low52,
          currency: yh.currency,
          finnhubFallback: !fundamentals,
          internationalSource: 'yahoo',
          isEtf: cachedIsEtf,
        };

        try {
          await supabase.from('stock_cache').upsert({ ticker, data: yhResult, updated_at: new Date().toISOString() });
        } catch (e) {}

        return Response.json(yhResult);
      }

      const m = fhBasic?.metric || {};
      const currentPrice = fh.c || null;
      // /stock/metric's sharesOutstanding is occasionally missing (verified against real data:
      // NOK) even when /stock/profile2's shareOutstanding is populated — the latter is a plain
      // share count with no currency exposure, safe to use regardless of which listing profile2
      // resolves to (unlike marketCapitalization below, which is denominated in whatever
      // currency that listing trades in).
      const sharesOutstanding = (m.sharesOutstanding ? m.sharesOutstanding * 1e6 : null)
        ?? (fhProfile.shareOutstanding ? fhProfile.shareOutstanding * 1e6 : null);
      // fhProfile can resolve to a foreign primary listing (e.g. ticker NVO -> Novo Nordisk's
      // Copenhagen listing, profile2 returns "currency":"DKK") even though /quote above
      // correctly returns the USD ADR price — mixing the two overstates market cap by the FX
      // rate. Only trust Finnhub's figure when its own profile currency matches the USD quote;
      // otherwise fall through to Yahoo's currency-normalized market cap below.
      const marketCap = fhProfile.marketCapitalization && (!fhProfile.currency || fhProfile.currency === 'USD')
        ? fhProfile.marketCapitalization * 1e6
        : null;
      const eps = m.epsAnnual || m.epsTTM || null;
      const pe = eps && currentPrice ? +(currentPrice / eps).toFixed(2) : null;

      // Prefer Yahoo's full financial-statement history for the dollar amounts and charts;
      // Finnhub fills in TTM ratios and current-price fields that Yahoo may be missing.
      const yh = yhFundamentals;
      const result = {
        riskFreeRate,
        name: fhProfile.name || ticker,
        ticker,
        cik: null,
        sector: fhProfile.finnhubIndustry || yh?.sector || null,
        industry: fhProfile.finnhubIndustry || yh?.industry || null,
        exchange: fhProfile.exchange || null,
        description: yh?.description || fhProfile.description || await fetchDescription(ticker),
        currentPrice,
        priceChange: fh.d || null,
        priceChangePct: fh.dp || null,
        prevClose: fh.pc || null,
        // Last-resort fallback: currentPrice × sharesOutstanding, both already USD-safe by this
        // point (verified against real data: NOK's Finnhub profile resolves to its Helsinki EUR
        // listing so the currency-matched marketCap above is null, and Yahoo's quoteSummary has
        // no marketCap for it either — this was the only path left to a usable number).
        marketCap: marketCap ?? yh?.marketCap ?? (currentPrice && sharesOutstanding ? currentPrice * sharesOutstanding : null),
        eps: eps ?? yh?.eps ?? null,
        pe: pe ?? yh?.pe ?? null,
        forwardPE: yh?.forwardPE ?? null,
        // Same Finnhub foreign-listing mismatch as marketCap above: /stock/metric's 52-week
        // range for NVO came back 224.25-464.6 against a $49.07 USD quote — Copenhagen DKK
        // range, not USD (Novo's actual USD 52-week range is far narrower). Gated on the same
        // profile-currency check since both Finnhub endpoints resolve the symbol the same way.
        high52: fhProfile.currency && fhProfile.currency !== 'USD' ? (yh?.high52 ?? null) : (m['52WeekHigh'] || yh?.high52 || null),
        low52: fhProfile.currency && fhProfile.currency !== 'USD' ? (yh?.low52 ?? null) : (m['52WeekLow'] || yh?.low52 || null),
        beta: m.beta || yh?.beta || null,
        sharesOutstanding: sharesOutstanding ?? yh?.sharesOutstanding ?? null,
        dividendYield: m.dividendYieldIndicatedAnnual || yh?.dividendYield || null,
        // Ratios: prefer Yahoo computed-from-statements, fall back to Finnhub TTM metrics.
        // Finnhub roeTTM/roaTTM/revenueGrowthTTMYoy are already percentage points.
        grossMargin: yh?.grossMargin ?? m.grossMarginTTM ?? null,
        opMargin: yh?.opMargin ?? m.operatingMarginTTM ?? null,
        netMargin: yh?.netMargin ?? m.netProfitMarginTTM ?? null,
        roe: yh?.roe ?? (m.roeTTM ? +m.roeTTM.toFixed(1) : null),
        roa: yh?.roa ?? (m.roaTTM ? +m.roaTTM.toFixed(1) : null),
        roic: yh?.roic ?? (m.roicTTM ? +m.roicTTM.toFixed(1) : null),
        revGrowth: yh?.revGrowth ?? (m.revenueGrowthTTMYoy ? +m.revenueGrowthTTMYoy.toFixed(1) : null),
        debtToEquity: yh?.debtToEquity ?? m.totalDebt_totalEquityAnnual ?? null,
        // Dollar amounts and history from Yahoo (or null if Yahoo had no statements).
        revVal: yh?.revVal ?? null, niVal: yh?.niVal ?? null,
        oiVal: yh?.oiVal ?? null, fcfVal: yh?.fcfVal ?? null,
        assetsVal: yh?.assetsVal ?? null, equityVal: yh?.equityVal ?? null,
        debtVal: yh?.debtVal ?? null, cashVal: yh?.cashVal ?? null,
        // The rest of fetchYahooFundamentals's computed scalars, same story as ebtVal/taxVal/
        // daVal above — dropped here even though the function already returns them, so
        // computeEasyMode's Quality-tab breakdown (R&D/Revenue, SBC/Revenue, Current Ratio)
        // silently showed "N/A" for every ticker on this path regardless of whether Yahoo
        // actually had the data.
        ebtVal: yh?.ebtVal ?? null, taxVal: yh?.taxVal ?? null, daVal: yh?.daVal ?? null,
        sharesVal: yh?.sharesVal ?? null, rdVal: yh?.rdVal ?? null,
        cogsVal: yh?.cogsVal ?? null, sgaVal: yh?.sgaVal ?? null, interestVal: yh?.interestVal ?? null,
        sharesBasicVal: yh?.sharesBasicVal ?? null, sharesDilutedVal: yh?.sharesDilutedVal ?? null,
        currentAssetsVal: yh?.currentAssetsVal ?? null, currentLiabilitiesVal: yh?.currentLiabilitiesVal ?? null,
        totalLiabilitiesVal: yh?.totalLiabilitiesVal ?? null, retainedEarningsVal: yh?.retainedEarningsVal ?? null,
        capexVal: yh?.capexVal ?? null, investingCFVal: yh?.investingCFVal ?? null, financingCFVal: yh?.financingCFVal ?? null,
        inventoryVal: yh?.inventoryVal ?? null, receivablesVal: yh?.receivablesVal ?? null, payablesVal: yh?.payablesVal ?? null,
        sbcVal: yh?.sbcVal ?? null, dividendsPaidVal: yh?.dividendsPaidVal ?? null,
        dso: yh?.dso ?? null, dio: yh?.dio ?? null, dpo: yh?.dpo ?? null, ccc: yh?.ccc ?? null,
        inventoryTurnover: yh?.inventoryTurnover ?? null, operatingCFVal: yh?.operatingCFVal ?? null,
        netDebt: yh?.netDebt ?? null,
        pfcf: yh?.pfcf ?? null, fcfYield: yh?.fcfYield ?? null,
        revHistory: yh?.revHistory ?? [], niHistory: yh?.niHistory ?? [],
        fcfHistory: yh?.fcfHistory ?? [], oiHistory: yh?.oiHistory ?? [],
        marginHistory: yh?.marginHistory ?? [], sharesHistory: yh?.sharesHistory ?? [],
        gpHistory: yh?.gpHistory ?? [],
        cogsHistory: yh?.cogsHistory ?? [], sgaHistory: yh?.sgaHistory ?? [],
        rdHistory: yh?.rdHistory ?? [], ebtHistory: yh?.ebtHistory ?? [],
        taxHistory: yh?.taxHistory ?? [],
        sharesBasicHistory: yh?.sharesBasicHistory ?? [],
        sharesDilutedHistory: yh?.sharesDilutedHistory ?? [],
        capexHistory: yh?.capexHistory ?? [],
        operatingCFHistory: yh?.operatingCFHistory ?? [],
        investingCFHistory: yh?.investingCFHistory ?? [],
        financingCFHistory: yh?.financingCFHistory ?? [],
        daHistory: yh?.daHistory ?? [], debtHistory: yh?.debtHistory ?? [],
        equityHistory: yh?.equityHistory ?? [], wcChangeHistory: yh?.wcChangeHistory ?? [],
        epsCagr: yh?.epsCagr ?? null, epsHistory: yh?.epsHistory ?? [],
        analystTarget: yh?.analystTarget ?? null,
        evEbitda: yh?.evEbitda ?? null, priceToBook: yh?.priceToBook ?? null,
        finnhubFallback: true,
        yahooFundamentals: !!yh,
      };

      result.isEtf = cachedIsEtf;
      const valCountFallback = [result.revVal, result.niVal, result.fcfVal, result.assetsVal, result.debtVal, result.cashVal].filter(v => v !== null).length;
      const isEtfFallback = result.sector === 'ETF' || result.industry === 'ETF';
      if (valCountFallback >= 2 || (isEtfFallback && result.currentPrice != null)) {
        try {
          await supabase.from('stock_cache').upsert({ ticker, data: result, updated_at: new Date().toISOString() });
        } catch (e) {}
      }

      return Response.json(result);
    }

    const usgaap = facts.facts?.['us-gaap'] || {};

    // How current this filer's most recent 10-K actually is, independent of getMetric() below
    // (computed directly off NetIncomeLoss/Assets, not through it, to avoid a chicken-and-egg
    // dependency) — NetIncomeLoss is about as close to universally-reported as an XBRL concept
    // gets, so its newest period end is a reliable proxy for "how current is this company's
    // filing history," used to reject stale matches in getMetric.
    function newestFyEnd(tag) {
      const units = usgaap[tag]?.units?.USD;
      if (!units) return null;
      const annual = units.filter(u => ['10-K', '20-F', '10-K/A', '20-F/A'].includes(u.form)).sort((a, b) => b.end.localeCompare(a.end));
      return annual[0]?.end ?? null;
    }
    const recencyAnchor = newestFyEnd('NetIncomeLoss') || newestFyEnd('Assets');

    const getMetric = (keys, isFlow = true) => {
      for (const key of keys) {
        const metric = usgaap[key];
        if (!metric) continue;
        const units = metric.units?.USD || metric.units?.EUR || metric.units?.shares || metric.units?.pure;
        if (!units) continue;
        const annual = units.filter(u => {
          const isForm = ['10-K', '20-F', '10-K/A', '20-F/A'].includes(u.form);
          if (!isForm) return false;
          if (isFlow && u.start && u.end) {
            const days = (new Date(u.end) - new Date(u.start)) / (1000 * 60 * 60 * 24);
            if (days < 300 && u.fp !== 'FY') return false;
          }
          return true;
        }).sort((a, b) => b.end.localeCompare(a.end));
        if (annual.length === 0) continue;
        // Reject a match whose newest period is a multi-year gap behind the freshest thing
        // this filer has ever reported — the signature of CIK reuse across a reverse merger,
        // where an old, unrelated predecessor business's figures (e.g. a defunct shell's
        // revenue tag) would otherwise look like a genuine, just-stale series for a company
        // that's still filing every year. Verified against real data: VRDN's 'Revenues' tag
        // matched 2013-2015 only (a pre-reverse-merger predecessor entity under the same CIK)
        // while NetIncomeLoss/OperatingIncomeLoss keep reporting every year through 2025 — that
        // mismatch fed a -6368% operating margin and a 1,243-day DPO into the Quality tab. Falls
        // through to the next key instead of returning stale data, same as "no data at all."
        if (recencyAnchor) {
          const gapYears = (new Date(recencyAnchor) - new Date(annual[0].end)) / (1000 * 60 * 60 * 24 * 365.25);
          if (gapYears > 3) continue;
        }
        return annual;
      }
      return null;
    };

    // Same key-preference lookup as getMetric, but keeps 10-Q periods too (still sorted
    // newest-end-first) — the raw material ttmVal below needs to roll a stale annual figure
    // forward.
    const getMetricAllPeriods = (keys) => {
      for (const key of keys) {
        const metric = usgaap[key];
        if (!metric) continue;
        const units = metric.units?.USD || metric.units?.EUR || metric.units?.shares || metric.units?.pure;
        if (!units) continue;
        const periods = units
          .filter(u => ['10-K', '20-F', '10-K/A', '20-F/A', '10-Q', '10-Q/A'].includes(u.form) && u.start && u.end)
          .sort((a, b) => b.end.localeCompare(a.end));
        if (periods.length > 0) return periods;
      }
      return null;
    };

    const daysBetween = (a, b) => Math.abs(new Date(a) - new Date(b)) / (1000 * 60 * 60 * 24);
    const oneYearBefore = (d) => { const nd = new Date(d); nd.setFullYear(nd.getFullYear() - 1); return nd; };

    // Trailing-twelve-month figure for a cash-flow-statement line item (operating cash flow,
    // capex, SBC): the latest full fiscal year (10-K) rolled forward by whatever 10-Q filings
    // have landed since, instead of freezing at the last annual report for up to a year.
    // Verified against real data: MU's FY2025 10-K (ended Aug 2025) reported $1.7B FCF, right
    // at the trough of the memory-price downcycle — getMetric alone kept every consumer of
    // fcfVal (relative-valuation fair value, DCF, P/FCF) anchored to that trough for months
    // after two blowout AI/HBM-driven quarters had already been reported, producing a ~96%
    // "downside" that was really a stale-denominator artifact, not a real valuation signal.
    // Cash-flow-statement lines are always YTD-cumulative in 10-Qs (an SEC presentation
    // requirement), so "this year's YTD minus the same period last year, plus the last full
    // FY" is a clean TTM delta — unlike income-statement lines, there's no discrete-vs-
    // cumulative ambiguity to resolve first. Falls back to the plain annual figure whenever a
    // newer interim period — or its prior-year comparative — can't be confidently matched
    // (fiscal-year change, thinly-tagged filer, etc.), so every filer without fresher 10-Q
    // data keeps the exact old behavior.
    const ttmVal = (keys) => {
      const periods = getMetricAllPeriods(keys);
      if (!periods || !periods.length) return null;
      const fy = periods.find(u => ['10-K', '20-F', '10-K/A', '20-F/A'].includes(u.form) && daysBetween(u.start, u.end) >= 300);
      if (!fy) return periods[0]?.val ?? null;

      const curYtd = periods
        .filter(u => u.form.startsWith('10-Q') && new Date(u.end) > new Date(fy.end) && daysBetween(u.start, u.end) < 300)
        .sort((a, b) => b.end.localeCompare(a.end))[0];
      if (!curYtd) return fy.val;

      const priorYtd = periods.find(u => u.form.startsWith('10-Q')
        && daysBetween(u.end, oneYearBefore(curYtd.end)) < 40
        && daysBetween(u.start, oneYearBefore(curYtd.start)) < 40);
      if (!priorYtd) return fy.val;

      return fy.val - priorYtd.val + curYtd.val;
    };

    const getEPS = () => {
      const keys = ['EarningsPerShareDiluted', 'EarningsPerShareBasic'];
      for (const key of keys) {
        const metric = usgaap[key];
        if (!metric) continue;
        const units = metric.units?.USD || metric.units?.pure || metric.units?.['USD/shares'];
        if (!units) continue;
        const annual = units.filter(u => (u.form === '10-K' || u.form === '20-F')).sort((a, b) => b.end.localeCompare(a.end));
        if (annual.length > 0) return annual[0].val;
      }
      return null;
    };

    const revenues      = getMetric(['RevenueFromContractWithCustomerExcludingAssessedTax','Revenues','SalesRevenueNet','RevenueFromContractWithCustomerIncludingAssessedTax']);
    const netIncomes    = getMetric(['NetIncomeLoss']);
    const operatingIncomes = getMetric(['OperatingIncomeLoss', 'IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest']);
    const cashFlows     = getMetric(['NetCashProvidedByUsedInOperatingActivities']);
    const assets        = getMetric(['Assets']);
    const equity        = getMetric([
      'StockholdersEquity',
      'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest',
      'PartnersCapital',
      'PartnersCapitalIncludingPortionAttributableToNoncontrollingInterest',
      'MembersEquity',
    ]);
    // LongTermDebt/LongTermDebtNoncurrent alone miss real, non-trivial debt balances filed
    // under a more specific concept — convertible notes (common for growth/tech issuers,
    // verified against real data: WIX), a combined current+noncurrent tag, or long-term
    // operating/finance lease liabilities. That last one matters a lot for retail-footprint
    // companies: ASC 842 (effective fiscal 2019) put operating leases on the balance sheet as
    // a liability, and Finviz-style D/E ratios count them as debt — verified against real
    // data: Deckers (near-zero conventional long-term debt, hundreds of UGG/HOKA store leases)
    // showed null here and 0.15 on Finviz before OperatingLeaseLiabilityNoncurrent was added.
    // Even with all of these, a genuinely lease-light, debt-free balance sheet can still
    // legitimately come back null — XBRL filers typically omit a concept entirely rather than
    // tag an explicit zero, so absence alone can't fully distinguish "no debt" from "wrong tag."
    const debt          = getMetric([
      'LongTermDebt','LongTermDebtNoncurrent','DebtLongtermAndShorttermCombinedAmount',
      'LongTermDebtAndCapitalLeaseObligations','ConvertibleNotesPayable','ConvertibleDebtNoncurrent',
      'ConvertibleLongTermNotesPayable','NotesPayableNoncurrent','SecuredDebtNoncurrent','UnsecuredDebtNoncurrent',
      'OperatingLeaseLiabilityNoncurrent','FinanceLeaseLiabilityNoncurrent',
    ]);
    // Cash runway (lib/stockScoring.js's cashRunwayYears/runwayScore) and the Balance Sheet's
    // "Cash" figure both need actual liquid firepower, not just the narrow "cash and cash
    // equivalents" line — many filers (biotechs especially) hold the bulk of their runway in
    // a separately-tagged short-term-investments line (T-bills, money-market funds) instead of
    // cash itself. Verified against real data: VRDN's CashAndCashEquivalentsAtCarryingValue was
    // $32.6M while their own reported cash+equivalents+short-term-investments was $875M — the
    // unpatched cashVal alone put Cash Runway at ~0.1y (39 days) instead of the real ~2.9y,
    // the single most alarming number on the page and wrong by ~27x. Only additive when a
    // filer tags cash and short-term investments separately (the common case) — when a filer
    // instead reports the two combined under CashCashEquivalentsAndShortTermInvestments,
    // shortTermInvestmentsByEnd has nothing to add on top of it, so behavior there is
    // unchanged.
    const cashNarrow = getMetric(['CashAndCashEquivalentsAtCarryingValue']);
    const cashCombined = getMetric(['CashCashEquivalentsAndShortTermInvestments']);
    const shortTermInvestments = getMetric(['ShortTermInvestments', 'MarketableSecuritiesCurrent', 'AvailableForSaleSecuritiesCurrent']);
    const shortTermInvestmentsByEnd = new Map((shortTermInvestments || []).map(u => [u.end, u.val]));
    const cash = cashNarrow
      ? cashNarrow.map(u => ({ ...u, val: u.val + (shortTermInvestmentsByEnd.get(u.end) ?? 0) }))
      : cashCombined;
    const shares        = getMetric(['CommonStockSharesOutstanding','WeightedAverageNumberOfSharesOutstandingBasic']);
    const grossProfit   = getMetric(['GrossProfit']);
    const rd            = getMetric(['ResearchAndDevelopmentExpense']);
    const cogs          = getMetric(['CostOfRevenue','CostOfGoodsAndServicesSold']);
    const sga           = getMetric(['SellingGeneralAndAdministrativeExpense','SellingAndMarketingExpense']);
    const ebt           = getMetric(['IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest']);
    const tax           = getMetric(['IncomeTaxExpenseBenefit']);
    const interestExp   = getMetric(['InterestExpense','InterestAndDebtExpense']);
    const sharesBasic   = getMetric(['WeightedAverageNumberOfSharesOutstandingBasic']);
    const sharesDiluted = getMetric(['WeightedAverageNumberOfDilutedSharesOutstanding']);
    const currentAssets = getMetric(['AssetsCurrent']);
    const currentLiabilities = getMetric(['LiabilitiesCurrent']);
    const totalLiabilities = getMetric(['Liabilities']);
    const retainedEarnings = getMetric(['RetainedEarningsAccumulatedDeficit']);
    // PaymentsToAcquireProductiveAssets is the tag department-store retailers (Kohl's, Macy's)
    // report capex under — without it, the getMetric() lookup below finds nothing for them, and
    // FCF silently defaults to 0 capex (see capexByEnd below), making FCF == raw operating cash
    // flow. That inflated FCF alone was enough to produce a >1900% "undervalued" DCF for KSS.
    const capex = getMetric(['PaymentsToAcquirePropertyPlantAndEquipment', 'CapitalExpenditureDiscontinuedOperations', 'PaymentsForProceedsFromProductiveAssets', 'PaymentsToAcquireProductiveAssets']);
    const inventory     = getMetric(['InventoryNet','InventoryGross']);
    const receivables   = getMetric(['AccountsReceivableNetCurrent','ReceivablesNetCurrent']);
    const payables      = getMetric(['AccountsPayableCurrent', 'AccountsPayable', 'AccountsPayableAndAccruedLiabilitiesCurrent']);
    const sbc           = getMetric(['ShareBasedCompensation','AllocatedShareBasedCompensationExpense']);
    const da            = getMetric(['DepreciationDepletionAndAmortization','DepreciationAndAmortization','Depreciation']);
    const dividendsPaid = getMetric(['PaymentsOfDividends','PaymentsOfDividendsCommonStock']);
    const investingActivities = getMetric(['NetCashProvidedByUsedInInvestingActivities']);
    const financingActivities = getMetric(['NetCashProvidedByUsedInFinancingActivities']);

    const latest = (arr) => arr?.[0]?.val ?? null;
    const prev   = (arr) => arr?.[1]?.val ?? null;
    const buildHistory = (arr, isShares = false) => {
  if (!arr) return [];
  const seen = new Set();
  const deduped = arr.filter(r => {
    const y = r.end.slice(0, 4);
    if (seen.has(y)) return false;
    seen.add(y);
    return true;
  });
  return deduped.slice(0, 6).reverse().map(r => {
    const val = isShares && r.val < 1e6 ? r.val * 1e6 : r.val;
    return { year: r.end.slice(0, 4), val };
  });
};

    // SEC's own tag only carries operating cash flow — FCF is OCF minus CapEx, matched by
    // fiscal period end so a year missing a capex filing doesn't get double-counted from
    // a different year. Missing capex for a *specific* period defaults to 0 (no PP&E
    // purchases reported) — true for plenty of asset-light filers. But zero capex matched
    // across EVERY period (capexByEnd empty despite having cash-flow data) is a different
    // signal: almost certainly a filer reporting capex under a tag not in getMetric()'s list
    // above (e.g. PaymentsToAcquireProductiveAssets — Kohl's, Macy's), not a company that
    // truly spends nothing. Only in that all-missing case, fall back to Yahoo's own capex
    // figures instead of silently overstating FCF by the full capex spend for every year.
    const capexByEnd = new Map((capex || []).map(u => [u.end, u.val]));
    if (capexByEnd.size === 0 && (cashFlows || []).length > 0) {
      const yhCapexFallback = await fetchYahooFundamentals(ticker).catch(() => null);
      (yhCapexFallback?.capexHistory || []).forEach(pt => {
        const match = (cashFlows || []).find(u => u.end.slice(0, 4) === pt.year);
        // Yahoo's capex sign varies by source field; SEC's tag (and capexByEnd everywhere
        // else) is a positive spend amount — normalize with Math.abs(), same convention
        // ocfMinusCapex() above already uses for the same reason.
        if (match) capexByEnd.set(match.end, Math.abs(pt.val));
      });
    }
    const freeCashFlows = (cashFlows || []).map(u => ({ ...u, val: u.val - (capexByEnd.get(u.end) ?? 0) }));

    const revVal   = latest(revenues);
    const revPrev  = prev(revenues);
    const niVal    = latest(netIncomes);
    const oiVal    = latest(operatingIncomes);
    // TTM (see ttmVal above) whenever a fresher one can be confidently rolled forward;
    // capexTTM only applies to the *scalar* OCF - capex used for fcfVal below, not to
    // freeCashFlows/fcfHistory's annual series, which stays a plain 10-K-by-10-K history.
    const operatingCFValTTM = ttmVal(['NetCashProvidedByUsedInOperatingActivities']);
    const capexValTTM = ttmVal(['PaymentsToAcquirePropertyPlantAndEquipment', 'CapitalExpenditureDiscontinuedOperations', 'PaymentsForProceedsFromProductiveAssets', 'PaymentsToAcquireProductiveAssets']);
    const operatingCFVal = operatingCFValTTM ?? latest(cashFlows);
    const fcfVal = (operatingCFValTTM != null && capexValTTM != null)
      ? operatingCFValTTM - capexValTTM
      : latest(freeCashFlows);
    const assetsVal = latest(assets);
    const equityVal = latest(equity);
    const debtVal  = latest(debt);
    const cashVal  = latest(cash);
    const sharesVal = latest(shares);
    const gpVal    = latest(grossProfit);
    const rdVal    = latest(rd);
    const cogsVal  = latest(cogs);
    const sgaVal   = latest(sga);
    const ebtVal   = latest(ebt);
    const taxVal   = latest(tax);
    const interestVal = latest(interestExp);
    const sharesBasicVal = latest(sharesBasic);
    const sharesDilutedVal = latest(sharesDiluted);
    const currentAssetsVal = latest(currentAssets);
    const currentLiabilitiesVal = latest(currentLiabilities);
    const totalLiabilitiesVal = latest(totalLiabilities);
    const retainedEarningsVal = latest(retainedEarnings);
    const capexVal = capexValTTM ?? latest(capex);
    const inventoryVal = latest(inventory);
    const receivablesVal = latest(receivables);
    const payablesVal = latest(payables);
    const sbcVal   = ttmVal(['ShareBasedCompensation', 'AllocatedShareBasedCompensationExpense']) ?? latest(sbc);
    const daVal    = latest(da);
    const dividendsPaidVal = latest(dividendsPaid);
    const investingCFVal = latest(investingActivities);
    const financingCFVal = latest(financingActivities);

    const dso = receivablesVal && revVal ? +((receivablesVal / revVal) * 365).toFixed(1) : null;
    const dio = inventoryVal && cogsVal ? +((inventoryVal / cogsVal) * 365).toFixed(1) : null;
    const dpo = payablesVal && cogsVal ? +((payablesVal / cogsVal) * 365).toFixed(1) : null;
    const ccc = dso !== null && dio !== null && dpo !== null ? +(dso + dio - dpo).toFixed(1) : null;
    const inventoryTurnover = cogsVal && inventoryVal ? +(cogsVal / inventoryVal).toFixed(2) : null;

    const opMargin    = revVal && oiVal ? +((oiVal / revVal) * 100).toFixed(1) : null;
    const netMargin   = revVal && niVal ? +((niVal / revVal) * 100).toFixed(1) : null;
    const grossMargin = revVal && gpVal ? +((gpVal / revVal) * 100).toFixed(1) : null;
    const revGrowth   = revVal && revPrev ? +(((revVal - revPrev) / Math.abs(revPrev)) * 100).toFixed(1) : null;
    const roe         = equityVal && niVal ? +((niVal / equityVal) * 100).toFixed(1) : null;
    const roa         = assetsVal && niVal ? +((niVal / assetsVal) * 100).toFixed(1) : null;
    const effectiveDebtVal = equityVal != null ? (debtVal ?? 0) : debtVal;
    const investedCapital = (equityVal ?? 0) + (effectiveDebtVal ?? 0);
    const roic        = investedCapital > 0 && oiVal !== null ? +((oiVal / investedCapital) * 100).toFixed(1) : null;
    const debtToEquity = equityVal && effectiveDebtVal != null ? +(effectiveDebtVal / equityVal).toFixed(2) : null;
    const netDebt     = (effectiveDebtVal ?? 0) - (cashVal ?? 0);

    const revHistory = buildHistory(revenues);
    const niHistory  = buildHistory(netIncomes);
    const fcfHistory = buildHistory(freeCashFlows);
    const oiHistory  = buildHistory(operatingIncomes);
    const sharesHistory = buildHistory(shares, true);
    const gpHistory  = buildHistory(grossProfit);
    const cogsHistory = buildHistory(cogs);
    const sgaHistory = buildHistory(sga);
    const rdHistory  = buildHistory(rd);
    const ebtHistory = buildHistory(ebt);
    const taxHistory = buildHistory(tax);
    const sharesBasicHistory = buildHistory(sharesBasic);
    const sharesDilutedHistory = buildHistory(sharesDiluted);
    const currentAssetsHistory = buildHistory(currentAssets);
    const currentLiabilitiesHistory = buildHistory(currentLiabilities);
    const totalLiabilitiesHistory = buildHistory(totalLiabilities);
    const capexHistory = buildHistory(capex);
    const operatingCFHistory = buildHistory(cashFlows);
    const investingCFHistory = buildHistory(investingActivities);
    const financingCFHistory = buildHistory(financingActivities);
    // Needed for computeReinvestmentGrowth (lib/stockScoring.js) — no XBRL tag reliably
    // carries a working-capital delta the way Yahoo's annualChangeInWorkingCapital does, so
    // this path's reinvestment estimate runs without the WC term (treated as 0 there).
    const daHistory = buildHistory(da);
    const debtHistory = buildHistory(debt);
    const equityHistory = buildHistory(equity);

    const marginHistory = revHistory.map((r, i) => {
      const oi = oiHistory[i];
      if (!oi || !r.val) return { year: r.year, margin: null };
      return { year: r.year, margin: +((oi.val / r.val) * 100).toFixed(1) };
    });

    const shareDilution = computeShareDilutionPct(sharesHistory);

    const safeFinnhubJson = (res) => res.ok ? res.json().catch(() => ({})) : Promise.resolve({});
    const [fhRes, fhBasicRes, fhProfileRes] = await Promise.all([
      fetch(`https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${FH_KEY}`).catch(() => null),
      fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${ticker}&metric=all&token=${FH_KEY}`).catch(() => null),
      fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${ticker}&token=${FH_KEY}`).catch(() => null),
    ]);

    const fh = fhRes ? await safeFinnhubJson(fhRes) : {};
    const fhBasic = fhBasicRes ? await safeFinnhubJson(fhBasicRes) : {};
    const fhProfile = fhProfileRes ? await safeFinnhubJson(fhProfileRes) : {};

    const currentPrice   = fh.c || null;
    const priceChange    = fh.d || null;
    const priceChangePct = fh.dp || null;
    const prevClose      = fh.pc || null;
    const high52         = fhBasic?.metric?.['52WeekHigh'] || null;
    const low52          = fhBasic?.metric?.['52WeekLow'] || null;
    const beta           = fhBasic?.metric?.beta || null;

    const epsDirect  = getEPS();
    const epsFinnhub = fhBasic?.metric?.epsAnnual || fhBasic?.metric?.epsTTM || null;
    const sharesFinnhub = fhBasic?.metric?.sharesOutstanding ? fhBasic.metric.sharesOutstanding * 1e6 : null;
const sharesValAdj = sharesVal && sharesVal < 1e6 ? sharesVal * 1e6 : sharesVal;
const sharesForCalc = sharesValAdj || sharesFinnhub;
    const epsEdgar   = niVal && sharesForCalc ? +(niVal / sharesForCalc).toFixed(2) : null;
    const epsCalc    = epsDirect || epsEdgar || epsFinnhub || null;
    const peCalc     = epsCalc && currentPrice ? +(currentPrice / epsCalc).toFixed(2) : null;
    const marketCapCalc = currentPrice && sharesForCalc ? currentPrice * sharesForCalc : null;
    const marketCapFinnhub = fhProfile?.marketCapitalization ? fhProfile.marketCapitalization * 1e6 : null;
    const marketCapFinal = marketCapFinnhub || marketCapCalc;
    const ebitdaCalc   = oiVal != null && daVal != null ? oiVal + daVal : null;
    const ebitdaFh     = fhBasic?.metric?.ebitdaTTM ? fhBasic.metric.ebitdaTTM * 1e6 : (fhBasic?.metric?.ebitdaAnnual ? fhBasic.metric.ebitdaAnnual * 1e6 : null);
    const ebitdaFinal  = ebitdaCalc ?? ebitdaFh;
    const evEbitda     = marketCapFinal != null && ebitdaFinal ? +((marketCapFinal + netDebt) / ebitdaFinal).toFixed(1) : null;
    const priceToBook  = marketCapFinal && equityVal && equityVal > 0 ? +(marketCapFinal / equityVal).toFixed(2) : null;

    const epsHistory = niHistory.map((ni, i) => {
      const sh = sharesHistory[i];
      if (!ni || !sh || !sh.val) return null;
      return { year: ni.year, eps: +(ni.val / sh.val).toFixed(2) };
    }).filter(Boolean);

    const epsOldest = epsHistory[0]?.eps;
    const epsLatest = epsHistory[epsHistory.length - 1]?.eps;
    const epsYears  = epsHistory.length > 1 ? epsHistory.length - 1 : 1;
    const epsCagrRaw = epsOldest && epsLatest && epsOldest > 0 && epsLatest > 0
      ? +(((Math.pow(epsLatest / epsOldest, 1 / epsYears)) - 1) * 100).toFixed(1)
      : null;
    const epsCagr = epsCagrRaw !== null && epsCagrRaw > 0 && epsCagrRaw < 50
      ? epsCagrRaw
      : revGrowth !== null && revGrowth > 0 ? Math.min(revGrowth, 20) : null;

      // Finnhub fallback para campos vacíos de SEC EDGAR
    const fhm = fhBasic?.metric || {};
    const grossMarginFinal = grossMargin ?? (fhm.grossMarginTTM != null ? fhm.grossMarginTTM : null);
    const opMarginFinal = opMargin ?? (fhm.operatingMarginTTM != null ? fhm.operatingMarginTTM : null);
    const netMarginFinal = netMargin ?? (fhm.netProfitMarginTTM != null ? fhm.netProfitMarginTTM : null);
    const roeFinal = roe ?? (fhm.roeTTM != null ? +fhm.roeTTM.toFixed(1) : null);
    const roaFinal = roa ?? (fhm.roaTTM != null ? +fhm.roaTTM.toFixed(1) : null);
    const roicFinal = roic ?? (fhm.roicTTM != null ? +fhm.roicTTM.toFixed(1) : null);
    const revGrowthFinal = revGrowth ?? (fhm.revenueGrowthTTMYoy != null ? +fhm.revenueGrowthTTMYoy.toFixed(1) : null);
    const fhDE = fhm.totalDebt_totalEquityAnnual ?? fhm.totalDebt_totalEquityQuarterly ?? null;
    const fhDEAdj = fhDE != null ? (fhDE > 10 ? +(fhDE / 100).toFixed(2) : +fhDE.toFixed(2)) : null;
    const debtToEquityFinal = debtToEquity ?? fhDEAdj ?? (equityVal != null ? 0 : null);

    // "Skin in the game" — aggregate insider ownership from the most recent Form 4 filings for
    // this CIK (see lib/secInsiders.js). Only attempted here, in the confirmed-domestic-filer
    // (us-gaap) branch — Form 4 is a US Section 16 requirement, so foreign filers and the
    // Finnhub/Yahoo fallback branches above correctly stay null rather than guessing. Best-
    // effort: a fetch failure here shouldn't take down the whole stock lookup, so it's swallowed
    // the same way the SEC XBRL facts fetch above is.
    let insiderTxns = [];
    const insiderOwnershipPct = await fetchForm4Transactions(cik, ticker, 15)
      .then(txns => { insiderTxns = txns; return computeInsiderOwnershipPct(txns, sharesForCalc); })
      .catch(() => null);

    // Piggyback the same Form 4 fetch above onto the Small & Micro Cap Radar's cross-ticker
    // insider feed (insider_feed_events) — scoped to small/micro only so ordinary mega/large-cap
    // traffic doesn't flood a table nobody browsing those tiers cares about. Deliberately not
    // awaited: this is a side effect for a different feature, and must never add latency to (or
    // fail) a stock-page load. The daily admin/refresh-small-cap-radar cron sweeps the rest of
    // the universe, since this alone only fires for tickers someone actually views.
    if (isSmallOrMicro(marketCapFinal) && insiderTxns.length > 0) {
      const capTierForFeed = getCapTier(marketCapFinal);
      const feedRows = insiderTxns.map(t => ({
        ticker, insider: t.insider, type: t.type, shares: t.shares, price: t.price, value: t.value,
        date: t.date, cap_tier: capTierForFeed?.id ?? null,
        is_officer: t.isOfficer, is_director: t.isDirector, is_ten_percent_owner: t.isTenPercentOwner,
      }));
      supabase.from('insider_feed_events')
        .upsert(feedRows, { onConflict: 'ticker,insider,date,type,shares', ignoreDuplicates: true })
        .then(() => {})
        .catch(err => console.error(`Failed to upsert insider feed rows for ${ticker}:`, err));
    }

    const result = {
      riskFreeRate,
      name: company.title,
      ticker,
      cik,
      sector: fhProfile.finnhubIndustry || null,
      industry: fhProfile.finnhubIndustry || null,
      exchange: fhProfile.exchange || null,
      description: fhProfile.description || await fetchDescription(ticker),
      employees: fhProfile.employeeTotal || null,
      weburl: fhProfile.weburl || null,
      revVal, niVal, oiVal, fcfVal, assetsVal, equityVal, debtVal: effectiveDebtVal, cashVal, sharesVal, rdVal,
      cogsVal, sgaVal, ebtVal, taxVal, interestVal, sharesBasicVal, sharesDilutedVal,
      currentAssetsVal, currentLiabilitiesVal, totalLiabilitiesVal, retainedEarningsVal,
      capexVal, investingCFVal, financingCFVal, daVal,
      inventoryVal, receivablesVal, payablesVal, sbcVal, dividendsPaidVal,
      dso, dio, dpo, ccc, inventoryTurnover,
      opMargin: opMarginFinal,
      netMargin: netMarginFinal,
      grossMargin: grossMarginFinal,
      revGrowth: revGrowthFinal,
      roe: roeFinal,
      roa: roaFinal,
      roic: roicFinal,
      debtToEquity: debtToEquityFinal,
      revHistory, niHistory, fcfHistory, oiHistory,
      sharesHistory, gpHistory, marginHistory, shareDilution,
      cogsHistory, sgaHistory, rdHistory, ebtHistory, taxHistory,
      sharesBasicHistory, sharesDilutedHistory,
      currentAssetsHistory, currentLiabilitiesHistory, totalLiabilitiesHistory,
      capexHistory, operatingCFHistory, investingCFHistory, financingCFHistory,
      daHistory, debtHistory, equityHistory,
      epsCagr, epsHistory,
      currentPrice, priceChange, priceChangePct, prevClose,
      eps: epsCalc, pe: peCalc,
      marketCap: marketCapFinal,
      pfcf: marketCapFinal && fcfVal && fcfVal > 0 ? +(marketCapFinal / fcfVal).toFixed(1) : null,
      fcfYield: marketCapFinal && fcfVal ? +((fcfVal / marketCapFinal) * 100).toFixed(2) : null,
      high52, low52, beta,
      sharesOutstanding: sharesForCalc,
      dividendYield: fhBasic?.metric?.dividendYieldIndicatedAnnual || null,
      netDebt,
      evEbitda,
      priceToBook,
      analystTarget: null,
      operatingCFVal,
      finnhubFallback: false,
      insiderOwnershipPct,
    };

    // Si menos de 3 campos clave tienen datos o no hay ingresos/beneficios, combinar con Yahoo Fundamentals
    const dataQuality = [revVal, niVal, oiVal, fcfVal, assetsVal, equityVal, debtVal, cashVal].filter(v => v !== null).length;
    if (dataQuality < 3 || (revVal == null && niVal == null)) {
      result.finnhubFallback = true;
      const yh = await fetchYahooFundamentals(ticker).catch(() => null);
      if (yh) {
        result.sector = result.sector || yh.sector;
        result.industry = result.industry || yh.industry;
        result.description = result.description || yh.description;
        result.revVal = result.revVal ?? yh.revVal;
        result.niVal = result.niVal ?? yh.niVal;
        result.oiVal = result.oiVal ?? yh.oiVal;
        result.fcfVal = result.fcfVal ?? yh.fcfVal;
        result.assetsVal = result.assetsVal ?? yh.assetsVal;
        result.equityVal = result.equityVal ?? yh.equityVal;
        result.debtVal = result.debtVal ?? yh.debtVal;
        result.cashVal = result.cashVal ?? yh.cashVal;
        result.sharesVal = result.sharesVal ?? yh.sharesVal;
        result.rdVal = result.rdVal ?? yh.rdVal;
        result.cogsVal = result.cogsVal ?? yh.cogsVal;
        result.sgaVal = result.sgaVal ?? yh.sgaVal;
        result.ebtVal = result.ebtVal ?? yh.ebtVal;
        result.taxVal = result.taxVal ?? yh.taxVal;
        result.interestVal = result.interestVal ?? yh.interestVal;
        result.operatingCFVal = result.operatingCFVal ?? yh.operatingCFVal;
        result.capexVal = result.capexVal ?? yh.capexVal;
        result.grossMargin = result.grossMargin ?? yh.grossMargin;
        result.opMargin = result.opMargin ?? yh.opMargin;
        result.netMargin = result.netMargin ?? yh.netMargin;
        result.roe = result.roe ?? yh.roe;
        result.roa = result.roa ?? yh.roa;
        result.roic = result.roic ?? yh.roic;
        result.revGrowth = result.revGrowth ?? yh.revGrowth;
        result.debtToEquity = result.debtToEquity ?? yh.debtToEquity;

        if (!result.revHistory || result.revHistory.length === 0) result.revHistory = yh.revHistory;
        if (!result.niHistory || result.niHistory.length === 0) result.niHistory = yh.niHistory;
        if (!result.fcfHistory || result.fcfHistory.length === 0) result.fcfHistory = yh.fcfHistory;
        if (!result.oiHistory || result.oiHistory.length === 0) result.oiHistory = yh.oiHistory;
        if (!result.sharesHistory || result.sharesHistory.length === 0) result.sharesHistory = yh.sharesHistory;
        if (!result.gpHistory || result.gpHistory.length === 0) result.gpHistory = yh.gpHistory;
        if (!result.marginHistory || result.marginHistory.length === 0) result.marginHistory = yh.marginHistory;
        if (!result.epsHistory || result.epsHistory.length === 0) result.epsHistory = yh.epsHistory;
        if (!result.cogsHistory || result.cogsHistory.length === 0) result.cogsHistory = yh.cogsHistory;
        if (!result.sgaHistory || result.sgaHistory.length === 0) result.sgaHistory = yh.sgaHistory;
        if (!result.rdHistory || result.rdHistory.length === 0) result.rdHistory = yh.rdHistory;
        if (!result.ebtHistory || result.ebtHistory.length === 0) result.ebtHistory = yh.ebtHistory;
        if (!result.taxHistory || result.taxHistory.length === 0) result.taxHistory = yh.taxHistory;
        if (!result.capexHistory || result.capexHistory.length === 0) result.capexHistory = yh.capexHistory;
        if (!result.operatingCFHistory || result.operatingCFHistory.length === 0) result.operatingCFHistory = yh.operatingCFHistory;
        if (!result.investingCFHistory || result.investingCFHistory.length === 0) result.investingCFHistory = yh.investingCFHistory;
        if (!result.financingCFHistory || result.financingCFHistory.length === 0) result.financingCFHistory = yh.financingCFHistory;
        if (!result.daHistory || result.daHistory.length === 0) result.daHistory = yh.daHistory;
        if (!result.debtHistory || result.debtHistory.length === 0) result.debtHistory = yh.debtHistory;
        if (!result.equityHistory || result.equityHistory.length === 0) result.equityHistory = yh.equityHistory;
        if (result.epsCagr == null) result.epsCagr = yh.epsCagr;
        if (result.pe == null) result.pe = yh.pe;
        if (result.eps == null) result.eps = yh.eps;
        if (result.pfcf == null) result.pfcf = yh.pfcf;
        if (result.fcfYield == null) result.fcfYield = yh.fcfYield;
      }
    }

    result.isEtf = cachedIsEtf;
    const finalValidCount = [result.revVal, result.niVal, result.fcfVal, result.assetsVal, result.debtVal, result.cashVal].filter(v => v !== null).length;
    const isEtfSec = result.sector === 'ETF' || result.industry === 'ETF';
    if (finalValidCount >= 2 || (isEtfSec && result.currentPrice != null)) {
      try {
        await supabase
          .from('stock_cache')
          .upsert({ ticker, data: result, updated_at: new Date().toISOString() });
      } catch (e) {}
    }

    return Response.json(result);

    

  } catch (e) {
    console.error(e);
    return Response.json({ error: 'Error al conectar con las fuentes de datos' }, { status: 500 });
  }
}
