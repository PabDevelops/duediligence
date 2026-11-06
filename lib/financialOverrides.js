import { HISTORY_FIELDS, samePeriod, validPeriod, cashFlowLessCapex, sanitizeFinancialData } from './financialIntegrity.js';
import { computeDerivedFinancials } from './financialStatements.js';

export const EDITABLE_FINANCIAL_FIELDS = [...new Set([...Object.values(HISTORY_FIELDS), 'wcChangeVal','eps','epsCagr','revGrowth','grossMargin','opMargin','netMargin','roe','roa','roic','pe','evEbitda','priceToBook','dividendYield','debtToEquity','dso','dio','dpo','ccc','inventoryTurnover','beta','sharesOutstanding','insiderOwnershipPct'])];
const ratios = new Set(EDITABLE_FINANCIAL_FIELDS.filter(f => !f.endsWith('Val') && !['eps','sharesOutstanding'].includes(f)));
const histories = Object.fromEntries(Object.entries(HISTORY_FIELDS).filter(([key])=>key!=='fcfHistory'));
export function overrideTarget(target) {
  if (EDITABLE_FINANCIAL_FIELDS.includes(target)) return { field: target };
  const indicator=/^period:roa:(H1|Q):(\d{4}-\d{2}-\d{2})$/.exec(target||'');
  if(indicator)return {field:'roa',indicatorPeriod:true,basis:indicator[1],periodEnd:indicator[2]};
  const match = /^history:([a-zA-Z]+History):(\d{4})$/.exec(target || '');
  return match && histories[match[1]] ? {history:match[1],field:histories[match[1]],year:match[2]} : null;
}
export function financialOverrideStorageTarget(target,metadata={}){
  const t=overrideTarget(target);
  return t?.field==='roa'&&!t.history&&['H1','Q'].includes(metadata.basis)?`period:roa:${metadata.basis}:${metadata.periodEnd}`:target;
}
export function validateFinancialOverride(body) {
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
export function cleanOverrideMetadata(m={},target) {
  const field=overrideTarget(target)?.field||'';
  return {basis:m.basis,currency:m.currency,unit:field.toLowerCase().includes('shares')?'shares':field==='eps'?`${m.currency}/shares`:ratios.has(field)?'pure':m.currency,scope:m.scope,periodStart:m.basis==='instant'?null:m.periodStart||null,periodEnd:m.periodEnd||null,
    source:'Corrección manual de administración',sourceUrl:m.sourceUrl||null,note:m.note?.trim()||'',manual:true,
    ...(field==='roa'&&['H1','Q'].includes(m.basis)?{roaBasis:{annualized:m.roaBasis?.annualized,denominator:m.roaBasis?.denominator,assetsStartDate:m.roaBasis?.assetsStartDate,assetsEndDate:m.roaBasis?.assetsEndDate}}:{})};
}
const derivedDependencies = {
  opMargin:['oiVal','revVal'],netMargin:['niVal','revVal'],grossMargin:['gpVal','revVal'],roe:['niVal','equityVal'],roa:['niVal','assetsVal'],
  roic:['oiVal','ebtVal','taxVal','assetsVal','currentLiabilitiesVal'],debtToEquity:['debtVal','equityVal'],netDebt:['debtVal','cashVal'],
  dso:['receivablesVal','revVal'],dio:['inventoryVal','cogsVal'],dpo:['payablesVal','cogsVal'],inventoryTurnover:['inventoryVal','cogsVal'],
};
export function applyFinancialOverrides(input, rows=[]) {
  if(!input||input.error||input.isEtf)return input;
  const active=rows.filter(r=>r.active&&(!r.ticker||r.ticker===input.ticker)&&overrideTarget(r.target));
  if(!active.length)return input;
  const d=structuredClone(input),changed=new Set(),explicit=new Map(active.filter(r=>!overrideTarget(r.target).history&&!overrideTarget(r.target).indicatorPeriod).map(r=>[overrideTarget(r.target).field,r])),annotations=[],indicators=[];
  d.financialPeriods={...d.financialPeriods};
  for(const r of active){
    const t=overrideTarget(r.target),period={...r.metadata,source:'Corrección manual de administración',manual:true};
    if(r.value!==null&&!Number.isFinite(r.value))continue;
    if(t.indicatorPeriod){
      if(validateFinancialOverride({...r,expectedId:0}))continue;
      indicators.push({target:r.target,field:t.field,value:r.value,period,id:r.id,updatedAt:r.created_at,status:'pending-review',modelExcluded:true});
      continue;
    }
    if(t.history){
      const key=t.history==='epsHistory'?'eps':'val';
      const points=(d[t.history]||[]).filter(p=>String(p.year||p.periodEnd?.slice(0,4))!==t.year);
      const p={...period,year:t.year,[key]:r.value};
      d[t.history]=[...points,p].sort((a,b)=>String(a.year).localeCompare(String(b.year)));
      if(!explicit.has(t.field)&&samePeriod(d.financialPeriods[t.field],p)){d[t.field]=r.value;d.financialPeriods[t.field]=period;changed.add(t.field);}
    }else{explicit.set(t.field,r);d[t.field]=r.value;d.financialPeriods[t.field]=period;changed.add(t.field);}
    const previous=input.manualCorrections?.find(p=>p.target===r.target);
    const providerPoint=t.history?(input[t.history]||[]).find(p=>String(p.year||p.periodEnd?.slice(0,4))===t.year):null;
    annotations.push({target:r.target,field:t.field,value:r.value,period,updatedAt:r.created_at,id:r.id,providerValue:previous?previous.providerValue:t.history?providerPoint?.val??null:input[t.field]??null});
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
  if(!annotations.length&&!changed.size)return {...input,reportedIndicators:indicators.sort((a,b)=>a.target.localeCompare(b.target))};
  const result=sanitizeFinancialData(d);
  result.reportedIndicators=indicators.sort((a,b)=>a.target.localeCompare(b.target));
  for(const field of changed)if(Number.isFinite(result[field])&&result.financialIntegrity?.fields?.[field]?.status!=='blocked'){
    result.financialIntegrity.fields[field]={...result.financialIntegrity.fields[field],status:'provisional',manual:true};
  }
  for(const r of annotations){if(!r.target.startsWith('history:')&&result.financialIntegrity?.fields?.[r.field]?.status!=='blocked'){
    result.financialIntegrity.fields[r.field]={...result.financialIntegrity.fields[r.field],status:'provisional',manual:true,source:'Corrección manual de administración',period:r.period};
  }}
  if(result.financialIntegrity){result.financialIntegrity.status='provisional';result.financialIntegrity.issues.push({code:'ADMIN_CORRECTION',severity:'warning',field:'financials',message:'Hay correcciones manuales de administración. Se conservan hasta que se editen o se restaure el proveedor; no son una verificación automática.'});}
  result.manualCorrections=annotations;
  return result;
}
export function isRatioField(field){return ratios.has(field);}
