import {it,expect,vi} from 'vitest';
const mocks=vi.hoisted(()=>({load:vi.fn(),visitor:vi.fn()}));
vi.mock('../../../lib/auth',()=>({getVisitor:mocks.visitor}));
vi.mock('../../../lib/screenerData',()=>({loadScreenerStocks:mocks.load}));
import {GET} from './route';
it('returns 410 for old public, refresh and signed-in calls without reading auth or the financial universe',async()=>{
 for(const query of ['', '?refresh=true','?ticker=AAPL']){
  const response=await GET(new Request('https://local.test/api/screener'+query,{headers:{cookie:'sb-test-auth-token=session'}}));
  expect(response.status).toBe(410);expect(await response.json()).toEqual({stocks:[],error:'El screener ya no está disponible.'});
 }
 expect(mocks.load).not.toHaveBeenCalled();expect(mocks.visitor).not.toHaveBeenCalled();
});