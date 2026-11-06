import {it,expect,vi} from 'vitest';
import {publicStockSummary,publicTicker} from './publicStockSummary';
it('exposes only public amounts, exact periods and provenance, never account data or admin notes',()=>{
 const d={name:'Test',currency:'EUR',revVal:100,portfolio:'PRIVATE',actor:'PRIVATE',manualCorrections:[{note:'PRIVATE'}],financialPeriods:{revVal:{basis:'H1',periodStart:'2026-01-01',periodEnd:'2026-06-30',currency:'EUR',manual:true,source:'Informe',note:'PRIVATE'}}};
 const s=publicStockSummary(d,'TEST');expect(s.rows[0]).toMatchObject({value:'100 EUR',period:expect.stringContaining('H1'),manual:true});expect(JSON.stringify(s)).not.toContain('PRIVATE');expect(s.rows[3].value).toBe('N/D');
});
it('rejects malformed identifiers, failed provider responses and ETFs',()=>{
 for(const t of ['../secret','AAPL?x=1',''])expect(publicTicker(t)).toBe(false);
 expect(publicStockSummary({error:'x'},'AAPL')).toBeNull();expect(publicStockSummary({isEtf:true},'SPY')).toBeNull();
});
const state=vi.hoisted(()=>({pages:[],select:vi.fn()}));
vi.mock('./supabase',()=>({supabase:{from:()=>({select:(columns)=>{state.select(columns);return {order:()=>({range:async()=>state.pages.shift()})};}})}}));
vi.mock('next/cache',()=>({unstable_cache:f=>f}));
it('paginates a minimal read-only catalog and filters invalid identifiers',async()=>{
 const {publicStockTickers}=await import('./publicStockData');
 state.pages=[{data:Array.from({length:1000},(_,i)=>({ticker:`T${i}`}))},{data:[{ticker:'AAPL'},{ticker:'../private'},{ticker:'SPY',isEtf:true},{ticker:'BAD',error:'missing'}]}];
 const tickers=await publicStockTickers();expect(tickers).toHaveLength(1001);expect(tickers).toContain('AAPL');expect(state.select.mock.calls.every(([c])=>c==='ticker,isEtf:data->isEtf,error:data->error')).toBe(true);
});
it('does not cache a database failure as a successful empty catalog',async()=>{
 const {publicStockTickers}=await import('./publicStockData');state.pages=[{error:{message:'offline'}}];await expect(publicStockTickers()).rejects.toThrow();
});
