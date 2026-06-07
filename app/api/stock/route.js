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

    const forceRefresh = searchParams.get('refresh') === 'true';
    if (cached && !forceRefresh) {
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
    
    if (!company) {
      // Fallback a Finnhub para stocks no en SEC EDGAR
      const [fhRes, fhBasicRes, fhProfileRes] = await Promise.all([
        fetch(`https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${FH_KEY}`),
        fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${ticker}&metric=all&token=${FH_KEY}`),
        fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${ticker}&token=${FH_KEY}`),
      ]);

      const fh = await fhRes.json();
      const fhBasic = await fhBasicRes.json();
      const fhProfile = await fhProfileRes.json();

      if (!fhProfile.name) return Response.json({ error: 'Ticker no encontrado' }, { status: 404 });

      const m = fhBasic?.metric || {};
      const currentPrice = fh.c || null;
      const sharesOutstanding = m.sharesOutstanding ? m.sharesOutstanding * 1e6 : null;
      const marketCap = fhProfile.marketCapitalization ? fhProfile.marketCapitalization * 1e6 : null;
      const eps = m.epsAnnual || m.epsTTM || null;
      const pe = eps && currentPrice ? +(currentPrice / eps).toFixed(2) : null;

      const result = {
        name: fhProfile.name || ticker,
        ticker,
        cik: null,
        sector: fhProfile.finnhubIndustry || null,
        industry: fhProfile.finnhubIndustry || null,
        exchange: fhProfile.exchange || null,
        description: fhProfile.description || null,
        currentPrice,
        priceChange: fh.d || null,
        priceChangePct: fh.dp || null,
        prevClose: fh.pc || null,
        marketCap,
        eps,
        pe,
        forwardPE: null,
        high52: m['52WeekHigh'] || null,
        low52: m['52WeekLow'] || null,
        beta: m.beta || null,
        sharesOutstanding,
        dividendYield: m.dividendYieldIndicatedAnnual || null,
        grossMargin: m.grossMarginTTM || null,
        opMargin: m.operatingMarginTTM || null,
        netMargin: m.netProfitMarginTTM || null,
        roe: m.roeTTM ? +(m.roeTTM * 100).toFixed(1) : null,
        roa: m.roaTTM ? +(m.roaTTM * 100).toFixed(1) : null,
        roic: m.roicTTM ? +(m.roicTTM * 100).toFixed(1) : null,
        revGrowth: m.revenueGrowthTTMYoy ? +(m.revenueGrowthTTMYoy * 100).toFixed(1) : null,
        debtToEquity: m.totalDebt_totalEquityAnnual || null,
        revVal: null, niVal: null, oiVal: null, fcfVal: null,
        assetsVal: null, equityVal: null, debtVal: null, cashVal: null,
        netDebt: null, pfcf: null, fcfYield: null,
        revHistory: [], niHistory: [], fcfHistory: [], oiHistory: [],
        marginHistory: [], sharesHistory: [], gpHistory: [],
        cogsHistory: [], sgaHistory: [], rdHistory: [], ebtHistory: [],
        taxHistory: [], sharesBasicHistory: [], sharesDilutedHistory: [],
        capexHistory: [], operatingCFHistory: [], investingCFHistory: [], financingCFHistory: [],
        epsCagr: null, epsHistory: [],
        netDebt,
      analystTarget: null,
        finnhubFallback: true,
      };

      try {
        await supabase.from('stock_cache').upsert({ ticker, data: result, updated_at: new Date().toISOString() });
      } catch (e) {}

      // Detectar si los datos son muy incompletos
    const dataQuality = [revVal, niVal, oiVal, fcfVal, assetsVal, equityVal].filter(v => v !== null).length;
    result.finnhubFallback = dataQuality < 2;

      return Response.json(result);
    }

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
        const units = metric.units?.USD || metric.units?.EUR || metric.units?.shares || metric.units?.pure;
        if (!units) continue;
        const annual = units.filter(u => (u.form === '10-K' || u.form === '20-F')).sort((a, b) => b.end.localeCompare(a.end));
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
    const equity        = getMetric(['StockholdersEquity','StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest']);
    const debt          = getMetric(['LongTermDebt','LongTermDebtNoncurrent']);
    const cash          = getMetric(['CashAndCashEquivalentsAtCarryingValue','CashCashEquivalentsAndShortTermInvestments']);
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
    const capex         = getMetric(['PaymentsToAcquirePropertyPlantAndEquipment']);
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

    const revVal   = latest(revenues);
    const revPrev  = prev(revenues);
    const niVal    = latest(netIncomes);
    const oiVal    = latest(operatingIncomes);
    const fcfVal   = latest(cashFlows);
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
    const capexVal = latest(capex);
    const inventoryVal = latest(inventory);
    const receivablesVal = latest(receivables);
    const payablesVal = latest(payables);
    const sbcVal   = latest(sbc);
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
    const investedCapital = (equityVal ?? 0) + (debtVal ?? 0);
const roic        = investedCapital > 0 && oiVal !== null ? +((oiVal / investedCapital) * 100).toFixed(1) : null;
    const debtToEquity = equityVal && debtVal ? +(debtVal / equityVal).toFixed(2) : null;
    const netDebt     = (debtVal ?? 0) - (cashVal ?? 0);

    const revHistory = buildHistory(revenues);
    const niHistory  = buildHistory(netIncomes);
    const fcfHistory = buildHistory(cashFlows);
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
    const epsCalc    = epsDirect || epsFinnhub || (niVal && sharesForCalc ? +(niVal / sharesForCalc).toFixed(2) : null);
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
    const roeFinal = roe ?? (fhm.roeTTM != null ? +(fhm.roeTTM * 100).toFixed(1) : null);
    const roaFinal = roa ?? (fhm.roaTTM != null ? +(fhm.roaTTM * 100).toFixed(1) : null);
    const roicFinal = roic ?? (fhm.roicTTM != null ? +(fhm.roicTTM * 100).toFixed(1) : null);
    const revGrowthFinal = revGrowth ?? (fhm.revenueGrowthTTMYoy != null ? +(fhm.revenueGrowthTTMYoy * 100).toFixed(1) : null);
    const debtToEquityFinal = debtToEquity ?? (fhm.totalDebt_totalEquityAnnual != null ? fhm.totalDebt_totalEquityAnnual : null);

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
      operatingCFVal: fcfVal,
      finnhubFallback: false,
    };

    // Si menos de 2 campos clave tienen datos, marcar como fallback
    const dataQuality = [revVal, niVal, oiVal, fcfVal, assetsVal, equityVal, debtVal, cashVal].filter(v => v !== null).length;
    if (dataQuality < 3) result.finnhubFallback = true;

    try {
      await supabase
        .from('stock_cache')
        .upsert({ ticker, data: result, updated_at: new Date().toISOString() });
    } catch (e) {}

    // Wikipedia description
    try {
      const searchName = fhProfile?.name || company.title;
      const wikiSearch = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(searchName)}`);
      if (wikiSearch.ok) {
        const wikiData = await wikiSearch.json();
        if (wikiData.extract) result.description = wikiData.extract.slice(0, 400);
      }
    } catch (e) {}

    return Response.json(result);

  } catch (e) {
    console.error(e);
    return Response.json({ error: 'Error al conectar con las fuentes de datos' }, { status: 500 });
  }
}