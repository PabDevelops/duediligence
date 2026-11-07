import {it,expect} from 'vitest';
import {reconcileSecRevenueScales,REVENUE_CONCEPTS,cachedRevenueScaleConflicts,quarantineCachedRevenueScale} from './secRevenueScale';
import {selectFlowSeries} from './secFactSelection';
import {sanitizeFinancialData} from './financialDataPolicy';
import tygo from './__fixtures__/tygo-revenue-scale-sec.json';
import apple from './__fixtures__/aapl-companyfacts-integrity.json';
import flyw from './__fixtures__/flyw-companyfacts-selection.json';
import buda from './__fixtures__/buda-companyfacts-coverage.json';
import onen from './__fixtures__/onen-companyfacts-coverage.json';
const p={start:'2025-01-01',end:'2025-12-31',filed:'2026-03-01',accn:'0000000001-26-000001',form:'10-K'};
const metric=(val,patch={})=>({units:{USD:[{...p,val,...patch}]}});
const gaap=()=>({Revenues:metric(100),RevenueFromContractWithCustomerExcludingAssessedTax:metric(100000),GrossProfit:metric(40),CostOfRevenue:metric(60)});
const period={basis:'FY',periodStart:p.start,periodEnd:p.end,currency:'USD',unit:'USD',scope:'consolidated',source:'SEC EDGAR',publicationDate:p.filed};
const cached=()=>({ticker:'TEST',revHistory:[{...period,year:'2025',val:100000}],gpHistory:[{...period,year:'2025',val:40}],cogsHistory:[{...period,year:'2025',val:60}],revVal:100000,niVal:12,fcfVal:15,revGrowth:10,opMargin:1,financialPeriods:{revVal:period}});
it('TYGO: rejects incorrectly scaled alias facts and selects the complete corroborated Revenues series',()=>{
 const source=tygo.facts['us-gaap'],before=structuredClone(source),r=reconcileSecRevenueScales(source);
 const issue=r.issues.find(i=>i.periodStart==='2025-01-01'&&i.periodEnd==='2025-12-31');
 expect(issue).toMatchObject({status:'resolved',accepted:{tag:'Revenues',val:103536000},evidence:{grossProfit:44351000,cost:59185000,val:103536000}});
 expect(issue.rejected).toContainEqual({tag:'RevenueFromContractWithCustomerExcludingAssessedTax',val:103536000000});
 const series=selectFlowSeries(source,REVENUE_CONCEPTS,'2025-12-31');expect(new Set(series.map(p=>p.tag))).toEqual(new Set(['Revenues']));
 const value=(start,end)=>series.find(p=>p.start===start&&p.end===end).val;
 expect(value('2025-01-01','2025-12-31')).toBe(103536000);
 expect(value('2025-01-01','2025-12-31')-value('2025-01-01','2025-09-30')+value('2026-01-01','2026-09-30')).toBe(104671000);
 expect(source).toEqual(before);
});
it('does not divide by 1000 or always choose the smaller total',()=>{
 const g=gaap();g.GrossProfit=metric(40000);g.CostOfRevenue=metric(60000);
 expect(reconcileSecRevenueScales(g).issues[0]).toMatchObject({accepted:{val:100000}});
});
it.each([['filing',{accn:'0000000001-26-000002'}],['period',{start:'2024-01-01'}],['publication',{filed:'2025-01-01'}]])('never corroborates across incompatible %s',(_,patch)=>{
 const g=gaap();g.GrossProfit=metric(40,patch);expect(reconcileSecRevenueScales(g).issues[0]).toMatchObject({status:'unresolved',accepted:null});
});
it('does not corroborate different currencies or units',()=>{
 const g=gaap();g.GrossProfit={units:{EUR:[{...p,val:40}]}};
 expect(reconcileSecRevenueScales(g).issues[0].accepted).toBeNull();
});
it('rejects unresolved and contradictory identities instead of inventing a replacement',()=>{
 for(const mode of ['missing','contradictory']){const g=gaap();if(mode==='missing')delete g.GrossProfit;else g.CostOfGoodsSold=metric(99960);const r=reconcileSecRevenueScales(g);expect(r.issues[0].status).toBe('unresolved');expect(r.usgaap.Revenues.units.USD).toEqual([]);expect(r.usgaap.RevenueFromContractWithCustomerExcludingAssessedTax.units.USD).toEqual([]);}
});
it('preserves large correct totals, real growth, and non-scale gross/net differences',()=>{
 for(const value of [100,1e12]){const g={Revenues:metric(value),GrossProfit:metric(value*.4),CostOfRevenue:metric(value*.6)};expect(reconcileSecRevenueScales(g).usgaap).toBe(g);}
 const g=gaap();g.RevenueFromContractWithCustomerExcludingAssessedTax=metric(95);expect(reconcileSecRevenueScales(g).usgaap).toBe(g);
});
it('does not remove legitimate gross/net tax variants when another concept has a scale error',()=>{
 const g=gaap();g.RevenueFromContractWithCustomerIncludingAssessedTax=metric(105);
 const r=reconcileSecRevenueScales(g);expect(r.usgaap.RevenueFromContractWithCustomerIncludingAssessedTax).toEqual(g.RevenueFromContractWithCustomerIncludingAssessedTax);expect(r.usgaap.Revenues).toEqual(g.Revenues);expect(r.issues[0].rejected).toEqual([{tag:'RevenueFromContractWithCustomerExcludingAssessedTax',val:100000}]);
});
it.each([apple,flyw,buda,onen])('preserves other SEC tickers and all non-revenue concepts',json=>{
 const g=json.facts['us-gaap'],before=structuredClone(g),r=reconcileSecRevenueScales(g);expect(r.issues).toEqual([]);expect(r.usgaap).toEqual(before);
});
it('quarantines old cached totals and dependent TTM without changing NI, FCF or input data',()=>{
 const d=cached(),before=structuredClone(d),a=quarantineCachedRevenueScale(d);expect(a).toMatchObject({revVal:null,niVal:12,fcfVal:15,secRevenueScale:{status:'refresh-required'}});expect(a.revHistory).toEqual([]);expect(d).toEqual(before);
 const ttm={...d,revVal:100020,financialPeriods:{revVal:{...period,basis:'TTM',components:[{start:p.start,end:p.end,val:100000}]}}};expect(quarantineCachedRevenueScale(ttm).revVal).toBeNull();
 expect(sanitizeFinancialData(d).financialIntegrity.issues.some(i=>i.code==='REVENUE_SCALE_CONFLICT')).toBe(true);
});
it('does not mask manual corrections or unrelated current revenue',()=>{
 const d=cached();d.financialPeriods.revVal={...period,manual:true};expect(quarantineCachedRevenueScale(d).revVal).toBe(100000);
 const current={...cached(),revVal:120};expect(quarantineCachedRevenueScale(current).revVal).toBe(120);
 d.revHistory[0].manual=true;expect(cachedRevenueScaleConflicts(d)).toEqual([]);
});
it('marks a freshly rechecked unresolved cache without demanding another full refresh',()=>expect(quarantineCachedRevenueScale({...cached(),secRevenueScaleCheckedVersion:1}).secRevenueScale.status).toBe('unresolved'));
it('leaves malformed or absent histories to the existing validator without throwing',()=>{
 for(const revHistory of [null,{},'invalid',[null]])expect(cachedRevenueScaleConflicts({revHistory,gpHistory:{},cogsHistory:null})).toEqual([]);
});
it('does not fail source reconciliation on malformed units or null facts',()=>{
 const g=gaap();g.SalesRevenueNet={units:{USD:{invalid:true}}};g.GrossProfit.units.USD.unshift(null);
 expect(reconcileSecRevenueScales(g).issues[0].accepted.val).toBe(100);
});
