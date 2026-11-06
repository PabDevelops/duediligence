import {describe,it,expect} from 'vitest';
import {applyFinancialOverrides,cleanOverrideMetadata,financialOverrideStorageTarget,validateFinancialOverride} from './financialOverrides';
import {sanitizeFinancialData} from './financialDataPolicy';
import {computeEasyMode,computeDCFValue} from './financialCalculations';
import {analyzeStock} from './engine';
import sample from './__fixtures__/integrity-baseline/ALC.MC.json';
import apple from './__fixtures__/integrity-baseline/AAPL.json';
import lloyds from './__fixtures__/integrity-baseline/LLOY.L.json';
const metadata={basis:'H1',periodStart:'2026-01-01',periodEnd:'2026-06-30',currency:'USD',scope:'consolidated',sourceUrl:'https://example.org/report',note:'ROA semestral sobre activos medios, no anualizado',roaBasis:{annualized:false,denominator:'average-assets',assetsStartDate:'2025-12-31',assetsEndDate:'2026-06-30'}};
const correction=(m=metadata)=>({ticker:'TEST',target:financialOverrideStorageTarget('roa',m),metadata:cleanOverrideMetadata(m,'roa'),value:3.5,active:true,expectedId:0,id:1});
describe('independent non-annualized ROA',()=>{
 it('retains H1 with its precise fiscal and average-asset dates while leaving an incompatible principal ROA blocked',()=>{
  const p={...metadata,source:'SEC EDGAR companyfacts'};
  const base=sanitizeFinancialData({ticker:'TEST',niVal:3416614,assetsVal:107297637,roa:3.18,financialPeriods:{niVal:{...p,basis:'FY',periodStart:'2023-01-01',periodEnd:'2023-12-31'},assetsVal:{...p,basis:'instant',periodStart:null}}});
  expect(base.roa).toBeNull();
  const d=applyFinancialOverrides(base,[correction()]);
  expect(d.roa).toBeNull();expect(d.financialIntegrity).toEqual(base.financialIntegrity);
  expect(d.reportedIndicators[0]).toMatchObject({value:3.5,status:'pending-review',modelExcluded:true,period:{...metadata,source:'Corrección manual de administración'}});
  expect(d.niVal).toBe(base.niVal);expect(d.assetsVal).toBe(base.assetsVal);
 });
 it('never replaces a usable annual ratio, financial input, score or valuation',()=>{
  const base={...sample,ticker:'TEST',roa:8};
  const d=applyFinancialOverrides(base,[correction()]);
  const {reportedIndicators,...rest}=d;expect(rest).toEqual(base);expect(reportedIndicators).toHaveLength(1);
  expect(computeEasyMode(d,true)).toEqual(computeEasyMode(base,true));
  expect(computeDCFValue(d,.1)).toEqual(computeDCFValue(base,.1));
  expect(analyzeStock(d)).toEqual(analyzeStock(base));
 });
 it('keeps different periods side by side and deactivates only the selected record',()=>{
  const h1=correction(),q=correction({...metadata,basis:'Q',periodStart:'2026-04-01',roaBasis:{...metadata.roaBasis,assetsStartDate:'2026-03-31'}});
  expect(q.target).not.toBe(h1.target);
  expect(applyFinancialOverrides({ticker:'TEST'},[h1,q]).reportedIndicators).toHaveLength(2);
  const d=applyFinancialOverrides({ticker:'TEST'},[{...h1,active:false},q]);
  expect(d.reportedIndicators.map(r=>r.target)).toEqual([q.target]);
 });
 it('stores incomplete or inconsistent period documentation, without admitting it to the model',()=>{
  expect(validateFinancialOverride(correction())).toBeNull();
  for(const roaBasis of [undefined,{...metadata.roaBasis,annualized:true},{...metadata.roaBasis,denominator:'closing-assets'},{...metadata.roaBasis,assetsStartDate:'2026-01-01'},{...metadata.roaBasis,assetsEndDate:'2026-03-31'}]){
   const row=correction({...metadata,roaBasis});expect(validateFinancialOverride(row)).toBeNull();
   expect(applyFinancialOverrides({ticker:'TEST'},[row]).reportedIndicators[0]).toMatchObject({value:3.5,modelExcluded:true});
  }
  expect(validateFinancialOverride({...correction(),target:'roa'})).toBeNull();
  expect(validateFinancialOverride({...correction(),metadata:{...metadata,basis:'unknown',periodStart:null}})).toBeNull();
  expect(validateFinancialOverride({...correction(),target:'period:roa:H1:2025-06-30'})).toBeNull();
 });
 it('does not permit period targets for model outputs or silently annualize values',()=>{
  expect(validateFinancialOverride({...correction(),target:'period:quality:H1:2026-06-30'})).toBeTruthy();
  expect(applyFinancialOverrides({ticker:'TEST'},[correction()]).reportedIndicators[0].value).toBe(3.5);
 });
 it.each([['AAPL',apple],['LLOY.L',lloyds],['ALC.MC',sample]])('preserves all existing outputs for %s with an independent H1 record',(_,sampleData)=>{
  const base={...sampleData,ticker:'TEST'},d=applyFinancialOverrides(base,[correction()]);
  const {reportedIndicators,...rest}=d;expect(rest).toEqual(base);expect(reportedIndicators).toHaveLength(1);
  expect(analyzeStock(d)).toEqual(analyzeStock(base));
  expect(computeEasyMode(d,true)).toEqual(computeEasyMode(base,true));
  expect(computeDCFValue(d,.1)).toEqual(computeDCFValue(base,.1));
 });
});
