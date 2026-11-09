import {it,expect,vi} from 'vitest';
const load=vi.hoisted(()=>vi.fn());
vi.mock('../../../lib/auth',()=>({getVisitor:async()=>({type:'registered',id:'registered-test'})}));
vi.mock('../../../lib/screenerData',()=>({loadScreenerStocks:load}));
import {GET} from './route';
it('reports an unavailable source as 503 rather than a successful empty market',async()=>{
 const log=vi.spyOn(console,'error').mockImplementation(()=>{});
 try{load.mockRejectedValue(new Error('Internal database diagnostic'));const r=await GET(new Request('https://local.test/api/screener'));const body=await r.json();expect(r.status).toBe(503);expect(body.error).toContain('No se pudieron cargar');expect(JSON.stringify(body)).not.toContain('Internal database diagnostic');}finally{log.mockRestore();}
});
it('preserves complete successful registered-user responses',async()=>{
 const rows=[{ticker:'AAPL',pe:20},{ticker:'ALC.MC',pe:null}];load.mockResolvedValue(rows);const r=await GET(new Request('https://local.test/api/screener'));expect(r.status).toBe(200);expect(await r.json()).toEqual({stocks:rows,limited:false});
});
