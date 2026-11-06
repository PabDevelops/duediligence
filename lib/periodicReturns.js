import {HISTORY_FIELDS,validPeriod,samePeriod} from './financialIntegrity.js';
import {computeDerivedFinancials} from './financialStatements.js';

// A return for H1/Q is a period calculation, never an annual score input.
export function evaluatePeriodicReturn(record,data){
  const p=record.period||{},field=record.field,b=p.returnBasis||p.roaBasis;
  const pending=reason=>({status:'pending-review',reason,modelExcluded:true,periodCalculation:null});
  if(!['roe','roa'].includes(field)||!['H1','Q'].includes(p.basis)||!validPeriod(p))return pending('Falta un periodo semestral/trimestral exacto.');
  if(!Number.isFinite(record.value))return pending('No hay un valor numérico para este periodo.');
  if(b?.annualized!==false)return pending('Documenta si el dato está anualizado. No se anualiza automáticamente.');
  const balance=field==='roe'?'equity':'assets',expected=field==='roe'?'average-equity':'average-assets';
  if(b.denominator!==expected)return pending('Falta documentar la base media del denominador.');
  const opening=new Date(Date.parse(p.periodStart)-86400000).toISOString().slice(0,10);
  if(b.assetsStartDate!==opening||b.assetsEndDate!==p.periodEnd)return pending('Las fechas de apertura y cierre del denominador no corresponden al periodo.');
  const pick=(points,predicate)=>{
    const matches=points.filter(pt=>Number.isFinite(pt.val)&&predicate(pt));
    if(!matches.length||matches.some(pt=>pt.val!==matches[0].val))return null;
    return matches[0];
  };
  const current=f=>({...data.financialPeriods?.[f+'Val'],val:data[f+'Val']});
  const incomePoints=[current('ni'),...(data.niHistory||[])];
  const candidates=incomePoints.filter(pt=>Number.isFinite(pt.val)&&validPeriod(pt)&&pt.basis===p.basis&&pt.periodStart===p.periodStart&&pt.periodEnd===p.periodEnd&&pt.currency&&pt.scope&&pt.scope!=='provider-unspecified'&&(!p.currency||p.currency===pt.currency)&&(!p.scope||p.scope==='provider-unspecified'||p.scope===pt.scope));
  const contexts=[...new Set(candidates.map(pt=>JSON.stringify([pt.currency,pt.scope])))];
  if(contexts.length!==1)return pending('No hay una única moneda y perímetro contrastados para el beneficio de este periodo.');
  const [currency,scope]=JSON.parse(contexts[0]),comparison={...p,currency,scope};
  const ni=pick(incomePoints,pt=>samePeriod(pt,comparison));
  const balances=[current(balance),...(data[balance+'History']||[])];
  const at=date=>pick(balances,pt=>validPeriod(pt)&&pt.basis==='instant'&&pt.periodEnd===date&&pt.currency===currency&&pt.scope===scope&&pt.scope!=='provider-unspecified'&&(!pt.unit||pt.unit===currency));
  const start=at(opening),end=at(p.periodEnd);
  if(!ni||!start||!end)return pending('Faltan beneficio y saldos de apertura/cierre comparables, o sus fuentes discrepan.');
  const mean=(start.val+end.val)/2;
  if(!(mean>0))return pending('El denominador medio no es positivo.');
  // Reuse the existing return formula, providing the documented mean balance as
  // its denominator. No annualization factor or alternative scoring is added.
  const h={...Object.fromEntries(Object.keys(HISTORY_FIELDS).map(k=>[k,[]])),niHistory:[{...ni,val:ni.val}],[balance+'History']:[{...end,val:mean}]};
  const calculated=ni.val===0?0:computeDerivedFinancials(h)[field];
  if(!Number.isFinite(calculated)||Math.abs(record.value-calculated)>.1)return pending('El rendimiento manual no coincide con beneficio / denominador medio del mismo periodo (tolerancia 0,1 puntos).');
  return {status:'period-comparable',reason:'Utilizable en este periodo; excluido de las notas y valoraciones anuales/TTM.',modelExcluded:true,
    periodCalculation:{value:record.value,calculatedValue:calculated,netIncome:ni.val,meanBalance:mean,openingBalance:start.val,closingBalance:end.val,basis:p.basis,periodStart:p.periodStart,periodEnd:p.periodEnd,currency,scope,comparisonContextSource:'matching-period-components',annualized:false,formula:'net-income / mean-balance * 100',sources:{netIncome:ni.source||null,opening:start.source||null,closing:end.source||null}}};
}
