import {describe,it,expect} from 'vitest';
import {qualityCashFlowInputs} from './qualityCashFlowInputs';
import {analyzeStock} from './engine';
import {computeCompanyScores} from './companyScoreCalibration';
import {computeEasyMode} from './financialCalculations';
import {scoreCoverageDetails} from './scoreCoverageDetails';
import anna from './__fixtures__/ANNA-manual-FY2025.json';
import apple from './__fixtures__/integrity-baseline/AAPL.json';
import lloyds from './__fixtures__/integrity-baseline/LLOY.L.json';
import altia from './__fixtures__/integrity-baseline/ALC.MC.json';
const period=y=>({basis:'FY',periodStart:`${y}-01-01`,periodEnd:`${y}-12-31`,currency:'USD',scope:'consolidated',unit:'USD'});
const trusted={...anna,manualCalculation:{fields:['fcfVal','sbcVal'],warnings:[]}};
describe('independent comparable complete cash-flow windows for Quality',()=>{
 it('selects ANNA FY2025 revenue, FCF and SBC, and reports missing FY2025 net income without mutating H1/TTM',()=>{
  const original=structuredClone(trusted),q=analyzeStock(trusted).quality,s=q.cashFlowInputs;
  expect(s.fcfGeneration).toMatchObject({status:'matched',period:period('2025'),inputs:{fcfVal:3150841,revVal:25035737,sbcVal:774220}});
  expect(q.components.fcfGeneration.detail).toContain('12,6%');expect(q.components.fcfGeneration.detail).toContain('9,5%');
  expect(q.components.cashConversion).toBeUndefined();
  expect(s.cashConversion).toMatchObject({status:'unavailable',missing:['niVal']});expect(s.cashConversion.reason).toContain('2025-01-01–2025-12-31');
  const engine=analyzeStock(trusted),score=computeCompanyScores(trusted,computeEasyMode(trusted,true),engine).find(s=>s.id==='quality');
  const details=scoreCoverageDetails(score,trusted,engine);
  expect(details.find(c=>c.id==='fcfGeneration').periodUsed).toContain('01/01/2025–31/12/2025');
  expect(details.find(c=>c.id==='cashConversion').action).toContain('beneficio neto');
  expect(trusted).toEqual(original);
 });
 it('recovers conversion only when matching net income is supplied',()=>{
  const d={...trusted,niHistory:[...trusted.niHistory,{...period('2025'),year:'2025',val:2000000}]};
  const q=analyzeStock(d).quality;
  expect(q.cashFlowInputs.cashConversion.inputs.niVal).toBe(2000000);expect(q.components.cashConversion.detail).toContain('158%');
 });
 it('allows the two ratios to use different complete periods, never different periods within a ratio',()=>{
  const d={...trusted,niHistory:[{...period('2024'),year:'2024',val:100}]};
  const s=qualityCashFlowInputs(d);
  expect(s.fcfGeneration.period.periodEnd).toBe('2025-12-31');expect(s.cashConversion.period.periodEnd).toBe('2024-12-31');
  expect(s.cashConversion.inputs.fcfVal).toBe(-39963844);expect(s.cashConversion.inputs.sbcVal).toBeNull();
 });
 it.each([{currency:'EUR'},{scope:'standalone'},{periodStart:'2021-01-01',periodEnd:'2021-12-31'},{basis:'TTM'}])('does not combine mismatched net income (%j), including manual data',change=>{
  expect(qualityCashFlowInputs({...trusted,niHistory:[{...period('2025'),year:'2025',val:100,...change}]}).cashConversion.status).toBe('unavailable');
 });
 it('does not use a mismatched SBC or silently substitute zero',()=>{
  const s=qualityCashFlowInputs({...trusted,sbcHistory:[]}).fcfGeneration;
  expect(s.inputs.sbcVal).toBeNull();expect(s.warnings.join(' ')).toContain('sin el ajuste');
 });
 it('rejects contradictory same-period values rather than choosing an older profitable period',()=>{
  const d={...trusted,fcfHistory:[...trusted.fcfHistory,{...period('2025'),year:'2025',val:999}]};
  expect(qualityCashFlowInputs(d).fcfGeneration.reasonCode).toBe('ambiguous');
 });
 it('keeps a latest negative income window rather than selecting older positive earnings',()=>{
  const d={...trusted,niHistory:[{...period('2024'),year:'2024',val:100},{...period('2025'),year:'2025',val:-100}]};
  const q=analyzeStock(d).quality;
  expect(q.cashFlowInputs.cashConversion.inputs.niVal).toBe(-100);expect(q.components.cashConversion).toBeUndefined();
 });
 it('does not turn matching H1 inputs into a complete year',()=>{
  const p={...period('2026'),basis:'H1',periodEnd:'2026-06-30'};
  const s=qualityCashFlowInputs({fcfVal:10,revVal:100,niVal:20,financialPeriods:{fcfVal:p,revVal:p,niVal:p},manualCalculation:{fields:['fcfVal']}});
  expect(s.fcfGeneration.status).toBe('unavailable');expect(s.cashConversion.status).toBe('unavailable');
 });
 it.each([['AAPL',apple],['LLOY.L',lloyds],['ALC.MC',altia]])('never changes principal statements for %s',(_,d)=>{
  const original=structuredClone(d);qualityCashFlowInputs(d);analyzeStock(d);expect(d).toEqual(original);
 });
});
