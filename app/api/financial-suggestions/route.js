import {getUserId} from '../../../lib/auth';
import {supabase} from '../../../lib/supabase';
import {rateLimit} from '../../../lib/rateLimit';
import {validateSuggestion,suggestionMetadata} from '../../../lib/financialSuggestions';
export const dynamic='force-dynamic';
export async function POST(request){
 const actor=await getUserId();if(!actor)return Response.json({error:'Inicia sesión para enviar una sugerencia.'},{status:401});
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return Response.json({error:'Origen no autorizado.'},{status:403});
 const limit=rateLimit(`financial-suggestion:${actor}`,{limit:5,windowMs:60000});
 if(!limit.ok)return Response.json({error:'Espera un minuto antes de enviar otra sugerencia.'},{status:429});
 if(Number(request.headers.get('content-length'))>20000)return Response.json({error:'La sugerencia es demasiado larga.'},{status:413});
 const body=await request.json().catch(()=>null),error=validateSuggestion(body);
 if(error)return Response.json({error},{status:400});
 const result=await supabase.rpc('submit_financial_suggestion',{
  p_reporter:actor,p_ticker:body.ticker,p_target:body.target,p_label:body.label.trim(),
  p_observed_value:body.observedValue,p_observed_metadata:suggestionMetadata(body.observedMetadata),
  p_proposed_value:body.proposedValue,p_proposed_metadata:suggestionMetadata(body.proposedMetadata),p_reason:body.reason.trim(),
 });
 if(result.error){
  const duplicate=result.error.code==='23505',limited=result.error.message?.includes('suggestion_rate_limit');
  return Response.json({error:duplicate?'Ya tienes una sugerencia pendiente para este dato.':limited?'Has alcanzado el límite de 10 sugerencias en 24 horas.':'No se pudo enviar la sugerencia. Inténtalo más tarde.'},{status:duplicate?409:limited?429:503});
 }
 return Response.json({ok:true,id:result.data},{status:201,headers:{'Cache-Control':'no-store'}});
}
