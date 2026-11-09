import {beforeEach,it,expect,vi} from 'vitest';
const s=vi.hoisted(()=>({user:{id:'registered',email_confirmed_at:'2026-01-01'},authError:null,budget:'reservation',budgetError:null}));
const mocks=vi.hoisted(()=>({getUser:vi.fn(),rpc:vi.fn(),create:vi.fn(),update:vi.fn(),constructor:vi.fn()}));
vi.mock('./supabase/server',()=>({createClient:async()=>({auth:{getUser:mocks.getUser}})}));
vi.mock('./supabase',()=>({supabase:{rpc:mocks.rpc,from:()=>({update:mocks.update})}}));
vi.mock('@anthropic-ai/sdk',()=>({default:class{constructor(options){mocks.constructor(options);this.messages={create:mocks.create};}}}));
import {translateDescription,MAX_TRANSLATION_INPUT_CHARS} from './translateDescription';
const request=new Request('https://example.test/api/stock?ticker=AAPL',{headers:{cookie:'sb-project-auth-token.0=session'}});
beforeEach(()=>{
 vi.clearAllMocks();vi.stubEnv('ANTHROPIC_API_KEY','unit-test-only');s.user={id:'registered',email_confirmed_at:'2026-01-01'};s.authError=null;s.budget='reservation';s.budgetError=null;
 mocks.getUser.mockImplementation(async()=>({data:{user:s.user},error:s.authError}));mocks.rpc.mockImplementation(async()=>({data:s.budget,error:s.budgetError}));
 mocks.create.mockResolvedValue({content:[{type:'text',text:'Empresa de tecnología.'}],stop_reason:'end_turn',usage:{input_tokens:100,output_tokens:20}});
 mocks.update.mockReturnValue({eq:async()=>({error:null})});
});
it('never calls the provider, budget or auth service for anonymous public/cron reads',async()=>{
 for(const context of [undefined,{}, {request:new Request('https://example.test')},{request:new Request('https://example.test',{headers:{cookie:'tq_gid=guest'}})}])expect(await translateDescription('English description',context)).toBe('English description');
 expect(mocks.getUser).not.toHaveBeenCalled();expect(mocks.rpc).not.toHaveBeenCalled();expect(mocks.create).not.toHaveBeenCalled();
});
it.each([null,{id:'guest',is_anonymous:true,email_confirmed_at:'now'},{id:'unconfirmed'}])('does not trust a cookie or an unregistered/anonymous session: %j',async user=>{
 s.user=user;expect(await translateDescription('English',{request})).toBe('English');expect(mocks.rpc).not.toHaveBeenCalled();expect(mocks.create).not.toHaveBeenCalled();
});
it('requires verified auth and atomically reserved budget before the one paid call',async()=>{
 expect(await translateDescription('English',{request})).toBe('Empresa de tecnología.');expect(mocks.rpc).toHaveBeenCalledWith('reserve_ai_translation',{p_user_id:'registered',p_source_hash:expect.stringMatching(/^[a-f0-9]{64}$/)});
 expect(mocks.constructor).toHaveBeenCalledWith(expect.objectContaining({maxRetries:0,timeout:10000}));expect(mocks.create).toHaveBeenCalledTimes(1);expect(mocks.update).toHaveBeenCalledWith({status:'completed',input_tokens:100,output_tokens:20});
});
it.each(['cap-or-duplicate','database-error','auth-error','missing-key'])('fails closed on %s',async reason=>{
 if(reason==='cap-or-duplicate')s.budget=null;if(reason==='database-error')s.budgetError={message:'offline'};if(reason==='auth-error')s.authError={message:'invalid'};if(reason==='missing-key')vi.stubEnv('ANTHROPIC_API_KEY','');
 expect(await translateDescription('English',{request})).toBe('English');expect(mocks.create).not.toHaveBeenCalled();
});
it('caps input/output even for a huge description and never retries a timeout',async()=>{
 const text='a'.repeat(100000);mocks.create.mockRejectedValue(new Error('timeout'));
 expect(await translateDescription(text,{request})).toBe(text);expect(mocks.create).toHaveBeenCalledTimes(1);const call=mocks.create.mock.calls[0][0];expect(call.max_tokens).toBe(256);expect(call.messages[0].content.split('\n\n')[1].length).toBe(MAX_TRANSLATION_INPUT_CHARS);expect(mocks.update).toHaveBeenCalledWith({status:'failed'});
});
it('does not publish a response truncated by the provider output limit',async()=>{
 mocks.create.mockResolvedValue({content:[{type:'text',text:'Incomplete'}],stop_reason:'max_tokens'});expect(await translateDescription('English',{request})).toBe('English');expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({status:'failed'}));
});
