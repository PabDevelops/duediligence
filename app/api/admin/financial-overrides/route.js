import {checkIsAdmin} from '../../../../lib/isAdmin';
import {getUserId} from '../../../../lib/auth';
import {supabase} from '../../../../lib/supabase';
import {validateFinancialOverride,cleanOverrideMetadata,financialOverrideStorageTarget} from '../../../../lib/financialOverrides';
import {financialOverridesEnabled,loadFinancialOverrides,invalidateFinancialOverrideCache} from '../../../../lib/financialOverrideStore';
import {invalidateScreenerCache} from '../../../../lib/screenerData';
export const dynamic='force-dynamic';
export async function GET(request){
  if(!await checkIsAdmin())return Response.json({error:'No autorizado.'},{status:403});
  if(!financialOverridesEnabled())return Response.json({error:'La edición requiere activar la configuración y la migración de correcciones.'},{status:503});
  const ticker=new URL(request.url).searchParams.get('ticker')?.toUpperCase();
  try{invalidateFinancialOverrideCache();return Response.json({overrides:(await loadFinancialOverrides()).filter(r=>r.ticker===ticker)},{headers:{'Cache-Control':'no-store'}});}
  catch{return Response.json({error:'No se pudieron cargar las correcciones.'},{status:503});}
}
export async function POST(request){
  if(!await checkIsAdmin())return Response.json({error:'No autorizado.'},{status:403});
  if(!financialOverridesEnabled())return Response.json({error:'La edición no está activada.'},{status:503});
  const origin=request.headers.get('origin');
  if(origin&&origin!==new URL(request.url).origin)return Response.json({error:'Origen no autorizado.'},{status:403});
  const body=await request.json().catch(()=>null);
  if(body&&!body.reset)body.target=financialOverrideStorageTarget(body.target,body.metadata);
  const error=validateFinancialOverride(body);
  if(error)return Response.json({error},{status:400});
  const userId=await getUserId();if(!userId)return Response.json({error:'Sesión caducada.'},{status:401});
  const {data,error:dbError}=await supabase.rpc('set_financial_override',{
    p_ticker:body.ticker,p_target:body.target,p_value:body.reset?null:body.value,p_metadata:body.reset?{}:cleanOverrideMetadata(body.metadata,body.target),
    p_active:!body.reset,p_actor:userId,p_expected_id:body.expectedId,
  });
  if(dbError)return Response.json({error:dbError.code==='40001'?'El dato ha cambiado en otra sesión. Recarga y revisa antes de guardar.':'No se pudo guardar la corrección.'},{status:dbError.code==='40001'?409:503});
  invalidateFinancialOverrideCache();
  invalidateScreenerCache();
  return Response.json({ok:true,id:data},{headers:{'Cache-Control':'no-store'}});
}
