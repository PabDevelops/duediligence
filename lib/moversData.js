import {unstable_cache} from 'next/cache';
import {supabase} from './supabase';
import {sanitizeFinancialData} from './financialIntegrity';
import {computeEasyMode} from './financialCalculations';
import {limitConcurrency} from './limitConcurrency';

// The old unpaged PostgREST read was implicitly capped at 1000. Keep that
// scope explicit, select recent quoted rows first, and never return statements.
export const MOVERS_UNIVERSE_LIMIT=1000;
const readWithinBudget=limitConcurrency(2);
const FIELDS=['name','currentPrice','priceChangePct','marketCap','currency','exchange','sector','roic','fcfYield','revGrowth'];
export function moversView(row){
 const d=sanitizeFinancialData(row.data||{});
 const hasFundamentals=d.revVal!=null||d.niVal!=null||d.marketCap!=null||d.roic!=null||d.grossMargin!=null||(d.revHistory?.length??0)>0;
 const easy=computeEasyMode(d,hasFundamentals),round=n=>Number.isFinite(n)?+n.toFixed(1):null;
 return {...Object.fromEntries(FIELDS.map(f=>[f,d[f]??null])),ticker:row.ticker,updated_at:row.updated_at,
  ...(d.financialIntegrity?{financialIntegrity:{status:d.financialIntegrity.status,warning:d.financialIntegrity.warning??null}}:{}),
  score:round(easy?.finalNote),cbs:round(easy?.cbs),oppo:round(easy?.oppo),gqs:round(easy?.gqs)};
}
let cached=null,expires=0,pending=null;
export async function loadMoversRows(){
 if(cached&&Date.now()<expires)return cached;
 if(pending)return pending;
 const read=unstable_cache(async()=>{
  const cutoff=new Date(Date.now()-24*3600000).toISOString();
  const {data:catalog,error}=await supabase.from('stock_cache').select('ticker')
   .neq('ticker','INHD').gte('updated_at',cutoff)
   .not('data->>currentPrice','is',null).not('data->>priceChangePct','is',null)
   .order('updated_at',{ascending:false}).limit(MOVERS_UNIVERSE_LIMIT);
  if(error)throw error;
  const tickers=(catalog||[]).map(r=>r.ticker),chunks=[];
  for(let i=0;i<tickers.length;i+=25)chunks.push(tickers.slice(i,i+25));
  let failure=null;
  const pages=await Promise.all(chunks.map(ids=>readWithinBudget(async()=>{
   if(failure)return [];
   try{
    const {data,error}=await supabase.from('stock_cache').select('ticker,updated_at,data').in('ticker',ids);
    if(error)throw error;
    return (data||[]).map(moversView);
   }catch(error){failure=error;throw error;}
  })));
  const byTicker=new Map(pages.flat().map(r=>[r.ticker,r]));
  return tickers.map(t=>byTicker.get(t)).filter(Boolean);
 },['radar-movers-v1',process.env.VERCEL_GIT_COMMIT_SHA||'local',new Date().toISOString().slice(0,10)],{revalidate:60});
 const work=read().then(rows=>{cached=rows;expires=Date.now()+60000;return rows;});pending=work;
 try{return await work;}finally{if(pending===work)pending=null;}
}
