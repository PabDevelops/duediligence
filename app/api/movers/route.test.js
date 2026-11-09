import {it,expect,vi} from 'vitest';
const load=vi.hoisted(()=>vi.fn());
vi.mock('../../../lib/moversData',()=>({loadMoversRows:load}));
import {GET} from './route';
it('preserves age and ranking exclusions when serving compact cached rows',async()=>{
 const now=new Date().toISOString();load.mockResolvedValue([{ticker:'VALID',updated_at:now,priceChangePct:5,score:70,cbs:60,oppo:40,roic:250},{ticker:'MISSING',updated_at:now,priceChangePct:0,score:null,cbs:null,oppo:null,roic:null},{ticker:'OLD',updated_at:new Date(Date.now()-25*3600000).toISOString(),priceChangePct:99,score:100,roic:100}]);
 const r=await GET(new Request('https://local.test/api/movers'));const d=await r.json();expect(r.status).toBe(200);expect(d.gainers.map(s=>s.ticker)).toEqual(['VALID','MISSING']);expect(d.topScore.map(s=>s.ticker)).toEqual(['VALID']);expect(d.topRoic).toEqual([]);expect(d.coverage.companies).toBe(2);
});
