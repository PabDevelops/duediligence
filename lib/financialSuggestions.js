import {overrideTarget,validateFinancialOverride,cleanOverrideMetadata,financialOverrideStorageTarget} from './financialOverrides';
import {parseFiscalDateInput,formatFiscalDateInput} from './fiscalDateInput';

export const SUGGESTION_STATUSES=['pending','accepted','rejected'];
export const SUGGESTION_METADATA_FIELDS=['basis','fiscalQuarter','currency','scope','periodStart','periodEnd','sourceUrl','note'];
export function suggestionMetadata(input={}){
  return Object.fromEntries(SUGGESTION_METADATA_FIELDS.filter(k=>typeof input?.[k]==='string').map(k=>[k,input[k]]));
}
export const suggestionFormMetadata=m=>({...suggestionMetadata(m),periodStart:formatFiscalDateInput(m?.periodStart)||m?.periodStart||'',periodEnd:formatFiscalDateInput(m?.periodEnd)||m?.periodEnd||''});
export const documentedSuggestionMetadata=m=>({...suggestionMetadata(m),periodStart:parseFiscalDateInput(m?.periodStart||'')??(m?.periodStart?.trim()||''),periodEnd:parseFiscalDateInput(m?.periodEnd||'')??(m?.periodEnd?.trim()||'')});
export function parseSuggestionNumber(text){
 const value=String(text??'').trim().replace(',','.');if(!value)return null;
 if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value)||!Number.isFinite(Number(value))||Math.abs(Number(value))>1e18)throw new Error('Introduce un número sin separadores de miles; puedes usar coma decimal.');
 return Number(value);
}
const numeric=v=>v===null||Number.isFinite(v)&&Math.abs(v)<=1e18;
export function validateSuggestion(body){
  if(!body||typeof body!=='object'||Array.isArray(body))return 'Sugerencia no válida.';
  if(!/^[A-Z0-9][A-Z0-9.^=-]{0,24}$/.test(body.ticker||'')||!overrideTarget(body.target))return 'Empresa o partida no válida.';
  if(typeof body.label!=='string'||!body.label.trim()||body.label.length>180)return 'Nombre de la partida no válido.';
  if(!numeric(body.proposedValue)||!numeric(body.observedValue))return 'Introduce un número válido sin separadores de miles, o deja vacío para proponer N/D.';
  if(typeof body.reason!=='string'||body.reason.trim().length<8||body.reason.length>1000)return 'Explica el problema en entre 8 y 1000 caracteres.';
  for(const metadata of [body.proposedMetadata,body.observedMetadata]){
    if(!metadata||typeof metadata!=='object'||Array.isArray(metadata))return 'Documentación no válida.';
    for(const [k,v] of Object.entries(metadata))if(typeof v!=='string'||v.length>(k==='sourceUrl'?2048:k==='note'?1000:180))return 'La documentación no es texto o supera el tamaño permitido.';
  }
  const source=body.proposedMetadata.sourceUrl;
  if(typeof source!=='string'||source.trim().length<3)return 'Añade una fuente o referencia para revisar la propuesta.';
  if(/^[a-z][a-z0-9+.-]*:/i.test(source)){
    try{const u=new URL(source);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)return 'Utiliza una referencia o un enlace público HTTP/HTTPS sin credenciales.';}
    catch{return 'Enlace de fuente no válido.';}
  }
  return null;
}
export function financialSuggestionSnapshot(data,target,point){
  const t=overrideTarget(target);if(!t)return {value:null,metadata:{}};
  const correction=data?.manualCorrections?.find(r=>r.target===target);
  let p=correction?.period||point;
  let value=correction?correction.value:point?point.val:undefined;
  if(value===undefined){
    if(t.indicatorPeriod){const record=data?.reportedIndicators?.find(r=>r.target===target);value=record?.value;p=record?.period;}
    else if(t.history){
      p=(t.ttmHistory?data?.ttmHistories?.[t.history]:t.quarterHistory?data?.quarterlyHistories?.[t.history]:data?.[t.history])?.find(x=>t.ttmHistory?x.periodEnd===t.periodEnd:t.quarterHistory?x.fiscalYear===t.year&&x.fiscalQuarter===t.quarter:String(x.year)===t.year);
      value=p?.val;
    }else{value=data?.[t.field];p=data?.financialPeriods?.[t.field]||data?.financialPeriods?.[t.field.replace(/Val$/,'')]||data?.financialIntegrity?.fields?.[t.field]?.period;}
  }
  return {value:Number.isFinite(value)?value:null,metadata:suggestionMetadata({...p,sourceUrl:p?.sourceReference||p?.sourceUrl||p?.source||''})};
}
export function prepareSuggestionReview(suggestion,body){
  if(!suggestion||suggestion.status!=='pending')throw new Error('Esta sugerencia ya ha sido revisada. Recarga la bandeja.');
  if(!['accepted','rejected'].includes(body?.action))throw new Error('Acción no válida.');
  if(typeof body.note!=='string'||body.note.length>1000)throw new Error('Nota de revisión no válida.');
  if(body.action==='rejected')return {action:'rejected',note:body.note};
  const metadata=suggestionMetadata(body.metadata);
  const target=financialOverrideStorageTarget(suggestion.target,metadata);
  const override={ticker:suggestion.ticker,target,value:body.value,metadata,expectedId:body.expectedId};
  const error=validateFinancialOverride(override);if(error)throw new Error(error);
  return {action:'accepted',note:body.note,...override,metadata:cleanOverrideMetadata(metadata,target)};
}
