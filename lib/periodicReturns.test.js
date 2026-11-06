import {describe,it,expect} from 'vitest';
import {evaluatePeriodicReturn} from './periodicReturns';
import {applyFinancialOverrides,cleanOverrideMetadata,financialOverrideStorageTarget} from './financialOverrides';
import {analyzeStock} from './engine';
import {computeEasyMode,computeDCFValue} from './financialCalculations';
import {normalizeInput} from './engine/input';
const p={basis:'H1',periodStart:'2026-01-01',periodEnd:'2026-06-30',currency:'USD',scope:'consolidated',source:'Official report'};
const point=(val,date)=>({basis:'instant',periodEnd:date,currency:'USD',scope:'consolidated',source:'Official report',val});
const period=field=>({...p,returnBasis:{annualized:false,denominator:field==='roe'?'average-equity':'average-assets',assetsStartDate:'2025-12-31',assetsEndDate:'2026-06-30'}});
const data={ticker:'TEST',currency:'USD',niVal:15,assetsVal:200,equityVal:200,assetsHistory:[{...point(100,'2025-12-31'),year:'2025'}],equityHistory:[{...point(100,'2025-12-31'),year:'2025'}],financialPeriods:{niVal:p,assetsVal:point(200,'2026-06-30'),equityVal:point(200,'2026-06-30')}};
const row=field=>({ticker:'TEST',id:1,target:financialOverrideStorageTarget(field,period(field)),value:10,metadata:cleanOverrideMetadata(period(field),field),active:true});
describe('manual returns have priority within a comparable period',()=>{
 it.each(['roe','roa'])('uses %s for H1 calculations against exact H1 income and opening/closing mean balances',field=>{
  const result=applyFinancialOverrides(data,[row(field)]),r=result.reportedIndicators[0];
  expect(r).toMatchObject({field,value:10,status:'period-comparable',modelExcluded:true,periodCalculation:{value:10,calculatedValue:10,netIncome:15,meanBalance:150,annualized:false,basis:'H1'}});
  expect(result[field]).toBe(data[field]);
  expect(computeEasyMode(result,true)).toEqual(computeEasyMode(data,true));
  expect(computeDCFValue(result,.1)).toEqual(computeDCFValue(data,.1));
  expect(analyzeStock(result)).toEqual(analyzeStock(data));
 });
 it('does not replace a TTM or annual figure with a same-end-date H1 figure',()=>{
  const result=applyFinancialOverrides({...data,roa:7,roe:8},[row('roe'),row('roa')]);
  expect(result.roe).toBe(8);expect(result.roa).toBe(7);expect(result.reportedIndicators).toHaveLength(2);
 });
 it('does not annualize a half-year result, even if a value was marked annualized without an accepted method',()=>{
  const r={field:'roa',value:20,period:{...period('roa'),returnBasis:{...period('roa').returnBasis,annualized:true}}};
  expect(evaluatePeriodicReturn(r,data)).toMatchObject({status:'pending-review',periodCalculation:null});
  expect(evaluatePeriodicReturn({...r,value:10,period:period('roa')},data).periodCalculation.annualized).toBe(false);
 });
 it.each([
  {...data,financialPeriods:{...data.financialPeriods,niVal:{...p,basis:'FY',periodStart:'2025-07-01'}}},
  {...data,assetsHistory:[{...point(100,'2025-12-31'),currency:'EUR'}]},
  {...data,assetsHistory:[{...point(100,'2025-12-31'),scope:'standalone'}]},
  {...data,assetsHistory:[]},
  {...data,assetsHistory:[point(100,'2025-12-31'),point(110,'2025-12-31')]},
 ])('does not combine incompatible or conflicting components (%#)',inputs=>{
  expect(evaluatePeriodicReturn({field:'roa',value:10,period:period('roa')},inputs)).toMatchObject({status:'pending-review',periodCalculation:null});
 });
 it('keeps a conflicting reported value but does not calculate with it',()=>{
  const r=applyFinancialOverrides(data,[{...row('roa'),value:25}]).reportedIndicators[0];
  expect(r.value).toBe(25);expect(r.periodCalculation).toBeNull();expect(r.reason).toContain('no coincide');
 });
 it('preserves a zero return for zero income and a positive mean balance',()=>{
  expect(evaluatePeriodicReturn({field:'roa',value:0,period:period('roa')},{...data,niVal:0})).toMatchObject({status:'period-comparable',periodCalculation:{value:0,calculatedValue:0}});
 });
 it('can compare a dimensionless return with optional scope omitted only when all matched components establish a unique context',()=>{
  const metadata={...period('roa'),scope:'provider-unspecified'};
  expect(evaluatePeriodicReturn({field:'roa',value:10,period:metadata},data)).toMatchObject({status:'period-comparable',periodCalculation:{scope:'consolidated'}});
  const mixed={...data,niHistory:[{...p,scope:'standalone',val:15}]};
  expect(evaluatePeriodicReturn({field:'roa',value:10,period:metadata},mixed).periodCalculation).toBeNull();
 });
 it('gives comparable annual manual ROE precedence in the existing normalized model without requiring optional scope',()=>{
  const fy={...p,basis:'FY',periodStart:'2025-01-01',periodEnd:'2025-12-31'};
  const base={...data,roe:5,financialPeriods:{niVal:fy,equityVal:{...fy,basis:'instant',periodStart:null}}};
  const metadata=cleanOverrideMetadata({...fy,scope:undefined},'roe');
  const d=applyFinancialOverrides(base,[{ticker:'TEST',target:'roe',value:22,metadata,active:true}]);
  expect(d.roe).toBe(22);expect(normalizeInput(d).roe).toBe(.22);
  expect(d.manualCorrections[0].modelExcluded).toBe(false);
 });
});
