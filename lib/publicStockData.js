import {cache} from 'react';
import {unstable_cache} from 'next/cache';
import {supabase} from './supabase';
import {publicTicker} from './publicStockSummary';
import {reconcileOfficialShareClasses} from './officialShareClasses';
import {scopeFinancialEntity} from './listingIdentity';
import {quarantineCachedRevenueScale} from './secRevenueScale';
// Metadata and HTML share the existing public API request, not a second provider fetch.
export const publicStockData=cache(async ticker=>{
  if(!publicTicker(ticker))return null;
  try{
    const response=await fetch(`${process.env.NEXT_PUBLIC_APP_URL||'https://bulltrace.app'}/api/stock?ticker=${encodeURIComponent(ticker)}`,{next:{revalidate:3600},signal:AbortSignal.timeout(10000)});
    // Also reconcile payloads served from the existing fetch cache: the initial
    // server HTML must use the same share base as the fresh detail API.
    return response.ok?scopeFinancialEntity(quarantineCachedRevenueScale(reconcileOfficialShareClasses(await response.json()))):null;
  }catch{return null;}
});
// Read only identifiers, never the full financial cache or user tables.
export const publicStockTickers=unstable_cache(async()=>{
  const tickers=[];
  for(let offset=0;;offset+=1000){
    const {data,error}=await supabase.from('stock_cache').select('ticker,isEtf:data->isEtf,error:data->error').order('ticker').range(offset,offset+999);
    if(error)throw new Error('No se pudo leer el catálogo público.');
    tickers.push(...(data||[]).filter(r=>!r.isEtf&&!r.error).map(r=>r.ticker).filter(publicTicker));
    if(!data||data.length<1000)break;
  }
  return [...new Set(tickers)];
},['public-stock-tickers-v1'],{revalidate:3600});
