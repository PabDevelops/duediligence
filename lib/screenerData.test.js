import {beforeEach,it,expect,vi} from 'vitest';
import apple from './__fixtures__/integrity-baseline/AAPL.json';
import {sanitizeFinancialData} from './financialIntegrity';
import {screenerView} from './screenerView';
const s=vi.hoisted(()=>({reads:[],keys:[],overrides:vi.fn(async()=>[])}));
vi.mock('./supabase',()=>({supabase:{from:()=>{let after;const q={select:()=>q,neq:()=>q,gt:(_,value)=>{after=value;return q;},order:()=>q,limit:limit=>new Promise(resolve=>s.reads.push({after,limit,resolve}))};return q;}}}));
vi.mock('./financialOverrideStore',()=>({loadFinancialOverrides:s.overrides}));
vi.mock('next/cache',()=>({unstable_cache:(fn,keys)=>{s.keys.push(keys);return fn;}}));
import {loadScreenerStocks,invalidateScreenerCache} from './screenerData';
const row={ticker:'AAPL',updated_at:'2026-11-09',data:apple};
beforeEach(()=>{invalidateScreenerCache();s.reads=[];s.keys=[];s.overrides.mockReset();s.overrides.mockResolvedValue([]);});
it('shares one scan and validation across concurrent visitors, preserving the exact validated projection',async()=>{
 const calls=Array.from({length:12},()=>loadScreenerStocks());await vi.waitFor(()=>expect(s.reads).toHaveLength(1));s.reads[0].resolve({data:[row],error:null});
 const results=await Promise.all(calls);const expected=[{...screenerView(sanitizeFinancialData({...apple,ticker:'AAPL'})),ticker:'AAPL',updatedAt:'2026-11-09'}];
 results.forEach(r=>expect(r).toEqual(expected));expect(s.overrides).toHaveBeenCalledTimes(1);expect(await loadScreenerStocks()).toEqual(expected);expect(s.reads).toHaveLength(1);
});
it('releases a failed scan so a later request can recover',async()=>{
 const first=loadScreenerStocks();await vi.waitFor(()=>expect(s.reads).toHaveLength(1));s.reads[0].resolve({error:new Error('offline')});await expect(first).rejects.toThrow('offline');
 const next=loadScreenerStocks();await vi.waitFor(()=>expect(s.reads).toHaveLength(2));s.reads[1].resolve({data:[],error:null});expect(await next).toEqual([]);
});
it('does not republish a pre-correction scan after cache invalidation',async()=>{
 const old=loadScreenerStocks();await vi.waitFor(()=>expect(s.reads).toHaveLength(1));invalidateScreenerCache();const fresh=loadScreenerStocks();await vi.waitFor(()=>expect(s.reads).toHaveLength(2));
 s.reads[1].resolve({data:[row],error:null});const corrected=await fresh;s.reads[0].resolve({data:[],error:null});await old;
 expect(await loadScreenerStocks()).toEqual(corrected);expect(s.reads).toHaveLength(2);
});
it('changes the shared page-cache revision when corrections change, without putting their text in the key',async()=>{
 const first=loadScreenerStocks();await vi.waitFor(()=>expect(s.reads).toHaveLength(1));s.reads[0].resolve({data:[],error:null});await first;
 const previous=s.keys[0];invalidateScreenerCache();s.overrides.mockResolvedValue([{id:1,ticker:'OTHER',target:'roe',value:5,metadata:{note:'Private administrative note'}}]);
 const second=loadScreenerStocks();await vi.waitFor(()=>expect(s.reads).toHaveLength(2));s.reads[1].resolve({data:[],error:null});await second;
 expect(s.keys[1][2]).not.toBe(previous[2]);expect(s.keys[1][2]).toMatch(/^[a-f0-9]{64}$/);expect(JSON.stringify(s.keys)).not.toContain('Private administrative note');
});
