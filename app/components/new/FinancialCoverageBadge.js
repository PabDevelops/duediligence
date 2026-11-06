import {getCompanyHeaderScores} from '../../../lib/companyHeaderScores';
import {financialCoverageBadge} from '../../../lib/financialCoverageBadge';
export default function FinancialCoverageBadge({data,easyMode,analysis}){
  const badge=financialCoverageBadge(getCompanyHeaderScores(easyMode,data,analysis),data);
  if(!badge)return null;
  return <details style={{margin:'10px 0',fontSize:12,color:'#226D3A'}}><summary style={{cursor:'pointer',display:'flex',alignItems:'center',gap:6,fontWeight:700}}>
    <svg width="19" height="21" viewBox="0 0 20 22" aria-hidden="true"><path d="M10 1 18 4v6c0 5-4 8-8 11C6 18 2 15 2 10V4Z" fill="#E4F3DE" stroke="#226D3A"/><path d="m6 10 3 3 5-6" fill="none" stroke="#226D3A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>{badge.label}</summary>
    <p style={{maxWidth:600,lineHeight:1.5}}>{badge.description}</p></details>;
}
