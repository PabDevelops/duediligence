import {it,expect,vi} from 'vitest';
const s=vi.hoisted(()=>({error:null,selected:''}));
vi.mock('../../../lib/supabase',()=>({supabase:{from:()=>({select:fields=>{s.selected=fields;return {in:async()=>({error:s.error,data:[{ticker:'AAPL',name:'Apple',currentPrice:100,priceChangePct:0,currency:'USD',exchange:'NASDAQ'}]})};}})}}));
import {GET} from './route';
it('reads only quote fields and preserves genuine missing symbols',async()=>{
 s.error=null;const r=await GET(new Request('https://local.test/api/explore?category=bigtech'));const d=await r.json();expect(r.status).toBe(200);expect(d.stocks[0]).toMatchObject({ticker:'AAPL',priceChangePct:0,currency:'USD'});expect(d.missing).not.toContain('AAPL');expect(d.missing).toContain('MSFT');expect(s.selected).not.toBe('ticker, data');
});
it('does not turn a database outage into a request to hydrate every stock',async()=>{
 s.error=Error('offline');const log=vi.spyOn(console,'error').mockImplementation(()=>{});try{const r=await GET(new Request('https://local.test/api/explore?category=bigtech'));expect(r.status).toBe(503);expect((await r.json()).missing).toEqual([]);}finally{log.mockRestore();}
});
