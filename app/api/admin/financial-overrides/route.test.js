import {describe,it,expect,vi,beforeEach} from 'vitest';
const state=vi.hoisted(()=>({admin:true,user:'actor-from-server',enabled:true,rows:[],error:null,result:12}));
vi.mock('../../../../lib/isAdmin',()=>({checkIsAdmin:vi.fn(async()=>state.admin)}));
vi.mock('../../../../lib/auth',()=>({getUserId:vi.fn(async()=>state.user)}));
vi.mock('../../../../lib/supabase',()=>({supabase:{rpc:vi.fn(async()=>({data:state.result,error:state.error}))}}));
vi.mock('../../../../lib/financialOverrideStore',()=>({financialOverridesEnabled:()=>state.enabled,loadFinancialOverrides:vi.fn(async()=>state.rows),invalidateFinancialOverrideCache:vi.fn()}));
vi.mock('../../../../lib/screenerData',()=>({invalidateScreenerCache:vi.fn()}));
import {GET,POST} from './route';
import {supabase} from '../../../../lib/supabase';
const metadata={basis:'unknown',currency:'USD',scope:'provider-unspecified',note:'Informe revisado'};
const body=()=>({ticker:'TEST',target:'rdVal',value:10,metadata,expectedId:0});
const request=(data=body(),origin='https://bulltrace.test')=>new Request('https://bulltrace.test/api/admin/financial-overrides',{method:'POST',headers:{'Content-Type':'application/json',origin},body:JSON.stringify(data)});
describe('admin financial corrections access and writes',()=>{
 beforeEach(()=>{state.admin=true;state.user='actor-from-server';state.enabled=true;state.rows=[];state.error=null;vi.clearAllMocks();});
 it('denies both reading and writing for non-admin users before touching storage',async()=>{
  state.admin=false;expect((await GET(new Request('https://bulltrace.test/api/admin/financial-overrides?ticker=TEST'))).status).toBe(403);
  expect((await POST(request())).status).toBe(403);expect(supabase.rpc).not.toHaveBeenCalled();
 });
 it('stays disabled until its migration and flag are deliberately activated',async()=>{
  state.enabled=false;expect((await POST(request())).status).toBe(503);expect(supabase.rpc).not.toHaveBeenCalled();
 });
 it('ignores spoofed client identity and records the authenticated server identity',async()=>{
  expect((await POST(request({...body(),actor:'spoof',user_id:'spoof'}))).status).toBe(200);
  expect(supabase.rpc).toHaveBeenCalledWith('set_financial_override',expect.objectContaining({p_actor:'actor-from-server',p_value:10,p_active:true,p_expected_id:0}));
 });
 it('rejects cross-origin writes and disallowed fields',async()=>{
  expect((await POST(request(body(),'https://evil.test'))).status).toBe(403);
  expect((await POST(request({...body(),target:'growthScore'}))).status).toBe(400);
  expect(supabase.rpc).not.toHaveBeenCalled();
 });
 it('returns conflicts without silently overwriting a concurrent correction',async()=>{
  state.error={code:'40001'};expect((await POST(request())).status).toBe(409);
 });
 it('stores a partial ROA under a distinct fiscal key, preserving the principal and other periods',async()=>{
  const m={basis:'H1',periodStart:'2026-01-01',periodEnd:'2026-06-30',currency:'USD',scope:'consolidated',note:'ROA H1 no anualizado',roaBasis:{annualized:false,denominator:'average-assets',assetsStartDate:'2025-12-31',assetsEndDate:'2026-06-30'}};
  expect((await POST(request({...body(),target:'roa',value:3.5,metadata:m}))).status).toBe(200);
  expect(supabase.rpc).toHaveBeenCalledWith('set_financial_override',expect.objectContaining({p_target:'period:roa:H1:2026-06-30',p_value:3.5,p_metadata:expect.objectContaining({basis:'H1',roaBasis:m.roaBasis})}));
  expect((await POST(request({...body(),target:'roa',metadata:{...m,roaBasis:{...m.roaBasis,annualized:true}}}))).status).toBe(400);
  expect(supabase.rpc).toHaveBeenCalledTimes(1);
 });
 it('resets only the chosen independent period with its own concurrency version',async()=>{
  expect((await POST(request({ticker:'TEST',target:'period:roa:H1:2026-06-30',reset:true,expectedId:12}))).status).toBe(200);
  expect(supabase.rpc).toHaveBeenCalledWith('set_financial_override',expect.objectContaining({p_target:'period:roa:H1:2026-06-30',p_active:false,p_expected_id:12}));
 });
 it('restores the provider by appending an inactive revision, not deleting history',async()=>{
  expect((await POST(request({ticker:'TEST',target:'rdVal',reset:true,expectedId:12}))).status).toBe(200);
  expect(supabase.rpc).toHaveBeenCalledWith('set_financial_override',expect.objectContaining({p_value:null,p_active:false,p_expected_id:12}));
 });
 it('does not claim success when storage fails',async()=>{
  state.error={code:'42P01'};expect((await POST(request())).status).toBe(503);
 });
 it('returns only corrections of the requested ticker without caching admin responses',async()=>{
  state.rows=[{ticker:'TEST',target:'rdVal'},{ticker:'OTHER',target:'roic'}];
  const r=await GET(new Request('https://bulltrace.test/api/admin/financial-overrides?ticker=TEST'));
  expect((await r.json()).overrides).toEqual([{ticker:'TEST',target:'rdVal'}]);expect(r.headers.get('Cache-Control')).toBe('no-store');
 });
});
