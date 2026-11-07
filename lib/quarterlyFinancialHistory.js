import {HISTORY_FIELDS,validPeriod,samePeriod} from './financialIntegrity.js';

export function quarterlyHistoryTarget(target){
  const m=/^history:([a-zA-Z]+History):(\d{4}):(Q[1-4])$/.exec(target||'');
  return m&&HISTORY_FIELDS[m[1]]?{history:m[1],field:HISTORY_FIELDS[m[1]],year:m[2],quarter:m[3],quarterHistory:true}:null;
}
export function historyPointTarget(history,p){
  if(p.manualTarget?.startsWith(`history:${history}:`))return p.manualTarget;
  if(p.basis==='TTM')return `history:${history}:TTM:${p.periodEnd}`;
  const year=p.fiscalYear||p.year||p.periodEnd?.slice(0,4);
  return `history:${history}:${year}${/^Q[1-4]$/.test(p.fiscalQuarter||'')?`:${p.fiscalQuarter}`:''}`;
}
// Quarterly records never enter annual arrays or principal FY/TTM inputs.
export function applyQuarterlyFinancialHistory(input,rows){
  const targets=new Set(rows.map(r=>r.target));
  const histories={...input.quarterlyHistories},annotations=(input.manualCorrections||[]).filter(r=>!targets.has(r.target));
  for(const r of rows){
    const t=quarterlyHistoryTarget(r.target);if(!t||r.value!==null&&!Number.isFinite(r.value))continue;
    const p={...r.metadata,year:t.year,fiscalYear:t.year,fiscalQuarter:t.quarter,val:r.value,manual:true,source:'Corrección manual de administración'};
    histories[t.history]=[...(histories[t.history]||[]).filter(x=>historyPointTarget(t.history,x)!==r.target),p]
      .sort((a,b)=>`${a.fiscalYear}${a.fiscalQuarter}`.localeCompare(`${b.fiscalYear}${b.fiscalQuarter}`));
    const reason=!validPeriod(p)||!p.currency||!p.scope||p.scope==='provider-unspecified'?'Falta documentar un periodo, moneda o perímetro comparables.':p.basis!=='Q'&&p.basis!=='instant'?'El tipo documentado no corresponde a un trimestre ni a un saldo de cierre.':null;
    annotations.push({target:r.target,field:t.field,value:r.value,period:p,id:r.id,updatedAt:r.created_at,quarterlyHistory:true,modelExcluded:false,calculationStatus:'quarterly-history',reason});
  }
  return {...input,quarterlyHistories:histories,manualCorrections:annotations};
}
export function quarterlyEpsPoints(data){
  const h=data.quarterlyHistories||{};
  return (h.niHistory||[]).flatMap(n=>{
    const candidates=(h.sharesHistory||[]).filter(s=>n.fiscalYear===s.fiscalYear&&n.fiscalQuarter===s.fiscalQuarter&&samePeriod(n,s));
    const s=candidates.length===1?candidates[0]:null;
    return n.basis==='Q'&&n.currency&&n.scope&&n.scope!=='provider-unspecified'&&Number.isFinite(n.val)&&s&&s.val>0?[{...n,eps:+(n.val/s.val).toFixed(2)}]:[];
  });
}
