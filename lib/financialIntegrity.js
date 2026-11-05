// Data validation only: no valuation, scoring or projection formulas live here.
export const INTEGRITY_VERSION = 1;
const finite = Number.isFinite;
const iso = x => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) && !Number.isNaN(Date.parse(x)) && new Date(x).toISOString().slice(0,10)===x;
export function validPeriod(p) {
  if (!p || !['FY','H1','Q','TTM','instant'].includes(p.basis) || !iso(p.periodEnd)) return false;
  if (p.basis === 'instant') return true;
  if (!iso(p.periodStart) || p.periodStart > p.periodEnd) return false;
  const days = (Date.parse(p.periodEnd) - Date.parse(p.periodStart)) / 86400000 + 1;
  return p.basis === 'FY' || p.basis === 'TTM' ? days >= 350 && days <= 380
    : p.basis === 'H1' ? days >= 170 && days <= 190 : days >= 80 && days <= 100;
}
export function samePeriod(a,b) {
  return validPeriod(a) && validPeriod(b) && a.basis === b.basis && a.periodEnd === b.periodEnd
    && (a.periodStart || null) === (b.periodStart || null)
    && a.currency === b.currency && a.scope === b.scope;
}
export function periodKey(p) {
  return validPeriod(p) ? [p.basis,p.periodStart || '',p.periodEnd,p.currency || '',p.scope || ''].join('|') : null;
}
export function joinPeriods(a=[], b=[]) {
  const groups = new Map();
  for (const pt of b) { const k=periodKey(pt); if(k) groups.set(k, groups.has(k) ? null : pt); }
  const counts = new Map();
  for (const pt of a) { const k=periodKey(pt); if(k) counts.set(k,(counts.get(k)||0)+1); }
  return a.flatMap(pt => { const k=periodKey(pt), other=groups.get(k); return k && counts.get(k)===1 && other ? [[pt,other]] : []; });
}
export function cashFlowLessCapex(ocf=[], capex=[]) {
  return joinPeriods(ocf,capex).filter(([o,c])=>finite(o.val)&&finite(c.val))
    .map(([o,c])=>({...o,val:o.val-Math.abs(c.val),derivation:'OCF-minus-absolute-CAPEX'}));
}
export function annualPoints(points=[], allowInstant=false) {
  const seen=new Set(), duplicates=new Set();
  for(const p of points) {const k=periodKey(p); if(seen.has(k))duplicates.add(k); seen.add(k);}
  return points.filter(p=>finite(p.val)&&validPeriod(p)&&p.currency&&p.scope&&(p.basis==='FY'||(allowInstant&&p.basis==='instant'))&&!duplicates.has(periodKey(p)))
    .sort((a,b)=>a.periodEnd.localeCompare(b.periodEnd));
}
export function sumFourQuarters(points=[]) {
  const pts=points.slice(-4);
  if(pts.length!==4 || pts.some(p=>!finite(p.val)||p.basis!=='Q'||!validPeriod(p)))return null;
  for(let i=1;i<4;i++) {
    if(Date.parse(pts[i].periodStart)-Date.parse(pts[i-1].periodEnd)!==86400000 || pts[i].currency!==pts[0].currency || pts[i].scope!==pts[0].scope)return null;
  }
  return pts.reduce((s,p)=>s+p.val,0);
}
// No rate of 1 on missing currencies, malformed responses, timeouts or provider errors.
export async function resolveFxRate(from,to,fetcher=fetch) {
  if(!from||!to)return null;
  if(from===to)return 1;
  try {
    const res=await fetcher(`https://query1.finance.yahoo.com/v8/finance/chart/${from}${to}=X`,{headers:{'User-Agent':'Mozilla/5.0'}});
    if(!res.ok)return null;
    const d=await res.json(), rate=d?.chart?.result?.[0]?.meta?.regularMarketPrice;
    return finite(rate)&&rate>0?rate:null;
  }catch{return null;}
}
export const HISTORY_FIELDS = {
 revHistory:'revVal',niHistory:'niVal',oiHistory:'oiVal',fcfHistory:'fcfVal',gpHistory:'gpVal',
 operatingCFHistory:'operatingCFVal',capexHistory:'capexVal',daHistory:'daVal',assetsHistory:'assetsVal',
 equityHistory:'equityVal',debtHistory:'debtVal',cashHistory:'cashVal',currentAssetsHistory:'currentAssetsVal',
 currentLiabilitiesHistory:'currentLiabilitiesVal',totalLiabilitiesHistory:'totalLiabilitiesVal',
 ebtHistory:'ebtVal',taxHistory:'taxVal',interestHistory:'interestVal',rdHistory:'rdVal',
 cogsHistory:'cogsVal',sgaHistory:'sgaVal',sbcHistory:'sbcVal',dividendsPaidHistory:'dividendsPaidVal',
 investingCFHistory:'investingCFVal',financingCFHistory:'financingCFVal',inventoryHistory:'inventoryVal',
 receivablesHistory:'receivablesVal',payablesHistory:'payablesVal',retainedEarningsHistory:'retainedEarningsVal',
 sharesBasicHistory:'sharesBasicVal',sharesDilutedHistory:'sharesDilutedVal',sharesHistory:'sharesVal'
};
const aliases={revVal:'rev',oiVal:'oi',niVal:'ni',fcfVal:'fcf',operatingCFVal:'ocf',capexVal:'capex'};
export function sanitizeFinancialData(data) {
  if(!data||data.isEtf||data.error)return data;
  if(!Object.keys(data).some(k=>k.endsWith('History')||k.endsWith('Val')||['eps','pe','revGrowth','opMargin','roe','fcfYield'].includes(k)))return data;
  const d={...data}, issues=[...(data.financialIntegrity?.issues||[])], rejected={...data.financialIntegrity?.rejected}, periods={...data.financialPeriods};
  const note=(code,field)=>{if(!issues.some(x=>x.code===code&&x.field===field))issues.push({code,field});};
  const drop=(key,code)=>{if(d[key]!=null){rejected[key]=d[key];d[key]=null;note(code,key);}};
  for(const [hist,field] of Object.entries(HISTORY_FIELDS)) {
    const input=d[hist]||[];
    d[hist]=annualPoints(input, /^(assets|equity|debt|cash|currentAssets|currentLiabilities|totalLiabilities|inventory|receivables|payables|retainedEarnings)History$/.test(hist));
    if(d[hist].length!==input.length){ rejected[hist]=input;note('HISTORY_PERIOD_UNVERIFIED',hist); }
    const p=periods[field]||periods[aliases[field]];
    if(d[field]!=null && (!validPeriod(p)||!p.currency||!p.scope||p.currency!==d.currency||!['FY','TTM','instant'].includes(p.basis)))drop(field,'SCALAR_PERIOD_UNVERIFIED');
  }
  for(const [hist] of Object.entries(HISTORY_FIELDS)) {
    if(hist==='revHistory')continue;
    d[hist]=d[hist].filter(pt=> {
      const reference=d.revHistory.find(r=>r.year===pt.year);
      if(!reference)return true;
      return pt.basis==='instant' ? pt.periodEnd===reference.periodEnd&&pt.currency===reference.currency&&pt.scope===reference.scope : samePeriod(reference,pt);
    });
  }
  const anchor=[periods.revVal,periods.rev,periods.oiVal,periods.oi,periods.niVal,periods.ni,periods.fcfVal,periods.fcf].find(validPeriod);
  for(const [hist,field] of Object.entries(HISTORY_FIELDS)) {
    const fp=periods[field]||periods[aliases[field]];
    if(!finite(d[field])||!validPeriod(anchor)||field==='revVal')continue;
    if(fp?.basis==='instant') {
      if(fp.periodEnd!==anchor.periodEnd||fp.currency!==anchor.currency||fp.scope!==anchor.scope)drop(field,'SCALAR_COHORT_MISMATCH');
    }else if(!samePeriod(anchor,fp))drop(field,'SCALAR_COHORT_MISMATCH');
  }
  // A persisted marker is not proof: validate the actual inputs on every read.
  const p=key=>periods[key]||periods[aliases[key]];
  const coherent=keys=>keys.every(k=>finite(d[k])) && keys.every(k=>samePeriod(p(keys[0]),p(k)));
  const endCompatible=(flow,instant)=>validPeriod(p(flow))&&validPeriod(p(instant))&&p(flow).periodEnd===p(instant).periodEnd&&p(flow).currency===p(instant).currency&&p(flow).scope===p(instant).scope;
  for(const [ratio,keys] of Object.entries({opMargin:['revVal','oiVal'],netMargin:['revVal','niVal'],grossMargin:['revVal','gpVal']}))if(!coherent(keys))drop(ratio,'INCOMPATIBLE_INPUTS');
  for(const [ratio,flow,bal] of [['roe','niVal','equityVal'],['roa','niVal','assetsVal']])if(!endCompatible(flow,bal)||!finite(d[flow])||!finite(d[bal]))drop(ratio,'INCOMPATIBLE_INPUTS');
  if(!coherent(['operatingCFVal','capexVal']) || !samePeriod(p('fcfVal'),p('operatingCFVal')))drop('fcfVal','CAPEX_OR_PERIOD_UNVERIFIED');
  d.fcfHistory=cashFlowLessCapex(d.operatingCFHistory,d.capexHistory);
  if(finite(d.fcfVal)&&finite(d.operatingCFVal)&&finite(d.capexVal)&&Math.abs(d.fcfVal-(d.operatingCFVal-Math.abs(d.capexVal)))>Math.max(1,Math.abs(d.fcfVal)*1e-6))drop('fcfVal','FCF_COMPONENT_MISMATCH');
  if(d.fcfVal==null)for(const k of ['pfcf','fcfYield'])drop(k,'FCF_UNAVAILABLE');
  if(!coherent(['oiVal','daVal'])) {drop('daVal','EBITDA_PERIOD_MISMATCH');drop('evEbitda','EBITDA_PERIOD_MISMATCH');}
  if(!coherent(['debtVal','cashVal']))drop('netDebt','BALANCE_PERIOD_MISMATCH');
  if(!coherent(['debtVal','equityVal']))drop('debtToEquity','BALANCE_PERIOD_MISMATCH');
  if(!coherent(['oiVal','ebtVal','taxVal'])||!endCompatible('oiVal','assetsVal')||!endCompatible('oiVal','currentLiabilitiesVal'))drop('roic','ROIC_PERIOD_MISMATCH');
  for(const k of ['dso','dio','dpo','ccc','inventoryTurnover'])drop(k,'WORKING_CAPITAL_PERIOD_UNVERIFIED');
  // Reported growth needs its own comparable-period provenance; never label it as FY.
  if(!validPeriod(periods.revGrowth)||!validPeriod(periods.revGrowth?.comparisonPeriod))drop('revGrowth','GROWTH_PERIOD_UNVERIFIED');
  if(!validPeriod(periods.shareDilution))drop('shareDilution','SHARE_BASIS_UNVERIFIED');
  const epsP=periods.eps, shP=periods.epsShares;
  const epsShares=d.epsShares;
  if(!samePeriod(epsP,p('niVal'))||!samePeriod(epsP,shP)||!finite(epsShares)||epsShares<=0) {
    drop('eps','EPS_BASIS_UNVERIFIED');drop('pe','EPS_BASIS_UNVERIFIED');
  } else if(finite(d.eps)&&finite(d.niVal)) {
    // Half the displayed EPS precision + 2% tolerance for published rounding.
    const expected=d.niVal/epsShares, tolerance=(d.epsPrecision ?? 0.01)/2+Math.abs(expected)*0.02;
    if(Math.abs(d.eps-expected)>tolerance){drop('eps','EPS_NET_INCOME_MISMATCH');drop('pe','EPS_NET_INCOME_MISMATCH');}
  }
  if(finite(d.pe)&&finite(d.currentPrice)&&finite(d.eps)&&d.eps>0 && Math.abs(d.pe-d.currentPrice/d.eps)>Math.max(.1,Math.abs(d.pe)*.02))drop('pe','PE_EPS_MISMATCH');
  if(finite(data.eps)&&finite(data.niVal)&&finite(data.sharesOutstanding)) {
    const implied=data.eps*data.sharesOutstanding;
    if(Math.abs(implied-data.niVal)>Math.max(Math.abs(implied),Math.abs(data.niVal))*.15)note('EPS_SHARES_NET_INCOME_CONFLICT','eps');
  }
  for(const key of ['wcChangeHistory'])if(d[key])d[key]=annualPoints(d[key]);
  d.marginHistory=joinPeriods(d.revHistory,d.oiHistory).map(([r,o])=>({...r,margin:r.val?+(o.val/r.val*100).toFixed(1):null}));
  d.epsHistory=joinPeriods(d.niHistory,d.sharesHistory).filter(([,s])=>s.val>0).map(([n,s])=>({...n,eps:+(n.val/s.val).toFixed(2)}));
  if(!d.epsHistory.length)drop('epsCagr','EPS_HISTORY_UNAVAILABLE');
  // Legacy quarterly snapshots have no recoverable period identity.
  if(d.prevQuarter&&!d.prevQuarter.financialPeriods)d.prevQuarter=null;
  d.financialPeriods=periods;
  d.financialIntegrity={version:INTEGRITY_VERSION,issues,rejected,status:issues.length?'partial':'validated'};
  return d;
}
