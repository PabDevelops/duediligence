import {describe,it,expect,vi} from 'vitest';
import {scopeFinancialEntity,listingPresentation,withListingIdentity,REVIEWED_LISTINGS} from './listingIdentity';
import {sanitizeFinancialData,analysisData} from './financialDataPolicy';
import {computeCompanyScores} from './companyScoreCalibration';
import {computeEasyMode,computeDCFValue} from './financialCalculations';
import {analyzeStock} from './engine';
import onen from './__fixtures__/ONEN-entity-earnings.json';
import apple from './__fixtures__/integrity-baseline/AAPL.json';
import altia from './__fixtures__/integrity-baseline/ALC.MC.json';
import lloyds from './__fixtures__/integrity-baseline/LLOY.L.json';
import {applyFinancialOverrides,cleanOverrideMetadata} from './financialOverrides';
import {scoreCoverageDetails} from './scoreCoverageDetails';
const event=REVIEWED_LISTINGS[0];
const p={basis:'FY',periodStart:'2025-01-01',periodEnd:'2025-12-31',currency:'USD',scope:'consolidated',source:'SEC EDGAR companyfacts',publicationDate:'2026-03-06'};
const score=d=>computeCompanyScores(d,computeEasyMode(d,true),analyzeStock(d));
describe('SPAC accounting entities, independent of listing-age information',()=>{
 it('ONEN: removes 2025 vehicle earnings and the old TTM from every model while retaining originals',()=>{
  const before=structuredClone(onen),d=sanitizeFinancialData(onen);
  expect(d.niVal).toBeNull();expect(d.niHistory).toEqual([]);
  expect(d.entityHistory).toEqual(expect.arrayContaining([expect.objectContaining({field:'niHistory',value:3687416,entity:'vehicle'})]));
  for(const purpose of ['standalone','quality','dcf'])expect(analysisData(onen,purpose).niVal).toBeNull();
  const scores=score(onen);expect(scores.every(s=>s.score100==null&&s.indicative==null)).toBe(true);
  expect(computeDCFValue(onen,.1)).toBeNull();expect(onen).toEqual(before);
 });
 it('is a generic entity-boundary rule, not a ticker exception',()=>{
  const d=scopeFinancialEntity({...onen,ticker:'UNRELATED',name:'Another business'});
  expect(d.niVal).toBeNull();expect(d.entityHistory.some(r=>r.value===3687416)).toBe(true);
 });
 it('preserves legitimate pre-listing operating histories with explicit sourced identity',()=>{
  const op={...p,val:-20,reportingEntityId:event.operatingEntityId,reportingEntitySourceUrl:event.operatingSources[0]},vehicle={...p,val:100};
  const d=scopeFinancialEntity({ticker:'TEST',asOf:'2026-11-07',listingInfo:event,revHistory:[{...op,year:'2025'},{...vehicle,year:'2024'}],niVal:-20,financialPeriods:{niVal:op}});
  expect(d.revHistory).toHaveLength(1);expect(d.revHistory[0].val).toBe(-20);expect(d.niVal).toBe(-20);
 });
 it('preserves current post-combination financials but blocks cross-boundary TTM and pro formas',()=>{
  const post={...p,periodStart:'2026-10-01',periodEnd:'2026-12-31',basis:'Q',publicationDate:'2027-02-01'};
  const d=scopeFinancialEntity({listingInfo:event,asOf:'2027-02-01',niVal:10,oiVal:20,revVal:100,financialPeriods:{niVal:post,oiVal:{...post,periodStart:'2026-01-01',basis:'FY'},revVal:{...post,proForma:true}}});
  expect(d.niVal).toBe(10);expect(d.oiVal).toBeNull();expect(d.revVal).toBeNull();
 });
 it('does not reintroduce vehicle amounts through manual authority or quarterly histories',()=>{
  const d={...onen,manualCalculation:{fields:['niVal']},quarterlyHistories:{niHistory:[{...p,val:50,basis:'Q'}]},manualCorrections:[{target:'niVal',value:50,field:'niVal',period:p,manualCalculation:true}]};
  expect(analysisData(d).niVal).toBeNull();const scoped=scopeFinancialEntity(d);expect(scoped.quarterlyHistories.niHistory).toEqual([]);expect(scoped.manualCorrections[0]).toMatchObject({value:50,modelExcluded:true,entityExcluded:true,manualCalculation:false});
 });
 it('is idempotent and retains quarantined data on repeated cache reads',()=>{const first=scopeFinancialEntity(onen);expect(scopeFinancialEntity(first)).toEqual(first);});
 it('guards the real administration-override path without deleting a saved revision',()=>{
  const rows=[{id:42,ticker:'ONEN',target:'niVal',value:50,metadata:cleanOverrideMetadata(p,'niVal'),active:true}];
  const d=applyFinancialOverrides(sanitizeFinancialData(onen),rows,{manualAuthority:true});
  expect(d.niVal).toBeNull();expect(d.manualCorrections.find(r=>r.id===42)).toMatchObject({value:50,entityExcluded:true,modelExcluded:true});expect(rows[0].value).toBe(50);
  const legitimate=applyFinancialOverrides(sanitizeFinancialData(onen),[{...rows[0],metadata:cleanOverrideMetadata({...p,sourceUrl:event.operatingSources[0]},'niVal')}],{manualAuthority:true});
  expect(legitimate.niVal).toBe(50);
 });
 it('shows the entity reason in score coverage diagnostics rather than asking for the SPAC profit again',()=>{
  const a=analyzeStock(onen),s=score(onen)[1];expect(scoreCoverageDetails(s,onen,a).some(c=>c.reason.includes('entidad'))).toBe(true);
 });
 it('blocks unidentified financials when a shell exit is documented but its accounting boundary is not yet verified',()=>{
  const event={type:'shell-transition',status:'review-required',sourceUrl:'https://www.sec.gov/Archives/test',publicationDate:'2026-09-29'};
  const d=scopeFinancialEntity({asOf:'2026-11-07',listingInfo:event,niVal:30,financialPeriods:{niVal:p},revHistory:[{...p,val:100,year:'2025'}]});
  expect(d.niVal).toBeNull();expect(d.revHistory).toEqual([]);expect(d.entityComparability.boundary).toBeNull();
 });
 it('never misaligns surviving quarterly revenue and earnings by array position',()=>{
  const point=period=>({basis:'Q',periodStart:'2026-10-01',periodEnd:'2026-12-31',period,source:'SEC',val:10});
  const d=scopeFinancialEntity({listingInfo:event,asOf:'2027-03-01',quarterly:{revenue:[point('2026Q4'),point('2027Q1')],operatingIncome:[point('2027Q1')]}});
  expect(d.quarterly.operatingIncome.map(r=>r.val)).toEqual([null,10]);
 });
 it('does not apply future transaction evidence to an earlier as-of date',()=>expect(withListingIdentity({...onen,asOf:'2026-09-01'}).listingInfo).toBeUndefined());
 it.each([apple,altia,lloyds])('ordinary companies keep data and all existing calculations unchanged: $ticker',d=>{
  expect(scopeFinancialEntity(d)).toEqual(d);
  const withIPO={...d,listingInfo:{type:'ipo',status:'verified',date:'2026-10-01',source:'Official exchange',sourceUrl:'https://example.org/ipo'}};
  expect(score(withIPO)).toEqual(score(d));expect(analyzeStock(withIPO).scenarios).toEqual(analyzeStock(d).scenarios);expect(computeDCFValue(withIPO,.1)).toEqual(computeDCFValue(d,.1));
 });
 it('uses the operating listing date, not the vehicle IPO date, and exactly 24 calendar months',()=>{
  expect(listingPresentation(onen,'2026-11-07')).toMatchObject({recent:true,typeLabel:'SPAC',date:'2026-09-24'});
  expect(listingPresentation(onen,'2028-09-23').recent).toBe(true);expect(listingPresentation(onen,'2028-09-24').recent).toBe(false);
 });
 it('does not call a provider date a verified traditional IPO or infer a missing date',()=>{
  const d={listingInfo:{date:'2026-10-01',status:'provider-reported',type:null}};
  expect(listingPresentation(d,'2026-11-07')).toMatchObject({recent:true,typeLabel:'Tipo no verificado'});
  expect(listingPresentation({listingInfo:{status:'verified',type:'spac'}},'2026-11-07')).toMatchObject({date:null,recent:false});
 });
 it('handles a leap-day listing with a 24-month anniversary at the end of February',()=>{
  const d={listingInfo:{status:'verified',type:'ipo',date:'2024-02-29'}};expect(listingPresentation(d,'2026-02-27').recent).toBe(true);expect(listingPresentation(d,'2026-02-28').recent).toBe(false);
 });
 it('expires the age badge using today, independently of an old financial snapshot date',()=>{
  vi.useFakeTimers();try{vi.setSystemTime(new Date('2028-09-24T12:00:00Z'));expect(listingPresentation(onen).recent).toBe(false);}finally{vi.useRealTimers();}
 });
 it('warns about missing pre-listing history without filtering ordinary IPO data',()=>{
  const d={listingInfo:{date:'2026-10-01',status:'verified',type:'ipo'},revHistory:[{year:'2025',val:100}]};
  expect(listingPresentation(d,'2026-11-07').warning).toContain('incompleto');expect(scopeFinancialEntity(d).revHistory).toEqual(d.revHistory);
 });
});
