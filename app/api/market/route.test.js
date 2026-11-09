import {it,expect,vi} from 'vitest';
import {GET} from './route';
it('retains successful indices and their existing calculation when one provider request fails',async()=>{
 vi.stubGlobal('fetch',vi.fn(async(url,options)=>{expect(options.signal).toBeInstanceOf(AbortSignal);expect(options.next.revalidate).toBe(60);if(String(url).includes('^IXIC'))throw Error('offline');return {ok:true,json:async()=>({chart:{result:[{meta:{regularMarketPrice:110,chartPreviousClose:100},timestamp:[1,2],indicators:{quote:[{close:[100,110]}]}}]}})};}));
 const r=await GET(new Request('https://local.test/api/market'));expect(r.status).toBe(200);const d=await r.json();expect(d.markets).toHaveLength(4);expect(d.markets[0]).toMatchObject({price:110,change:10,changePct:10});
});
it('reports unavailable indices as an error rather than a successful empty market',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>{throw Error('offline');}));const r=await GET(new Request('https://local.test/api/market'));expect(r.status).toBe(503);expect((await r.json()).error).toBeTruthy();
});
