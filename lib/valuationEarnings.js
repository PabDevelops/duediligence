import {validPeriod} from './financialIntegrity';
import {OFFICIAL_EARNINGS_EVENTS} from './officialEarningsEvents';
import {selectStatementFacts} from './secFactSelection';
const finite=Number.isFinite;
const periodOf=d=>d?.financialPeriods?.niVal||d?.financialPeriods?.ni;
const today=d=>String(d?.asOf||new Date().toISOString()).slice(0,10);
export function valuationEarnings(data){
 const d=data||{},period=periodOf(d),asOf=today(d);
 const reported=finite(d.niVal)?d.niVal:null;
 const comparable=reported!==null&&validPeriod(period)&&['FY','TTM'].includes(period.basis)
  &&period.currency===d.currency&&(!period.unit||period.unit===period.currency)
  &&period.source&&period.scope&&period.scope!=='provider-unspecified'&&period.periodEnd<=asOf
  &&Number(asOf.slice(0,4))-Number(period.periodEnd.slice(0,4))<4
  &&!d.financialIntegrity?.fields?.niVal?.modelExcluded&&!['blocked','incompatible'].includes(d.financialIntegrity?.fields?.niVal?.status);
 const reportedPe=comparable&&reported>0&&finite(d.marketCap)&&d.marketCap>0?d.marketCap/reported:null;
 const records=[...(d.earningsAdjustments||[]),...OFFICIAL_EARNINGS_EVENTS.filter(r=>r.cik===d.cik)];
 const adjustments=records.filter(r=>r.publicationDate&&r.publicationDate<=asOf&&r.classification!=='recurring'
  &&(!period?.periodStart||!period?.periodEnd||r.periodStart<=period.periodEnd&&r.periodEnd>=period.periodStart));
 const base={reported,reportedPe,period,comparable:!!comparable,adjustments};
 if(!adjustments.length)return {...base,status:'reported',value:reported,reason:'Beneficio contable observado; no se han identificado ajustes verificables en las fuentes disponibles. No certifica ausencia de extraordinarios.'};
 const unavailable=reason=>({...base,status:'review-required',value:null,reason});
 if(!comparable)return unavailable('No se puede conciliar el beneficio y las partidas especiales sin periodo FY/TTM, moneda, unidades y perímetro comparables.');
 const seen=new Set();let adjustment=0;
 for(const r of adjustments){
  if(!r.id||seen.has(r.id))return unavailable('Partidas extraordinarias duplicadas o sin identidad: revisa la conciliación para evitar un doble ajuste.');seen.add(r.id);
  if(!validPeriod(r)||r.periodStart<period.periodStart||r.periodEnd>period.periodEnd||r.currency!==period.currency||r.scope!==period.scope||r.unit!==period.currency||!r.source||!r.sourceUrl)
   return unavailable('Una partida extraordinaria tiene fechas, moneda, unidades, perímetro o fuente incompatibles con el beneficio. No se reparte ni se anualiza automáticamente.');
  if(r.classification!=='non-recurring')return unavailable('Hay partidas especiales cuya naturaleza recurrente o extraordinaria sigue pendiente de contraste.');
  if(!finite(r.incomeEffect))return unavailable('Falta el importe de una partida extraordinaria identificada.');
  // Never estimate tax from the statutory or aggregate effective rate.
  if(!finite(r.taxEffect)&&!finite(r.afterTaxEffect))return unavailable('Beneficio contable positivo o negativo disponible, pero falta aislar el efecto fiscal de los extraordinarios. P/E recurrente N/D; no se resta una ganancia antes de impuestos al beneficio neto como si fuera un ajuste neto.');
  adjustment+=finite(r.afterTaxEffect)?r.afterTaxEffect:r.incomeEffect-r.taxEffect;
 }
 return {...base,status:'adjusted',value:reported-adjustment,adjustment,reason:'Beneficio neto menos efectos extraordinarios netos de impuestos documentados. Es una base ajustada para VALUE; el beneficio contable original se conserva.'};
}

// Uses the existing SEC facts download. Missing disclosures are not zero. A
// pretax asset-sale concept is a review candidate, not a certified one-off.
export function secEarningsAdjustments(data,json){
 const period=periodOf(data);if(!validPeriod(period)||!/^\d{10}$/.test(data?.cik||''))return [];
 const definitions=[['IncomeLossFromDiscontinuedOperationsNetOfTax','discontinued-operations',true],['GainLossOnSaleOfBusiness','business-sale',false],['GainLossOnSaleOfIntangibleAssets','asset-sale',false]];
 return definitions.flatMap(([tag,category,netOfTax])=>{
  const rows=selectStatementFacts((json?.facts?.['us-gaap']?.[tag]?.units?.[period.currency]||[]).filter(r=>r.filed&&r.filed<=today(data)&&finite(r.val)&&/^\d{10}-\d{2}-\d{6}$/.test(r.accn||'')));
  const legs=period.basis==='TTM'&&period.components?.length===3?period.components:null;
  const matches=(start,end)=>rows.filter(r=>r.start===start&&r.end===end);
  let val,sourceRows;
  if(legs){sourceRows=legs.map(p=>matches(p.start,p.end));if(sourceRows.some(r=>r.length!==1))return [];sourceRows=sourceRows.map(r=>r[0]);val=sourceRows[0].val-sourceRows[1].val+sourceRows[2].val;}
  else{sourceRows=matches(period.periodStart,period.periodEnd);if(sourceRows.length!==1)return [];val=sourceRows[0].val;}
  if(val===0)return [];
  return [{...period,id:`sec:${tag}:${period.periodStart}:${period.periodEnd}`,category,classification:netOfTax?'non-recurring':'pending',incomeEffect:val,...(netOfTax?{afterTaxEffect:val}:{}),unit:period.currency,source:'SEC EDGAR companyfacts',sourceUrl:`https://www.sec.gov/Archives/edgar/data/${Number(data.cik)}/${sourceRows.at(-1).accn.replaceAll('-','')}/`,publicationDate:sourceRows.map(r=>r.filed).sort().at(-1),tag,components:sourceRows}];
 });
}
