import {validPeriod,samePeriod,cashFlowLessCapex} from './financialIntegrity.js';

export function validateManualFcfHistory(record,data,explicitTargets=new Set()){
  let p=record.period;
  const year=record.target.split(':').at(-1);
  const no=reason=>({point:null,reason});
  if(!Number.isFinite(record.value))return no('FCF histórico marcado como N/D.');
  if(p.basis!=='FY'||!validPeriod(p)||p.periodEnd.slice(0,4)!==year||!p.currency)return no('Se conserva el dato, pero falta un ejercicio FY completo con su moneda.');
  if(data.currency&&data.currency!==p.currency)return no('La moneda no coincide con la base del motor. No se convierte automáticamente.');
  if(!p.scope||p.scope==='provider-unspecified'){
    const window=x=>x.basis===p.basis&&x.periodStart===p.periodStart&&x.periodEnd===p.periodEnd&&x.currency===p.currency;
    const scopes=new Set((data.operatingCFHistory||[]).filter(window).flatMap(o=>(data.capexHistory||[]).filter(c=>window(c)&&samePeriod(o,c)&&o.scope&&o.scope!=='provider-unspecified').map(()=>o.scope)));
    if(scopes.size===1)p={...p,scope:[...scopes][0],comparisonScopeSource:'matching-OCF-CAPEX'};
  }
  const known=p=>p?.scope&&p.scope!=='provider-unspecified';
  const incomePeriod=data.financialPeriods?.revVal||data.financialPeriods?.rev;
  if(known(p)&&known(incomePeriod)&&p.scope!==incomePeriod.scope)return no('El perímetro del FCF no coincide con el de las cuentas del motor.');
  const other=(data.fcfHistory||[]).filter(x=>String(x.year)!==year&&!explicitTargets.has(`history:fcfHistory:${x.year}`));
  if(other.some(x=>x.currency&&x.currency!==p.currency||known(p)&&known(x)&&p.scope!==x.scope))return no('El FCF pertenece a otra moneda o perímetro que la serie histórica.');
  const component=(history,key)=>{
    const explicit=explicitTargets.has(`history:${history}:${year}`);
    const value=p.fcfInputs?.[key];
    if(!explicit&&Number.isFinite(value))return {...p,val:value,source:'Componentes de la corrección manual de FCF'};
    const points=(data[history]||[]).filter(x=>Number.isFinite(x.val)&&samePeriod(x,p)&&(!x.unit||x.unit===p.currency));
    return points.length===1?points[0]:null;
  };
  const o=component('operatingCFHistory','operatingCF'),c=component('capexHistory','capex');
  if(!o||!c)return no('FCF guardado sin OCF y CAPEX comparables. No se supone CAPEX cero.');
  const result=cashFlowLessCapex([o],[c])[0];
  if(!result||Math.abs(record.value-result.val)>Math.max(1,Math.abs(record.value)*1e-6))return no('El FCF guardado no coincide con OCF menos CAPEX del mismo ejercicio.');
  return {point:{...p,year,val:record.value,manual:true,derivation:'OCF-minus-absolute-CAPEX',cashFlowInputs:{operatingCF:o,capex:c}},reason:null};
}
