import {describe,it,expect,vi,beforeEach,afterEach} from 'vitest';
const state=vi.hoisted(()=>({rows:[],error:null,reads:0,wait:null}));
vi.mock('./supabase.js',()=>({supabase:{from:()=>{const q={select:()=>q,order:()=>q,range:async(a,b)=>{state.reads++;const data=state.rows.slice(a,b+1);if(state.wait)await state.wait;return {data,error:state.error}}};return q;}}}));
import {loadFinancialOverrides,invalidateFinancialOverrideCache} from './financialOverrideStore';
describe('bounded server-side cache of permanent overrides',()=>{
 beforeEach(()=>{vi.stubEnv('FINANCIAL_OVERRIDES_ENABLED','true');state.rows=[];state.error=null;state.reads=0;state.wait=null;invalidateFinancialOverrideCache();});
 afterEach(()=>vi.unstubAllEnvs());
 it('makes no queries when the feature is disabled',async()=>{vi.stubEnv('FINANCIAL_OVERRIDES_ENABLED','false');expect(await loadFinancialOverrides()).toEqual([]);expect(state.reads).toBe(0);});
 it('pages all corrections and reuses the warm result',async()=>{
  state.rows=Array.from({length:1001},(_,i)=>({id:i,ticker:'TEST',target:'rdVal'}));
  expect(await loadFinancialOverrides()).toHaveLength(1001);expect(state.reads).toBe(2);
  await loadFinancialOverrides();expect(state.reads).toBe(2);
 });
 it('invalidates the cache after a save',async()=>{
  await loadFinancialOverrides();invalidateFinancialOverrideCache();await loadFinancialOverrides();expect(state.reads).toBe(2);
 });
 it('does not silently serve uncorrected financials when storage is unavailable',async()=>{
  state.error={message:'down'};await expect(loadFinancialOverrides()).rejects.toThrow();
 });
 it('does not replace a new post-save cache with an older request still in flight',async()=>{
  let finish;state.wait=new Promise(resolve=>{finish=resolve;});state.rows=[{id:1}];
  const old=loadFinancialOverrides();invalidateFinancialOverrideCache();state.wait=null;state.rows=[{id:2}];
  expect(await loadFinancialOverrides()).toEqual([{id:2}]);finish();await old;
  expect(await loadFinancialOverrides()).toEqual([{id:2}]);expect(state.reads).toBe(2);
 });
});
