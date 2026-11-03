import { supabase } from '../../../lib/supabase';
import { getYahooAuth } from '../../../lib/yahooFinance';

const FH_KEY = process.env.FINNHUB_API_KEY;
const CACHE_HOURS = 24;
const DEFAULT_TICKERS = [
  'SPY', 'QQQ', 'VOO', 'VTI', 'DIA', 'IWM', 'XLK', 'XLF', 'XLV', 'XLE', 'VEA', 'VWO', 'BND', 'TLT', 'GLD'
];

// Non-US UCITS ETFs seeded alongside the US defaults so the "International" tab isn't
// empty until a user manually searches one of these tickers. Actual metrics always come
// from Yahoo in fetchETFData — this is just a list of tickers, not a data source.
const INTERNATIONAL_SEED_TICKERS = [
  'VUAG.L', 'VUSA.L', 'SSLN.L', 'SGLN.L', 'INRG.L', 'EIMI.L', 'VWRL.L', 'VWRA.L', 'IUSA.L', 'CSPX.L'
];

// Yahoo's fundProfile/summaryDetail/defaultKeyStatistics modules can each come back thin on
// any individual fetch (crumb hiccup, a field Yahoo just doesn't populate that round) without
// the fund's real data having changed — same flakiness already documented throughout
// app/api/stock/route.js, which falls back to priorCachedData on nearly every field for exactly
// this reason. This file had none of that: every field here was sourced purely from the current
// fetch, so a transient gap silently overwrote a good "0.03%"/"$450.2B" with the "See
// Prospectus"/"N/A" sentinel on the next 24h refresh. Applied after fetchETFData returns, so
// every call site (seed, stale-refresh, POST) gets the same protection from one place.
const MISSING_ETF_VALUES = new Set(['See Prospectus', 'N/A', null, undefined]);
function mergeWithPriorEtfData(fresh, prior) {
  if (!prior) return fresh;
  const merged = { ...fresh };
  for (const key of ['expenseRatio', 'aum', 'yield', 'pe', 'beta', 'volume', 'inception', 'indexTracked', 'issuer']) {
    if (MISSING_ETF_VALUES.has(merged[key]) && !MISSING_ETF_VALUES.has(prior[key])) merged[key] = prior[key];
  }
  if ((!merged.holdings || merged.holdings.length === 0) && prior.holdings?.length > 0) merged.holdings = prior.holdings;
  if ((!merged.sectors || merged.sectors.length === 0) && prior.sectors?.length > 0) merged.sectors = prior.sectors;
  return merged;
}

async function fetchETFData(ticker) {
  const cleanTicker = ticker.trim().toUpperCase();
  const auth = await getYahooAuth();
  const headers = { 'User-Agent': 'Mozilla/5.0', Cookie: auth.cookie };

  // 1. Fetch quoteSummary and basic quote from Yahoo Finance in parallel
  const [res, quoteRes] = await Promise.all([
    fetch(
      `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${cleanTicker}?modules=fundProfile,summaryDetail,defaultKeyStatistics,price,topHoldings&crumb=${encodeURIComponent(auth.crumb)}`,
      { headers }
    ),
    fetch(
      `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${cleanTicker}&crumb=${encodeURIComponent(auth.crumb)}`,
      { headers }
    )
  ]);

  if (!res.ok) {
    throw new Error(`Failed to fetch Yahoo data for ${cleanTicker}`);
  }

  const json = await res.json();
  const result = json?.quoteSummary?.result?.[0];
  if (!result) {
    throw new Error(`No Yahoo data returned for ${cleanTicker}`);
  }

  let quoteData = null;
  if (quoteRes.ok) {
    try {
      const qJson = await quoteRes.json();
      quoteData = qJson?.quoteResponse?.result?.[0];
    } catch (e) {
      console.warn('Failed to parse quote API response:', e);
    }
  }

  // 2. Parse basic price info
  const priceModule = result.price || {};
  const summaryModule = result.summaryDetail || {};
  const statsModule = result.defaultKeyStatistics || {};
  const profileModule = result.fundProfile || {};
  const holdingsModule = result.topHoldings || {};

  const name = priceModule.longName || priceModule.shortName || `${cleanTicker} ETF`;
  const exchange = priceModule.exchangeName || null;
  const currency = priceModule.currency || 'USD';

  // 3. Parse expense ratio
  let expenseRatio = 'See Prospectus';
  const rawExp =
    profileModule.feesExpensesInvestment?.annualReportExpenseRatio?.raw ??
    statsModule.annualReportExpenseRatio?.raw;
  if (rawExp != null && rawExp > 0) {
    expenseRatio = `${(rawExp * 100).toFixed(2)}%`;
  }

  // 4. Parse AUM (check quote summary total assets or basic quote net assets/market cap)
  let aum = 'See Prospectus';
  const totalAssets =
    summaryModule.totalAssets?.raw ??
    statsModule.totalAssets?.raw ??
    quoteData?.netAssets ??
    quoteData?.marketCap;

  if (totalAssets != null && totalAssets > 0) {
    aum = `$${(totalAssets / 1e9).toFixed(1)}B`;
  }

  // 5. Parse yield
  let divYield = 'See Prospectus';
  const rawYield =
    summaryModule.yield?.raw ??
    statsModule.yield?.raw ??
    quoteData?.trailingAnnualDividendYield ??
    quoteData?.trailingAnnualDividendRate;

  if (rawYield != null && rawYield > 0) {
    divYield = `${(rawYield * 100).toFixed(2)}%`;
  }

  // 6. Parse Beta, PE, and Volume
  const betaVal = statsModule.beta3Year?.raw ?? statsModule.beta?.raw ?? summaryModule.beta?.raw;
  const peVal = summaryModule.trailingPE?.raw ?? statsModule.trailingPE?.raw ?? quoteData?.trailingPE;
  const volVal = summaryModule.volume?.raw ?? summaryModule.averageVolume?.raw;

  let beta = betaVal != null ? betaVal.toFixed(2) : 'N/A';
  let pe = peVal != null ? peVal.toFixed(1) : 'N/A';
  const volume = volVal != null ? `${(volVal / 1e6).toFixed(1)}M` : 'N/A';

  // 7. Parse holdings
  let holdings = [];
  if (holdingsModule.holdings && holdingsModule.holdings.length > 0) {
    holdings = holdingsModule.holdings.map((h) => {
      const wRaw = h.holdingPercent?.raw;
      // 'See Prospectus' makes sense for the fund-level stats below ("this isn't in our feed,
      // the fund's official document would have it") — it doesn't for one holding in a list
      // we're already showing, and it rendered as unlocalized English either way (confirmed:
      // app/(main)/etfs/[ticker]/page.js's WeightBars renders item.weight/item.name directly,
      // with no filter the way the fund-level stats have). 'N/D' matches what every other
      // missing value in this Spanish-language app already shows.
      const weight = wRaw != null ? `${(wRaw * 100).toFixed(2)}%` : 'N/D';
      return {
        name: h.holdingName || h.symbol || 'Posición sin nombre',
        ticker: h.symbol || 'N/D',
        weight,
      };
    });
  } else {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('silver') || cleanTicker.includes('SSLN')) {
      holdings = [
        { name: 'Physical Silver Bullion', ticker: 'SILVER', weight: '100.00%' }
      ];
    } else if (lowerName.includes('gold') || cleanTicker.includes('SGLN') || cleanTicker.includes('GLD')) {
      holdings = [
        { name: 'Physical Gold Bullion', ticker: 'GOLD', weight: '100.00%' }
      ];
    }
    // Otherwise leave holdings empty rather than asserting unverified composition.
  }

  // 8. Parse sectors
  const sectorMapping = {
    realestate: 'Real Estate',
    consumer_cyclical: 'Consumer Cyclical',
    basic_materials: 'Basic Materials',
    consumer_defensive: 'Consumer Defensive',
    technology: 'Technology',
    communication_services: 'Communication Services',
    financial_services: 'Financials',
    utilities: 'Utilities',
    industrials: 'Industrials',
    energy: 'Energy',
    healthcare: 'Healthcare',
  };

  let sectors = [];
  if (holdingsModule.sectorWeightings && holdingsModule.sectorWeightings.length > 0) {
    sectors = holdingsModule.sectorWeightings
      .map((item) => {
        const key = Object.keys(item)[0];
        if (!key) return null;
        const rawVal = item[key]?.raw;
        if (rawVal == null) return null;
        const mappedName = sectorMapping[key] || key.charAt(0).toUpperCase() + key.slice(1);
        const weight = `${(rawVal * 100).toFixed(1)}%`;
        return { name: mappedName, weight, rawVal };
      })
      .filter(Boolean);
  }

  if (sectors.length === 0) {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('silver') || cleanTicker.includes('SSLN') || lowerName.includes('gold') || cleanTicker.includes('SGLN') || cleanTicker.includes('GLD') || lowerName.includes('precious metal')) {
      sectors = [
        { name: 'Precious Metals', weight: '100.0%', rawVal: 1.0 }
      ];
    }
    // Otherwise leave sectors empty rather than labeling unknown composition "Diversified Assets".
  }

  // Sort sectors by weight descending
  sectors.sort((a, b) => b.rawVal - a.rawVal);
  sectors.forEach((s) => delete s.rawVal); // Remove temporary rawVal

  // Determine category. Yahoo's own Morningstar-style category string (when present) is a
  // more reliable signal than guessing from the fund name, which misses funds like VEA
  // ("Vanguard FTSE Developed Markets ETF") that don't contain any of the international
  // keywords we check for. Fall back to name/ticker heuristics only when that string is
  // missing or doesn't match any known signal.
  let category = 'all';
  let assetClass = profileModule.legalType || statsModule.legalType || 'Exchange-Traded Fund (ETF)';
  const lowerName = name.toLowerCase();
  const lowerCategoryName = (profileModule.categoryName || statsModule.category || '').toLowerCase();

  if (lowerName.includes('etc') || lowerName.includes('commodity') || cleanTicker.includes('SSLN') || cleanTicker.includes('SGLN')) {
    assetClass = 'Exchange-Traded Commodity (ETC)';
  }

  if (
    lowerCategoryName.includes('bond') ||
    lowerCategoryName.includes('treasury') ||
    lowerCategoryName.includes('municipal') ||
    lowerCategoryName.includes('high yield') ||
    lowerCategoryName.includes('tips')
  ) {
    category = 'fixed';
  } else if (
    lowerCategoryName.includes('foreign') ||
    lowerCategoryName.includes('emerging') ||
    lowerCategoryName.includes('world') ||
    lowerCategoryName.includes('international') ||
    lowerCategoryName.includes('diversified emerging')
  ) {
    category = 'international';
  } else if (
    lowerName.includes('bond') ||
    lowerName.includes('treasury') ||
    lowerName.includes('fixed income') ||
    lowerName.includes('bnd') ||
    lowerName.includes('tlt')
  ) {
    category = 'fixed';
  } else if (
    lowerName.includes('gold') ||
    lowerName.includes('silver') ||
    lowerName.includes('commodity') ||
    lowerName.includes('physical') ||
    lowerName.includes('gld')
  ) {
    category = 'fixed';
  } else if (
    lowerName.includes('international') ||
    lowerName.includes('global') ||
    lowerName.includes('developed markets') ||
    lowerName.includes('ftse') ||
    lowerName.includes('msci') ||
    lowerName.includes('ex-us') ||
    lowerName.includes('frontier') ||
    cleanTicker.includes('.') ||
    lowerName.includes('world') ||
    lowerName.includes('emerging')
  ) {
    category = 'international';
  } else if (
    lowerName.includes('sector') ||
    lowerName.includes('technology') ||
    lowerName.includes('financial') ||
    lowerName.includes('health') ||
    lowerName.includes('energy')
  ) {
    category = 'sector';
  } else {
    category = 'equity';
  }

  return {
    ticker: cleanTicker,
    name,
    // null (not an English placeholder string like the old 'Fund Provider'/'Underlying Assets')
    // so a missing value hides this row the same way every other genuinely-unavailable stat on
    // this page already does, instead of rendering English text that reads like a real answer.
    issuer: profileModule.family || statsModule.fundFamily || null,
    assetClass,
    expenseRatio,
    aum,
    inception: statsModule.fundInceptionDate?.fmt || 'N/A',
    indexTracked: profileModule.categoryName || statsModule.category || null,
    volume,
    yield: divYield,
    pe,
    beta,
    category,
    isEtf: true,
    holdings,
    sectors,
  };
}

export async function GET() {
  try {
    // Query stock_cache for all ETFs
    const { data, error } = await supabase
      .from('stock_cache')
      .select('ticker, data, updated_at')
      .eq('data->>isEtf', 'true');

    if (error) throw error;

    const rows = data || [];
    // Exposed as updatedAt (camelCase, matching app/api/stock/route.js's convention) so the
    // frontend can show data freshness the same way stock pages already do — this was
    // previously only used internally for the staleness check below, never sent to the client.
    let etfs = rows.map((row) => ({ ...row.data, updatedAt: row.updated_at }));
    const existingTickers = new Set(etfs.map((e) => e.ticker));

    // Find missing default tickers (US defaults + known international ETFs)
    const seedTickers = [...DEFAULT_TICKERS, ...INTERNATIONAL_SEED_TICKERS];
    const missingTickers = seedTickers.filter((t) => !existingTickers.has(t));

    if (missingTickers.length > 0) {
      console.log(`Seeding missing default ETFs: ${missingTickers.join(', ')}`);
      // Fetch missing ones in parallel
      const seeded = await Promise.all(
        missingTickers.map(async (ticker) => {
          try {
            const etfData = await fetchETFData(ticker);
            const seededAt = new Date().toISOString();
            await supabase.from('stock_cache').upsert({
              ticker,
              data: etfData,
              updated_at: seededAt,
            });
            return { ...etfData, updatedAt: seededAt };
          } catch (err) {
            console.error(`Failed to seed default ETF ${ticker}:`, err);
            return null;
          }
        })
      );

      const validSeeded = seeded.filter(Boolean);
      etfs = [...etfs, ...validSeeded];
    }

    // Refresh stale rows (expense ratio, AUM, yield, holdings drift over time) without
    // blocking this response — the refreshed data shows up on the next page load.
    const staleRows = rows
      .filter((row) => (Date.now() - new Date(row.updated_at).getTime()) / 36e5 > CACHE_HOURS);

    if (staleRows.length > 0) {
      Promise.all(
        staleRows.map(async (row) => {
          const ticker = row.data.ticker;
          try {
            const fresh = mergeWithPriorEtfData(await fetchETFData(ticker), row.data);
            await supabase.from('stock_cache').upsert({
              ticker,
              data: fresh,
              updated_at: new Date().toISOString(),
            });
          } catch (err) {
            console.error(`Failed to refresh stale ETF ${ticker}:`, err);
          }
        })
      ).catch(() => {});
    }

    return Response.json({ etfs });
  } catch (err) {
    console.error('Error fetching global ETFs:', err);
    return Response.json({ etfs: [] });
  }
}

export async function POST(request) {
  try {
    const { ticker, force } = await request.json();
    if (!ticker) {
      return Response.json({ error: 'Ticker is required' }, { status: 400 });
    }
    const cleanTicker = ticker.trim().toUpperCase();

    // 1. Check if it's already in stock_cache with isEtf = true and still fresh
    const { data: cached } = await supabase
      .from('stock_cache')
      .select('data, updated_at')
      .eq('ticker', cleanTicker)
      .single();

    // force bypasses the freshness check entirely — same as /api/stock's ?refresh=true, for the
    // "Actualizar datos" button, which exists precisely so a stale-but-not-yet-24h-old row can
    // be refetched on demand instead of waiting out the cache window.
    if (!force && cached?.data?.isEtf) {
      const hoursOld = (Date.now() - new Date(cached.updated_at).getTime()) / 36e5;
      if (hoursOld < CACHE_HOURS) {
        return Response.json({ ...cached.data, updatedAt: cached.updated_at });
      }
    }

    // 2. Fetch price, name, and basic indicators
    const etfObject = mergeWithPriorEtfData(await fetchETFData(cleanTicker), cached?.data);
    const fetchedAt = new Date().toISOString();

    // Upsert into stock_cache
    const { error: upsertError } = await supabase.from('stock_cache').upsert({
      ticker: cleanTicker,
      data: etfObject,
      updated_at: fetchedAt,
    });

    if (upsertError) throw upsertError;

    return Response.json({ ...etfObject, updatedAt: fetchedAt });
  } catch (err) {
    console.error('Error creating global ETF:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
