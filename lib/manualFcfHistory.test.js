import {describe,it,expect} from 'vitest';
import {applyFinancialOverrides,cleanOverrideMetadata,validateFinancialOverride} from './financialOverrides';
import {statementRows,growthPoints} from './analysisPresentation';
const period=y=>({basis:'FY',periodStart:`${y}-01-01`,periodEnd:`${y}-12-31`,currency:'USD',scope:'consolidated',source:'Official report',unit:'USD'});
const row=(year,value,inputs,metadata={})=>({id:Number(year),ticker:'TEST',target:`history:fcfHistory:${year}`,value,active:true,metadata:cleanOverrideMetadata({...period(year),...metadata,fcfInputs:inputs},`history:fcfHistory:${year}`)});
describe('adding complete annual FCF histories without replacing the financial formulas',()=>{
 it('adds several independently evidenced annual values and makes them available to the existing history consumer',()=>{
  const rows=[row('2024',15,{operatingCF:20,capex:5}),row('2025',30,{operatingCF:40,capex:-10})];
  const d=applyFinancialOverrides({ticker:'TEST',currency:'USD'},rows);
  expect(d.fcfHistory.map(p=>[p.year,p.val])).toEqual([['2024',15],['2025',30]]);
  expect(growthPoints(d,'fcfHistory').map(p=>p.val)).toEqual([15,30]);
  expect(d.manualCorrections.every(r=>!r.modelExcluded)).toBe(true);
  expect(d.fcfHistory[0].cashFlowInputs).toMatchObject({operatingCF:{val:20},capex:{val:5}});
 });
 it('uses existing exact-period OCF/CAPEX when no manual components were provided',()=>{
  const p=period('2025'),base={ticker:'TEST',currency:'USD',operatingCFHistory:[{...p,year:'2025',val:20}],capexHistory:[{...p,year:'2025',val:5}]};
  const d=applyFinancialOverrides(base,[row('2025',15)]);
  expect(d.fcfHistory[0].val).toBe(15);expect(d.manualCorrections[0].modelExcluded).toBe(false);
  const optionalScope=applyFinancialOverrides(base,[row('2025',15,undefined,{scope:'provider-unspecified'})]);
  expect(optionalScope.fcfHistory[0]).toMatchObject({val:15,scope:'consolidated',comparisonScopeSource:'matching-OCF-CAPEX'});
 });
 it.each([
  row('2025',20,{operatingCF:20}),
  row('2025',99,{operatingCF:20,capex:5}),
  row('2025',15,{operatingCF:20,capex:5},{basis:'H1',periodEnd:'2025-06-30'}),
  row('2025',15,{operatingCF:20,capex:5},{currency:'EUR'}),
  row('2025',15,{operatingCF:20,capex:5},{periodEnd:'2024-12-31'}),
 ])('stores an unfit point but keeps it out of model histories (%#)',r=>{
  expect(validateFinancialOverride({...r,expectedId:0})).toBeNull();
  const d=applyFinancialOverrides({ticker:'TEST',currency:'USD'},[r]);
  expect(d.fcfHistory).toEqual([]);expect(d.manualCorrections[0]).toMatchObject({value:r.value,modelExcluded:true});
  expect(statementRows(d,[['FCF','fcf']],true)[0]).toMatchObject({editTarget:r.target,status:'Manual · excluido de cálculos',point:{val:r.value}});
 });
 it('does not resurrect an automatic annual FCF when the manual correction for that year is incompatible',()=>{
  const p=period('2025'),base={ticker:'TEST',currency:'USD',operatingCFHistory:[{...p,year:'2025',val:20}],capexHistory:[{...p,year:'2025',val:5}]};
  expect(applyFinancialOverrides(base,[row('2025',90)]).fcfHistory).toEqual([]);
  expect(applyFinancialOverrides(base,[]).operatingCFHistory[0].val).toBe(20);
 });
 it('prioritizes an explicit OCF history correction over a conflicting embedded FCF component, independent of row order',()=>{
  const f=row('2025',15,{operatingCF:20,capex:5}),o={...row('2025',10),target:'history:operatingCFHistory:2025'};
  for(const rows of [[f,o],[o,f]])expect(applyFinancialOverrides({ticker:'TEST',currency:'USD'},rows).manualCorrections.find(r=>r.target===f.target).modelExcluded).toBe(true);
 });
 it('persists across provider refreshes and restoring the provider removes only the selected manual year',()=>{
  const a=row('2024',15,{operatingCF:20,capex:5}),b=row('2025',30,{operatingCF:40,capex:10});
  const base={ticker:'TEST',currency:'USD'};
  expect(applyFinancialOverrides({...base,fcfHistory:[{...period('2025'),year:'2025',val:9}]},[a,b]).fcfHistory.map(p=>p.val)).toEqual([15,30]);
  const d=applyFinancialOverrides(base,[{...a,active:false},b]);expect(d.fcfHistory.map(p=>p.year)).toEqual(['2025']);
 });
 it('accepts explicit zero CAPEX, but never replaces missing CAPEX with zero',()=>{
  expect(applyFinancialOverrides({ticker:'TEST',currency:'USD'},[row('2025',20,{operatingCF:20,capex:0})]).fcfHistory[0].val).toBe(20);
 });
 it('does not mix consolidated and standalone annual series',()=>{
  const d=applyFinancialOverrides({ticker:'TEST',currency:'USD'},[row('2024',15,{operatingCF:20,capex:5}),row('2025',15,{operatingCF:20,capex:5},{scope:'standalone'})]);
  expect(d.fcfHistory).toEqual([]);expect(d.manualCorrections.every(r=>r.modelExcluded)).toBe(true);
 });
 it('updates current FCF and its multiple only when the corrected historical point has exactly the same fiscal window',()=>{
  const p=period('2025'),base={ticker:'TEST',currency:'USD',fcfVal:10,marketCap:150,financialPeriods:{fcfVal:p}};
  const d=applyFinancialOverrides(base,[row('2025',15,{operatingCF:20,capex:5})]);
  expect(d.fcfVal).toBe(15);expect(d.pfcf).toBe(10);
  const older=applyFinancialOverrides(base,[row('2024',15,{operatingCF:20,capex:5})]);
  expect(older.financialPeriods.fcfVal.periodEnd).toBe('2025-12-31');
 });
});
