import {supabase} from './supabase.js';
import {applyFinancialOverrides} from './financialOverrides.js';
export const financialOverridesEnabled=()=>process.env.FINANCIAL_OVERRIDES_ENABLED==='true';
let cached=null,expires=0,pending=null,generation=0;
export function invalidateFinancialOverrideCache(){cached=null;expires=0;pending=null;generation++;}
export async function loadFinancialOverrides(){
  if(!financialOverridesEnabled())return [];
  if(cached&&Date.now()<expires)return cached;
  if(pending)return pending;
  const readingGeneration=generation;
  const task=(async()=>{
    const rows=[];
    for(let offset=0;;offset+=1000){const {data,error}=await supabase.from('current_financial_overrides')
      .select('id,ticker,target,value,metadata,active,created_at').order('ticker').order('target').range(offset,offset+999);
      if(error)throw new Error('No se pudieron cargar las correcciones financieras.');
      rows.push(...(data||[]));if(!data||data.length<1000)break;
    }
    if(readingGeneration===generation){cached=rows;expires=Date.now()+15000;}return rows;
  })();
  pending=task;
  try{return await task;}finally{if(pending===task)pending=null;}
}
export async function applyStoredFinancialOverrides(data){
  if(!data||data.error||!financialOverridesEnabled())return data;
  const rows=await loadFinancialOverrides();return applyFinancialOverrides(data,rows.filter(r=>r.ticker===data.ticker),{manualAuthority:true});
}
