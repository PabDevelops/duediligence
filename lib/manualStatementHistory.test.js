import {describe,it,expect,vi} from 'vitest';
import {historicalStatementFields,prepareStatementHistory,saveStatementHistory} from './manualStatementHistory';
import {applyFinancialOverrides,cleanOverrideMetadata} from './financialOverrides';
import {statementRows,STATEMENTS} from './analysisPresentation';
import {analyzeStock} from './engine';
import anna from './__fixtures__/ANNA-manual-FY2025.json';
const metadata={periodStart:'01/01/2025',periodEnd:'31/12/2025',currency:'USD',scope:'consolidated',sourceUrl:'https://example.org/accounts',note:'Informe anual'};
const input={ticker:'ANNA',statement:'Resultados',year:'2025',metadata};
const records=writes=>writes.map((w,i)=>({id:i+1,ticker:'ANNA',target:w.body.target,value:w.body.value,metadata:cleanOverrideMetadata(w.body.metadata,w.body.target),active:true}));
describe('complete historical statements using existing revisions',()=>{
 it('covers every native income and balance history, without inventing a separate EPS target',()=>{
  for(const title of ['Resultados','Balance'])for(const f of historicalStatementFields(title))expect(f.history).toBe(`${f.key}History`);
  expect(historicalStatementFields('Resultados').map(f=>f.key)).toEqual(['rev','cogs','gp','sga','rd','oi','da','interest','ebt','tax','ni','shares','sharesBasic','sharesDiluted']);
  expect(historicalStatementFields('Balance')).toHaveLength(11);expect(historicalStatementFields('Other')).toEqual([]);
 });
 it('prepares common FY metadata, EU dates, revisions, decimal input, real zero and omissions',()=>{
  const writes=prepareStatementHistory({...input,values:{rev:'25,5',ni:'0',oi:'',shares:'20'},factor:1000000,rows:[{id:12,target:'history:revHistory:2025'}]});
  expect(writes).toHaveLength(3);expect(writes[0].body).toMatchObject({target:'history:revHistory:2025',value:25500000,expectedId:12,metadata:{basis:'FY',periodStart:'2025-01-01',periodEnd:'2025-12-31'}});
  expect(writes[1].body.value).toBe(0);expect(writes[2].body.value).toBe(20);
 });
 it('uses a balance snapshot without inventing a beginning date and infers the year only from an explicit closing date',()=>{
  const w=prepareStatementHistory({...input,statement:'Balance',year:'',values:{assets:'100',equity:'-10'}});
  expect(w[0].body).toMatchObject({target:'history:assetsHistory:2025',metadata:{basis:'instant',periodStart:'',periodEnd:'2025-12-31'}});
  expect(w[1].body.value).toBe(-10);
 });
 it('allows undocumented metadata while requiring a usable technical identifier and finite values',()=>{
  expect(prepareStatementHistory({...input,metadata:{},values:{ni:'123'}})[0].body.metadata).toMatchObject({basis:'FY',periodStart:'',periodEnd:''});
  expect(()=>prepareStatementHistory({...input,year:'',metadata:{},values:{ni:'123'}})).toThrow('ejercicio');
  expect(()=>prepareStatementHistory({...input,values:{rev:'10',ni:'NaN'}})).toThrow('Beneficio neto');
  expect(()=>prepareStatementHistory({...input,values:{rev:'1e30'}})).toThrow('finito');
  expect(()=>prepareStatementHistory({...input,values:{}})).toThrow('al menos una');
 });
 it('adds complete result and balance rows to presentation, retains existing periods and recovers comparable cash conversion',()=>{
  const original=structuredClone(anna);
  const results=prepareStatementHistory({...input,values:Object.fromEntries(historicalStatementFields('Resultados').map(f=>[f.key,f.shares?'1000000':f.key==='ni'?'2000000':'25035737']))});
  const balance=prepareStatementHistory({...input,statement:'Balance',values:Object.fromEntries(historicalStatementFields('Balance').map(f=>[f.key,'10000000']))});
  const existingFcf=anna.fcfHistory.find(p=>p.year==='2025');
  const d=applyFinancialOverrides(anna,[...records([...results,...balance]),{id:100,ticker:'ANNA',target:'history:fcfHistory:2025',value:existingFcf.val,metadata:existingFcf,active:true}],{manualAuthority:true});
  for(const title of ['Resultados','Balance']){
    const rows=statementRows(d,STATEMENTS.find(([t])=>t===title)[1],true);
    for(const f of historicalStatementFields(title))expect(rows.some(r=>r.editTarget===`history:${f.history}:2025`)).toBe(true);
  }
  expect(d.niVal).toBe(anna.niVal);expect(d.revVal).toBe(anna.revVal);expect(d.financialPeriods.revVal).toEqual(anna.financialPeriods.revVal);
  expect(analyzeStock(d).quality.cashFlowInputs.cashConversion).toMatchObject({status:'matched',inputs:{niVal:2000000,fcfVal:3150841}});
  expect(d.epsHistory.find(p=>p.year==='2025').eps).toBe(2);
  expect(anna).toEqual(original);
 });
 it('preserves manual history after provider refresh and restores provider values per existing revision mechanism',()=>{
  const rows=records(prepareStatementHistory({...input,values:{ni:'2000000'}}));
  const provider={...anna,niHistory:[{...metadata,basis:'FY',year:'2025',val:100}]};
  expect(applyFinancialOverrides(provider,rows,{manualAuthority:true}).niHistory.find(p=>p.year==='2025').val).toBe(2000000);
  expect(applyFinancialOverrides(provider,rows.map(r=>({...r,active:false})),{manualAuthority:true})).toBe(provider);
 });
 it('reports partial confirmation, stops on failure and resumes without duplicate revisions',async()=>{
  const writes=prepareStatementHistory({...input,values:{rev:'100',oi:'20',ni:'10'}}),completed=new Map();
  const send=vi.fn().mockResolvedValueOnce({id:100}).mockRejectedValueOnce(new Error('Conflicto de versión'));
  const first=await saveStatementHistory(writes,{send,completed});
  expect(first).toMatchObject({ok:false,saved:['Ingresos'],failed:'EBIT'});expect(send).toHaveBeenCalledTimes(2);
  const retry=vi.fn().mockResolvedValueOnce({id:101}).mockResolvedValueOnce({id:102});
  expect(await saveStatementHistory(writes,{send:retry,completed})).toMatchObject({ok:true});expect(retry).toHaveBeenCalledTimes(2);
  const edit=vi.fn().mockResolvedValue({id:103});
  await saveStatementHistory([{...writes[0],body:{...writes[0].body,value:200}}],{send:edit,completed});
  expect(edit.mock.calls[0][0]).toMatchObject({expectedId:100,value:200});
 });
});
