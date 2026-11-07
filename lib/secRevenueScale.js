export const REVENUE_CONCEPTS=['RevenueFromContractWithCustomerExcludingAssessedTax','Revenues','SalesRevenueNet','RevenueFromContractWithCustomerIncludingAssessedTax'];
const COST_CONCEPTS=['CostOfRevenue','CostOfGoodsAndServicesSold','CostOfGoodsSold'];
const forms=new Set(['10-K','10-K/A','10-Q','10-Q/A','20-F','20-F/A']);
const close=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=Math.max(.01,Math.abs(b)*1e-8);
const scaleConflict=(a,b)=>a>0&&b>0&&[1000,1e6].some(f=>close(Math.max(a,b)/Math.min(a,b),f));
export const revenueConcepts=keys=>keys.length>0&&keys.every(k=>REVENUE_CONCEPTS.includes(k));

// companyfacts amounts already include iXBRL scale. Never scale them again or
// infer a replacement from magnitude. Choose an independently reported total,
// corroborated by GP + cost in the SAME filing, period and monetary unit.
export function reconcileSecRevenueScales(usgaap={}){
 const groups=new Map();
 for(const tag of [...REVENUE_CONCEPTS,'GrossProfit',...COST_CONCEPTS])for(const [unit,rows] of Object.entries(usgaap[tag]?.units||{})){
  if(!/^[A-Z]{3}$/.test(unit)||!Array.isArray(rows))continue;
  for(const p of rows){
   if(!p||!forms.has(p.form)||!p.start||!p.end||!p.accn||!Number.isFinite(p.val)||p.filed&&p.end>p.filed)continue;
   const key=[unit,p.start,p.end,p.accn,p.form].join('|');if(!groups.has(key))groups.set(key,[]);groups.get(key).push({tag,unit,p});
  }
 }
 const rejected=new Set(),issues=[];
 for(const rows of groups.values()){
  const totals=rows.filter(r=>REVENUE_CONCEPTS.includes(r.tag));
  const suspects=totals.filter(a=>totals.some(b=>a.tag!==b.tag&&scaleConflict(a.p.val,b.p.val)));
  if(!suspects.length)continue;
  const sums=rows.filter(r=>r.tag==='GrossProfit').flatMap(g=>rows.filter(c=>COST_CONCEPTS.includes(c.tag)&&c.p.val>=0).map(c=>({grossProfit:g.p.val,cost:c.p.val,costTag:c.tag,val:g.p.val+c.p.val})));
  const supported=totals.filter(t=>sums.some(s=>close(t.p.val,s.val))),values=supported.reduce((values,r)=>values.some(v=>close(v,r.p.val))?values:[...values,r.p.val],[]);
  const accepted=values.length===1?supported[0]:null;
  const removed=accepted?suspects.filter(r=>scaleConflict(r.p.val,accepted.p.val)):suspects;for(const r of removed)rejected.add(r.p);
  if(!removed.length)continue;
  const first=totals[0];issues.push({status:accepted?'resolved':'unresolved',periodStart:first.p.start,periodEnd:first.p.end,currency:first.unit,accession:first.p.accn,
   accepted:accepted?{tag:accepted.tag,val:accepted.p.val}:null,rejected:removed.map(r=>({tag:r.tag,val:r.p.val})),evidence:accepted?sums.find(s=>close(s.val,accepted.p.val)):null});
 }
 if(!rejected.size)return {usgaap,issues};
 const result={...usgaap};for(const tag of REVENUE_CONCEPTS)if(usgaap[tag])result[tag]={...usgaap[tag],units:Object.fromEntries(Object.entries(usgaap[tag].units||{}).map(([unit,rows])=>[unit,Array.isArray(rows)?rows.filter(p=>!rejected.has(p)):rows]))};
 return {usgaap:result,issues};
}

// Old caches lack the alternate reported concept. They may request a source
// refresh, but GP+cost alone is never used to rewrite their revenue value.
export function cachedRevenueScaleConflicts(d){
 const eq=(a,b)=>a?.periodStart&&a?.periodEnd&&a.periodStart===b?.periodStart&&a.periodEnd===b?.periodEnd&&a.currency&&a.currency===b.currency&&a.unit===a.currency&&b.unit===b.currency&&a.scope==='consolidated'&&b.scope===a.scope
  &&a.publicationDate&&a.publicationDate===b.publicationDate&&/SEC EDGAR/.test(a.source||'')&&/SEC EDGAR/.test(b.source||'')&&!a.manual&&!b.manual;
 const rows=key=>Array.isArray(d?.[key])?d[key]:[];
 return rows('revHistory').filter(r=>r&&!r.manual&&Number.isFinite(r.val)).flatMap(r=>{
  const g=rows('gpHistory').filter(p=>eq(r,p)&&Number.isFinite(p.val)),c=rows('cogsHistory').filter(p=>eq(r,p)&&Number.isFinite(p.val)&&p.val>=0);
  const sums=g.flatMap(g=>c.map(c=>g.val+c.val));
  return sums.some(s=>scaleConflict(r.val,s))?[{...r}]:[];
 });
}
export function quarantineCachedRevenueScale(d){
 if(!d||d.error||d.isEtf)return d;const conflicts=cachedRevenueScaleConflicts(d);if(!conflicts.length)return d;
 const result={...d,revHistory:(d.revHistory||[]).filter(r=>!r||!conflicts.some(c=>c.periodStart===r.periodStart&&c.periodEnd===r.periodEnd&&c.val===r.val)),secRevenueScale:{status:d.secRevenueScaleCheckedVersion===1?'unresolved':'refresh-required',conflicts}};
 const p=d.financialPeriods?.revVal||d.financialPeriods?.rev;
 const manual=f=>d.financialPeriods?.[f]?.manual||d.manualCalculation?.fields?.includes(f);
 const affected=!manual('revVal')&&conflicts.some(c=>close(d.revVal,c.val)||(p?.components||[]).some(x=>x.start===c.periodStart&&x.end===c.periodEnd&&close(x.val,c.val)));
 if(!manual('revGrowth'))result.revGrowth=null;
 if(affected){result.revVal=null;for(const f of ['grossMargin','opMargin','netMargin','dso','ccc'])if(!manual(f))result[f]=null;}
 return result;
}
