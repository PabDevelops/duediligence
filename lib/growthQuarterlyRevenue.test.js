import {describe,it,expect} from 'vitest';
import {growthQuarterlyRevenue} from './growthQuarterlyRevenue';
import {computeCompanyScores,GROWTH_WEIGHTS} from './companyScoreCalibration';
import {computeEasyMode,computeDCFValue} from './financialCalculations';
import {analyzeStock} from './engine';
import {scoreCoverageDetails} from './scoreCoverageDetails';
import {applyFinancialOverrides,cleanOverrideMetadata} from './financialOverrides';
import te from './__fixtures__/TE-quarterly.json';
import apple from './__fixtures__/integrity-baseline/AAPL.json';
import lloyds from './__fixtures__/integrity-baseline/LLOY.L.json';
import {CALIBRATION_COMPANIES} from './__fixtures__/scoreCalibration';

const points=te.quarterlyHistories.revHistory;
const withPoints=ps=>({...te,quarterlyHistories:{...te.quarterlyHistories,revHistory:ps}});
const scores=d=>computeCompanyScores(d,computeEasyMode(d,true),analyzeStock(d));
const change=(i,patch)=>points.map((p,j)=>j===i?{...p,...patch}:p);
const base={...te,quarterlyHistories:undefined};

describe('Growth quarterly revenue evidence, TE public snapshot 2026-11-06',()=>{
 it('calculates two YoY rates with six quarters, never sequential growth or annualized amounts',()=>{
  const result=growthQuarterlyRevenue(te);
  expect(result.comparisons.map(c=>c.growth)).toEqual([177647000/53452000-1,250128000/132767000-1]);
  expect(result.acceleration).toBeCloseTo(-143.95243634,6);
  expect(result.records.filter(r=>r.used).map(r=>r.label)).toEqual(['Q1 2025','Q2 2025','Q1 2026','Q2 2026']);
  expect(result.records.filter(r=>!r.used).map(r=>r.label)).toEqual(['Q3 2025','Q4 2025']);
  expect(result.periodUsed).toContain('Q2 2026 frente a Q2 2025');
 });
 it('recovers precisely the 15% acceleration component, preserving the annual median and other dimensions',()=>{
  const before=scores(base),after=scores(te);
  expect(before[0].coverage).toBeCloseTo(.6);expect(after[0].coverage).toBeCloseTo(.75);
  expect(after[0].components.find(c=>c.id==='historicalRevenue').score).toBeNull();
  expect(after[0].components.find(c=>c.id==='acceleration').score).toBe(20);
  expect(after[0].components.filter(c=>c.id!=='acceleration')).toEqual(before[0].components.filter(c=>c.id!=='acceleration'));
  expect(after.slice(1)).toEqual(before.slice(1));
  expect(GROWTH_WEIGHTS).toEqual({currentRevenue:.45,historicalRevenue:.25,acceleration:.15,cashEvolution:.15});
  expect(after[0].indicative).toBeNull();expect(after[0].tier).toBe('A');expect(after[0].score100).toBe(81);
 });
 it('does not feed quarterly revenues into general momentum, DCF, projections or FY/TTM',()=>{
  const original=structuredClone(te);
  expect(analyzeStock(te)).toEqual(analyzeStock(base));
  expect(computeDCFValue(te,.1)).toEqual(computeDCFValue(base,.1));
  expect(computeEasyMode(te,true)).toEqual(computeEasyMode(base,true));
  scores(te);growthQuarterlyRevenue(te);expect(te).toEqual(original);
 });
 it('traces storage targets through overlay to scoring, without overwriting annual records',()=>{
  const rows=points.map((p,i)=>{const target=`history:revHistory:${p.fiscalYear}:${p.fiscalQuarter}`;return {id:i+1,ticker:'TE',target,value:p.val,active:true,metadata:cleanOverrideMetadata(p,target)};});
  const d=applyFinancialOverrides(base,rows,{manualAuthority:true});
  expect(d.revHistory).toEqual(base.revHistory);expect(d.revVal).toEqual(base.revVal);
  expect(d.financialPeriods).toEqual(base.financialPeriods);
  expect(growthQuarterlyRevenue(d).acceleration).toEqual(growthQuarterlyRevenue(te).acceleration);
  expect(scores(d)[0].coverage).toBeCloseTo(.75);
 });
 it('explains every available quarter, the exact comparisons, manual status and annual-only median',()=>{
  const details=scoreCoverageDetails(scores(te)[0],te,analyzeStock(te));
  const accel=details.find(c=>c.id==='acceleration'),median=details.find(c=>c.id==='historicalRevenue');
  expect(accel.status).toBe('Calculado · entrada manual');
  expect(accel.periodUsed).toContain('Q1 2026 frente a Q1 2025');
  expect(accel.inputs.filter(i=>i.field.startsWith('quarterly-'))).toHaveLength(6);
  expect(accel.inputs.find(i=>i.label.includes('Q3 2025')).period).toContain('no interviene');
  expect(median.reason).toContain('2024, 2025');
  expect(median.inputs.find(i=>i.label.includes('Q1 2025')).period).toContain('la mediana exige ejercicios FY positivos');
 });
 it('keeps missing comparisons unavailable and names missing fiscal references',()=>{
  const d=withPoints(points.filter(p=>!(p.fiscalYear==='2025'&&p.fiscalQuarter==='Q2')));
  expect(growthQuarterlyRevenue(d)).toMatchObject({acceleration:null,missing:['Q2 2025']});
  expect(scores(d)[0].coverage).toBeCloseTo(.6);
  expect(scoreCoverageDetails(scores(d)[0],d)[2].reason).toContain('Falta Q2 2025');
 });
 it('rejects the actual earlier metadata mistakes without correcting or deleting user records',()=>{
  const ps=change(1,{periodEnd:'2028-06-30'}).map((p,i)=>i===5?{...p,scope:'provider-unspecified'}:p);
  const d=withPoints(ps),r=growthQuarterlyRevenue(d);
  expect(r.acceleration).toBeNull();expect(r.reason).toContain('Q2 2025: Fechas inválidas');expect(r.reason).toContain('Q2 2026: Perímetro sin especificar');
  expect(scores(d)[0].coverage).toBeCloseTo(.6);expect(d.quarterlyHistories.revHistory).toEqual(ps);
 });
 it.each([
  [1,{currency:'EUR',unit:'EUR'},'Monedas distintas'],
  [1,{scope:'standalone'},'Perímetros distintos'],
  [5,{scope:'provider-unspecified'},'Perímetro sin especificar'],
  [1,{unit:'USD millions'},'Unidades'],
  [1,{unit:null},'Unidades'],
  [1,{periodStart:'2025-01-01'},'Fechas inválidas'],
  [1,{periodEnd:'2025-02-30'},'Fechas inválidas'],
  [1,{periodStart:'2024-04-01',periodEnd:'2024-06-30'},'ejercicio anterior'],
  [1,{val:0},'positivos'],
  [1,{val:-1},'positivos'],
  [1,{val:null},'numéricos'],
 ])('excludes incompatible comparison %j %j without increasing coverage', (i,patch,reason)=>{
  const d=withPoints(change(i,patch));expect(growthQuarterlyRevenue(d).acceleration).toBeNull();
  expect(growthQuarterlyRevenue(d).reason).toContain(reason);expect(scores(d)[0].coverage).toBeCloseTo(.6);
 });
 it('rejects duplicate fiscal identities and duplicate dates rather than depending on array order',()=>{
  for(const ps of [[...points,points[1]],[...points,{...points[1],fiscalYear:'2024'}]]){
   expect(growthQuarterlyRevenue(withPoints(ps)).acceleration).toBeNull();
  }
  expect(growthQuarterlyRevenue(withPoints([...points].reverse())).acceleration).toEqual(growthQuarterlyRevenue(te).acceleration);
 });
 it('does not require unrelated Q3/Q4 amounts to compute Q1/Q2 YoY, but rejects nonadjacent dates',()=>{
  expect(growthQuarterlyRevenue(withPoints(points.filter(p=>!['Q3','Q4'].includes(p.fiscalQuarter)))).acceleration).toEqual(growthQuarterlyRevenue(te).acceleration);
  const r=growthQuarterlyRevenue(withPoints(change(5,{periodStart:'2026-04-02'})));
  expect(r.acceleration).toBeNull();expect(r.reason).toContain('consecutivos por fechas');
 });
 it('keeps one YoY observation and a newer incomplete pair unavailable',()=>{
  expect(growthQuarterlyRevenue(withPoints(points.slice(0,5))).acceleration).toBeNull();
  const next={...points[2],fiscalYear:'2026',periodStart:'2026-07-01',periodEnd:'2026-09-30'};
  expect(growthQuarterlyRevenue(withPoints([...points,next].filter(p=>!(p.fiscalYear==='2025'&&p.fiscalQuarter==='Q3')))).missing).toContain('Q3 2025');
 });
 it('does not replace a more recent annual signal with an old quarterly series',()=>{
  const d={...te,revHistory:[...te.revHistory,{...te.revHistory.at(-1),year:'2026',periodStart:'2026-01-01',periodEnd:'2026-12-31'}]};
  expect(growthQuarterlyRevenue(d).acceleration).toBeNull();
  expect(growthQuarterlyRevenue(d).reason).toContain('anterior al último ejercicio FY');
 });
 it('never uses a zero-revenue FY2023 to complete the annual median',()=>{
  const d={...te,revHistory:[{...te.revHistory[0],year:'2023',periodStart:'2023-01-01',periodEnd:'2023-12-31',val:0},...te.revHistory]};
  expect(computeEasyMode(d,true).growthCagrPct).toBeNull();
  expect(scores(d)[0].components.find(c=>c.id==='historicalRevenue').score).toBeNull();
 });
 it.each([apple,CALIBRATION_COMPANIES['ALC.MC'],lloyds])('preserves annual scores when no valid quarterly evidence exists ($ticker)',d=>{
  expect(scores({...d,quarterlyHistories:{revHistory:[{...points[0],basis:'FY'}]}})).toEqual(scores(d));
 });
 it('handles absent or malformed quarterly collections safely',()=>{
  for(const d of [null,{}, {quarterlyHistories:{revHistory:{}}},{quarterlyHistories:{revHistory:[null]}}])expect(growthQuarterlyRevenue(d).acceleration).toBeNull();
 });
});
