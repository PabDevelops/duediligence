import {describe,it,expect,vi,beforeEach} from 'vitest';
const state=vi.hoisted(()=>({admin:true,user:'server-admin',enabled:true,item:null,dbError:null,rpcError:null,stockError:null,rows:[]}));
vi.mock('../../../../lib/isAdmin',()=>({checkIsAdmin:async()=>state.admin}));
vi.mock('../../../../lib/auth',()=>({getUserId:async()=>state.user}));
vi.mock('../../../../lib/financialOverrideStore',()=>({financialOverridesEnabled:()=>state.enabled,invalidateFinancialOverrideCache:vi.fn()}));
vi.mock('../../../../lib/screenerData',()=>({invalidateScreenerCache:vi.fn()}));
vi.mock('../../../../lib/supabase',()=>({supabase:{
 rpc:vi.fn(async()=>({data:99,error:state.rpcError})),
 from:vi.fn(table=>{const q={select:()=>q,eq:()=>q,order:()=>q,limit:()=>q,lt:()=>q,maybeSingle:async()=>({data:table==='financial_data_suggestions'?state.item:null,error:table==='stock_cache'?state.stockError:state.dbError}),then:(resolve,reject)=>Promise.resolve({data:state.rows,error:state.dbError}).then(resolve,reject)};return q;}),
}}));
import {GET,PATCH} from './route';
import {supabase} from '../../../../lib/supabase';
import {invalidateFinancialOverrideCache} from '../../../../lib/financialOverrideStore';
import {invalidateScreenerCache} from '../../../../lib/screenerData';
const request=(body,origin='https://bulltrace.test')=>new Request('https://bulltrace.test/api/admin/financial-suggestions',{method:'PATCH',headers:{'Content-Type':'application/json',origin},body:JSON.stringify(body)});
const approval=()=>({id:5,action:'accepted',value:30,expectedId:12,metadata:{sourceUrl:'Informe anual'},note:'Revisado',actor:'spoof',ticker:'OTHER',target:'growthScore'});
describe('private admin suggestion queue and atomic approval',()=>{
 beforeEach(()=>{Object.assign(state,{admin:true,user:'server-admin',enabled:true,item:{id:5,ticker:'TEST',target:'rdVal',status:'pending'},dbError:null,rpcError:null,stockError:null,rows:[]});vi.clearAllMocks();});
 it('denies reading and writing before accessing the database',async()=>{state.admin=false;expect((await GET(new Request('https://bulltrace.test/api/admin/financial-suggestions'))).status).toBe(403);expect((await PATCH(request(approval()))).status).toBe(403);expect(supabase.from).not.toHaveBeenCalled();expect(supabase.rpc).not.toHaveBeenCalled();});
 it('denies stale sessions and cross-origin writes',async()=>{state.user=null;expect((await PATCH(request(approval()))).status).toBe(401);state.user='server-admin';expect((await PATCH(request(approval(),'https://evil.test'))).status).toBe(403);expect(supabase.rpc).not.toHaveBeenCalled();});
 it('returns bounded private pagination with no cache',async()=>{state.rows=Array.from({length:31},(_,id)=>({id}));const r=await GET(new Request('https://bulltrace.test/api/admin/financial-suggestions'));const j=await r.json();expect(j.items).toHaveLength(30);expect(j.hasMore).toBe(true);expect(r.headers.get('cache-control')).toBe('no-store');});
 it.each(['?status=bad','?before=x','?id=x'])('rejects invalid filter %s',async q=>expect((await GET(new Request('https://bulltrace.test/api/admin/financial-suggestions'+q))).status).toBe(400));
 it('does not review against an unavailable current cache or revision snapshot',async()=>{state.stockError={code:'failure'};expect((await GET(new Request('https://bulltrace.test/api/admin/financial-suggestions?id=5'))).status).toBe(503);});
 it('accepts via the atomic review RPC using server identity and stored financial target',async()=>{expect((await PATCH(request(approval()))).status).toBe(200);expect(supabase.rpc).toHaveBeenCalledExactlyOnceWith('review_financial_suggestion',expect.objectContaining({p_actor:'server-admin',p_target:'rdVal',p_expected_id:12,p_value:30,p_metadata:expect.objectContaining({manual:true,storageFirst:true})}));expect(invalidateFinancialOverrideCache).toHaveBeenCalledOnce();expect(invalidateScreenerCache).toHaveBeenCalledOnce();});
 it('rejects without creating a financial revision or invalidating financial caches',async()=>{expect((await PATCH(request({id:5,action:'rejected',note:'Fuente insuficiente'}))).status).toBe(200);expect(supabase.rpc).toHaveBeenCalledWith('review_financial_suggestion',expect.objectContaining({p_action:'rejected',p_target:null,p_value:null,p_metadata:null,p_expected_id:null}));expect(invalidateFinancialOverrideCache).not.toHaveBeenCalled();expect(invalidateScreenerCache).not.toHaveBeenCalled();});
 it('blocks duplicate review, missing revisions and disabled financial edits',async()=>{state.item.status='accepted';expect((await PATCH(request(approval()))).status).toBe(409);state.item.status='pending';expect((await PATCH(request({...approval(),expectedId:undefined}))).status).toBe(400);state.enabled=false;expect((await PATCH(request(approval()))).status).toBe(503);expect(supabase.rpc).not.toHaveBeenCalled();});
 it.each([[{code:'40001'},409],[{code:'failure'},503]])('never claims success after a failed transaction %j',async(error,status)=>{state.rpcError=error;expect((await PATCH(request(approval()))).status).toBe(status);expect(invalidateFinancialOverrideCache).not.toHaveBeenCalled();});
});
