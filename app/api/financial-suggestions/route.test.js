import {describe,it,expect,vi,beforeEach} from 'vitest';
const state=vi.hoisted(()=>({user:'server-user',allowed:true,error:null}));
vi.mock('../../../lib/auth',()=>({getUserId:async()=>state.user}));
vi.mock('../../../lib/rateLimit',()=>({rateLimit:()=>({ok:state.allowed})}));
vi.mock('../../../lib/supabase',()=>({supabase:{rpc:vi.fn(async()=>({data:123,error:state.error}))}}));
import {POST} from './route';
import {supabase} from '../../../lib/supabase';
const body=()=>({ticker:'TEST',target:'rdVal',label:'I+D',observedValue:null,proposedValue:30,observedMetadata:{},proposedMetadata:{sourceUrl:'Informe oficial'},reason:'El dato parece incorrecto',reporter:'spoof',status:'accepted'});
const request=(b=body(),origin='https://bulltrace.test')=>new Request('https://bulltrace.test/api/financial-suggestions',{method:'POST',headers:{'Content-Type':'application/json',origin},body:JSON.stringify(b)});
describe('financial suggestion submission access',()=>{
 beforeEach(()=>{state.user='server-user';state.allowed=true;state.error=null;vi.clearAllMocks();});
 it('requires login and same-origin requests before writing',async()=>{state.user=null;expect((await POST(request())).status).toBe(401);state.user='server-user';expect((await POST(request(body(),'https://evil.test'))).status).toBe(403);expect(supabase.rpc).not.toHaveBeenCalled();});
 it('stores only a proposal using the server identity, never a financial override',async()=>{const response=await POST(request());expect(response.status).toBe(201);expect(response.headers.get('cache-control')).toBe('no-store');expect(supabase.rpc).toHaveBeenCalledExactlyOnceWith('submit_financial_suggestion',expect.objectContaining({p_reporter:'server-user',p_proposed_value:30}));expect(supabase.rpc.mock.calls[0][1]).not.toHaveProperty('status');});
 it('rejects malformed values before storage',async()=>{expect((await POST(request({...body(),proposedValue:'30'}))).status).toBe(400);expect(supabase.rpc).not.toHaveBeenCalled();});
 it('limits bursts without storage writes',async()=>{state.allowed=false;expect((await POST(request())).status).toBe(429);expect(supabase.rpc).not.toHaveBeenCalled();});
 it.each([[{code:'23505'},409],[{message:'suggestion_rate_limit'},429],[{code:'42P01'},503]])('reports database failure %j',async(error,status)=>{state.error=error;expect((await POST(request())).status).toBe(status);});
});
