import { supabase } from '../../../lib/supabase';

const FH_KEY = 'd8he51pr01qgcfbpbuo0d8he51pr01qgcfbpbuog';
const CACHE_HOURS = 24;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get('ticker')?.toUpperCase();

  if (!ticker) {
    return Response.json({ error: 'Ticker requerido' }, { status: 400 });
  }

  try {
    const { data: cached } = await supabase
      .from('stock_cache')
      .select('data, updated_at')
      .eq('ticker', ticker)
      .single();

    if (cached) {
      const hoursOld = (Date.now() - new Date(cached.updated_at).getTime()) / (1000 * 60 * 60);
      if (hoursOld < CACHE_HOURS) {
        return Response.json({ ...cached.data, cached: true });
      }
    }
  } catch (e) {}

  try {
    const tickerRes = await fetch(
      'https://www.sec.gov/files/company_tickers.json',
      { headers: { 'User-Agent': 'DueDiligenceApp contact@example.com' } }
    );
    const tickerData = await tickerRes.json();
    const company = Object.values(tickerData).find(c => c.ticker.toUpperCase() === ticker);
    if (!company) return Response.json({ error: 'Ticker no encontrado' }, { status: 404 });

    const cik = String(company.cik_str).padStart(10, '0');

    const factsRes = await fetch(
      `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`,
      { headers: { 'User-Agent': 'DueDiligenceApp contact@example.com' } }
    );
    const facts = await factsRes.json();
    const usgaap = facts.facts?.['us-gaap'] || {};

    const getMetric = (keys) => {
      for (const key of keys) {
        const metric = usgaap[key];
        if (!metric) continue;
        const units = metric.units?.USD || metric.units?.shares || metric.units?.pure;
        if (!units) continue;
        const annual = units.filter(u => u.form === '10-K' && u.frame).sort((a, b) => b.end.localeCompare(a.end));
        if (annual.length > 0) return annual;
      }
      return null;
    };

    const getEPS = () => {
      const keys = ['EarningsPerShareDiluted', 'EarningsPerShareBasic'];
      for (const key of keys) {
        const metric = usgaap[key];
        if (!metric) continue;
        const units = metric.units?.USD || metric.units?.pure || metric.units?.['USD/shares'];
        if (!units) continue;
        const annual = units.filter(u => u.form === '10-K').sort((a, b) => b.end.localeCompare(a.end));
        if (annual.length > 0) return annual[0].val;
      }
      return null;
    };

    const revenues = getMetric(['RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues', 'SalesRevenueNet', 'RevenueFromContractWithCustomerIncludingAssessedTax']);
    const netIncomes = getMetric(['NetIncomeLoss']);
    const operatingIncomes = getMetric(['OperatingIncomeLoss']);
    const cashFlows = getMetric(['NetCashProvidedByUsedInOperatingActivities']);
    const assets = getMetric(['Assets']);
    const equity = getMetric(['StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest']);
    const debt = getMetric(['LongTermDebt', 'LongTermDebtNoncurrent']);
    const cash = getMetric(['CashAndCashEquivalentsAtCarryingValue', 'CashCashEquivalentsAndShortTermInvestments']);
    const shares = getMetric(['CommonStockSharesOutstanding', 'WeightedAverageNumberOfSharesOutstandingBasic']);
    const grossProfit = getMetric(['GrossProfit']);
    const rd = getMetric(['ResearchAndDevelopmentExpense']);
    const cogs = getMetric(['CostOfRevenue', 'CostOfGoodsAndServicesSold']);
    const sga = getMetric(['SellingGeneralAndAdministrativeExpense', 'SellingAndMarketingExpense']);
    const ebt = getMetric(['IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest']);
    const tax = getMetric(['IncomeTaxExpenseBenefit']);
    const interestExp = getMetric(['InterestExpense', 'InterestAndDebtExpense']);
    const sharesBasic = getMetric(['WeightedAverageNumberOfSharesOutstandingBasic']);
    const sharesDiluted = getMetric(['WeightedAverageNumberOfDilutedSharesOutstanding']);
    const currentAssets = getMetric(['AssetsCurrent']);
    const currentLiabilities = getMetric(['LiabilitiesCurrent']);
    const totalLiabilities = getMetric(['Liabilities']);
    const retainedEarnings = getMetric(['RetainedEarningsAccumulatedDeficit']);
    const capex = getMetric(['PaymentsToAcquirePropertyPlantAndEquipment']);
    const inventory = getMetric(['InventoryNet', 'InventoryGross']);
    const receivables = getMetric(['AccountsReceivableNetCurrent', 'ReceivablesNetCurrent']);
    const payables = getMetric(['AccountsPayableCurrent']);
    const sbc = getMetric(['ShareBasedCompensation', 'AllocatedShareBasedCompensationExpense']);
    const dividendsPaid = getMetric(['PaymentsOfDividends', 'PaymentsOfDividendsCommonStock']);
    const investingActivities = getMetric(['NetCashProvidedByUsedInInvestingActivities']);
    const financingActivities = getMetric(['NetCashProvidedByUsedInFinancingActivities']);

    const latest = (arr) => arr?.[0]?.val ?? null;
    const prev = (arr) => arr?.[1]?.val ?? null;

    const revVal = latest(revenues);
    const revPrev = prev(revenues);
    const niVal = latest(netIncomes);
    const oiVal = latest(operatingIncomes);
    const fcfVal = latest(cashFlows);
    const assetsVal = latest(assets);
    const equityVal = latest(equity);
    const debtVal = latest(debt);
    const cashVal = latest(cash);
    const sharesVal = latest(shares);
    const gpVal = latest(grossProfit);
    const rdVal = latest(rd);
    const cogsVal = latest(cogs);
    const sgaVal = latest(sga);
    const ebtVal = latest(ebt);
    const taxVal = latest(tax);
    const interestVal = latest(interestExp);
    const sharesBasicVal = latest(sharesBasic);
    const sharesDilutedVal = latest(sharesDiluted);
    const currentAssetsVal = latest(currentAssets);
    const currentLiabilitiesVal = latest(currentLiabilities);
    const totalLiabilitiesVal = latest(totalLiabilities);
    const retainedEarningsVal = latest(retainedEarnings);
    const capexVal = latest(capex);
    const inventoryVal = latest(inventory);
    const receivablesVal = latest(receivables);
    const payablesVal = latest(payables);
    const sbcVal = latest(sbc);
    const dividendsPaidVal = latest(dividendsPaid);

// Efficiency ratios
const dso = receivablesVal && revVal ? +((receivablesVal / revVal) * 365).toFixed(1) : null;
const dio = inventoryVal && cogsVal ? +((inventoryVal / cogsVal) * 365).toFixed(1) : null;
const dpo = payablesVal && cogsVal ? +((payablesVal / cogsVal) * 365).toFixed(1) : null;
const ccc = dso !== null && dio !== null && dpo !== null ? +(dso + dio - dpo).toFixed(1) : null;
const inventoryTurnover = cogsVal && inventoryVal ? +(cogsVal / inventoryVal).toFixed(2) : null;
    const investingCFVal = latest(investingActivities);
    const financingCFVal = latest(financingActivities);

    const opMargin = revVal && oiVal ? +((oiVal / revVal) * 100).toFixed(1) : null;
    const netMargin = revVal && niVal ? +((niVal / revVal) * 100).toFixed(1) : null;
    const grossMargin = revVal && gpVal ? +((gpVal / revVal) * 100).toFixed(1) : null;
    const revGrowth = revVal && revPrev ? +(((revVal - revPrev) / Math.abs(revPrev)) * 100).toFixed(1) : null;
    const roe = equityVal && niVal ? +((niVal / equityVal) * 100).toFixed(1) : null;
    const roa = assetsVal && niVal ? +((niVal / assetsVal) * 100).toFixed(1) : null;
    const debtToEquity = equityVal && debtVal ? +(debtVal / equityVal).toFixed(2) : null;
    const netDebt = debtVal && cashVal ? debtVal - cashVal : null;
    const roic = equityVal && debtVal && oiVal ? +((oiVal / (equityVal + debtVal)) * 100).toFixed(1) : null;

    const buildHistory = (arr) => arr?.slice(0, 6).reverse().map(r => ({ year: r.end.slice(0, 4), val: r.val })) || [];

    const revHistory = buildHistory(revenues);
    const niHistory = buildHistory(netIncomes);
    const fcfHistory = buildHistory(cashFlows);
    const oiHistory = buildHistory(operatingIncomes);
    const sharesHistory = buildHistory(shares);
    const gpHistory = buildHistory(grossProfit);
    const cogsHistory = buildHistory(cogs);
    const sgaHistory = buildHistory(sga);
    const rdHistory = buildHistory(rd);
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

    const marginHistory = revHistory.map((r, i) => {
      const oi = oiHistory[i];
      if (!oi || !r.val) return { year: r.year, margin: null };
      return { year: r.year, margin: +((oi.val / r.val) * 100).toFixed(1) };
    });

    const sharesLatest = sharesHistory[sharesHistory.length - 1]?.val;
    const sharesOldest = sharesHistory[0]?.val;
    const shareDilution = sharesLatest && sharesOldest
      ? +(((sharesLatest - sharesOldest) / sharesOldest) * 100).toFixed(1)
      : null;

    const [fhRes, fhBasicRes, fhProfileRes] = await Promise.all([
      fetch(`https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${FH_KEY}`),
      fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${ticker}&metric=all&token=${FH_KEY}`),
      fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${ticker}&token=${FH_KEY}`),
    ]);

    const fh = await fhRes.json();
    const fhBasic = await fhBasicRes.json();
    const fhProfile = await fhProfileRes.json();

    const currentPrice = fh.c || null;
    const priceChange = fh.d || null;
    const priceChangePct = fh.dp || null;
    const prevClose = fh.pc || null;
    const high52 = fhBasic?.metric?.['52WeekHigh'] || null;
    const low52 = fhBasic?.metric?.['52WeekLow'] || null;
    const beta = fhBasic?.metric?.beta || null;

    const epsDirect = getEPS();
    const epsFinnhub = fhBasic?.metric?.epsAnnual || fhBasic?.metric?.epsTTM || null;
    const sharesFinnhub = fhBasic?.metric?.sharesOutstanding ? fhBasic.metric.sharesOutstanding * 1e6 : null;
    const sharesForCalc = sharesVal || sharesFinnhub;
    const epsCalc = epsDirect || epsFinnhub || (niVal && sharesForCalc ? +(niVal / sharesForCalc).toFixed(2) : null);
    const peCalc = epsCalc && currentPrice ? +(currentPrice / epsCalc).toFixed(2) : null;
    const marketCapCalc = currentPrice && sharesForCalc ? currentPrice * sharesForCalc : null;
    const pfcfCalc = marketCapCalc && fcfVal && fcfVal > 0 ? +(marketCapCalc / fcfVal).toFixed(1) : null;
    const fcfYield = marketCapCalc && fcfVal ? +((fcfVal / marketCapCalc) * 100).toFixed(2) : null;

    const epsHistory = niHistory.map((ni, i) => {
      const sh = sharesHistory[i];
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
      : revGrowth !== null && revGrowth > 0
      ? Math.min(revGrowth, 20)
      : null;

    const result = {
      name: company.title,
      ticker,
      cik,
      sector: fhProfile.finnhubIndustry || null,
      industry: fhProfile.finnhubIndustry || null,
      exchange: fhProfile.exchange || null,
      description: fhProfile.description || null,
      employees: fhProfile.employeeTotal || null,
      weburl: fhProfile.weburl || null,
      revVal, niVal, oiVal, fcfVal, assetsVal, equityVal, debtVal, cashVal, sharesVal, rdVal,
      cogsVal, sgaVal, ebtVal, taxVal, interestVal, sharesBasicVal, sharesDilutedVal,
      currentAssetsVal, currentLiabilitiesVal, totalLiabilitiesVal, retainedEarningsVal,
      capexVal, investingCFVal, financingCFVal,
      inventoryVal, receivablesVal, payablesVal, sbcVal, dividendsPaidVal,
      dso, dio, dpo, ccc, inventoryTurnover,
      opMargin, netMargin, grossMargin, revGrowth, roe, roa, debtToEquity, netDebt, roic,
      revHistory, niHistory, fcfHistory, oiHistory,
      sharesHistory, gpHistory, marginHistory, shareDilution,
      cogsHistory, sgaHistory, rdHistory, ebtHistory, taxHistory,
      sharesBasicHistory, sharesDilutedHistory,
      currentAssetsHistory, currentLiabilitiesHistory, totalLiabilitiesHistory,
      capexHistory, operatingCFHistory, investingCFHistory, financingCFHistory,
      epsCagr, epsHistory,
      currentPrice, priceChange, priceChangePct, prevClose,
      eps: epsCalc, pe: peCalc, marketCap: marketCapCalc, pfcf: pfcfCalc, fcfYield,
      high52, low52, beta,
      sharesOutstanding: sharesForCalc,
      dividendYield: fhBasic?.metric?.dividendYieldIndicatedAnnual || null,
      analystTarget: null,
      operatingCFVal: fcfVal,
    };

    try {
      await supabase
        .from('stock_cache')
        .upsert({ ticker, data: result, updated_at: new Date().toISOString() });
    } catch (e) {}

    return Response.json(result);

  } catch (e) {
    console.error(e);
    return Response.json({ error: 'Error al conectar con las fuentes de datos' }, { status: 500 });
  }
}