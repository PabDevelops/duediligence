import {describe,it,expect} from 'vitest';
import {valuationCashFlow} from './valuationCashFlow';
import {analyzeStock} from './engine';
import {computeCompanyScores,MIN_SCORE_COVERAGE} from './companyScoreCalibration';
import {computeEasyMode,computeDCFValue} from './financialCalculations';
import {statementRows} from './analysisPresentation';
import anna from './__fixtures__/ANNA-manual-FY2025.json';
import apple from './__fixtures__/integrity-baseline/AAPL.json';
import lloyds from './__fixtures__/integrity-baseline/LLOY.L.json';
import altia from './__fixtures__/integrity-baseline/ALC.MC.json';
const p=y=>({basis:'FY',periodStart:`${y}-01-01`,periodEnd:`${y}-12-31`,currency:'USD',scope:'consolidated',unit:'USD'});
const data={currency:'USD',fcfVal:10,sbcVal:20,financialPeriods:{fcfVal:{...p('2026'),basis:'H1',periodEnd:'2026-06-30'},sbcVal:{...p('2026'),basis:'H1',periodEnd:'2026-06-30'}},fcfHistory:[{...p('2025'),val:100}],sbcHistory:[{...p('2025'),val:20}]};
describe('annual FCF/SBC input selection without changing financial formulas',()=>{
 it('reproduces ANNA, proves SBC reaches presentation, and recovers the missing Value component with FY2025',()=>{
  const original=structuredClone(anna),selection=valuationCashFlow(anna);
  expect(selection.basis).toMatchObject({basis:'FY',periodStart:'2025-01-01',periodEnd:'2025-12-31',fcf:3150841,sbc:774220});
  expect(statementRows(anna,[['SBC','sbc']],true)).toContainEqual(expect.objectContaining({point:expect.objectContaining({year:'2025',val:774220})}));
  const withoutPair={...anna,sbcHistory:[]},before=analyzeStock(withoutPair),after=analyzeStock(anna),easy=computeEasyMode(anna,true);
  const oldScores=computeCompanyScores(withoutPair,easy,before),scores=computeCompanyScores(anna,easy,after);
  expect(oldScores.find(x=>x.id==='value').coverage).toBe(.6);
  expect(after.valuation.multiples.pfcf).toBeCloseTo(anna.marketCap/(3150841-774220),2);
  expect(scores.find(x=>x.id==='value').coverage).toBe(1);expect(MIN_SCORE_COVERAGE).toBe(.7);
  expect(scores.find(x=>x.id==='growth')).toEqual(oldScores.find(x=>x.id==='growth'));
  // Quality now independently uses same-period historical SBC, too. Its other
  // components and its coverage must remain unchanged when SBC is added.
  expect(scores.find(x=>x.id==='quality').coverage).toBe(oldScores.find(x=>x.id==='quality').coverage);
  for(const id of ['returns','operatingMargin','balance'])expect(after.quality.components[id]).toEqual(before.quality.components[id]);
  expect(after.scenarios).toEqual(before.scenarios);
  expect(computeDCFValue(anna,.1)).toEqual(computeDCFValue(withoutPair,.1));
  expect(anna).toEqual(original);expect(anna.fcfVal).toBe(1182806);expect(anna.sbcVal).toBe(1398702);
 });
 it.each([['AAPL',apple],['LLOY.L',lloyds],['ALC.MC',altia]])('preserves existing usable valuation inputs for %s',(_,sample)=>{
  expect(valuationCashFlow(sample).data).toBe(sample);
 });
 it('does not use half-year inputs as annual cash flows when an annual pair is missing',()=>{
  expect(valuationCashFlow({...data,sbcHistory:[]}).data.fcfVal).toBeNull();
 });
 it('never switches to an older profitable pair to avoid a negative latest annual result',()=>{
  const d={...data,fcfHistory:[...data.fcfHistory,{...p('2026'),val:10}],sbcHistory:[...data.sbcHistory,{...p('2026'),val:20}]};
  expect(valuationCashFlow(d).basis).toMatchObject({periodEnd:'2026-12-31',fcf:10,sbc:20});
 });
 it.each([{currency:'EUR'},{scope:'standalone'},{periodStart:'2024-01-01',periodEnd:'2024-12-31'},{basis:'TTM'}])('does not pair incompatible facts (%j)',change=>{
  expect(valuationCashFlow({...data,sbcHistory:[{...p('2025'),val:20,...change}]}).data.fcfVal).toBeNull();
 });
 it('does not choose one of conflicting same-period facts by array order',()=>{
  const d={...data,sbcHistory:[...data.sbcHistory,{...p('2025'),val:30}]};
  expect(valuationCashFlow(d).basis.status).toBe('unavailable');
 });
 it('preserves a comparable annual current pair even when its adjusted cash flow is negative',()=>{
  const d={...data,financialPeriods:{fcfVal:p('2026'),sbcVal:p('2026')}};
  expect(valuationCashFlow(d).data).toBe(d);
 });
});
