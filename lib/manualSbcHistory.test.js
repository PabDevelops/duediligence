import {describe,it,expect} from 'vitest';
import {applyFinancialOverrides,cleanOverrideMetadata,validateFinancialOverride} from './financialOverrides';
import {statementRows} from './analysisPresentation';
const period=y=>({basis:'FY',periodStart:`${y}-01-01`,periodEnd:`${y}-12-31`,currency:'USD',scope:'consolidated'});
const row=(year,value,metadata=period(year))=>({ticker:'TEST',id:Number(year),active:true,target:`history:sbcHistory:${year}`,value,metadata:cleanOverrideMetadata(metadata,'sbcVal')});
describe('additional manual SBC history years',()=>{
 it('adds several annual amounts without touching FCF or inventing a current fiscal period',()=>{
  const base={ticker:'TEST',currency:'USD',sbcVal:900,fcfVal:null,financialPeriods:{sbcVal:period('2026')}};
  const d=applyFinancialOverrides(base,[row('2024',100),row('2025',200)]);
  expect(d.sbcHistory.map(p=>[p.year,p.val])).toEqual([['2024',100],['2025',200]]);
  expect(d.sbcVal).toBe(900);expect(d.fcfVal).toBeNull();
  expect(d.manualCorrections.every(r=>!r.modelExcluded)).toBe(true);
 });
 it('updates only the selected year and persists after a provider refresh',()=>{
  const p=period('2025'),base={ticker:'TEST',currency:'USD',sbcHistory:[{...period('2024'),year:'2024',val:50},{...p,year:'2025',val:60}]};
  const r=row('2025',200),d=applyFinancialOverrides(base,[r]);
  expect(d.sbcHistory.map(p=>p.val)).toEqual([50,200]);
  expect(applyFinancialOverrides({...base,sbcHistory:[{...p,year:'2025',val:70}]},[r]).sbcHistory[0].val).toBe(200);
  expect(applyFinancialOverrides(base,[{...r,active:false}])).toBe(base);
 });
 it.each([{basis:'H1',periodStart:'2025-01-01',periodEnd:'2025-06-30',currency:'USD'}, {}, {...period('2025'),currency:'EUR'}])('stores incomplete or non-comparable history without feeding an annual series (%j)',metadata=>{
  const r=row('2025',100,metadata);expect(validateFinancialOverride({...r,expectedId:0})).toBeNull();
  const d=applyFinancialOverrides({ticker:'TEST',currency:'USD'},[r]);
  expect(d.sbcHistory).toEqual([]);expect(d.manualCorrections[0]).toMatchObject({value:100,modelExcluded:true});
  expect(statementRows(d,[['SBC','sbc']],true)[0]).toMatchObject({editTarget:r.target,point:{val:100},status:'Manual · excluido de cálculos'});
 });
 it('updates current SBC only if its exact fiscal window matches',()=>{
  const d=applyFinancialOverrides({ticker:'TEST',currency:'USD',sbcVal:60,financialPeriods:{sbcVal:period('2025')}},[row('2025',200)]);
  expect(d.sbcVal).toBe(200);expect(d.financialPeriods.sbcVal.periodEnd).toBe('2025-12-31');
 });
 it('keeps raw amounts and explicit zero without converting them to percentages or missing values',()=>{
  const d=applyFinancialOverrides({ticker:'TEST',currency:'USD'},[row('2024',0),row('2025',1500000)]);
  expect(d.sbcHistory.map(p=>p.val)).toEqual([0,1500000]);expect(d.manualCorrections[1].period.unit).toBe('USD');
 });
});
