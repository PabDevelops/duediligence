import {describe,it,expect} from 'vitest';
import {EDITABLE_FINANCIAL_FIELDS,applyFinancialOverrides,cleanOverrideMetadata,validateFinancialOverride} from './financialOverrides';
import {statementRows} from './analysisPresentation';
import {analyzeStock} from './engine';
import {computeEasyMode,computeDCFValue} from './financialCalculations';
import apple from './__fixtures__/integrity-baseline/AAPL.json';
import lloyds from './__fixtures__/integrity-baseline/LLOY.L.json';
import altia from './__fixtures__/integrity-baseline/ALC.MC.json';
const p={basis:'FY',periodStart:'2025-01-01',periodEnd:'2025-12-31',currency:'USD',scope:'consolidated'};
const row=(target,value,metadata={})=>({id:1,ticker:'TEST',target,value,metadata:cleanOverrideMetadata(metadata,target),active:true});
describe('saving manual data is independent of eligibility for calculations',()=>{
 it.each(EDITABLE_FINANCIAL_FIELDS)('allows %s with only a valid number and concurrency version',target=>{
  expect(validateFinancialOverride({ticker:'TEST',target,value:-12.5,expectedId:0})).toBeNull();
  const d=applyFinancialOverrides({ticker:'TEST'},[row(target,-12.5)]);
  expect(d.manualCorrections[0]).toMatchObject({target,value:-12.5,modelExcluded:true});
 });
 it('preserves every documented inconsistency while excluding the new value from calculations',()=>{
  for(const metadata of [{...p,periodEnd:'2024-01-01'},{...p,currency:'EUR'},{...p,periodStart:'30'},{...p,scope:'standalone'}]){
   const base={ticker:'TEST',currency:'USD',niVal:20,equityVal:100,roe:20,financialPeriods:{niVal:p,equityVal:p}};
   const r=row('roe',77,metadata);expect(validateFinancialOverride({...r,expectedId:0})).toBeNull();
   const d=applyFinancialOverrides(base,[r]);
   expect(d.roe).toBeNull();expect(d.manualCorrections[0]).toMatchObject({value:77,modelExcluded:true,period:{...metadata}});
  }
 });
 it('automatically uses a compatible manual ratio and recalculates compatible input dependants',()=>{
  const base={ticker:'TEST',currency:'USD',niVal:20,equityVal:100,roe:null,revVal:100,oiVal:10,opMargin:10,financialPeriods:{niVal:p,equityVal:p,revVal:p,oiVal:p}};
  const ratio=applyFinancialOverrides(base,[row('roe',20,p)]);
  expect(ratio.roe).toBe(20);expect(ratio.manualCorrections[0].modelExcluded).toBe(false);
  const amount=applyFinancialOverrides(base,[row('oiVal',25,p)]);
  expect(amount.opMargin).toBe(25);
 });
 it('admits a compatible balance ratio at an instant, but excludes a PE with a different earnings window',()=>{
  const instant={...p,basis:'instant',periodStart:null};
  const d=applyFinancialOverrides({ticker:'TEST',currency:'USD',debtVal:50,equityVal:100,financialPeriods:{debtVal:instant,equityVal:instant}},[row('debtToEquity',.5,instant)]);
  expect(d.debtToEquity).toBe(.5);expect(d.manualCorrections[0].modelExcluded).toBe(false);
  const pe=applyFinancialOverrides({ticker:'TEST',currency:'USD',eps:2,currentPrice:20,financialPeriods:{eps:{...p,periodStart:'2024-01-01',periodEnd:'2024-12-31'}}},[row('pe',10,p)]);
  expect(pe.pe).toBeNull();expect(pe.manualCorrections[0]).toMatchObject({value:10,modelExcluded:true});
 });
 it('keeps an inconsistent FCF visible in storage and out of valuation inputs',()=>{
  const r=row('fcfVal',999,p),base={ticker:'TEST',currency:'USD',operatingCFVal:20,capexVal:5,financialPeriods:{operatingCFVal:p,capexVal:p}};
  expect(validateFinancialOverride({...r,expectedId:0})).toBeNull();
  const d=applyFinancialOverrides(base,[r]);expect(d.fcfVal).toBeNull();
  expect(d.manualCorrections[0]).toMatchObject({value:999,modelExcluded:true});
 });
 it('keeps an excluded historical correction in display tables, never the model history',()=>{
  const r=row('history:revHistory:2025',200,{...p,basis:'Q',periodStart:'2025-10-01'});
  const d=applyFinancialOverrides({ticker:'TEST',revHistory:[{...p,year:'2025',val:100}]},[r]);
  expect(d.revHistory).toEqual([]);
  const [display]=statementRows(d,[['Ingresos','rev']],true);
  expect(display).toMatchObject({editTarget:r.target,status:'Manual · excluido de cálculos',point:{val:200,basis:'Q'}});
 });
 it('persists exclusions across provider refreshes and restoration reveals the latest provider',()=>{
  const r=row('roe',77),before=applyFinancialOverrides({ticker:'TEST',roe:8},[r]),after=applyFinancialOverrides({ticker:'TEST',roe:9},[r]);
  expect(before.manualCorrections[0].value).toBe(77);expect(after.manualCorrections[0].value).toBe(77);
  expect(applyFinancialOverrides({ticker:'TEST',roe:9},[{...r,active:false}]).roe).toBe(9);
 });
 it('automatically includes a saved ratio when subsequent inputs become compatible, without requiring a justification',()=>{
  const r=row('roe',20,{...p,note:'x'}),base={ticker:'TEST',currency:'USD',niVal:20,equityVal:100,financialPeriods:{niVal:{...p,periodStart:'2024-01-01',periodEnd:'2024-12-31'},equityVal:p}};
  expect(applyFinancialOverrides(base,[r]).manualCorrections[0].modelExcluded).toBe(true);
  const ready=applyFinancialOverrides({...base,financialPeriods:{niVal:p,equityVal:p}},[r]);
  expect(ready.roe).toBe(20);expect(ready.manualCorrections[0].modelExcluded).toBe(false);
  for(const rows of [[r,row('niVal',20,p)],[row('niVal',20,p),r]])expect(applyFinancialOverrides(base,rows).roe).toBe(20);
 });
 it('stores source references as text without creating unsafe links or invented currencies',()=>{
  const m=cleanOverrideMetadata({sourceUrl:'javascript:alert(1)'},'roa');
  expect(m.sourceReference).toBe('javascript:alert(1)');expect(m.sourceUrl).toBeNull();expect(m.currency).toBeNull();
 });
 it.each([['AAPL',apple],['LLOY.L',lloyds],['ALC.MC',altia]])('preserves unchanged financial outputs for %s without corrections',(_,sample)=>{
  const d=applyFinancialOverrides(sample,[]);expect(d).toBe(sample);
  expect(analyzeStock(d)).toEqual(analyzeStock(sample));
  expect(computeEasyMode(d,true)).toEqual(computeEasyMode(sample,true));
  expect(computeDCFValue(d,.1)).toEqual(computeDCFValue(sample,.1));
 });
});
