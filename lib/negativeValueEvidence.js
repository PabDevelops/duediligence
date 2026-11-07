import {validPeriod, samePeriod} from './financialIntegrity';
import {valuationEarnings} from './valuationEarnings';
import {scopeFinancialEntity} from './listingIdentity';

// Coverage evidence for VALUE only. A zero is not a multiple, price target,
// valuation method or an input to DCF/scenarios.
export function negativeValueEvidence(id, data, {validation, cashFlowBasis, profileKind}={}) {
  const d=scopeFinancialEntity(data)||{};
  const fields={pe:['marketCap','niVal'],pfcf:['marketCap','fcfVal','sbcVal'],evEbit:['marketCap','oiVal','debtVal','cashVal']}[id];
  if(!fields)return null;
  const earnings=id==='pe'?valuationEarnings(d):null;
  if(earnings?.adjustments.length&&earnings.value==null)return {state:'unavailable',reason:earnings.reason,fields,earningsBasis:earnings};
  const denominator=id==='pe'?earnings.value:id==='evEbit'?d.oiVal:
    Number.isFinite(d.fcfVal)&&Number.isFinite(d.sbcVal)?d.fcfVal-d.sbcVal:null;
  if(!(denominator<0)&&!(id==='pfcf'&&d.fcfVal<0))return null;
  const unavailable=reason=>({state:'unavailable',reason,fields});
  if(validation?.hasErrors)return unavailable('La validación contiene errores de coherencia; no se evalúa este componente.');
  if(!(Number.isFinite(d.marketCap)&&d.marketCap>0))return unavailable('Falta una capitalización positiva válida.');
  if(!d.currency)return unavailable('Falta la moneda de la capitalización.');
  if(id==='evEbit'&&profileKind==='cyclical')return unavailable('El perfil cíclico exige EBIT normalizado: un EBIT puntual negativo no basta para evaluar este componente.');
  if(id==='pfcf'&&['unavailable','manual-unmatched'].includes(cashFlowBasis?.status))return unavailable(cashFlowBasis.reason);
  const aliases={niVal:'ni',oiVal:'oi',fcfVal:'fcf'};
  const periods=fields.filter(f=>f!=='marketCap').map(field=>({field,p:d.financialPeriods?.[field]||d.financialPeriods?.[aliases[field]]}));
  const now=new Date(d.asOf||Date.now());
  const names={niVal:'Beneficio neto',oiVal:'EBIT',fcfVal:'FCF',sbcVal:'SBC',cashVal:'Caja',debtVal:'Deuda'};
  const scope=d.financialPeriods?.revVal?.scope||d.financialPeriods?.rev?.scope;
  for(const {field,p} of periods){
    const name=names[field];
    if(!Number.isFinite(d[field]))return unavailable(`Falta ${name}: no se presupone cero.`);
    const state=d.financialIntegrity?.fields?.[field];
    const selectedCash=cashFlowBasis?.status==='matched'&&['fcfVal','sbcVal'].includes(field);
    if(!selectedCash&&(state?.modelExcluded||['blocked','incompatible'].includes(state?.status)))return unavailable(`${name}: ${state.reason||'dato incompatible o excluido'}`);
    if(!validPeriod(p))return unavailable(`${name}: falta un periodo fiscal válido y documentado.`);
    if(['cashVal','debtVal'].includes(field)?p.basis!=='instant':!['FY','TTM'].includes(p.basis))return unavailable(`${name}: ${p.basis} no es una base anual FY/TTM para este componente; no se anualiza.`);
    if(!p.currency||!p.scope||p.scope==='provider-unspecified'||!p.source)return unavailable(`${name}: falta documentar moneda, perímetro o fuente.`);
    if(scope&&scope!=='provider-unspecified'&&p.scope!==scope)return unavailable(`${name}: perímetro incompatible con el negocio consolidado de referencia.`);
    if(p.currency!==d.currency||p.unit&&p.unit!==p.currency)return unavailable(`${name}: moneda o unidades incompatibles con la capitalización.`);
    if(p.originalCurrency&&p.originalCurrency!==p.currency&&!(p.fxRate>0&&Number.isFinite(p.fxRate)))return unavailable(`${name}: la conversión monetaria no tiene un tipo válido.`);
    // Same hard age limit as the existing HISTORY_STALE validation. Missing
    // provenance never becomes proof of a valid loss; future facts are not used.
    if(!Number.isFinite(now.getTime())||Date.parse(p.periodEnd)>now.getTime()||now.getUTCFullYear()-Number(p.periodEnd.slice(0,4))>=4)return unavailable(`${name}: periodo futuro o demasiado antiguo para la evaluación actual.`);
    if(['cashVal','debtVal','sbcVal'].includes(field)&&d[field]<0)return unavailable(`${name}: signo no válido para este componente.`);
  }
  const anchor=periods[0].p;
  if(id==='pfcf'&&!samePeriod(anchor,periods[1].p))return unavailable('FCF y SBC no tienen el mismo periodo, moneda y perímetro.');
  if(id==='evEbit'&&periods.slice(1).some(({p})=>p.periodEnd!==anchor.periodEnd||p.currency!==anchor.currency||p.scope!==anchor.scope))return unavailable('EBIT, deuda y caja no tienen cierres, moneda y perímetro compatibles.');
  if(!(denominator<0))return unavailable('No se puede documentar el resultado ajustado negativo.');
  const name={pe:'Beneficio neto negativo',pfcf:'FCF después de SBC negativo',evEbit:'EBIT negativo'}[id];
  return {state:'negative-results',fields,denominator,period:anchor,manual:periods.some(({field,p})=>p.manual||d.manualCalculation?.fields?.includes(field)),
    ...(earnings?.adjustments.length?{earningsBasis:earnings}:{}),
    reason:`${name}${earnings?.status==='adjusted'?' tras excluir extraordinarios netos de impuestos documentados':''}: evaluado con 0/100 por falta de rentabilidad actual. No se calcula un múltiplo sobre un denominador negativo.`};
}
