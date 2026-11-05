import {describe,it,expect,vi,beforeEach,afterEach} from 'vitest';
import sample from './__fixtures__/integrity-baseline/ALC.MC.json';
const state=vi.hoisted(()=>({rows:[],reads:0,selected:[]}));
vi.mock('./supabase',()=>({supabase:{from:()=>{const q={select:(fields)=>{state.selected.push(fields);return q},neq:()=>q,order:()=>q,range:async(a,b)=>{state.reads++;return {data:state.rows.slice(a,b+1),error:null}}};return q}}}));
describe('final validation: screener paging and cache (isolated DB)',()=>{
 beforeEach(()=>{vi.resetModules();state.rows=Array.from({length:11232},(_,i)=>({ticker:'TEST'+i,updated_at:'2026-11-05T00:00:00Z',data:{...sample,ticker:'TEST'+i}}));state.reads=0;state.selected=[];vi.useFakeTimers();});afterEach(()=>vi.useRealTimers());
 it('reads all 11232 rows across 12 pages and reuses the warm cache',async()=>{const {loadScreenerStocks}=await import('./screenerData.js');const a=await loadScreenerStocks();expect(a).toHaveLength(11232);expect(state.reads).toBe(12);expect(a[0].financialIntegrity.status).toBe('provisional');const b=await loadScreenerStocks();expect(b).toBe(a);expect(state.reads).toBe(12);});
 it('refetches exactly once after the 60-second cache window expires',async()=>{const {loadScreenerStocks}=await import('./screenerData.js');await loadScreenerStocks();vi.advanceTimersByTime(60001);await loadScreenerStocks();expect(state.reads).toBe(24);await loadScreenerStocks();expect(state.reads).toBe(24);});
});

