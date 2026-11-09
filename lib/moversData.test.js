import {beforeEach,it,expect,vi} from 'vitest';
import apple from './__fixtures__/integrity-baseline/AAPL.json';
import altia from './__fixtures__/integrity-baseline/ALC.MC.json';
import lloyds from './__fixtures__/integrity-baseline/LLOY.L.json';
import {sanitizeFinancialData} from './financialIntegrity';
import {computeEasyMode} from './financialCalculations';
const s=vi.hoisted(()=>({catalogReads:0,chunks:[],active:0,peak:0,fail:false,failPage:false,filters:[],limit:null}));
vi.mock('next/cache',()=>({unstable_cache:fn=>fn}));
vi.mock('./supabase',()=>({supabase:{from:()=>{
 const q={select:()=>q,neq:()=>q,gte:()=>q,not:field=>{s.filters.push(field);return q;},order:()=>q,
 limit:async limit=>{s.limit=limit;s.catalogReads++;return s.fail?{error:Error('offline')}:{data:Array.from({length:67},(_,i)=>({ticker:'T'+i}))};},
 in:async(_,ids)=>{s.chunks.push(ids);s.active++;s.peak=Math.max(s.peak,s.active);await new Promise(r=>setTimeout(r,1));s.active--;return s.failPage?{error:Error('page offline')}:{data:ids.map(ticker=>({ticker,updated_at:new Date().toISOString(),data:apple}))};}};return q;
}}}));
beforeEach(()=>{vi.resetModules();s.catalogReads=0;s.chunks=[];s.active=0;s.peak=0;s.fail=false;s.failPage=false;s.filters=[];});
it.each([apple,altia,lloyds])('preserves existing scores and displayed values without returning statements: $ticker',async raw=>{
 const {moversView}=await import('./moversData');const before=structuredClone(raw);const d=sanitizeFinancialData(raw),easy=computeEasyMode(d,true),actual=moversView({ticker:raw.ticker,updated_at:'2026-11-09',data:raw});
 for(const [key,source] of [['score','finalNote'],['cbs','cbs'],['oppo','oppo'],['gqs','gqs']])expect(actual[key]).toBe(Number.isFinite(easy?.[source])?+easy[source].toFixed(1):null);
 for(const key of ['currentPrice','priceChangePct','marketCap','currency','roic','fcfYield','revGrowth'])expect(actual[key]).toEqual(d[key]??null);
 expect(actual.financialIntegrity).toEqual({status:d.financialIntegrity.status,warning:d.financialIntegrity.warning??null});
 expect(actual).not.toHaveProperty('revHistory');expect(actual).not.toHaveProperty('financialPeriods');expect(Buffer.byteLength(JSON.stringify(actual))).toBeLessThan(Buffer.byteLength(JSON.stringify(raw))*.1);expect(raw).toEqual(before);
});
it('coalesces visitors, bounds heavy batches to two, and reuses the compact snapshot',async()=>{
 const {loadMoversRows}=await import('./moversData');const results=await Promise.all(Array.from({length:8},()=>loadMoversRows()));
 expect(s.catalogReads).toBe(1);expect(s.limit).toBe(1000);expect(s.chunks.map(c=>c.length)).toEqual([25,25,17]);expect(s.peak).toBe(2);expect(s.filters).toEqual(['data->>currentPrice','data->>priceChangePct']);results.forEach(r=>expect(r).toHaveLength(67));await loadMoversRows();expect(s.catalogReads).toBe(1);
});
it('does not cache a database failure as an empty radar',async()=>{
 const {loadMoversRows}=await import('./moversData');s.fail=true;await expect(loadMoversRows()).rejects.toThrow('offline');s.fail=false;expect(await loadMoversRows()).toHaveLength(67);expect(s.catalogReads).toBe(2);
});
it('stops queued financial reads after a failed page and can recover on the next request',async()=>{
 const {loadMoversRows}=await import('./moversData');s.failPage=true;await expect(loadMoversRows()).rejects.toThrow('page offline');await vi.waitFor(()=>expect(s.active).toBe(0));expect(s.chunks.length).toBeLessThanOrEqual(2);
 s.failPage=false;expect(await loadMoversRows()).toHaveLength(67);expect(s.catalogReads).toBe(2);
});
it('keeps absent fundamentals as missing scores instead of converting them to zero',async()=>{
 const {moversView}=await import('./moversData');const d=moversView({ticker:'MISSING',data:{name:'Missing',currentPrice:1,priceChangePct:2,currency:'USD'}});
 expect(d).toMatchObject({score:null,cbs:null,oppo:null,gqs:null,currentPrice:1});
});
