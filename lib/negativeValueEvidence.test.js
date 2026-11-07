import {it,expect,vi,afterEach} from 'vitest';
import * as evidence from './negativeValueEvidence';
import {computeCompanyScores} from './companyScoreCalibration';
import {getCompanyHeaderScores} from './companyHeaderScores';
import {computeEasyMode,computeDCFValue} from './financialCalculations';
import {analyzeStock} from './engine';
import {scoreCoverageDetails} from './scoreCoverageDetails';
import {valuationCashFlow} from './valuationCashFlow';
import {msftLike} from './engine/__fixtures__/companies';
import te from './__fixtures__/TE-value-periods.json';
import apple from './__fixtures__/integrity-baseline/AAPL.json';
import altia from './__fixtures__/integrity-baseline/ALC.MC.json';
import lloyds from './__fixtures__/integrity-baseline/LLOY.L.json';

const p={basis:'FY',periodStart:'2025-01-01',periodEnd:'2025-12-31',currency:'USD',unit:'USD',scope:'consolidated',source:'Synthetic regression fixture'};
const balance={...p,basis:'instant',periodStart:null};
const data=patch=>({...msftLike,asOf:'2026-11-07',financialPeriods:{revVal:{...p},niVal:{...p},fcfVal:{...p},sbcVal:{...p},oiVal:{...p},debtVal:{...balance},cashVal:{...balance}},...patch});
const score=d=>computeCompanyScores(d,computeEasyMode(d,true),analyzeStock(d));
const allNegative=()=>data({fcfVal:-10e9,sbcVal:1e9,niVal:-5e9,oiVal:-3e9});
afterEach(()=>vi.restoreAllMocks());

it('TE live snapshot: evaluates only EBIT, keeping H1 earnings and undated SBC unavailable',()=>{
 const value=score(te)[1],parts=Object.fromEntries(value.components.map(c=>[c.id,c]));
 expect(value.coverage).toBeCloseTo(.3);expect(value.score100).toBeNull();expect(value.tier).toBeNull();
 expect(parts.evEbit).toMatchObject({score:0,detail:null,evaluation:{state:'negative-results',denominator:-222894000}});
 expect(parts.pe.score).toBeNull();expect(parts.pe.evaluation.reason).toContain('H1');
 expect(parts.pfcf.score).toBeNull();expect(parts.pfcf.evaluation.reason).toContain('SBC');
 const details=scoreCoverageDetails(value,te,analyzeStock(te));
 expect(details.find(c=>c.id==='evEbit').status).toContain('Evaluado · resultado negativo');
 expect(details.find(c=>c.id==='pe').reason).toContain('no se anualiza');
 expect(details.find(c=>c.id==='pfcf').reason).toContain('periodo fiscal');
});
it('three documented negative denominators give VALUE F/100% without inventing multiples',()=>{
 const d=allNegative(),before=structuredClone(d),analysis=analyzeStock(d),value=score(d)[1];
 expect(value).toMatchObject({score100:0,tier:'F',coverage:1,interpretationLabel:'Sin rentabilidad actual'});
 expect(value.components.map(c=>c.score)).toEqual([0,0,0]);
 expect(value.components.map(c=>c.detail)).toEqual([null,null,null]);
 for(const id of ['pe','pfcf','evEbit'])expect(analysis.valuation.multiples[id]??null).toBeNull();
 expect(value.description).toContain('La empresa todavía no genera beneficios ni flujo de caja suficientes');
 expect(value.description).toContain('no demuestra por sí solo');
 expect(d).toEqual(before);
});
it('the hypothetical fully documented TE case reaches F/100%, without editing the live snapshot',()=>{
 const before=structuredClone(te),ttm=te.financialPeriods.oiVal;
 const d={...te,financialPeriods:{...te.financialPeriods,niVal:{...ttm,manual:true},sbcVal:{...ttm,unit:'USD'}}};
 expect(score(d)[1]).toMatchObject({score100:0,tier:'F',coverage:1});
 expect(te).toEqual(before);
});
it('two negatives and one positive preserve the existing positive multiple score and weights',()=>{
 const d=data({fcfVal:-10e9,sbcVal:1e9,niVal:-5e9}),analysis=analyzeStock(d),value=score(d)[1];
 const positive=analysis.valuation.methods.find(m=>m.id==='evEbit');
 expect(positive).toBeTruthy();expect(value.coverage).toBe(1);
 expect(value.components.map(c=>c.score)).toEqual([0,0,positive.score]);
 expect(value.score100).toBe(Math.round(.3*positive.score));
 expect(value.interpretationLabel).toBe('Incluye resultados negativos');
 expect(value.description).not.toContain('La empresa todavía no genera beneficios ni flujo de caja suficientes');
});
it('negative plus absent results never become full coverage or a normal grade',()=>{
 const d=allNegative();d.niVal=null;d.sbcVal=null;
 const value=score(d)[1];expect(value.coverage).toBe(.3);expect(value.tier).toBeNull();expect(value.indicative).toBeNull();
 const two=allNegative();two.niVal=null;
 expect(score(two)[1]).toMatchObject({coverage:.7,tier:'F',score100:0});
});
it.each([
 ['capitalization',d=>{d.marketCap=null;}],
 ['zero capitalization',d=>{d.marketCap=0;}],
 ['currency',d=>{d.currency=null;}],
 ['missing period',d=>{d.financialPeriods.niVal=null;}],
 ['partial period',d=>{d.financialPeriods.niVal={...p,basis:'H1',periodStart:'2025-07-01'};}],
 ['foreign currency',d=>{d.financialPeriods.niVal={...p,currency:'EUR',unit:'EUR'};}],
 ['unknown scope',d=>{d.financialPeriods.niVal={...p,scope:'provider-unspecified'};}],
 ['missing source',d=>{d.financialPeriods.niVal={...p,source:null};}],
 ['wrong units',d=>{d.financialPeriods.niVal={...p,unit:'USD millions'};}],
 ['invalid FX',d=>{d.financialPeriods.niVal={...p,originalCurrency:'EUR',fxRate:null};}],
 ['invalid dates',d=>{d.financialPeriods.niVal={...p,periodEnd:'2025-02-30'};}],
 ['stale fact',d=>{d.financialPeriods.niVal={...p,periodStart:'2021-01-01',periodEnd:'2021-12-31'};}],
 ['future fact',d=>{d.financialPeriods.niVal={...p,periodStart:'2027-01-01',periodEnd:'2027-12-31'};}],
 ['blocked fact',d=>{d.financialIntegrity={fields:{niVal:{status:'blocked'}}};}],
])('does not award coverage for %s',(name,mutate)=>{
 const d=allNegative();mutate(d);
 const result=evidence.negativeValueEvidence('pe',d);
 expect(result?.state).toBe('unavailable');expect(result?.reason).toBeTruthy();
});
it('requires paired annual FCF/SBC and closing debt/cash in the same scope and currency as EBIT',()=>{
 for(const patch of [{basis:'TTM'},{periodStart:'2024-01-01',periodEnd:'2024-12-31'},{currency:'EUR',unit:'EUR'},{scope:'standalone'}]){
  const d=allNegative();d.financialPeriods.sbcVal={...p,...patch};
  expect(evidence.negativeValueEvidence('pfcf',d).state).toBe('unavailable');
 }
 for(const patch of [{periodEnd:'2024-12-31'},{currency:'EUR',unit:'EUR'},{scope:'standalone'}]){
  const d=allNegative();d.financialPeriods.cashVal={...balance,...patch};
  expect(evidence.negativeValueEvidence('evEbit',d).state).toBe('unavailable');
 }
 const d=allNegative();d.cashVal=null;expect(score(d)[1].components.find(c=>c.id==='evEbit').score).toBeNull();
});
it('respects validation errors, zero denominators, sector exclusions and cyclical normalization',()=>{
 expect(evidence.negativeValueEvidence('pe',allNegative(),{validation:{hasErrors:true}}).state).toBe('unavailable');
 expect(evidence.negativeValueEvidence('pe',data({niVal:0}))).toBeNull();
 const utility=allNegative();utility.sector='Utilities';utility.industry='Utilities - Regulated Electric';
 expect(score(utility)[1].components.map(c=>c.id)).not.toContain('pfcf');
 const d=data({oiVal:1e9,sector:'Energy',industry:'Oil & Gas'}),analysis=analyzeStock(d),value=score(d)[1];
 const normalized=analysis.valuation.methods.find(m=>m.id==='evEbit');
 expect(normalized).toBeTruthy();expect(value.components.find(c=>c.id==='evEbit')).toMatchObject({score:normalized.score,detail:normalized.value});
 expect(evidence.negativeValueEvidence('evEbit',allNegative(),{profileKind:'cyclical'}).state).toBe('unavailable');
});
it('selects an already compatible historical FCF/SBC pair without overwriting the latest statements',()=>{
 const d=allNegative();d.financialPeriods.fcfVal={...p,basis:'H1',periodStart:'2025-07-01'};d.financialPeriods.sbcVal={...d.financialPeriods.fcfVal};
 d.fcfHistory=[{...p,year:'2025',val:-20e9}];d.sbcHistory=[{...p,year:'2025',val:2e9}];
 const original=structuredClone(d),s=valuationCashFlow(d);
 expect(s.basis.status).toBe('matched');expect(evidence.negativeValueEvidence('pfcf',s.data,{cashFlowBasis:s.basis}).denominator).toBe(-22e9);
 expect(d).toEqual(original);
});
it('manual negative results stay provisional, and incompatibility cannot be overridden by manual authority',()=>{
 const d=allNegative();d.financialIntegrity={version:2,status:'verified',fields:{},calculations:{value:{status:'verified'}}};
 d.financialPeriods.niVal.manual=true;
 expect(getCompanyHeaderScores(computeEasyMode(d,true),d,analyzeStock(d))[1].status).toBe('provisional');
 d.manualCalculation={fields:['niVal']};d.financialPeriods.niVal.scope='standalone';
 expect(score(d)[1].components.find(c=>c.id==='pe').score).toBeNull();
 d.financialPeriods.sbcVal.scope='standalone';
 expect(score(d)[1].components.find(c=>c.id==='pfcf').score).toBeNull();
});
it.each([apple,altia,lloyds])('profitable existing VALUE is numerically unchanged ($ticker)',d=>{
 const enabled=score(d)[1];
 vi.spyOn(evidence,'negativeValueEvidence').mockReturnValue(null);
 expect(score(d)[1]).toEqual(enabled);
});
it('does not alter Growth, Quality, legacy valuation, DCF or scenarios on loss-making input',()=>{
 const d=allNegative(),original=structuredClone(d),after=score(d),engine=analyzeStock(d),dcf=computeDCFValue(d,.1);
 vi.spyOn(evidence,'negativeValueEvidence').mockReturnValue(null);
 const before=score(d);
 expect(after[0]).toEqual(before[0]);expect(after[2]).toEqual(before[2]);
 expect(analyzeStock(d)).toEqual(engine);expect(computeDCFValue(d,.1)).toEqual(dcf);expect(d).toEqual(original);
});
it('distinguishes expensive-multiple F from negative-result F',()=>{
 const d=data({marketCap:1e15,sharesOutstanding:1e15/420}),value=score(d)[1];
 expect(value.tier).toBe('F');expect(value.interpretationLabel).toBe('Múltiplos elevados');
 expect(value.components.every(c=>!c.evaluation)).toBe(true);
});
