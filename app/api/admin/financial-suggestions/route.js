import {checkIsAdmin} from '../../../../lib/isAdmin';
import {getUserId} from '../../../../lib/auth';
import {supabase} from '../../../../lib/supabase';
import {prepareSuggestionReview,financialSuggestionSnapshot,SUGGESTION_STATUSES} from '../../../../lib/financialSuggestions';
import {sanitizeFinancialData} from '../../../../lib/financialIntegrity';
import {applyFinancialOverrides} from '../../../../lib/financialOverrides';
import {financialOverridesEnabled,invalidateFinancialOverrideCache} from '../../../../lib/financialOverrideStore';
import {invalidateScreenerCache} from '../../../../lib/screenerData';
export const dynamic='force-dynamic';
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(request){
 if(!await checkIsAdmin())return json({error:'No autorizado.'},403);
 const q=new URL(request.url).searchParams,id=q.get('id');
 if(id){
  if(!/^\d+$/.test(id))return json({error:'Identificador no válido.'},400);
  const {data:item,error}=await supabase.from('financial_data_suggestions').select('*').eq('id',id).maybeSingle();
  if(error)return json({error:'No se pudo cargar la sugerencia.'},503);if(!item)return json({error:'Sugerencia no encontrada.'},404);
  const [revisions,stock]=await Promise.all([
   supabase.from('current_financial_overrides').select('id,target,value,metadata,active').eq('ticker',item.ticker),
   supabase.from('stock_cache').select('data,updated_at').eq('ticker',item.ticker).maybeSingle(),
  ]);
  if(revisions.error||stock.error)return json({error:'No se pudo contrastar el valor actual. Recarga antes de revisar.'},503);
  const current=stock.data?.data?applyFinancialOverrides(sanitizeFinancialData(stock.data.data),(revisions.data||[]).map(r=>({...r,ticker:item.ticker})),{manualAuthority:true}):null;
  return json({item,revisions:revisions.data||[],current:financialSuggestionSnapshot(current,item.target),cacheUpdatedAt:stock.data?.updated_at||null,canAccept:financialOverridesEnabled()});
 }
 const status=q.get('status')||'pending',before=q.get('before');
 if(status!=='all'&&!SUGGESTION_STATUSES.includes(status)||before&&!/^\d+$/.test(before))return json({error:'Filtro no válido.'},400);
 let query=supabase.from('financial_data_suggestions').select('*').order('id',{ascending:false}).limit(31);
 if(status!=='all')query=query.eq('status',status);if(before)query=query.lt('id',before);
 const {data,error}=await query;if(error)return json({error:'No se pudo cargar la bandeja.'},503);
 return json({items:(data||[]).slice(0,30),hasMore:(data||[]).length>30});
}
export async function PATCH(request){
 if(!await checkIsAdmin())return json({error:'No autorizado.'},403);
 const actor=await getUserId();if(!actor)return json({error:'Sesión caducada.'},401);
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return json({error:'Origen no autorizado.'},403);
 const body=await request.json().catch(()=>null);
 if(!Number.isSafeInteger(body?.id)||body.id<=0)return json({error:'Identificador no válido.'},400);
 const {data:item,error}=await supabase.from('financial_data_suggestions').select('*').eq('id',body.id).maybeSingle();
 if(error)return json({error:'No se pudo cargar la sugerencia.'},503);if(!item)return json({error:'Sugerencia no encontrada.'},404);
 let review;try{review=prepareSuggestionReview(item,body);}catch(e){return json({error:e.message},item.status==='pending'?400:409);}
 if(review.action==='accepted'&&!financialOverridesEnabled())return json({error:'La edición financiera está desactivada.'},503);
 const result=await supabase.rpc('review_financial_suggestion',{
  p_id:item.id,p_actor:actor,p_action:review.action,p_note:review.note,p_target:review.target||null,
  p_value:review.value??null,p_metadata:review.metadata||null,p_expected_id:review.expectedId??null,
 });
 if(result.error)return json({error:result.error.code==='40001'?'El dato o la sugerencia han cambiado. Recarga y revisa antes de aceptar.':'No se pudo guardar la revisión.'},result.error.code==='40001'?409:503);
 if(review.action==='accepted'){invalidateFinancialOverrideCache();invalidateScreenerCache();}
 return json({ok:true,revisionId:result.data});
}
