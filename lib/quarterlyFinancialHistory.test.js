import {describe,it,expect} from 'vitest';
import {overrideTarget,cleanOverrideMetadata,validateFinancialOverride,applyFinancialOverrides,financialOverrideStorageTarget} from './financialOverrides';
import {prepareStatementHistory} from './manualStatementHistory';
import {statementRows,STATEMENTS} from './analysisPresentation';
import {quarterlyEpsPoints} from './quarterlyFinancialHistory';
import {computeDCFValue,computeEasyMode} from './financialCalculations';
import {analyzeStock} from './engine';
import {computeCompanyScores} from './companyScoreCalibration';
import apple from './__fixtures__/integrity-baseline/AAPL.json';
const p={basis:'Q',periodStart:'2025-01-01',periodEnd:'2025-03-31',currency:'USD',scope:'consolidated'};
const row=(history,q,value,metadata=p)=>({id:1,ticker:'AAPL',target:`history:${history}:2025:${q}`,value,metadata:cleanOverrideMetadata(metadata,`history:${history}:2025:${q}`),active:true});
const apply=rows=>applyFinancialOverrides(apple,rows,{manualAuthority:true});
describe('quarterly histories isolated from annual statements and models',()=>{
 it('accepts whitelisted Q1–Q4 identities and keeps fiscal identity in metadata',()=>{
  expect(overrideTarget('history:niHistory:2025:Q1')).toMatchObject({field:'niVal',history:'niHistory',year:'2025',quarter:'Q1',quarterHistory:true});
  expect(overrideTarget('history:niHistory:2025:Q5')).toBeNull();expect(overrideTarget('history:otherHistory:2025:Q1')).toBeNull();
  expect(validateFinancialOverride({...row('niHistory','Q1',10),expectedId:0})).toBeNull();
  expect(row('niHistory','Q1',10).metadata).toMatchObject({fiscalYear:'2025',fiscalQuarter:'Q1'});
  expect(financialOverrideStorageTarget('history:fcfHistory:2025',{...p,fiscalQuarter:'Q1'})).toBe('history:fcfHistory:2025:Q1');
 });
 it('prepares quarterly result and balance forms using their own versions, without inferring a fiscal quarter',()=>{
  const input={ticker:'AAPL',statement:'Resultados',year:'2025',values:{ni:'100'},metadata:{historyBasis:'Q',fiscalQuarter:'Q1',periodStart:'01/01/2025',periodEnd:'31/03/2025'},rows:[{id:5,target:'history:niHistory:2025'},{id:9,target:'history:niHistory:2025:Q1'}]};
  expect(prepareStatementHistory(input)[0].body).toMatchObject({target:'history:niHistory:2025:Q1',expectedId:9,metadata:{basis:'Q',periodStart:'2025-01-01',periodEnd:'2025-03-31'}});
  const balance=prepareStatementHistory({...input,statement:'Balance',values:{assets:'100'}})[0].body;
  expect(balance).toMatchObject({target:'history:assetsHistory:2025:Q1',metadata:{basis:'instant',periodStart:'',periodEnd:'2025-03-31'}});
  expect(()=>prepareStatementHistory({...input,year:''})).toThrow('ejercicio fiscal');
  expect(()=>prepareStatementHistory({...input,metadata:{historyBasis:'Q'}})).toThrow('trimestre fiscal');
 });
 it('keeps four quarters, FY, H1, TTM and all annual scores/DCF unchanged',()=>{
  const original=structuredClone(apple),rows=['Q1','Q2','Q3','Q4'].map((q,i)=>row('revHistory',q,100+i));
  const d=apply(rows);
  expect(d.quarterlyHistories.revHistory).toHaveLength(4);expect(d.revHistory).toEqual(apple.revHistory);
  expect(d.revVal).toBe(apple.revVal);expect(d.financialPeriods).toEqual(apple.financialPeriods);expect(d.quarterly).toEqual(apple.quarterly);
  expect(computeDCFValue(d,.1)).toEqual(computeDCFValue(apple,.1));
  const before=analyzeStock(apple),after=analyzeStock(d);
  for(const key of ['quality','valuation','scenarios','momentum'])expect(after[key]).toEqual(before[key]);
  expect(computeCompanyScores(d,computeEasyMode(d,true),after)).toEqual(computeCompanyScores(apple,computeEasyMode(apple,true),before));
  expect(apple).toEqual(original);
 });
 it('presents each quarter with its own editable target instead of replacing the same-year FY row',()=>{
  const d=apply([row('revHistory','Q1',100),row('revHistory','Q2',200,{...p,periodStart:'2025-04-01',periodEnd:'2025-06-30'})]);
  const rows=statementRows(d,[['Ingresos','rev']],true);
  expect(rows.find(r=>r.editTarget==='history:revHistory:2025:Q1')).toMatchObject({value:'100 USD',period:expect.stringContaining('Q1 FY2025')});
  expect(rows.find(r=>r.editTarget==='history:revHistory:2025:Q2')).toMatchObject({value:'200 USD',period:expect.stringContaining('Q2 FY2025')});
  expect(rows.filter(r=>r.editTarget==='history:revHistory:2025')).toHaveLength(1);
 });
 it('supports quarter-end balance snapshots and FCF/SBC without entering annual histories',()=>{
  const d=apply([row('assetsHistory','Q1',123,{...p,basis:'instant',periodStart:''}),row('assetsHistory','Q2',456,{...p,basis:'instant',periodStart:'',periodEnd:'2025-06-30'}),row('fcfHistory','Q1',10),row('sbcHistory','Q1',2)]);
  expect(d.assetsHistory).toEqual(apple.assetsHistory);expect(d.fcfHistory).toEqual(apple.fcfHistory);expect(d.sbcHistory).toEqual(apple.sbcHistory);
  expect(d.quarterlyHistories.assetsHistory.map(x=>x.val)).toEqual([123,456]);
  expect(statementRows(d,STATEMENTS[2][1],true).some(r=>r.editTarget==='history:fcfHistory:2025:Q1')).toBe(true);
 });
 it('derives quarterly EPS only from comparable profit and mean shares, preserving fiscal years across calendar boundaries',()=>{
  const period={...p,periodStart:'2024-10-01',periodEnd:'2024-12-31'};
  const d=apply([row('niHistory','Q1',300,period),row('sharesHistory','Q1',100,period)]);
  expect(quarterlyEpsPoints(d)[0]).toMatchObject({eps:3,fiscalYear:'2025',fiscalQuarter:'Q1',periodEnd:'2024-12-31'});
  const presented=statementRows(d,[['BPA','eps']],true).find(r=>r.editTarget==='history:niHistory:2025:Q1');
  expect(presented).toMatchObject({value:'3 USD',derived:true,point:expect.objectContaining({val:300})});
  for(const change of [{currency:'EUR'},{scope:'standalone'},{periodStart:'2025-01-01',periodEnd:'2025-03-31'}])expect(quarterlyEpsPoints(apply([row('niHistory','Q1',300,period),row('sharesHistory','Q1',100,{...period,...change})]))).toEqual([]);
 });
 it('stores incomplete or non-quarter windows visibly without inventing dates or deriving EPS',()=>{
  const d=apply([row('niHistory','Q1',10,{basis:'Q'}),row('sharesHistory','Q1',2,{basis:'Q'})]);
  expect(d.quarterlyHistories.niHistory[0].val).toBe(10);expect(d.manualCorrections.at(-1).reason).toContain('Falta documentar');
  expect(quarterlyEpsPoints(d)).toEqual([]);expect(d.niHistory).toEqual(apple.niHistory);
 });
 it('updates and restores one quarter independently, without duplicate overlay annotations',()=>{
  const first=row('niHistory','Q1',100),second=row('niHistory','Q2',200);
  const d=apply([first,second]);
  expect(applyFinancialOverrides(d,[first,second],{manualAuthority:true}).manualCorrections.filter(r=>r.quarterlyHistory)).toHaveLength(2);
  const restored=apply([{...first,active:false},second]);
  expect(restored.quarterlyHistories.niHistory).toHaveLength(1);expect(restored.quarterlyHistories.niHistory[0].fiscalQuarter).toBe('Q2');
 });
});
