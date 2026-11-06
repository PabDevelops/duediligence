import { sanitizeFinancialData } from './financialIntegrity.js';
import { screenerView } from './screenerView.js';
import { supabase } from './supabase';
import { loadFinancialOverrides } from './financialOverrideStore';
import { applyFinancialOverrides } from './financialOverrides';

// Shared full-universe scan of stock_cache, used by app/api/screener/route.js — extracted
// here so the field list and pagination/cache-TTL logic have one place to live. Memoized
// in-process for a short window to cut repeat Supabase egress, since the route can be hit
// frequently with no HTTP caching of its own.
const SCREENER_CACHE_TTL_MS = 60_000;
let screenerStocksCache = null;
let screenerStocksCachedAt = 0;
export function invalidateScreenerCache(){screenerStocksCache=null;screenerStocksCachedAt=0;}

// Validation needs the complete input, including compatible cash-flow components
// and fiscal evidence. Keep that read server-side; project the validated result
// before caching/returning it so provenance cannot inflate the list response.
const SELECT_FIELDS = 'ticker, updated_at, data';

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

  const overrides=await loadFinancialOverrides();
  const byTicker=new Map();for(const item of overrides){if(!byTicker.has(item.ticker))byTicker.set(item.ticker,[]);byTicker.get(item.ticker).push(item);}
  screenerStocksCache = rows.map(row => ({ ...screenerView(applyFinancialOverrides(sanitizeFinancialData({...row.data,ticker:row.ticker}),byTicker.get(row.ticker),{manualAuthority:true})), ticker:row.ticker, updatedAt: row.updated_at }));
  screenerStocksCachedAt = Date.now();
  return screenerStocksCache;
}
