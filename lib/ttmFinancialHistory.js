import {HISTORY_FIELDS,validPeriod,samePeriod} from './financialIntegrity';

export function ttmHistoryTarget(target){
  const m=/^history:([a-zA-Z]+History):TTM:(\d{4}-\d{2}-\d{2})$/.exec(target||'');
  return m&&HISTORY_FIELDS[m[1]]&&validPeriod({basis:'instant',periodEnd:m[2]})?{history:m[1],field:HISTORY_FIELDS[m[1]],year:m[2].slice(0,4),periodEnd:m[2],ttmHistory:true}:null;
}
export function ttmHistoryRow(row){
  const t=ttmHistoryTarget(row.target);if(t)return t;
  const m=/^history:([a-zA-Z]+History):(\d{4})$/.exec(row.target||'');
  return m&&HISTORY_FIELDS[m[1]]&&row.metadata?.basis==='TTM'?{history:m[1],field:HISTORY_FIELDS[m[1]],year:m[2],ttmHistory:true}:null;
}
export function prepareTtmHistory(data,rows,otherRows=[]){
  const histories={...data.ttmHistories},annotations=[],projected=[];
  const candidates=rows.map(r=>({r,t:ttmHistoryRow(r),p:{...r.metadata,manual:true,source:'Corrección manual de administración'}}));
  const now=new Date(data.asOf||Date.now()).getTime();
  const valid=({r,t,p})=>{
    if(/^(assets|equity|debt|cash|currentAssets|currentLiabilities|totalLiabilities|inventory|receivables|payables|retainedEarnings)History$/.test(t.history))return false;
    if(!Number.isFinite(r.value)||p.basis!=='TTM'||!validPeriod(p)||Date.parse(p.periodEnd)>now||!Number.isFinite(now))return false;
    if(p.currency!==data.currency||!p.scope||p.scope==='provider-unspecified')return false;
    if(t.field==='revVal'&&r.value<0)return false;
    if(t.field.toLowerCase().includes('shares'))return r.value>0&&p.unit==='shares';
    return !p.unit||p.unit===p.currency;
  };
  // Multiple administrative revisions of the same window use the latest saved
  // version, not an arbitrary array position. Physical revisions stay intact.
  const latest=new Map();
  for(const x of candidates){const k=`${x.t.history}|${x.p.periodEnd}`;if(!latest.has(k)||(x.r.id||0)>(latest.get(k).r.id||0))latest.set(k,x);}
  const chosen=[...latest.values()].sort((a,b)=>(b.p.periodEnd||'').localeCompare(a.p.periodEnd||'')||(b.r.id||0)-(a.r.id||0));
  const revisionAllowed=x=>!otherRows.some(r=>r.active&&r.target===x.t.field&&(r.id||0)>(x.r.id||0));
  const oldPeriod=f=>data.financialPeriods?.[f]||data.financialPeriods?.[f.replace(/Val$/,'')];
  const notOlder=x=>!oldPeriod(x.t.field)?.periodEnd||x.p.periodEnd>=oldPeriod(x.t.field).periodEnd;
  const revenue=chosen.find(x=>x.t.field==='revVal'&&valid(x)&&revisionAllowed(x)&&notOlder(x))?.p||oldPeriod('revVal');
  const cash=chosen.find(x=>x.t.field==='fcfVal'&&valid(x)&&revisionAllowed(x)&&notOlder(x))?.p||oldPeriod('fcfVal');
  const selectedFields=new Set();
  for(const x of chosen){
    const {r,t,p}=x;
    const anchor=['sbcVal','fcfVal','operatingCFVal','capexVal'].includes(t.field)?cash:revenue;
    const selected=valid(x)&&notOlder(x)&&revisionAllowed(x)&&!selectedFields.has(t.field)&&samePeriod(p,anchor);
    const reason=!valid(x)?'TTM guardado: el valor, las fechas de doce meses, la moneda, las unidades o el perímetro no cumplen las condiciones del cálculo.'
      :!selected?'TTM histórico independiente: no coincide con la ventana actual o existe una corrección principal más reciente.'
        :'TTM manual utilizado con su periodo completo; no sustituye el histórico FY ni Q.';
    const annotation={target:r.target,field:t.field,value:r.value,period:p,id:r.id,updatedAt:r.created_at,ttmHistory:true,modelExcluded:!selected,appliedToCurrent:selected,manualCalculation:selected,calculationStatus:selected?'manual':'ttm-history',reason};
    annotations.push(annotation);
    const point={...p,year:t.year,val:r.value,manualTarget:r.target};
    histories[t.history]=[...(histories[t.history]||[]).filter(a=>a.periodEnd!==p.periodEnd),point].sort((a,b)=>(a.periodEnd||'').localeCompare(b.periodEnd||''));
    if(selected){selectedFields.add(t.field);projected.push({...r,target:t.field,metadata:p});}
  }
  return {histories,annotations,projected};
}
export function ttmEpsPoints(data){
  const h=data.ttmHistories||{};
  return (h.niHistory||[]).flatMap(n=>{
    const matches=(h.sharesHistory||[]).filter(s=>samePeriod(n,s)&&s.val>0);
    return n.basis==='TTM'&&validPeriod(n)&&Number.isFinite(n.val)&&matches.length===1?[{...n,eps:+(n.val/matches[0].val).toFixed(2)}]:[];
  });
}
