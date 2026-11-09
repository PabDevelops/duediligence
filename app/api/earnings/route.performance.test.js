import {beforeEach,it,expect,vi} from 'vitest';
const s=vi.hoisted(()=>({active:0,peak:0,chunks:[],fail:false}));
vi.mock('../../../lib/nasdaqEarnings',()=>({fetchNasdaqEarningsRange:async()=>[]}));
vi.mock('../../../lib/supabase',()=>({supabase:{from:()=>({select:()=>({in:async(_,tickers)=>{
 s.active++;s.peak=Math.max(s.peak,s.active);s.chunks.push(tickers);await new Promise(r=>setTimeout(r,3));s.active--;
 if(s.fail)throw Error('offline');return {data:tickers.map(ticker=>({ticker,data:{name:ticker,marketCap:100,sector:'Technology'}}))};
}})})}}));
import {GET} from './route';
beforeEach(()=>{s.active=0;s.peak=0;s.chunks=[];s.fail=false;vi.stubGlobal('fetch',vi.fn(async url=>({ok:true,json:async()=>String(url).includes('/calendar/ipo')?{}:{earningsCalendar:Array.from({length:151},(_,i)=>({symbol:'T'+i,date:'2026-11-10',epsActual:2,epsEstimate:1}))}})));});
it('coalesces concurrent identical windows, gives every caller a readable body and preserves all events and surprises',async()=>{
 const urls=['https://local.test/api/earnings?from=2026-11-09&to=2026-11-11','https://local.test/api/earnings?to=2026-11-11&from=2026-11-09'];
 const responses=await Promise.all(Array.from({length:8},(_,i)=>GET(new Request(urls[i%2]))));const bodies=await Promise.all(responses.map(r=>r.json()));
 bodies.forEach(b=>{expect(b.earnings).toHaveLength(151);expect(b.earnings[0]).toMatchObject({ticker:'T0',name:'T0',marketCap:100,surprisePercent:100});expect(b).toEqual(bodies[0]);});
 expect(s.peak).toBeLessThanOrEqual(2);expect(s.chunks).toHaveLength(4);expect(s.chunks.every(c=>c.length<=50)).toBe(true);expect(fetch).toHaveBeenCalledTimes(2);
 await GET(new Request(urls[1]));expect(s.chunks).toHaveLength(4);
});
it('shares the concurrency limit across distinct calendar windows',async()=>{
 await Promise.all(['2026-11-12','2026-11-13'].map(to=>GET(new Request('https://local.test/api/earnings?from=2026-11-09&to='+to))));
 expect(s.chunks).toHaveLength(8);expect(s.peak).toBeLessThanOrEqual(2);
});
it('releases failed in-flight work so the same request can retry',async()=>{
 const url='https://local.test/api/earnings?from=2026-11-20&to=2026-11-21';s.fail=true;
 expect((await(await GET(new Request(url))).json()).earnings).toEqual([]);s.fail=false;
 expect((await(await GET(new Request(url))).json()).earnings).toHaveLength(151);
});
