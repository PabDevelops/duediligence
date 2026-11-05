// Existing statement arithmetic shared by providers and the offline comparison importer.
// Extracted from app/api/stock/route.js without changing financial formulas.
import { samePeriod } from './financialIntegrity.js';

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

export function splitAdjustedShares(sharesHistory) {
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

export function computeShareDilutionPct(sharesHistory) {
  const adjusted = splitAdjustedShares(sharesHistory);
  const sharesLatest = adjusted?.[adjusted.length - 1]?.val;
  const sharesOldest = adjusted?.[0]?.val;
  return sharesLatest && sharesOldest
    ? +(((sharesLatest - sharesOldest) / sharesOldest) * 100).toFixed(1)
    : null;
}

// Same ratio/margin/history math as the SEC-EDGAR path below, but operating on
// ascending { year, val } arrays (latest = last element) instead of raw XBRL facts.
export function computeDerivedFinancials(h) {
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
  // Invested capital = Total Assets − Current Liabilities, not Debt + Equity. The Debt+Equity
  // version collapses toward zero (or goes negative) for a company with debt-funded-buyback
  // negative equity — verified against real data: DPZ's Debt+Equity invested capital was
  // ~$730M-$894M depending on cash-netting, versus Finviz's reported 54.88% ROIC implying a
  // denominator well over $1B — producing a 100%+ ROIC that reads as elite capital efficiency
  // when it's really just an artificially tiny denominator. Assets − Current Liabilities is the
  // standard textbook alternative for exactly this reason: it never inverts sign or collapses
  // just because equity went negative. NOPAT (after-tax), not raw operating income, is the
  // correct numerator for either definition — same effective-tax-rate clamp used in
  // computeWACC/computeReinvestmentGrowth (lib/stockScoring.js) so a one-off tax benefit/charge
  // can't send it negative.
  const investedCapital = assetsVal != null && currentLiabilitiesVal != null ? assetsVal - currentLiabilitiesVal : null;
  const effTaxRate = ebtVal > 0 && taxVal != null ? Math.min(0.35, Math.max(0, taxVal / ebtVal)) : 0.21;
  const nopat = oiVal != null ? oiVal * (1 - effTaxRate) : null;
  const roic = investedCapital > 0 && nopat != null ? +((nopat / investedCapital) * 100).toFixed(1) : null;
  const effectiveDebtVal = equityVal != null ? (debtVal ?? 0) : debtVal;
  const debtToEquity = equityVal && effectiveDebtVal != null ? +(effectiveDebtVal / equityVal).toFixed(2) : null;
  const netDebt = (effectiveDebtVal ?? 0) - (cashVal ?? 0);

  const marginHistory = h.revHistory.map((r, i) => {
    const oi = h.oiHistory.find(o=>samePeriod(r,o));
    if (!oi || !r.val) return { year: r.year, margin: null };
    return { year: r.year, margin: +((oi.val / r.val) * 100).toFixed(1) };
  });

  const shareDilution = computeShareDilutionPct(h.sharesHistory);

  const epsHistory = h.niHistory.map((ni, i) => {
    const sh = h.sharesHistory.find(sh=>samePeriod(ni,sh));
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
