import { supabase } from './supabase';

// Shared full-universe scan of stock_cache, used by app/api/screener/route.js — extracted
// here so the field list and pagination/cache-TTL logic have one place to live. Memoized
// in-process for a short window to cut repeat Supabase egress, since the route can be hit
// frequently with no HTTP caching of its own.
const SCREENER_CACHE_TTL_MS = 60_000;
let screenerStocksCache = null;
let screenerStocksCachedAt = 0;

// Only the fields the screener actually renders — selecting individual jsonb paths instead
// of the whole `data` blob (which also carries multi-year history arrays used only on the
// stock detail page) cuts what would otherwise be a near-full-table dump of heavy JSON on
// every load. shareDilution/insiderOwnershipPct/cashVal feed lib/stockScoring.js's
// dilutionScore/runwayScore/ownershipScore. country comes from the Finnhub-profile populate
// script (scripts/populateFullMarket.js), fcfHistory from the SEC EDGAR pipeline in
// app/api/stock/route.js's full fetch, so coverage of each varies independently of the other
// core fields above.
const SELECT_FIELDS = 'ticker, updated_at, name:data->name, sector:data->sector, exchange:data->exchange, country:data->country, currentPrice:data->currentPrice, priceChangePct:data->priceChangePct, marketCap:data->marketCap, pe:data->pe, beta:data->beta, revGrowth:data->revGrowth, opMargin:data->opMargin, fcfYield:data->fcfYield, roe:data->roe, netDebt:data->netDebt, grossMargin:data->grossMargin, fcfVal:data->fcfVal, revVal:data->revVal, eps:data->eps, shareDilution:data->shareDilution, insiderOwnershipPct:data->insiderOwnershipPct, cashVal:data->cashVal, fcfHistory:data->fcfHistory';

export async function loadScreenerStocks() {
  if (screenerStocksCache && Date.now() - screenerStocksCachedAt < SCREENER_CACHE_TTL_MS) return screenerStocksCache;

  // Supabase/PostgREST caps a single select at 1000 rows by default with no error — once
  // stock_cache grows past that, a plain .select() here would silently drop whichever
  // tickers didn't land in that first page, with no stable order guaranteed across
  // requests. Page through with .range() until a page comes back short, so every cached
  // ticker reaches callers regardless of table size.
  const PAGE_SIZE = 1000;
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data: page, error } = await supabase
      .from('stock_cache')
      .select(SELECT_FIELDS)
      .neq('ticker', 'INHD')
      .order('updated_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;
    rows.push(...(page || []));
    if (!page || page.length < PAGE_SIZE) break;
  }

  screenerStocksCache = rows.map(row => ({ ...row, updatedAt: row.updated_at }));
  screenerStocksCachedAt = Date.now();
  return screenerStocksCache;
}
