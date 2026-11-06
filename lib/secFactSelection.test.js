import {describe,it,expect} from 'vitest';
import {selectStatementFacts,selectFlowSeries,ANNUAL_FORMS} from './secFactSelection';
import flyw from './__fixtures__/flyw-companyfacts-selection.json';
const gaap=flyw.facts['us-gaap'];
describe('SEC statement concept selection',()=>{
 it('rejects future balances filed before their alleged reporting date',()=>{
  expect(selectStatementFacts([{end:'2026-12-31',filed:'2026-05-13',form:'10-Q',val:1}])).toEqual([]);
 });
 it('retains exact annual FLYW earnings despite a newer rounded proxy disclosure',()=>{
  const p=selectStatementFacts(gaap.NetIncomeLoss.units.USD,ANNUAL_FORMS).find(x=>x.start==='2025-01-01'&&x.end==='2025-12-31');
  expect(p.val).toBe(13497000);expect(p.form).toBe('10-K');
 });
 it('selects a complete revenue concept rather than a quarterly-only preferred tag',()=>{
  const p=selectFlowSeries(gaap,['RevenueFromContractWithCustomerExcludingAssessedTax','Revenues'],'2025-12-31');
  expect(new Set(p.map(x=>x.tag))).toEqual(new Set(['Revenues']));
  expect(p.some(x=>x.start==='2025-01-01'&&x.end==='2025-12-31')).toBe(true);
 });
 it('applies annual eligibility before choosing the latest filing',()=>{
  const base={start:'2025-01-01',end:'2025-12-31',unit:'USD',currency:'USD'};
  const p=selectStatementFacts([{...base,form:'10-K',filed:'2026-02-01',val:1},{...base,form:'10-Q',filed:'2026-03-01',val:2}],ANNUAL_FORMS);
  expect(p[0].val).toBe(1);
 });
 it('preserves amendments and rejects same-date conflicting statement values',()=>{
  const p={start:'2025-01-01',end:'2025-12-31',unit:'USD',currency:'USD',form:'10-K',filed:'2026-02-01',val:1};
  expect(selectStatementFacts([p,{...p,form:'10-K/A',filed:'2026-03-01',val:2}])[0].val).toBe(2);
  expect(selectStatementFacts([p,{...p,val:2}])).toEqual([]);
 });
 it('never invents an annual anchor or joins different concepts',()=>{
  const point={start:'2026-01-01',end:'2026-03-31',form:'10-Q',filed:'2026-05-01',val:10};
  const p=selectFlowSeries({A:{units:{USD:[point]}}},['A'],'2025-12-31');
  expect(p).toHaveLength(1);expect(p[0].start).toBe('2026-01-01');
  expect(selectFlowSeries({},['A'],'2025-12-31')).toBeNull();
 });
 it('does not replace operating income with a newer pretax concept',()=>{
  const point={start:'2024-01-01',end:'2024-12-31',form:'10-K',filed:'2025-02-01',val:10};
  const p=selectFlowSeries({OperatingIncomeLoss:{units:{USD:[point]}},Pretax:{units:{USD:[{...point,start:'2025-01-01',end:'2025-12-31'}]}}},['OperatingIncomeLoss','Pretax'],'2025-12-31');
  expect(p[0].tag).toBe('OperatingIncomeLoss');
 });

});
