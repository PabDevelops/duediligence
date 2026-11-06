import {describe,it,expect} from 'vitest';
import {applyFinancialOverrides,validateFinancialOverride,cleanOverrideMetadata,overrideTarget} from './financialOverrides';
import {computeEasyMode,computeDCFValue} from './financialCalculations';
import {analyzeStock} from './engine';
import {analysisData,sanitizeFinancialData} from './financialDataPolicy';
import sample from './__fixtures__/integrity-baseline/ALC.MC.json';
const period={basis:'FY',periodStart:'2025-01-01',periodEnd:'2025-12-31',currency:'EUR',scope:'consolidated',source:'provider'};
const meta={...period,note:'Revisión del informe oficial',sourceUrl:'https://example.org/report'};
const row=(target,value,metadata=meta)=>({id:1,ticker:'TEST',target,value,metadata:cleanOverrideMetadata(metadata,target),active:true,created_at:'2026-11-06T00:00:00Z'});
describe('permanent financial corrections without changing the financial model',()=>{
 it('shows a manual Q margin independently of unrelated TTM revenue and old annual profit (ANNA)',()=>{
  const q={...meta,basis:'Q',currency:'USD',periodStart:'2026-04-01',periodEnd:'2026-06-30'};
  const data={ticker:'TEST',revVal:39919363,niVal:3416614,netMargin:null,financialPeriods:{revVal:{...q,basis:'TTM',periodStart:'2025-07-01'},niVal:{...q,basis:'FY',periodStart:'2023-01-01',periodEnd:'2023-12-31'}}};
  const d=applyFinancialOverrides(data,[row('netMargin',37.19,q)]);
  expect(d.netMargin).toBeNull();
  expect(d.manualCorrections[0]).toMatchObject({value:37.19,modelExcluded:true});
  expect(d.financialPeriods.netMargin).toMatchObject({...q,source:'Corrección manual de administración'});
  for(const purpose of ['quality','standalone','dcf'])expect(analysisData(d,purpose).netMargin).toBeNull();
  expect(sanitizeFinancialData(d).netMargin).toBeNull();
  expect(d.niVal).toBe(data.niVal);expect(d.revVal).toBe(data.revVal);
 });
 it.each(['opMargin','netMargin','grossMargin'])('contrasts a manual %s only against components of its own period',field=>{
  const component={opMargin:'oiVal',netMargin:'niVal',grossMargin:'gpVal'}[field];
  const data={ticker:'TEST',revVal:100,[component]:20,financialPeriods:{revVal:period,[component]:period}};
  const good=applyFinancialOverrides(data,[row(field,20)]);
  expect(good[field]).toBe(20);expect(analysisData(good)[field]).toBe(20);
  const bad=applyFinancialOverrides(data,[row(field,37.19)]);
  expect(bad[field]).toBeNull();expect(bad.financialIntegrity.fields[field].reason).toContain('mismo periodo');
 });
 it('does not allow a same-period reported margin with zero revenue',()=>{
  const d=applyFinancialOverrides({ticker:'TEST',revVal:0,niVal:20,financialPeriods:{revVal:period,niVal:period}},[row('netMargin',10)]);
  expect(d.netMargin).toBeNull();
 });
 it('does not unblock a non-manual cross-period reported margin',()=>{
  const d=sanitizeFinancialData({revVal:100,niVal:20,netMargin:20,financialPeriods:{revVal:period,niVal:{...period,periodStart:'2024-01-01',periodEnd:'2024-12-31'}}});
  expect(d.netMargin).toBeNull();
 });
 it('keeps the exact baseline object and model outputs when there are no active corrections',()=>{
  expect(applyFinancialOverrides(sample,[])).toBe(sample);
  expect(applyFinancialOverrides(sample,[{...row('roic',10),active:false}])).toBe(sample);
  expect(computeEasyMode(applyFinancialOverrides(sample,[]),true)).toEqual(computeEasyMode(sample,true));
  expect(computeDCFValue(applyFinancialOverrides(sample,[]),.1)).toEqual(computeDCFValue(sample,.1));
 });
 it('retains a correction over a later provider update and restoration exposes the latest provider',()=>{
  const correction=row('rdVal',20),a={ticker:'TEST',rdVal:null},b={ticker:'TEST',rdVal:100};
  expect(applyFinancialOverrides(a,[correction]).rdVal).toBe(20);
  expect(applyFinancialOverrides(b,[correction]).rdVal).toBe(20);
  expect(applyFinancialOverrides(b,[{...correction,active:false}]).rdVal).toBe(100);
 });
 it('recalculates an affected margin with the existing arithmetic but leaves independent values unchanged',()=>{
  const data={ticker:'TEST',revVal:100,oiVal:10,opMargin:10,roa:5,financialPeriods:{revVal:period,oiVal:period}};
  const d=applyFinancialOverrides(data,[row('oiVal',20)]);
  expect(d.oiVal).toBe(20);expect(d.opMargin).toBe(20);expect(d.roa).toBe(5);expect(data.oiVal).toBe(10);
  expect(d.financialIntegrity.fields.oiVal.status).toBe('provisional');
 });
 it('does not manufacture a compatible fiscal relationship',()=>{
  const d=applyFinancialOverrides({ticker:'TEST',revVal:100,oiVal:10,opMargin:10,financialPeriods:{revVal:period,oiVal:period}},[row('oiVal',20,{...meta,periodStart:'2024-01-01',periodEnd:'2024-12-31'})]);
  expect(d.oiVal).toBe(20);expect(d.opMargin).toBeNull();
 });
 it('keeps unknown dates provisional rather than inventing the fiscal year',()=>{
  const d=applyFinancialOverrides({ticker:'TEST',rdVal:null},[row('rdVal',20,{...meta,basis:'unknown',periodStart:null,periodEnd:null})]);
  expect(d.rdVal).toBeNull();expect(d.financialPeriods.rdVal.periodStart).toBeNull();
  expect(d.manualCorrections[0]).toMatchObject({value:20,modelExcluded:true});
 });
 it('does not unblock FCF without compatible OCF and CAPEX',()=>{
  const d=applyFinancialOverrides({ticker:'TEST',operatingCFVal:20,capexVal:null},[row('fcfVal',15)]);
  expect(d.fcfVal).toBeNull();expect(d.manualCorrections[0].value).toBe(15);
 });
 it('recalculates FCF only when edited components share their exact fiscal window',()=>{
  const d=applyFinancialOverrides({ticker:'TEST',operatingCFVal:20,capexVal:null,fcfVal:null,marketCap:150,financialPeriods:{operatingCFVal:period}},[row('capexVal',5)]);
  expect(d.fcfVal).toBe(15);expect(d.pfcf).toBe(10);
 });
 it('recalculates the published PE after an EPS correction',()=>{
  const d=applyFinancialOverrides({ticker:'TEST',eps:2,pe:10,currentPrice:20},[row('eps',4)]);
  expect(d.pe).toBe(5);
 });
 it('updates current shares and market capitalization together',()=>{
  const d=applyFinancialOverrides({ticker:'TEST',sharesOutstanding:10,sharesVal:10,currentPrice:2,marketCap:20},[row('sharesOutstanding',15)]);
  expect(d.sharesVal).toBe(15);expect(d.marketCap).toBe(30);
 });
 it('corrects exactly one historical year without changing a different current fiscal period',()=>{
  const d=applyFinancialOverrides({ticker:'TEST',revVal:200,financialPeriods:{revVal:period},revHistory:[{...period,year:'2024',val:80}]},[row('history:revHistory:2024',100,{...meta,periodStart:'2024-01-01',periodEnd:'2024-12-31'})]);
  expect(d.revHistory).toHaveLength(1);expect(d.revHistory[0].val).toBe(100);expect(d.revVal).toBe(200);
 });
 it('gives the explicit current correction priority over a correction of a historical cell',()=>{
  const history=row('history:revHistory:2025',120),current=row('revVal',150);
  const data={ticker:'TEST',revVal:100,financialPeriods:{revVal:period},revHistory:[{...period,year:'2025',val:100}]};
  for(const rows of [[current,history],[history,current]]){
    const d=applyFinancialOverrides(data,rows);expect(d.revVal).toBe(150);expect(d.revHistory[0].val).toBe(120);
  }
 });
 it('preserves an explicit manual N/D without interpreting it as zero',()=>{
  const d=applyFinancialOverrides({ticker:'TEST',rdVal:30},[row('rdVal',null)]);
  expect(d.rdVal).toBeNull();expect(d.manualCorrections[0].value).toBeNull();
 });
 it('does not apply another company correction or expose its actor',()=>{
  const d=applyFinancialOverrides({ticker:'TEST',rdVal:30},[{...row('rdVal',10),ticker:'OTHER',actor:'private-user'}]);
  expect(d.rdVal).toBe(30);expect(d.manualCorrections).toBeUndefined();
  expect(JSON.stringify(applyFinancialOverrides({ticker:'TEST',rdVal:30},[{...row('rdVal',10),actor:'private-user'}]))).not.toContain('private-user');
 });
 it('leaves independent analysis possible after a manual data change',()=>{
  const d=applyFinancialOverrides({...sample,ticker:'TEST'},[row('rdVal',1e6)]);
  expect(()=>analyzeStock(d)).not.toThrow();
 });
 it('rejects unauthorized targets and invalid numbers, while storing financial inconsistencies as documentation',()=>{
  const body={ticker:'TEST',target:'rdVal',value:10,metadata:meta,expectedId:0};
  expect(validateFinancialOverride(body)).toBeNull();
  for(const target of ['growthScore','currentPrice','__proto__','financialIntegrity','history:evil:2025'])expect(validateFinancialOverride({...body,target})).toBeTruthy();
  for(const value of [Infinity,NaN,'10',undefined])expect(validateFinancialOverride({...body,value})).toBeTruthy();
  expect(validateFinancialOverride({...body,metadata:{...meta,periodEnd:'2025-01-10'}})).toBeNull();
  expect(validateFinancialOverride({...body,metadata:{...meta,sourceUrl:'javascript:alert(1)'}})).toBeNull();
  expect(cleanOverrideMetadata({...meta,sourceUrl:'javascript:alert(1)'},'rdVal').sourceUrl).toBeNull();
  expect(validateFinancialOverride({...body,target:'sharesOutstanding',value:-1})).toBeNull();
  expect(validateFinancialOverride({...body,target:'history:revHistory:2024'})).toBeNull();
  expect(overrideTarget('roic')).toEqual({field:'roic'});
 });
});
