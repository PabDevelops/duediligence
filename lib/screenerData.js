import { sanitizeFinancialData } from './financialIntegrity.js';
import { screenerView } from './screenerView.js';
import { supabase } from './supabase';
import { loadFinancialOverrides } from './financialOverrideStore';
import { applyFinancialOverrides } from './financialOverrides';
import {unstable_cache} from 'next/cache';
import {createHash} from 'node:crypto';

// Shared full-universe scan of stock_cache, used by app/api/screener/route.js — extracted
// here so the field list and pagination/cache-TTL logic have one place to live. Memoized
// in-process for a short window to cut repeat Supabase egress, since the route can be hit
// frequently with no HTTP caching of its own.
const SCREENER_CACHE_TTL_MS = 60_000;
let screenerStocksCache = null;
let screenerStocksCachedAt = 0;
let screenerLoadInFlight = null;
let cacheGeneration = 0;
export function invalidateScreenerCache(){screenerStocksCache=null;screenerStocksCachedAt=0;screenerLoadInFlight=null;cacheGeneration++;}

// Validation needs the complete input, including compatible cash-flow components
// and fiscal evidence. Keep that read server-side; project the validated result
// before caching/returning it so provenance cannot inflate the list response.
const SELECT_FIELDS = 'ticker, updated_at, data';

export async function loadScreenerStocks() {
  if (screenerStocksCache && Date.now() - screenerStocksCachedAt < SCREENER_CACHE_TTL_MS) return screenerStocksCache;
  if (screenerLoadInFlight) return screenerLoadInFlight;
  const generation=cacheGeneration;
  const work=scanScreenerStocks(generation).then(stocks=>{
    // A manual correction may invalidate the cache while this scan is running.
    if(generation===cacheGeneration){screenerStocksCache=stocks;screenerStocksCachedAt=Date.now();}
    return stocks;
  });
  screenerLoadInFlight=work;
  try{return await work;}finally{if(screenerLoadInFlight===work)screenerLoadInFlight=null;}
}

async function scanScreenerStocks(generation) {
  const overrides=await loadFinancialOverrides();
  const byTicker=new Map();for(const item of overrides){if(!byTicker.has(item.ticker))byTicker.set(item.ticker,[]);byTicker.get(item.ticker).push(item);}
  const revision=createHash('sha256').update(JSON.stringify(overrides)).digest('hex');
  // Cache only small validated pages in the existing Next data cache, shared
  // across instances. A correction changes the key; a day boundary forces new
  // validation even if the provider remains unavailable during revalidation.
  const PAGE_SIZE=250;
  const readPage=unstable_cache(async offset=>{
    const {data:page,error}=await supabase.from('stock_cache').select(SELECT_FIELDS)
      .neq('ticker','INHD').order('ticker',{ascending:true}).range(offset,offset+PAGE_SIZE-1);
    if(error)throw error;
    // Release each full financial page before loading the next. Never retain
    // the full raw universe (including all statements and provenance) in RAM.
    return (page||[]).map(row=>({...screenerView(applyFinancialOverrides(sanitizeFinancialData({...row.data,ticker:row.ticker}),byTicker.get(row.ticker),{manualAuthority:true})),ticker:row.ticker,updatedAt:row.updated_at}));
  },['screener-validated-pages-v1',process.env.VERCEL_GIT_COMMIT_SHA||'local',revision,String(generation),String(PAGE_SIZE),new Date().toISOString().slice(0,10)],{revalidate:60});

  // Supabase/PostgREST caps a single select at 1000 rows by default with no error — once
  // stock_cache grows past that, a plain .select() here would silently drop whichever
  // tickers didn't land in that first page, with no stable order guaranteed across
  // requests. Page through with .range() until a page comes back short, so every cached
  // ticker reaches callers regardless of table size.
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page=await readPage(offset);
    rows.push(...(page || []));
    if (!page || page.length < PAGE_SIZE) break;
  }

  // Preserve the existing API order while using stable ticker pagination.
  return rows.sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));
}
