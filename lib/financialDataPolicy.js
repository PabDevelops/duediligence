// Compatibility is evidence-based; missing provenance is not evidence of a conflict.

import {HISTORY_FIELDS,validPeriod,samePeriod} from './financialIntegrity.js';

const number=Number.isFinite;

const fieldAliases={revVal:'rev',niVal:'ni',oiVal:'oi',fcfVal:'fcf',capexVal:'capex',operatingCFVal:'ocf'};

export function periodRelation(a,b) {

 if(a?.currency&&b?.currency&&a.currency!==b.currency)return 'incompatible';

 if(a?.scope&&b?.scope&&a.scope!=='provider-unspecified'&&b.scope!=='provider-unspecified'&&a.scope!==b.scope)return 'incompatible';

 if(a?.basis&&b?.basis&&a.basis!=='unknown'&&b.basis!=='unknown'&&a.basis!==b.basis&&a.basis!=='instant'&&b.basis!=='instant')return 'incompatible';

 if(a?.periodEnd&&b?.periodEnd&&a.periodEnd!==b.periodEnd)return 'incompatible';

 if(a?.periodStart&&b?.periodStart&&a.basis!=='instant'&&b.basis!=='instant'&&a.periodStart!==b.periodStart)return 'incompatible';

 if(a?.fiscalYear&&b?.fiscalYear&&a.fiscalYear!==b.fiscalYear)return 'incompatible';

 if(validPeriod(a)&&validPeriod(b)&&a.currency&&b.currency&&a.scope&&b.scope&&a.scope!=='provider-unspecified'&&b.scope!=='provider-unspecified')return 'verified';

 return 'provisional';

}

const yearOf=p=>p?.fiscalYear||p?.periodEnd?.slice(0,4)||p?.year;

export function joinAnnualEvidence(a=[],b=[]) {

 return a.flatMap(x=>{const matches=b.filter(y=>yearOf(x)===yearOf(y)&&periodRelation(x,y)!=='incompatible');return matches.length===1&&a.filter(y=>yearOf(y)===yearOf(x)).length===1?[[x,matches[0]]]:[];});

}

export function sanitizeFinancialData(input) {

 if(!input||input.error||input.isEtf)return input;

 if(!Object.keys(input).some(k=>k.endsWith('History')||k.endsWith('Val')||['pe','eps','roe','revGrowth','fcfYield'].includes(k)))return input;

 // v1 stored rejected originals. Reevaluate them, rather than permanently losing coverage.

 const restored=input.financialIntegrity?.version===1?{...input,...input.financialIntegrity.rejected}:input;

 const d={...restored},periods={...d.financialPeriods},fields={},issues=(d.financialIntegrity?.version===2?d.financialIntegrity.issues||[]:[]).filter(i=>['HISTORY_BLOCKED','FCF_HISTORY_BLOCKED'].includes(i.code)&&!(d[i.field]?.length)),rejected={...d.financialIntegrity?.rejected},calculations={};

 const report=(code,field,message,severity='warning')=>{if(!issues.some(i=>i.code===code&&i.field===field))issues.push({code,field,message,severity});};

 const block=(field,reason)=>{if(d[field]!=null)rejected[field]=d[field];d[field]=null;fields[field]={status:'blocked',reason};report('INCOMPATIBLE_INPUT',field,reason);};

 const metadata=field=>periods[field]||periods[fieldAliases[field]];

 const state=field=>!number(d[field])?'missing':fields[field]?.status||'provisional';

 const assess=(name,deps)=>{

  if(deps.some(f=>!number(d[f])))return calculations[name]={status:'blocked',reason:'Faltan componentes necesarios.',reasonCode:'missing-components',dependencies:deps};

  if(deps.some((a,i)=>deps.slice(i+1).some(b=>periodRelation(metadata(a),metadata(b))==='incompatible')))return calculations[name]={status:'blocked',reason:'Los componentes pertenecen a periodos, monedas o perímetros incompatibles.',dependencies:deps};

  return calculations[name]={status:deps.every(f=>state(f)==='verified')?'verified':'provisional',dependencies:deps};

 };

 for(const [history,field] of Object.entries(HISTORY_FIELDS)) {

  const raw=d[history];

  if(raw!=null&&!Array.isArray(raw)){rejected[history]=raw;d[history]=[];report('MALFORMED_HISTORY',history,'Serie no válida.');continue;}

  const points=(raw||[]).filter(p=>p&&!['TTM','H1','Q'].includes(p.basis)&&number(p.val)&&/^\d{4}$/.test(String(p.year||p.periodEnd?.slice(0,4)||'')));

  const counts=new Map();for(const pt of points){const y=String(pt.year||pt.periodEnd.slice(0,4));counts.set(y,(counts.get(y)||0)+1);}

  const isBalance=/^(assets|equity|debt|cash|currentAssets|currentLiabilities|totalLiabilities|inventory|receivables|payables|retainedEarnings)History$/.test(history);

  const otherCore=['niHistory','oiHistory','fcfHistory'].some(k=>(d[k]||[]).some?.(p=>p.year===points[0]?.year));

  // v0 fill1 tagged undated quoteSummary aggregates with the server's calendar year.

  const synthetic=d.internationalSource==='yahoo'&&['revHistory','gpHistory','debtHistory'].includes(history)&&points.length===1&&!points[0].periodEnd&&!otherCore;

  d[history]=points.filter(p=>{

   const y=String(p.year||p.periodEnd.slice(0,4));

   return !synthetic&&counts.get(y)===1&&!['TTM','H1','Q'].includes(p.basis)&&(!p.currency||!d.currency||p.currency===d.currency);

  }).map(p=>({...p,year:String(p.year||p.periodEnd.slice(0,4)),basis:p.basis||(isBalance?'instant':'FY'),fiscalYear:String(p.year||p.periodEnd.slice(0,4)),periodConfidence:validPeriod(p)?'exact':p.periodEnd?'provider-end':'legacy-annual-label'})).sort((a,b)=>a.year.localeCompare(b.year));

  if(d[history].length!==points.length){rejected[history]=raw;report('HISTORY_BLOCKED',history,synthetic?'Se retira el punto anual creado a partir de un agregado sin periodo.':'Se retiran duplicados o periodos no anuales incompatibles.');}

  if(synthetic&&number(d[field])&&!metadata(field))periods[field]={basis:isBalance?'instant':'TTM',legacyLabel:points[0]?.year,confidence:'undated-aggregate',source:'legacy Yahoo quoteSummary'};

  if(!metadata(field)&&number(d[field])){

   const last=d[history].at(-1);

   if(last&&Math.abs(last.val-d[field])<=Math.max(1e-7,Math.abs(d[field])*1e-10))periods[field]={...last,confidence:last.periodConfidence};

  }

  if(number(d[field]))fields[field]={status:validPeriod(metadata(field))&&metadata(field)?.currency&&metadata(field)?.scope&&metadata(field)?.source&&metadata(field).scope!=='provider-unspecified'?'verified':'provisional',period:metadata(field)||null};

  else if(d[field]!=null)block(field,'El dato no es un número válido.');

 }

 // Preserve independent primitives. Only derived quantities lose incompatible dependencies.

 for(const [ratio,deps] of Object.entries({opMargin:['revVal','oiVal'],netMargin:['revVal','niVal'],grossMargin:['revVal','gpVal'],roe:['niVal','equityVal'],roa:['niVal','assetsVal'],netDebt:['debtVal','cashVal'],debtToEquity:['debtVal','equityVal'],roic:['oiVal','ebtVal','taxVal','assetsVal','currentLiabilitiesVal'],evEbitda:['oiVal','daVal','debtVal','cashVal'],dso:['receivablesVal','revVal'],dio:['inventoryVal','cogsVal'],dpo:['payablesVal','cogsVal'],inventoryTurnover:['inventoryVal','cogsVal']})){

  const result=assess(ratio,deps);

  if(result.reasonCode==='missing-components'&&number(d[ratio])&&!['netDebt','debtToEquity'].includes(ratio)){fields[ratio]={status:'provisional',source:'legacy-reported-ratio',reason:'No están disponibles todos los componentes para contrastar el ratio publicado.'};calculations[ratio]={...result,status:'provisional'};}

  else if(result.status==='blocked'){if(result.reasonCode==='incompatible-periods'||d[ratio]!=null||d.financialIntegrity?.fields?.[ratio]?.status==='blocked')block(ratio,result.reason);}

  else if(number(d[ratio]))fields[ratio]={status:result.status};

 }

 // A complete, older FCF can coexist with fresher independent OCF/CAPEX.
 // Validate its own explicit inputs rather than subtracting unrelated snapshots.
 const fcfPeriod=metadata('fcfVal'),fcfInputs=fcfPeriod?.cashFlowInputs;
 const hasFcfInputs=fcfInputs!=null;
 const evidenceValid=hasFcfInputs&&['operatingCF','capex'].every(k=>{
   const p=fcfInputs[k];return p&&number(p.val)&&samePeriod(p,fcfPeriod)&&p.source&&p.currency&&p.scope&&p.scope!=='provider-unspecified'
     && (!p.unit||p.unit===p.currency)&&(!fcfPeriod.unit||fcfPeriod.unit===p.currency);
 });
 if(hasFcfInputs)calculations.fcfVal={status:evidenceValid&&number(d.fcfVal)?'verified':'blocked',dependencies:['financialPeriods.fcfVal.cashFlowInputs']};
 else assess('fcfVal',['operatingCFVal','capexVal','fcfVal']);

 if(calculations.fcfVal.status==='blocked')block('fcfVal','FCF sin OCF y CAPEX compatibles. No se presupone CAPEX cero.');

 else if(number(d.fcfVal)&&Math.abs(d.fcfVal-((hasFcfInputs?fcfInputs.operatingCF.val:d.operatingCFVal)-Math.abs(hasFcfInputs?fcfInputs.capex.val:d.capexVal)))>Math.max(1,Math.abs(d.fcfVal)*1e-6))block('fcfVal','El FCF no coincide con OCF menos CAPEX.');

 else if(number(d.fcfVal))fields.fcfVal={status:calculations.fcfVal.status,period:metadata('fcfVal')||metadata('operatingCFVal')};
 if(number(d.fcfVal)&&evidenceValid&&periodRelation(fcfPeriod,metadata('operatingCFVal'))==='incompatible')report('HISTORICAL_FCF_BASIS','fcfVal',`FCF del ejercicio terminado el ${fcfPeriod.periodEnd}; no equivale al TTM de los flujos operativos más recientes.`);

 const sourceFcf=d.fcfHistory||[];

 d.fcfHistory=joinAnnualEvidence(d.operatingCFHistory,d.capexHistory).map(([o,c])=>({...o,val:o.val-Math.abs(c.val),derivation:'OCF-minus-absolute-CAPEX',periodConfidence:periodRelation(o,c)}));

 if(sourceFcf.length&&!d.fcfHistory.length){rejected.fcfHistory=sourceFcf;report('FCF_HISTORY_BLOCKED','fcfHistory','No hay CAPEX para contrastar el histórico de FCF.');}

 if(!number(d.fcfVal)){block('pfcf','FCF no disponible.');block('fcfYield','FCF no disponible.');}

 else {for(const f of ['pfcf','fcfYield'])if(number(d[f]))fields[f]={status:fields.fcfVal.status};}

 d.marginHistory=joinAnnualEvidence(d.revHistory,d.oiHistory).filter(([r])=>r.val!==0).map(([r,o])=>({...r,margin:+(o.val/r.val*100).toFixed(1)}));

 d.epsHistory=joinAnnualEvidence(d.niHistory,d.sharesHistory).filter(([,s])=>s.val>0).map(([n,s])=>({...n,eps:+(n.val/s.val).toFixed(2)}));

 if(!d.epsHistory.length)block('epsCagr','No hay beneficio y acciones medias del mismo ejercicio.');

 // Reported trailing EPS is not annual NI / current shares. Unknown bases warn, not contradict.

 if(number(d.eps))fields.eps={status:samePeriod(periods.eps,periods.epsShares)&&number(d.epsShares)?'verified':'provisional',period:periods.eps||null};

 if(number(d.pe))fields.pe={status:fields.eps?.status||'provisional'};

 if(number(d.eps)&&number(d.currentPrice)&&number(d.pe)&&d.eps>0&&Math.abs(d.pe-d.currentPrice/d.eps)>Math.max(.1,Math.abs(d.pe)*.03))block('pe','PER incompatible con precio/BPA de la misma respuesta.');

 if(number(d.eps)&&number(d.epsShares)&&number(d.niVal)&&samePeriod(periods.eps,metadata('niVal'))&&samePeriod(periods.eps,periods.epsShares)&&Math.abs(d.eps-d.niVal/d.epsShares)>(d.epsPrecision??.01)/2+Math.abs(d.eps)*.02){block('eps','BPA incompatible con beneficio y media ponderada de su propio periodo.');block('pe','BPA no válido.');}

 if(number(d.eps)&&number(d.niVal)&&d.sharesOutstanding>0&&Math.abs(d.eps*d.sharesOutstanding-d.niVal)>Math.max(Math.abs(d.niVal),Math.abs(d.eps*d.sharesOutstanding))*.15)report('EPS_BASES_UNRESOLVED','eps','BPA y beneficio/acciones actuales difieren. Pueden usar periodos y denominadores distintos; la relación no está verificada.');

 if(number(d.epsCagr))fields.epsCagr={status:'provisional',reason:'Método heredado de crecimiento del BPA; no equivale a una serie auditada.'};
 for(const f of ['revGrowth','shareDilution','dso','dio','dpo','ccc','inventoryTurnover','priceToBook'])if(number(d[f]))fields[f]={status:validPeriod(periods[f])?'verified':'provisional',period:periods[f]||null};

 const projectionDeps=['revVal','oiVal','assetsVal','currentLiabilitiesVal','debtVal','cashVal','ebtVal','taxVal'];

 const projected=assess('projections',projectionDeps);

 // Missing inputs are handled by each unchanged model; only proven conflicts add a veto.

 const provenConflict=projectionDeps.some((a,i)=>number(d[a])&&projectionDeps.slice(i+1).some(b=>number(d[b])&&periodRelation(metadata(a),metadata(b))==='incompatible'));

 calculations.projections={...projected,status:provenConflict?'blocked':projectionDeps.every(f=>state(f)==='verified')?'verified':'provisional'};

 const bank=assess('bankProjections',['niVal','equityVal']);
 calculations.bankProjections={...bank,status:bank.reasonCode==='incompatible-periods'?'blocked':['niVal','equityVal'].every(f=>state(f)==='verified')?'verified':'provisional'};
 calculations.dcf={status:calculations.netDebt?.reasonCode==='incompatible-periods'||!number(d.fcfVal)||periodRelation(metadata('fcfVal'),metadata('revVal'))==='incompatible'?'blocked':fields.fcfVal?.status||'provisional'};

 calculations.growth={status:number(d.revGrowth)?fields.revGrowth?.status||'provisional':d.revHistory.length>1?'provisional':'blocked'};

 calculations.value={status:number(d.fcfVal)?['fcfVal','sbcVal','debtVal','cashVal','roic'].every(f=>state(f)==='verified')?'verified':'provisional':'blocked'};

 calculations.quality={status:['roic','grossMargin','opMargin','debtVal','cashVal','equityVal','currentAssetsVal','currentLiabilitiesVal','fcfVal','shareDilution'].every(f=>state(f)==='verified')?'verified':'provisional'};

 assess('currentRatio',['currentAssetsVal','currentLiabilitiesVal']);

 assess('cashRunway',['cashVal','fcfVal']);
 assess('fcfMargin',['fcfVal','revVal']);
 assess('cashConversion',['fcfVal','niVal']);

 if(calculations.dcf.status==='blocked'&&number(d.fcfVal)&&periodRelation(metadata('fcfVal'),metadata('revVal'))==='incompatible')report('DCF_INPUT_CONFLICT','dcf','La base de caja y los ingresos no pertenecen al mismo periodo.');

 if(d.prevQuarter&&!Object.values(d.prevQuarter.financialPeriods||{}).some(validPeriod)){rejected.prevQuarter=d.prevQuarter;d.prevQuarter=null;}

 for(const f of [...Object.values(HISTORY_FIELDS),'eps','pe','opMargin','netMargin','grossMargin','roe','roa','roic','revGrowth','shareDilution','pfcf','fcfYield','priceToBook'])if(d[f]!=null&&!number(d[f]))block(f,'El dato no es un número finito.');
 const provisional=Object.entries(fields).filter(([,v])=>v.status==='provisional').map(([k])=>k);

 if(provisional.length)report('PROVISIONAL_DATA','financials','Datos provisionales: falta verificar parte de sus periodos, moneda o procedencia. Las notas y estimaciones que los utilicen también son provisionales.');

 issues.sort((a,b)=>(a.code+'|'+a.field).localeCompare(b.code+'|'+b.field));
 d.financialPeriods=periods;

 d.financialIntegrity={version:2,status:provisional.length?'provisional':issues.length?'partial':'verified',fields,calculations,issues,rejected,warning:provisional.length?'Datos provisionales: algunas relaciones fiscales y fuentes siguen sin verificarse. No confundir estas estimaciones con resultados validados.':null};

 return d;

}

// Model-specific validation adapter. Raw standalone figures remain visible in the API.

export function analysisData(data,purpose='quality') {

 if(!data?.financialIntegrity||data.financialIntegrity.version!==2)return data;

 const d={...data},c=data.financialIntegrity.calculations||{},p=field=>data.financialPeriods?.[field]||data.financialPeriods?.[fieldAliases[field]];

 if(c.netDebt?.reasonCode==='incompatible-periods')d.debtVal=null;

 if(c.debtToEquity?.reasonCode==='incompatible-periods'&&purpose==='quality')d.equityVal=null;

 if(c.currentRatio?.reasonCode==='incompatible-periods')d.currentAssetsVal=null;

 if(c.cashRunway?.reasonCode==='incompatible-periods'&&number(d.fcfVal)&&d.fcfVal<0)d.cashVal=null;

 if(c.evEbitda?.status==='blocked'&&periodRelation(p('oiVal'),p('daVal'))==='incompatible')d.daVal=null;

 if(periodRelation(p('ebtVal'),p('taxVal'))==='incompatible')d.taxVal=null;
 // Standalone historical FCF remains available for its own multiple. It must not
 // be divided by newer income-statement flows inside the unchanged quality model.
 if(purpose==='quality'&&['revVal','niVal','sbcVal'].some(f=>number(d[f])&&periodRelation(p('fcfVal'),p(f))==='incompatible'))d.fcfVal=null;
 // With no compatible revenue window, do not feed cross-period margins to the engine.

 if(purpose==='quality'&&c.opMargin?.status==='blocked'&&number(data.revVal)&&number(data.oiVal)&&periodRelation(data.financialPeriods?.revVal||data.financialPeriods?.rev,data.financialPeriods?.oiVal||data.financialPeriods?.oi)==='incompatible')d.revVal=null;

 return d;

}
