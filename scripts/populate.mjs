import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://vmfpdysxofboofccsdcv.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZtZnBkeXN4b2Zib29mY2NzZGN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2ODU5MDEsImV4cCI6MjA5NjI2MTkwMX0.3mFvm8Tk5F9DVWsVqJ5gt37tyOvH_rKtIIQxCZDL1LU'
);

const SP500 = [
  'AAPL','MSFT','NVDA','GOOGL','AMZN','META','TSLA','BRK.B','AVGO','JPM',
  'LLY','V','UNH','XOM','MA','COST','HD','PG','WMT','NFLX',
  'CRM','BAC','ORCL','KO','CVX','MRK','ABBV','AMD','ACN','PEP',
  'TMO','LIN','MCD','CSCO','ABT','GE','DHR','CAT','IBM','TXN',
  'INTU','PM','NOW','SPGI','ISRG','GS','NEE','BKNG','RTX','AMGN',
  'PLD','BLK','SYK','VRTX','ETN','AXP','T','DE','UBER','MDLZ',
  'ADI','REGN','MU','MS','MMC','CI','SCHW','ZTS','CB','C',
  'BSX','SO','CME','PGR','EOG','WM','TJX','AON','BDX','NOC',
  'ELV','ITW','SHW','HCA','ICE','USB','MCO','DUK','COP','APH',
  'FI','KLAC','SNPS','CDNS','MAR','EMR','TGT','MO','NSC','PH',
  'AIG','WELL','PSA','ECL','ROP','PCAR','ORLY','OKE','HLT','CARR',
  'MSI','AJG','CTAS','PAYX','KMB','GD','WBA','EW','VRSK','EXC',
  'A','IDXX','FTNT','CEG','FAST','SRE','OTIS','IQV','MNST','YUM',
  'MTD','ROST','LRCX','ODFL','NDAQ','KR','HSY','GEHC','GWW','BIIB',
  'CTSH','DD','PPG','KVUE','STZ','AVB','GLW','NEM','EQR','ROK',
  'VMC','MLM','WAT','DLTR','XEL','KEYS','PWR','AWK','EPAM','TROW',
  'DG','FDS','CDW','EBAY','LYB','MTB','ANSS','WTW','PTC','CFG',
  'LH','IFF','BR','MKC','HOLX','FSLR','TYL','EXPD','SWKS','ZBRA',
  'BAX','NTRS','CTLT','HSIC','AKAM','JKHY','STE','TER','FRT','BXP',
  'VNO','REG','KIM','SPG','O','AMT','CCI','EQIX','DLR','IRM',
  'WY','VICI','ESS','MAA','UDR','CPT','AIV','ARE','EXR','LSI',
  'PEAK','DOC','HR','NNN','STAG','COLD','REXR','EGP','FR','PLD',
  'JNJ','PFE','MRNA','GILD','ILMN','DXCM','HUM','CVS','MCK','CAH',
  'CNC','MOH','WCG','ANTM','UHS','THC','HRC','ENSG','AMED','LHCG',
  'ADBE','INTC','QCOM','MU','WDC','STX','NTAP','HPE','HPQ','DELL',
  'NCR','JNPR','FFIV','NLOK','CTXS','VMW','PAYC','GWRE','PCTY','RNG',
  'ZM','DOCU','COUP','OKTA','CRWD','ZS','NET','DDOG','MDB','SNOW',
  'PLTR','U','RBLX','COIN','HOOD','SOFI','AFRM','UPST','LC','OPEN',
];

const FH_KEY = 'd8he51pr01qgcfbpbuo0d8he51pr01qgcfbpbuog';
const AV_KEY = 'HQ3HYMDJQK4QBM4I';

async function fetchStock(ticker) {
  try {
    // Finnhub precio
    const fhRes = await fetch(`https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${FH_KEY}`);
    const fh = await fhRes.json();

    // Finnhub métricas básicas
    const fhBasicRes = await fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${ticker}&metric=all&token=${FH_KEY}`);
    const fhBasic = await fhBasicRes.json();

    // SEC EDGAR
    const tickerRes = await fetch('https://www.sec.gov/files/company_tickers.json', {
      headers: { 'User-Agent': 'DueDiligenceApp contact@example.com' }
    });
    const tickerData = await tickerRes.json();
    const company = Object.values(tickerData).find(c => c.ticker.toUpperCase() === ticker.toUpperCase());
    if (!company) return null;

    const cik = String(company.cik_str).padStart(10, '0');
    const factsRes = await fetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`, {
      headers: { 'User-Agent': 'DueDiligenceApp contact@example.com' }
    });
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

    const revenues = getMetric(['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet']);
    const netIncomes = getMetric(['NetIncomeLoss']);
    const operatingIncomes = getMetric(['OperatingIncomeLoss']);
    const cashFlows = getMetric(['NetCashProvidedByUsedInOperatingActivities']);
    const assets = getMetric(['Assets']);
    const equity = getMetric(['StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest']);
    const debt = getMetric(['LongTermDebt', 'LongTermDebtNoncurrent']);
    const cash = getMetric(['CashAndCashEquivalentsAtCarryingValue', 'CashCashEquivalentsAndShortTermInvestments']);
    const shares = getMetric(['CommonStockSharesOutstanding', 'WeightedAverageNumberOfSharesOutstandingBasic']);
    const grossProfit = getMetric(['GrossProfit']);

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

    const opMargin = revVal && oiVal ? +((oiVal / revVal) * 100).toFixed(1) : null;
    const netMargin = revVal && niVal ? +((niVal / revVal) * 100).toFixed(1) : null;
    const grossMargin = revVal && gpVal ? +((gpVal / revVal) * 100).toFixed(1) : null;
    const revGrowth = revVal && revPrev ? +(((revVal - revPrev) / Math.abs(revPrev)) * 100).toFixed(1) : null;
    const roe = equityVal && niVal ? +((niVal / equityVal) * 100).toFixed(1) : null;
    const roa = assetsVal && niVal ? +((niVal / assetsVal) * 100).toFixed(1) : null;
    const debtToEquity = equityVal && debtVal ? +(debtVal / equityVal).toFixed(2) : null;
    const netDebt = debtVal && cashVal ? debtVal - cashVal : null;

    const currentPrice = fh.c || null;
    const priceChange = fh.d || null;
    const priceChangePct = fh.dp || null;

    const epsFinnhub = fhBasic?.metric?.epsAnnual || fhBasic?.metric?.epsTTM || null;
    const sharesFinnhub = fhBasic?.metric?.sharesOutstanding ? fhBasic.metric.sharesOutstanding * 1e6 : null;
    const sharesForCalc = sharesVal || sharesFinnhub;
    const epsCalc = epsFinnhub || (niVal && sharesForCalc ? +(niVal / sharesForCalc).toFixed(2) : null);
    const peCalc = epsCalc && currentPrice ? +(currentPrice / epsCalc).toFixed(2) : null;
    const marketCapCalc = currentPrice && sharesForCalc ? currentPrice * sharesForCalc : null;
    const fcfYield = marketCapCalc && fcfVal ? +((fcfVal / marketCapCalc) * 100).toFixed(2) : null;

    let sectorVal = null;
try {
  const profileRes = await fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${ticker}&token=${FH_KEY}`);
  const profile = await profileRes.json();
  sectorVal = profile.finnhubIndustry || null;
} catch(e) {}

    return {
      name: company.title,
      ticker: ticker.toUpperCase(),
      sector: sectorVal,
      currentPrice, priceChange, priceChangePct,
      revVal, niVal, oiVal, fcfVal, assetsVal, equityVal, debtVal, cashVal,
      opMargin, netMargin, grossMargin, revGrowth, roe, roa, debtToEquity, netDebt,
      eps: epsCalc, pe: peCalc, marketCap: marketCapCalc, fcfYield,
      sharesOutstanding: sharesForCalc,
      revHistory: revenues?.slice(0, 5).reverse().map(r => ({ year: r.end.slice(0, 4), val: r.val })) || [],
      niHistory: netIncomes?.slice(0, 5).reverse().map(r => ({ year: r.end.slice(0, 4), val: r.val })) || [],
      fcfHistory: cashFlows?.slice(0, 5).reverse().map(r => ({ year: r.end.slice(0, 4), val: r.val })) || [],
    };
  } catch (e) {
    console.error(`Error fetching ${ticker}:`, e.message);
    return null;
  }
}

async function main() {
  console.log(`Starting S&P500 population — ${SP500.length} tickers`);
  let success = 0;
  let failed = 0;

  for (let i = 0; i < SP500.length; i++) {
    const ticker = SP500[i];
    process.stdout.write(`[${i+1}/${SP500.length}] ${ticker}... `);

    const data = await fetchStock(ticker);

    if (data) {
      await supabase
        .from('stock_cache')
        .upsert({ ticker: ticker.toUpperCase(), data, updated_at: new Date().toISOString() });
      console.log('✓');
      success++;
    } else {
      console.log('✗');
      failed++;
    }

    // Esperar 500ms entre llamadas para no sobrecargar las APIs
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\nDone: ${success} success, ${failed} failed`);
}

main();