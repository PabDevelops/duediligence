import {it,expect} from 'vitest';
import {OFFICIAL_SHARE_CLASSES,reconcileOfficialShareClasses} from './officialShareClasses';
import {recomputeFinancialPriceRatios} from './priceRatios';
import {sanitizeFinancialData} from './financialIntegrity';
import {screenerView} from './screenerView';
import {applyFinancialOverrides,cleanOverrideMetadata} from './financialOverrides';
import {analyzeStock} from './engine';
import {computeEasyMode} from './financialCalculations';
import {computeCompanyScores} from './companyScoreCalibration';
import ophc from './__fixtures__/OPHC-share-classes.json';
import apple from './__fixtures__/integrity-baseline/AAPL.json';
import altia from './__fixtures__/integrity-baseline/ALC.MC.json';
import lloyds from './__fixtures__/integrity-baseline/LLOY.L.json';

const total=24080821,record=OFFICIAL_SHARE_CLASSES[0];
const score=d=>computeCompanyScores(d,computeEasyMode(d,true),analyzeStock(d));
it('reconciles OPHC only from the two same-date economically equivalent common classes',()=>{
 const before=structuredClone(ophc),d=reconcileOfficialShareClasses(ophc);
 expect(record.classes.reduce((s,c)=>s+c.shares,0)).toBe(total);
 expect(d.sharesOutstanding).toBe(total);expect(d.sharesVal).toBe(total);
 expect(d.marketCap).toBeCloseTo(212633649.43,2);expect(d.priceToBook).toBe(1.58);
 expect(d.financialPeriods.sharesOutstanding).toMatchObject({periodEnd:'2026-08-10',unit:'shares',sourceUrl:record.source});
 expect(d.shareClassEvidence.providerShares).toBe(12340785);
 expect(ophc).toEqual(before);expect(reconcileOfficialShareClasses(d)).toBe(d);
});
it('preserves EPS, weighted average shares, annual histories and all model assumptions',()=>{
 const d=reconcileOfficialShareClasses(ophc),a=analyzeStock(ophc),b=analyzeStock(d);
 for(const key of ['eps','sharesBasicVal','sharesDilutedVal','sharesHistory','sharesBasicHistory','sharesDilutedHistory','niVal','equityVal','revHistory','niHistory'])expect(d[key]).toEqual(ophc[key]);
 const central=x=>x.scenarios.scenarios.find(s=>s.key==='central');
 expect(central(a).assumptions).toEqual(central(b).assumptions);
 expect(central(a).fairValueToday).toBe(21.88);expect(central(b).fairValueToday).toBe(11.22);
 expect(central(b)).toMatchObject({sharesToday:total,bookValuePerShareToday:5.58,valueYear5:20.71});
 expect(b.quality).toEqual(a.quality);expect(b.momentum).toEqual(a.momentum);
 expect(score(d)[0]).toEqual(score(ophc)[0]);expect(score(d)[2]).toEqual(score(ophc)[2]);
 expect(score(ophc)[1]).toMatchObject({tier:'S',score100:86,coverage:1});
 expect(score(d)[1]).toMatchObject({tier:'C',score100:54,coverage:1});
});
it('corrects old cache reads consistently for detail, watchlist and compact screener validation',()=>{
 const d=sanitizeFinancialData(ophc);
 expect(d.sharesOutstanding).toBe(total);expect(d.marketCap).toBeCloseTo(212633649.43,2);
 expect(screenerView(d).marketCap).toBe(d.marketCap);
 expect(screenerView(d)).not.toHaveProperty('shareClassEvidence');
 expect(sanitizeFinancialData(d).marketCap).toBe(d.marketCap);
});
it('does not add nonvoting shares twice when a provider already reports the complete total',()=>{
 const d=reconcileOfficialShareClasses({...ophc,sharesOutstanding:total});
 expect(d.sharesOutstanding).toBe(total);expect(d.marketCap).toBe(ophc.currentPrice*total);
});
it.each([
 {ticker:'OTHER'}, {cik:'0000000001'}, {currency:'EUR'},
 {lastFilingDate:null}, {asOf:'2026-07-01'}, {sharesOutstanding:30000000},
 {financialPeriods:{sharesOutstanding:{manual:true}}},
 {manualCalculation:{fields:['sharesVal']}},
])('does not apply reviewed OPHC evidence to an incompatible or manually controlled input %j',patch=>{
 const d={...ophc,...patch};expect(reconcileOfficialShareClasses(d)).toBe(d);
});
it('does not silently reuse an old class reconciliation against a newer filing and known partial count',()=>{
 const d=sanitizeFinancialData({...ophc,lastFilingDate:'2026-11-10'});
 expect(d.sharesOutstanding).toBeNull();expect(d.marketCap).toBeNull();
 expect(d.financialIntegrity.issues.some(i=>i.code==='SHARE_CLASSES_REQUIRE_REVIEW')).toBe(true);
 expect(score(d)[1].score100).toBeNull();
 const updated={...ophc,lastFilingDate:'2026-11-10',sharesOutstanding:25000000};
 expect(reconcileOfficialShareClasses(updated)).toBe(updated);
});
it.each([
 r=>({...r,economicallyEquivalent:false}),
 r=>({...r,classes:[r.classes[0],r.classes[0]]}),
 r=>({...r,classes:[r.classes[0],{...r.classes[1],kind:'preferred'}]}),
 r=>({...r,classes:[r.classes[0],{...r.classes[1],economicUnits:2}]}),
 r=>({...r,classes:[r.classes[0],{...r.classes[1],asOf:'2026-06-30'}]}),
 r=>({...r,classes:[r.classes[0],{...r.classes[1],shares:-1}]}),
])('rejects ambiguous classes, dates and economic rights without guessing totals',modify=>{
 expect(reconcileOfficialShareClasses(ophc,[modify(record)])).toBe(ophc);
});
it('uses the exact existing price-refresh formulas with a new total and fresh quote',()=>{
 const d=reconcileOfficialShareClasses(ophc),fresh=recomputeFinancialPriceRatios(d,10);
 expect(fresh.marketCap).toBe(240808210);expect(fresh.priceToBook).toBe(+(240808210/ophc.equityVal).toFixed(2));
 expect(fresh.pe).toBe(+(10/ophc.eps).toFixed(2));
 const refreshed=sanitizeFinancialData({...d,...fresh,currentPrice:10});
 expect(refreshed.marketCap).toBe(240808210);expect(refreshed.sharesOutstanding).toBe(total);
});
it.each([null,0,-1,NaN])('does not keep a partial market cap when the price is unusable (%s)',price=>{
 const d=reconcileOfficialShareClasses({...ophc,currentPrice:price});
 expect(d.sharesOutstanding).toBe(total);expect(d.marketCap).toBeNull();expect(d.priceToBook).toBeNull();
});
it('preserves the administrator share override after reconciliation',()=>{
 const target='sharesOutstanding',metadata=cleanOverrideMetadata({basis:'instant',periodEnd:'2026-10-01',currency:'USD',scope:'consolidated'},target);
 const base=sanitizeFinancialData(ophc),r={id:999,ticker:'OPHC',target,value:25000000,metadata,active:true};
 const d=applyFinancialOverrides(base,[r],{manualAuthority:true});
 expect(d.sharesOutstanding).toBe(25000000);expect(d.marketCap).toBe(25000000*ophc.currentPrice);
 expect(reconcileOfficialShareClasses(d)).toBe(d);
});
it.each([apple,altia,lloyds])('preserves other issuers and listings ($ticker)',d=>{
 expect(reconcileOfficialShareClasses(d)).toBe(d);
 expect(recomputeFinancialPriceRatios(d,d.currentPrice).pe).toBe(d.eps?+(d.currentPrice/d.eps).toFixed(2):undefined);
});
