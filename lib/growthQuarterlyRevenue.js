import {validPeriod} from './financialIntegrity.js';

const DAY=86400000;
const index=p=>/^\d{4}$/.test(String(p.fiscalYear||''))&&/^Q[1-4]$/.test(p.fiscalQuarter||'')
  ? Number(p.fiscalYear)*4+Number(p.fiscalQuarter.slice(1))-1:null;
const label=i=>`Q${i%4+1} ${Math.floor(i/4)}`;
const duration=p=>(Date.parse(p.periodEnd)-Date.parse(p.periodStart))/DAY+1;
const adjacent=(a,b)=>Date.parse(b.periodStart)-Date.parse(a.periodEnd)===DAY;
function invalid(p){
  if(index(p)==null)return 'Falta la identidad fiscal del trimestre.';
  if(p.basis!=='Q'||!validPeriod(p))return 'Fechas inválidas: se requiere un trimestre independiente de 80–100 días.';
  if(!Number.isFinite(p.val))return 'Ingresos numéricos no disponibles.';
  if(!/^[A-Z]{3}$/.test(p.currency||''))return 'Moneda no documentada.';
  if(!p.scope||p.scope==='provider-unspecified')return 'Perímetro sin especificar.';
  if(p.unit!==p.currency)return 'Unidades no documentadas en moneda base o incompatibles; no se presume una escala.';
  return null;
}
function yoyIssue(now,before){
  if(now.currency!==before.currency)return 'Monedas distintas entre trimestres equivalentes.';
  if(now.scope!==before.scope)return 'Perímetros distintos entre trimestres equivalentes.';
  const start=(Date.parse(now.periodStart)-Date.parse(before.periodStart))/DAY;
  const end=(Date.parse(now.periodEnd)-Date.parse(before.periodEnd))/DAY;
  if(start<350||start>380||end<350||end>380||Math.abs(duration(now)-duration(before))>7)return 'Las fechas no corresponden al mismo trimestre del ejercicio anterior.';
  if(before.val<=0)return 'Los ingresos del trimestre de referencia deben ser positivos.';
  return null;
}

// Two consecutive YoY observations need four identified records, not eight
// aligned arrays of unrelated metrics. This selector only supplies Growth's
// revenue acceleration; it never feeds FY/TTM, cash momentum, DCF or valuation.
export function growthQuarterlyRevenue(data={}){
  const points=Array.isArray(data?.quarterlyHistories?.revHistory)?data.quarterlyHistories.revHistory:[];
  const records=points.map(point=>{const p=point||{};return {point:p,index:index(p),label:index(p)==null?'Trimestre sin identidad':label(index(p)),reason:invalid(p),used:false};});
  const groups=new Map();
  for(const r of records)if(r.index!=null)groups.set(r.index,[...(groups.get(r.index)||[]),r]);
  for(const rs of groups.values())if(rs.length>1)for(const r of rs)r.reason='Identidad fiscal duplicada: no se elige un registro por posición.';
  const dates=new Map();
  for(const r of records){const p=r.point;if(!validPeriod(p))continue;const key=`${p.periodStart}|${p.periodEnd}`;dates.set(key,[...(dates.get(key)||[]),r]);}
  for(const rs of dates.values())if(rs.length>1)for(const r of rs)r.reason='Fechas duplicadas en varios registros trimestrales.';
  for(const r of records)r.discarded=!!r.reason;
  const latest=groups.size?Math.max(...groups.keys()):null;
  const required=latest==null?[]:[latest-5,latest-4,latest-1,latest];
  const missing=required.filter(i=>!groups.has(i)).map(label);
  const selected=required.map(i=>groups.get(i)?.length===1?groups.get(i)[0]:null);
  const problems=[...missing.map(q=>`Falta ${q}.`),...selected.filter(r=>r?.reason).map(r=>`${r.label}: ${r.reason}`)];
  let acceleration=null,comparisons=[];
  if(latest!=null&&selected.every(r=>r&&!r.reason)){
    const [priorPrevious,priorLatest,previous,now]=selected.map(r=>r.point);
    for(const [a,b] of [[previous,priorPrevious],[now,priorLatest]]){const issue=yoyIssue(a,b);if(issue){problems.push(`${label(index(a))}: ${issue}`);for(const r of selected.filter(r=>r.point===a||r.point===b)){r.reason=issue;r.discarded=true;}}}
    if(!adjacent(previous,now)||!adjacent(priorPrevious,priorLatest))problems.push('Los dos trimestres y sus referencias deben ser consecutivos por fechas.');
    if(new Set(selected.map(r=>r.point.currency)).size!==1||new Set(selected.map(r=>r.point.scope)).size!==1)problems.push('Las dos variaciones deben tener la misma moneda y perímetro.');
    const annualEnd=(data.revHistory||[]).filter(p=>p.basis==='FY'&&validPeriod(p)&&Number.isFinite(p.val)).map(p=>p.periodEnd).sort().at(-1);
    if(annualEnd&&now.periodEnd<annualEnd)problems.push('La serie trimestral es anterior al último ejercicio FY disponible; no sustituye una señal más reciente.');
    if(!problems.length){
      comparisons=[[previous,priorPrevious],[now,priorLatest]].map(([a,b])=>({period:label(index(a)),reference:label(index(b)),growth:a.val/b.val-1}));
      acceleration=(comparisons[1].growth-comparisons[0].growth)*100;
      selected.forEach(r=>{r.used=true;});
    }
  }
  for(const r of records)if(!r.reason)r.reason=r.used?'Utilizado en una variación interanual; no es crecimiento secuencial.':required.includes(r.index)?'No utilizado: falta completar una comparación interanual compatible.':'Disponible; no interviene en las dos últimas variaciones interanuales.';
  return {acceleration,records,comparisons,missing,reason:records.length?problems.join(' '):'No hay históricos trimestrales de ingresos documentados.',
    periodUsed:comparisons.map(c=>`${c.period} frente a ${c.reference}`).join('; ')};
}
