import { getVisitor } from '../../../lib/auth';
import { supabase } from '../../../lib/supabase';
import { rateLimit, getClientIp } from '../../../lib/rateLimit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Guests get a curated, capped slice of the dataset rather than the full
// screener — enough to see real value, not enough to replace registering.
const ANON_RESULT_LIMIT = 40;

// The full stock_cache scan below is identical for every caller (only the anon slicing
// afterwards differs), but this endpoint is hit on every screener page load with no HTTP
// caching. Memoize the raw scan in-process for a short window to cut repeat Supabase egress.
const SCREENER_CACHE_TTL_MS = 60_000;
let screenerStocksCache = null;
let screenerStocksCachedAt = 0;

async function loadScreenerStocks() {
  if (screenerStocksCache && Date.now() - screenerStocksCachedAt < SCREENER_CACHE_TTL_MS) return screenerStocksCache;

  // Supabase/PostgREST caps a single select at 1000 rows by default with no error — once
  // stock_cache grows past that, a plain .select() here would silently drop whichever
  // tickers didn't land in that first page, with no stable order guaranteed across
  // requests. Page through with .range() until a page comes back short, so every cached
  // ticker reaches the screener regardless of table size.
  const PAGE_SIZE = 1000;
  const rows = [];
  // Only the fields the screener table actually renders — selecting individual jsonb
  // paths instead of the whole `data` blob (which also carries multi-year history
  // arrays used only on the stock detail page) cuts what would otherwise be a
  // near-full-table dump of heavy JSON on every page load.
  const SELECT_FIELDS = 'ticker, updated_at, name:data->name, sector:data->sector, exchange:data->exchange, currentPrice:data->currentPrice, priceChangePct:data->priceChangePct, marketCap:data->marketCap, pe:data->pe, beta:data->beta, revGrowth:data->revGrowth, opMargin:data->opMargin, fcfYield:data->fcfYield, roe:data->roe, netDebt:data->netDebt, grossMargin:data->grossMargin, fcfVal:data->fcfVal, revVal:data->revVal, eps:data->eps';
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

export async function GET(request) {
  const visitor = await getVisitor();

  if (visitor.type === 'anonymous') {
    const key = `screener:${visitor.id || getClientIp(request)}`;
    const { ok, retryAfterMs } = rateLimit(key, { limit: 20, windowMs: 60 * 60 * 1000 });
    if (!ok) return Response.json({ error: 'Rate limit exceeded', retryAfterMs }, { status: 429 });
  }

  try {
    let stocks = (await loadScreenerStocks()).slice();

    if (visitor.type === 'anonymous') {
      // Slice by market cap, not recency, so guests see recognizable names.
      stocks = stocks
        .slice()
        .sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0))
        .slice(0, ANON_RESULT_LIMIT);
    }

    return Response.json({ stocks, limited: visitor.type === 'anonymous' });
  } catch (e) {
    console.error(e);
    return Response.json({ stocks: [] });
  }
}
