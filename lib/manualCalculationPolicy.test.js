import {describe,it,expect} from 'vitest';
import {applyFinancialOverrides,cleanOverrideMetadata} from './financialOverrides';
import {analysisData} from './financialDataPolicy';
import {normalizeInput} from './engine/input';
import {manualValidation} from './manualCalculationPolicy';
import {computeQuality} from './engine/quality';
import sample from './__fixtures__/integrity-baseline/ALC.MC.json';
const meta={basis:'H1',periodStart:'2026-01-01',periodEnd:'2026-06-30',currency:'USD',scope:'consolidated'};
const row=(target,value,m=meta)=>({id:1,target,value,active:true,metadata:cleanOverrideMetadata(m,target)});
const apply=(d,rows)=>applyFinancialOverrides(d,rows,{manualAuthority:true});
describe('authenticated administrator calculation inputs',()=>{
 it.each(['grossMargin','netMargin','opMargin'])('uses a manual %s despite conflicting automatic components and preserves its H1 dates',field=>{
  const d=apply({revVal:100,niVal:20,oiVal:20,gpVal:20,financialPeriods:{revVal:{...meta,basis:'TTM',periodStart:'2025-07-01'}}},[row(field,37.19)]);
  expect(d[field]).toBe(37.19);expect(analysisData(d,'quality')[field]).toBe(37.19);
  expect(normalizeInput(analysisData(d,'quality'))[field]).toBeCloseTo(.3719);
  expect(d.financialPeriods[field]).toMatchObject(meta);
  expect(d.manualCorrections[0]).toMatchObject({manualCalculation:true,modelExcluded:false});
  expect(d.manualCalculation.message).toContain('no constituyen una verificación');
 });
 it.each(['roe','roa'])('uses the latest independent semestral %s without annualizing it',field=>{
  const d=apply({ticker:'TEST'},[{...row(`period:${field}:H1:2026-06-30`,5),ticker:'TEST'}]);
  expect(d[field]).toBe(5);expect(normalizeInput(d)[field]).toBe(.05);
  expect(d.financialPeriods[field]).toMatchObject(meta);
  expect(d.manualCorrections[0]).toMatchObject({appliedToCurrent:true});
 });
 it('preserves zero and an explicit empty correction',()=>{
  expect(apply({roic:10},[row('roic',0)]).roic).toBe(0);
  expect(apply({roic:10},[row('roic',null)]).roic).toBeNull();
 });
 it('uses supplied FCF without inventing CAPEX and does not derive FCF from OCF alone',()=>{
  const direct=apply({},[row('fcfVal',123)]);
  expect(analysisData(direct,'dcf').fcfVal).toBe(123);expect(direct.capexVal).toBeUndefined();
  const missing=apply({},[row('operatingCFVal',123)]);
  expect(missing.fcfVal).toBeNull();expect(missing.capexVal).toBeUndefined();
 });
 it('retains a reported manual ROIC despite negative EBIT, with a warning',()=>{
  const d=apply(sample,[row('roic',15,{})]);d.oiVal=-1;
  const q=computeQuality(normalizeInput(d),{kind:'recovery'});
  expect(q.components.returns.score).not.toBeNull();expect(q.notes.join(' ')).toContain('ROIC manual');
 });
 it('demotes only errors on manual inputs, never unrelated provider errors',()=>{
  const validation={hasErrors:true,issues:[{field:'grossMargin',severity:'error',code:'M',message:'Discrepancia'},{field:'shares',severity:'error',code:'S',message:'Acciones inválidas'}]};
  const checked=manualValidation(validation,{manualCalculation:{fields:['grossMargin']}});
  expect(checked.issues[0].severity).toBe('warning');expect(checked.hasErrors).toBe(true);expect(checked.errorCodes).toEqual(['S']);
 });
 it('leaves original objects and calculations unchanged without active manual inputs',()=>{
  expect(apply(sample,[])).toBe(sample);
  expect(manualValidation({hasErrors:true,issues:[]},sample)).toEqual({hasErrors:true,issues:[]});
 });
});
