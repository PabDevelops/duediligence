import { HISTORY_FIELDS, samePeriod, validPeriod, cashFlowLessCapex, sanitizeFinancialData } from './financialIntegrity.js';
import { computeDerivedFinancials } from './financialStatements.js';
import {periodRelation} from './financialDataPolicy.js';
import {evaluatePeriodicReturn} from './periodicReturns.js';
import {validateManualFcfHistory} from './manualFcfHistory.js';
import {authoritativeManualInputs} from './manualCalculationPolicy.js';
import {quarterlyHistoryTarget,applyQuarterlyFinancialHistory} from './quarterlyFinancialHistory.js';

export const EDITABLE_FINANCIAL_FIELDS = [...new Set([...Object.values(HISTORY_FIELDS), 'wcChangeVal','eps','epsCagr','revGrowth','grossMargin','opMargin','netMargin','roe','roa','roic','pe','evEbitda','priceToBook','dividendYield','debtToEquity','dso','dio','dpo','ccc','inventoryTurnover','beta','sharesOutstanding','insiderOwnershipPct'])];
const ratios = new Set(EDITABLE_FINANCIAL_FIELDS.filter(f => !f.endsWith('Val') && !['eps','sharesOutstanding'].includes(f)));
const histories = HISTORY_FIELDS;
export function overrideTarget(target) {
  if (EDITABLE_FINANCIAL_FIELDS.includes(target)) return { field: target };
  const quarterly=quarterlyHistoryTarget(target);if(quarterly)return quarterly;
  const indicator=/^period:(roa|roe):(H1|Q):(\d{4}-\d{2}-\d{2})$/.exec(target||'');
  if(indicator)return {field:indicator[1],indicatorPeriod:true,basis:indicator[2],periodEnd:indicator[3]};
  const match = /^history:([a-zA-Z]+History):(\d{4})$/.exec(target || '');
  return match && histories[match[1]] ? {history:match[1],field:histories[match[1]],year:match[2]} : null;
}
export function financialOverrideStorageTarget(target,metadata={}){
  metadata=metadata||{};
  const t=overrideTarget(target);
  if(t?.history&&!t.quarterHistory&&['Q','instant'].includes(metadata.basis)&&/^Q[1-4]$/.test(metadata.fiscalQuarter||''))return `${target}:${metadata.fiscalQuarter}`;
  return ['roa','roe'].includes(t?.field)&&!t.history&&['H1','Q'].includes(metadata.basis)&&/^\d{4}-\d{2}-\d{2}$/.test(metadata.periodEnd||'')?`period:${t.field}:${metadata.basis}:${metadata.periodEnd}`:target;
}
// Storage validates access-controlled shape and technical limits, never accounting compatibility.
export function validateFinancialOverride(body) {
  if(!body||!/^[A-Z0-9][A-Z0-9.^=-]{0,24}$/.test(body.ticker||'')||!overrideTarget(body.target))return 'Empresa o partida no válida.';
  if(!Number.isSafeInteger(body.expectedId)||body.expectedId<0)return 'Falta la versión actual del dato. Recarga antes de guardar.';
  if(body.reset!==undefined&&typeof body.reset!=='boolean')return 'Acción de restauración no válida.';
  if(body.reset)return null;
  if(body.value!==null&&(!Number.isFinite(body.value)||Math.abs(body.value)>1e18))return 'Introduce un número finito entre −10¹⁸ y 10¹⁸, sin separadores de miles.';
  if(body.metadata!=null&&(typeof body.metadata!=='object'||Array.isArray(body.metadata)))return 'Documentación no válida.';
  const m=body.metadata||{};
  for(const [key,max] of Object.entries({basis:80,currency:80,scope:80,periodStart:80,periodEnd:80,note:1000,sourceUrl:2048}))if(m[key]!=null&&(typeof m[key]!=='string'||m[key].length>max))return 'La documentación supera el tamaño permitido o no es texto.';
  for(const b of [m.roaBasis,m.returnBasis]){
    if(b!=null&&(typeof b!=='object'||Array.isArray(b)))return 'Documentación del denominador no válida.';
    for(const k of ['assetsStartDate','assetsEndDate','denominator'])if(b?.[k]!=null&&(typeof b[k]!=='string'||b[k].length>80))return 'Documentación del denominador no válida.';
    if(b?.annualized!=null&&typeof b.annualized!=='boolean')return 'Documentación de anualización no válida.';
  }
  if(m.fcfInputs!=null&&(typeof m.fcfInputs!=='object'||Array.isArray(m.fcfInputs)))return 'Componentes de caja no válidos.';
  for(const k of ['operatingCF','capex'])if(m.fcfInputs?.[k]!=null&&(!Number.isFinite(m.fcfInputs[k])||Math.abs(m.fcfInputs[k])>1e18))return 'Los componentes de caja deben ser números finitos.';
  return null;
}
export function financialOverrideCalculationIssue(row) {
  const m=row.metadata||{};
  if(!validPeriod(m)||!m.currency)return 'Falta documentar un periodo y moneda utilizables para cálculos.';
  return legacyCalculationValidation({...row,expectedId:0,metadata:{...m,note:'Dato manual'}});
}
function legacyCalculationValidation(body) {
  if (!body || !/^[A-Z0-9][A-Z0-9.^=-]{0,24}$/.test(body.ticker || '') || !overrideTarget(body.target)) return 'Empresa o partida no válida.';
  if (!Number.isSafeInteger(body.expectedId) || body.expectedId < 0) return 'Falta la versión actual del dato. Recarga antes de guardar.';
  if(body.reset!==undefined&&typeof body.reset!=='boolean')return 'Acción de restauración no válida.';
  if (body.reset === true) return null;
  if (body.value !== null && (!Number.isFinite(body.value) || Math.abs(body.value) > 1e18)) return 'Introduce un número finito, sin separadores de miles.';
  const m=body.metadata;
  if (!m || !['unknown','FY','H1','Q','TTM','instant'].includes(m.basis)) return 'Selecciona el tipo de periodo.';
  if (!/^[A-Z]{3}$/.test(m.currency || '') && !['GBp','shares','pure'].includes(m.currency)) return 'Indica la moneda o unidad real.';
  if (!['consolidated','standalone','provider-unspecified'].includes(m.scope)) return 'Selecciona el perímetro.';
  const date=s=>!s || /^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
  if (!date(m.periodStart)||!date(m.periodEnd)||m.periodStart&&m.periodEnd&&m.periodStart>m.periodEnd) return 'Revisa las fechas fiscales.';
  if (['FY','H1','Q','TTM'].includes(m.basis)&&(!m.periodStart||!m.periodEnd)) return 'Indica el inicio y final del periodo, o selecciona «Sin verificar».';
  if (m.basis==='instant'&&!m.periodEnd) return 'Indica la fecha del balance.';
  if(m.basis!=='unknown'&&!validPeriod(m))return 'La duración no corresponde al tipo de periodo seleccionado.';
  const t=overrideTarget(body.target);
  if((t.field==='roa'&&['H1','Q'].includes(m.basis))||t.indicatorPeriod){
    if(!t.indicatorPeriod||t.basis!==m.basis||t.periodEnd!==m.periodEnd)return 'El ROA parcial debe guardarse en su registro fiscal independiente.';
    if(!validPeriod(m))return 'Revisa el periodo fiscal del ROA independiente.';
    const b=m.roaBasis;
    const previousDay=new Date(Date.parse(m.periodStart)-86400000).toISOString().slice(0,10);
    if(b?.annualized!==false||b?.denominator!=='average-assets'||b.assetsStartDate!==previousDay||b.assetsEndDate!==m.periodEnd)return 'Indica ROA no anualizado y activos medios entre el cierre anterior al inicio y el cierre del periodo.';
  }
  if(body.value!=null&&body.value<0&&['assetsVal','currentAssetsVal','cashVal','debtVal','totalLiabilitiesVal','currentLiabilitiesVal','sharesVal','sharesBasicVal','sharesDilutedVal','sharesOutstanding'].includes(t.field))return 'Esta partida no admite valores negativos.';
  if (t.year && m.periodEnd && m.periodEnd.slice(0,4)!==t.year) return 'El ejercicio debe coincidir con la celda histórica.';
  if (typeof m.note!=='string'||m.note.trim().length<3||m.note.length>1000) return 'Añade una breve justificación de la corrección.';
  if (m.sourceUrl) {try{if(typeof m.sourceUrl!=='string'||m.sourceUrl.length>2048)return 'Enlace de fuente demasiado largo.';const u=new URL(m.sourceUrl);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)return 'La fuente debe ser un enlace público HTTP o HTTPS.';}catch{return 'Enlace de fuente no válido.';}}
  return null;
}
export function cleanOverrideMetadata(metadata={},target) {
  const m=metadata||{},field=overrideTarget(target)?.field||'';
  let sourceUrl=null;
  try{const u=new URL(m.sourceUrl);if(['http:','https:'].includes(u.protocol)&&!u.username&&!u.password)sourceUrl=u.href;}catch{}
  return {basis:m.basis||'unknown',currency:m.currency||null,unit:field.toLowerCase().includes('shares')?'shares':field==='eps'?(m.currency?`${m.currency}/shares`:null):ratios.has(field)?'pure':m.currency||null,scope:m.scope||'provider-unspecified',periodStart:m.periodStart||null,periodEnd:m.periodEnd||null,
    ...(overrideTarget(target)?.quarterHistory?{fiscalYear:overrideTarget(target).year,fiscalQuarter:overrideTarget(target).quarter}:{}),
    source:'Corrección manual de administración',sourceUrl,sourceReference:m.sourceUrl||null,note:m.note?.trim()||'',manual:true,storageFirst:true,
    ...(field==='roa'&&m.roaBasis?{roaBasis:{annualized:m.roaBasis.annualized,denominator:m.roaBasis.denominator,assetsStartDate:m.roaBasis.assetsStartDate,assetsEndDate:m.roaBasis.assetsEndDate}}:{}),
    ...(['roa','roe'].includes(field)&&m.returnBasis?{returnBasis:{annualized:m.returnBasis.annualized,denominator:m.returnBasis.denominator,assetsStartDate:m.returnBasis.assetsStartDate,assetsEndDate:m.returnBasis.assetsEndDate}}:{}),
    ...(field==='fcfVal'&&m.fcfInputs?{fcfInputs:{operatingCF:m.fcfInputs.operatingCF??null,capex:m.fcfInputs.capex??null}}:{})};
}
const derivedDependencies = {
  opMargin:['oiVal','revVal'],netMargin:['niVal','revVal'],grossMargin:['gpVal','revVal'],roe:['niVal','equityVal'],roa:['niVal','assetsVal'],
  roic:['oiVal','ebtVal','taxVal','assetsVal','currentLiabilitiesVal'],debtToEquity:['debtVal','equityVal'],netDebt:['debtVal','cashVal'],
  dso:['receivablesVal','revVal'],dio:['inventoryVal','cogsVal'],dpo:['payablesVal','cogsVal'],inventoryTurnover:['inventoryVal','cogsVal'],
};
const ratioEvidence={...derivedDependencies,pe:['eps'],priceToBook:['equityVal'],revGrowth:['revVal'],epsCagr:['niVal'],dividendYield:['dividendsPaidVal'],ccc:['receivablesVal','revVal','inventoryVal','cogsVal','payablesVal']};
const annualFlowRatios=new Set(['epsCagr','revGrowth','grossMargin','opMargin','netMargin','roe','roa','roic','evEbitda','dividendYield','dso','dio','dpo','ccc','inventoryTurnover']);
export function applyFinancialOverrides(input, rows=[],{manualAuthority=false}={}) {
  if(!input||input.error||input.isEtf)return input;
  const active=rows.filter(r=>r.active&&(!r.ticker||r.ticker===input.ticker)&&overrideTarget(r.target));
  if(!active.length)return input;
  const quarterly=active.filter(r=>overrideTarget(r.target).quarterHistory);
  if(quarterly.length)return applyQuarterlyFinancialHistory(applyFinancialOverrides(input,active.filter(r=>!overrideTarget(r.target).quarterHistory),{manualAuthority}),quarterly);
  const d=structuredClone(input),changed=new Set(),explicit=new Map(active.filter(r=>!overrideTarget(r.target).history&&!overrideTarget(r.target).indicatorPeriod).map(r=>[overrideTarget(r.target).field,r])),annotations=[],indicators=[],fcfRecords=[];
  const periodicChoice=new Map();
  if(manualAuthority)for(const r of active){const t=overrideTarget(r.target);if(t.indicatorPeriod&&!explicit.has(t.field)&&(!periodicChoice.has(t.field)||(r.id||0)>(periodicChoice.get(t.field).id||0)))periodicChoice.set(t.field,r);}
  d.financialPeriods={...d.financialPeriods};
  for(const r of active){
    const t=overrideTarget(r.target),period={...r.metadata,source:'Corrección manual de administración',manual:true};
    if(r.value!==null&&!Number.isFinite(r.value))continue;
    if(t.indicatorPeriod){
      if(validateFinancialOverride({...r,expectedId:0}))continue;
      indicators.push({target:r.target,field:t.field,value:r.value,period,id:r.id,updatedAt:r.created_at,status:'pending-review',modelExcluded:true,reason:financialOverrideCalculationIssue(r)||'Indicador independiente: no sustituye el ROA anual o TTM del motor.'});
      if(manualAuthority&&periodicChoice.get(t.field)===r){
        d[t.field]=r.value;d.financialPeriods[t.field]=period;changed.add(t.field);explicit.set(t.field,r);
        annotations.push({target:r.target,field:t.field,value:r.value,period,id:r.id,updatedAt:r.created_at,providerValue:input[t.field]??null,appliedToCurrent:true});
      }
      continue;
    }
    // Legacy editors used the principal key for H1 returns. Project that saved
    // record into its period view without rewriting or deleting its revision.
    if(!t.history&&['roe','roa'].includes(t.field)&&['H1','Q'].includes(period.basis))indicators.push({target:r.target,field:t.field,value:r.value,period,id:r.id,updatedAt:r.created_at});
    if(t.history==='fcfHistory'){
      const previous=input.manualCorrections?.find(p=>p.target===r.target),providerPoint=(input.fcfHistory||[]).find(p=>String(p.year)===t.year);
      const annotation={target:r.target,field:t.field,value:r.value,period,id:r.id,updatedAt:r.created_at,providerValue:previous?previous.providerValue:providerPoint?.val??null};
      annotations.push(annotation);fcfRecords.push(annotation);continue;
    }
    const documentationIssue=period.storageFirst?financialOverrideCalculationIssue(r):null;
    const currencyIssue=period.storageFirst&&period.currency&&input.currency&&period.currency!==input.currency?'La moneda documentada no coincide con la base monetaria del motor.':null;
    const ratioIssue=period.storageFirst&&ratios.has(t.field)&&((annualFlowRatios.has(t.field)&&['H1','Q','instant'].includes(period.basis))||(ratioEvidence[t.field]||[]).some(f=>{
      const edited=explicit.get(f);
      return Number.isFinite(edited?edited.value:d[f])&&periodRelation(period,edited?.metadata||d.financialPeriods[f]||d.financialPeriods[f.replace(/Val$/,'')])==='incompatible';
    }))?'El indicador tiene un periodo, moneda o perímetro incompatible con sus componentes del motor.':null;
    const exclusion=documentationIssue||currencyIssue||ratioIssue;
    if(t.history){
      const key=t.history==='epsHistory'?'eps':'val';
      const points=(d[t.history]||[]).filter(p=>String(p.year||p.periodEnd?.slice(0,4))!==t.year);
      const p={...period,year:t.year,[key]:exclusion&&!manualAuthority?null:r.value};
      d[t.history]=[...points,p].sort((a,b)=>String(a.year).localeCompare(String(b.year)));
      if(!explicit.has(t.field)&&samePeriod(d.financialPeriods[t.field],p)){d[t.field]=exclusion?null:r.value;d.financialPeriods[t.field]=period;changed.add(t.field);}
    }else{explicit.set(t.field,r);d[t.field]=exclusion&&!manualAuthority?null:r.value;d.financialPeriods[t.field]=period;changed.add(t.field);}
    const previous=input.manualCorrections?.find(p=>p.target===r.target);
    const providerPoint=t.history?(input[t.history]||[]).find(p=>String(p.year||p.periodEnd?.slice(0,4))===t.year):null;
    annotations.push({target:r.target,field:t.field,value:r.value,period,exclusion,updatedAt:r.created_at,id:r.id,providerValue:previous?previous.providerValue:t.history?providerPoint?.val??null:input[t.field]??null});
  }
  for(const r of fcfRecords){
    const validated=validateManualFcfHistory(r,d,new Set(active.map(x=>x.target)));
    r.exclusion=validated.reason;r.validatedPoint=validated.point;
    if(!explicit.has('fcfVal')&&samePeriod(d.financialPeriods.fcfVal,r.period)){
      d.fcfVal=validated.point?.val??null;d.financialPeriods.fcfVal=validated.point||r.period;changed.add('fcfVal');
    }
  }
  const scopes=new Set(fcfRecords.filter(r=>r.validatedPoint?.scope&&r.validatedPoint.scope!=='provider-unspecified').map(r=>r.validatedPoint.scope));
  const currencies=new Set(fcfRecords.filter(r=>r.validatedPoint).map(r=>r.validatedPoint.currency));
  if(scopes.size>1||currencies.size>1)for(const r of fcfRecords){
    r.exclusion='Los FCF manuales no forman una serie de moneda y perímetro homogéneos.';r.validatedPoint=null;
    if(samePeriod(d.financialPeriods.fcfVal,r.period)&&changed.has('fcfVal'))d.fcfVal=null;
  }
  // Reuse the existing financial arithmetic; replace only dependants of edited inputs.
  if(changed.size){
    const h=Object.fromEntries(Object.entries(HISTORY_FIELDS).map(([history,field])=>[history,Number.isFinite(d[field])?[{...d.financialPeriods[field],val:d[field]}]:[]]));
    const derived=computeDerivedFinancials(h);
    for(const [field,deps] of Object.entries(derivedDependencies))if(!explicit.has(field)&&deps.some(f=>changed.has(f))){d[field]=deps.every(f=>Number.isFinite(d[f]))?derived[field]:null;changed.add(field);}
    if(!explicit.has('ccc')&&['receivablesVal','revVal','inventoryVal','cogsVal','payablesVal'].some(f=>changed.has(f)))d.ccc=derived.ccc;
    if(!explicit.has('fcfVal')&&['operatingCFVal','capexVal'].some(f=>changed.has(f))){
      const fcf=cashFlowLessCapex([{...d.financialPeriods.operatingCFVal,val:d.operatingCFVal}],[{...d.financialPeriods.capexVal,val:d.capexVal}])[0];
      d.fcfVal=fcf?.val??null;d.financialPeriods.fcfVal=fcf||null;
      if(manualAuthority&&!fcf&&Number.isFinite(d.operatingCFVal)&&Number.isFinite(d.capexVal)){
        d.fcfVal=d.operatingCFVal-Math.abs(d.capexVal);
        d.financialPeriods.fcfVal={basis:'unknown',manual:true,source:'Cálculo con componentes manuales',inputPeriods:{operatingCF:d.financialPeriods.operatingCFVal,capex:d.financialPeriods.capexVal}};
      }
      changed.add('fcfVal');
    }
    if(changed.has('sharesVal')&&!explicit.has('sharesOutstanding'))d.sharesOutstanding=d.sharesVal;
    if(changed.has('sharesOutstanding')&&!explicit.has('sharesVal'))d.sharesVal=d.sharesOutstanding;
    const sharesChanged=changed.has('sharesVal')||changed.has('sharesOutstanding');
    if(sharesChanged)d.marketCap=Number.isFinite(d.currentPrice)&&Number.isFinite(d.sharesOutstanding)?d.currentPrice*d.sharesOutstanding:null;
    if(['fcfVal','sbcVal'].some(f=>changed.has(f))||sharesChanged){
      d.pfcf=d.fcfVal>0&&d.marketCap>0?+(d.marketCap/d.fcfVal).toFixed(1):null;
      d.fcfYield=Number.isFinite(d.fcfVal)&&d.marketCap>0?+(d.fcfVal/d.marketCap*100).toFixed(2):null;
    }
    if((sharesChanged||changed.has('debtVal')||changed.has('cashVal'))&&!explicit.has('evEbitda'))d.evEbitda=null;
    if(changed.has('eps')&&!explicit.has('pe'))d.pe=d.eps>0&&d.currentPrice>0?+(d.currentPrice/d.eps).toFixed(2):null;
  }
  // A separately stored indicator never rewrites the principal inputs or their
  // integrity flags. Its absence from the models is structural, not a waiver.
  const evaluateIndicators=data=>{
    const latest=new Map();
    for(const r of indicators){
      const key=JSON.stringify([r.field,r.period.basis,r.period.periodStart,r.period.periodEnd,r.period.currency,r.period.scope]);
      if(!latest.has(key)||(r.id||0)>(latest.get(key).id||0))latest.set(key,r);
    }
    return [...latest.values()].map(r=>({...r,...evaluatePeriodicReturn(r,data)})).sort((a,b)=>a.target.localeCompare(b.target));
  };
  if(!annotations.length&&!changed.size)return {...input,reportedIndicators:evaluateIndicators(input)};
  const result=sanitizeFinancialData(d);
  result.financialIntegrity ||= {version:2,status:'provisional',fields:{},calculations:{},issues:[],rejected:{}};
  for(const r of annotations)if(r.exclusion&&!overrideTarget(r.target).history)result.financialIntegrity.fields[r.field]={status:'blocked',manual:true,reason:r.exclusion,period:r.period};
  result.reportedIndicators=evaluateIndicators(result);
  for(const r of fcfRecords){
    const year=overrideTarget(r.target).year;
    result.fcfHistory=(result.fcfHistory||[]).filter(p=>String(p.year)!==year);
    if(r.validatedPoint)result.fcfHistory.push(r.validatedPoint);
    delete r.validatedPoint;
  }
  if(fcfRecords.length)result.fcfHistory.sort((a,b)=>String(a.year).localeCompare(String(b.year)));
  if(result.fcfHistory?.length)result.financialIntegrity.issues=result.financialIntegrity.issues.filter(i=>!(i.code==='FCF_HISTORY_BLOCKED'&&i.field==='fcfHistory'));
  for(const field of changed)if(Number.isFinite(result[field])&&result.financialIntegrity?.fields?.[field]?.status!=='blocked'){
    result.financialIntegrity.fields[field]={...result.financialIntegrity.fields[field],status:'provisional',manual:true};
  }
  for(const r of annotations){if(!r.target.startsWith('history:')&&result.financialIntegrity?.fields?.[r.field]?.status!=='blocked'){
    result.financialIntegrity.fields[r.field]={...result.financialIntegrity.fields[r.field],status:'provisional',manual:true,source:'Corrección manual de administración',period:r.period};
  }}
  if(result.financialIntegrity){result.financialIntegrity.status='provisional';result.financialIntegrity.issues.push({code:'ADMIN_CORRECTION',severity:'warning',field:'financials',message:'Hay correcciones manuales de administración. Se conservan hasta que se editen o se restaure el proveedor; no son una verificación automática.'});}
  for(const r of annotations){
    const t=overrideTarget(r.target),state=result.financialIntegrity?.fields?.[r.field];
    const point=t.history?(result[t.history]||[]).find(p=>String(p.year)===t.year):null;
    r.modelExcluded=!!r.exclusion||(!t.history&&(state?.status==='blocked'||state?.modelExcluded))||(!!t.history&&r.value!=null&&!Number.isFinite(point?.val));
    r.calculationStatus=r.modelExcluded?'excluded':r.value==null?'missing':'provisional';
    r.reason=r.exclusion||(r.modelExcluded?state?.reason||'El dato no es utilizable en la serie anual del motor.':null);
  }
  result.manualCorrections=annotations;
  return manualAuthority?authoritativeManualInputs(result,d,annotations,changed):result;
}
export function isRatioField(field){return ratios.has(field);}
