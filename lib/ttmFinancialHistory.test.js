import {it,expect} from 'vitest';
import {prepareStatementHistory} from './manualStatementHistory';
import {applyFinancialOverrides,cleanOverrideMetadata,overrideTarget,financialOverrideStorageTarget} from './financialOverrides';
import {statementRows,STATEMENTS} from './analysisPresentation';
import {computeCompanyScores} from './companyScoreCalibration';
import {computeEasyMode,computeDCFValue} from './financialCalculations';
import {analyzeStock} from './engine';
import {ttmEpsPoints} from './ttmFinancialHistory';
import te from './__fixtures__/TE-value-periods.json';
import sbc from './__fixtures__/TE-sbc-ttm.json';

const meta={...sbc.metadata};
const form={ticker:'TE',statement:'Resultados',year:'2026',metadata:{...meta,historyBasis:'TTM',periodStart:'01/07/2025',periodEnd:'30/06/2026'}};
const row=(history,value,metadata=meta,id=100)=>{const target=`history:${history}:TTM:${metadata.periodEnd}`;return {id,ticker:'TE',target,value,active:true,metadata:cleanOverrideMetadata(metadata,target)};};
const rows=writes=>writes.map((w,i)=>({...w.body,id:100+i,active:true,metadata:cleanOverrideMetadata(w.body.metadata,w.body.target)}));
const scores=d=>computeCompanyScores(d,computeEasyMode(d,true),analyzeStock(d));

it('prepares complete TTM results with EU dates, omissions, zero and independent closing identities',()=>{
 const writes=prepareStatementHistory({...form,values:{rev:'10,5',ni:'0',oi:'',shares:'250'},factor:1e6,rows:[{id:12,target:'history:revHistory:2026'},{id:13,target:'history:revHistory:TTM:2026-06-30'}]});
 expect(writes[0].body).toMatchObject({target:'history:revHistory:TTM:2026-06-30',value:10500000,expectedId:13,metadata:{basis:'TTM',periodStart:'2025-07-01',periodEnd:'2026-06-30'}});
 expect(writes[1].body.value).toBe(0);expect(writes[2].body.value).toBe(250);
 expect(()=>prepareStatementHistory({...form,metadata:{historyBasis:'TTM'},values:{rev:'10'}})).toThrow('fecha de cierre');
 expect(()=>prepareStatementHistory({...form,statement:'Balance',values:{assets:'10'}})).toThrow('saldo a una fecha');
});
it('recognizes TTM targets and routes new single-value histories by closing date',()=>{
 expect(overrideTarget('history:sbcHistory:TTM:2026-06-30')).toMatchObject({field:'sbcVal',ttmHistory:true,year:'2026'});
 expect(overrideTarget('history:sbcHistory:TTM:2026-02-30')).toBeNull();
 expect(financialOverrideStorageTarget('history:sbcHistory:2026',meta)).toBe('history:sbcHistory:TTM:2026-06-30');
 expect(()=>financialOverrideStorageTarget('history:sbcHistory:2026',{basis:'TTM'})).toThrow('fecha de cierre');
});
it('recovers the already stored TE SBC without rewriting its database target or its amount',()=>{
 const original=structuredClone(sbc),d=applyFinancialOverrides(te,[sbc],{manualAuthority:true});
 expect(d.sbcVal).toBe(14707000);expect(d.financialPeriods.sbcVal).toMatchObject({basis:'TTM',periodStart:'2025-07-01',periodEnd:'2026-06-30',currency:'USD',scope:'consolidated'});
 expect(d.sbcHistory).toEqual(te.sbcHistory);
 expect(d.manualCorrections.find(r=>r.target===sbc.target)).toMatchObject({appliedToCurrent:true,modelExcluded:false,ttmHistory:true,value:14707000});
 expect(scores(d)[1]).toMatchObject({tier:'F',coverage:.7,score100:0});
 expect(scores(d)[1].components.find(c=>c.id==='pe').score).toBeNull();
 const direct=applyFinancialOverrides(te,[{...sbc,target:'sbcVal'}],{manualAuthority:true});
 expect(analyzeStock(d)).toEqual(analyzeStock(direct));expect(computeDCFValue(d,.1)).toEqual(computeDCFValue(direct,.1));
 expect(sbc).toEqual(original);
});
it('reads a new compatible TTM net income through the existing engine and preserves FY/Q and H1 revisions',()=>{
 const historicH1={id:40,ticker:'TE',target:'niVal',value:te.niVal,metadata:te.financialPeriods.niVal,active:true};
 const writes=rows(prepareStatementHistory({...form,values:{ni:'-396790000'}}));
 const d=applyFinancialOverrides(te,[historicH1,sbc,...writes],{manualAuthority:true});
 expect(d.niVal).toBe(-396790000);expect(d.financialPeriods.niVal.basis).toBe('TTM');
 expect(d.revHistory).toEqual(te.revHistory);expect(d.niHistory).toEqual(te.niHistory);expect(d.quarterlyHistories).toEqual(te.quarterlyHistories);
 expect(d.manualCorrections.find(r=>r.target==='niVal').period.basis).toBe('H1');
 expect(d.manualCorrections.find(r=>r.appliedToCurrent&&r.field==='niVal').target).toBe(writes[0].target);
 expect(scores(d)[1]).toMatchObject({tier:'F',coverage:1,score100:0});
});
it('shows editable FY, Q and multiple TTM closes in the same year without replacing annual rows',()=>{
 const september={...meta,periodStart:'2025-10-01',periodEnd:'2026-09-30'};
 const records=[row('niHistory',-10),row('niHistory',-20,september,101)];
 const d=applyFinancialOverrides(te,records,{manualAuthority:true});
 const entries=statementRows(d,STATEMENTS[0][1],true).filter(r=>r.editTarget.startsWith('history:niHistory:'));
 for(const r of records)expect(entries.find(e=>e.editTarget===r.target)).toMatchObject({period:expect.stringContaining('TTM'),point:expect.objectContaining({val:r.value})});
 expect(entries.filter(r=>r.editTarget.includes(':TTM:'))).toHaveLength(2);expect(d.niHistory).toEqual(te.niHistory);
});
it.each([
 {periodStart:'2026-01-01'},
 {periodStart:''},
 {currency:'EUR'},
 {scope:'provider-unspecified'},
 {scope:'standalone'},
 {unit:'USD millions'},
 {basis:'FY'},
])('stores incompatible TTM metadata %j with a warning and does not feed it into calculations',patch=>{
 const r={...row('sbcHistory',123),metadata:{...meta,...patch}},d=applyFinancialOverrides(te,[r],{manualAuthority:true});
 expect(d.sbcVal).toBe(te.sbcVal);expect(d.financialPeriods.sbcVal).toEqual(te.financialPeriods.sbcVal);
 expect(d.ttmHistories.sbcHistory[0].val).toBe(123);
 expect(d.manualCorrections.find(x=>x.target===r.target)).toMatchObject({modelExcluded:true,appliedToCurrent:false});
 expect(scores(d)).toEqual(scores(te));expect(computeDCFValue(d,.1)).toEqual(computeDCFValue(te,.1));
});
it('respects newer principal edits, restores the provider when the TTM override is inactive and survives refresh',()=>{
 const record=row('sbcHistory',14707000),primary={...record,target:'sbcVal',value:5,id:101};
 expect(applyFinancialOverrides(te,[record,primary],{manualAuthority:true}).sbcVal).toBe(5);
 expect(applyFinancialOverrides(te,[{...record,active:false}],{manualAuthority:true})).toBe(te);
 expect(applyFinancialOverrides({...te,sbcVal:20},[record],{manualAuthority:true}).sbcVal).toBe(14707000);
});
it('prefers the latest administrative revision when a legacy target and new target describe one window',()=>{
 const newer=row('sbcHistory',15000000,meta,100);
 const d=applyFinancialOverrides(te,[newer,sbc],{manualAuthority:true});
 expect(d.sbcVal).toBe(15000000);expect(d.ttmHistories.sbcHistory).toHaveLength(1);
 const presented=statementRows(d,STATEMENTS[2][1],true).filter(r=>r.label==='Remuneración en acciones');
 expect(presented).toHaveLength(1);expect(presented[0].editTarget).toBe(newer.target);
});
it('derives TTM EPS only from the same TTM net income and mean share window',()=>{
 const d=applyFinancialOverrides(te,[row('niHistory',-300),row('sharesHistory',100)],{manualAuthority:true});
 expect(ttmEpsPoints(d)[0]).toMatchObject({eps:-3,basis:'TTM'});
 const eps=statementRows(d,[['BPA','eps']],true).find(r=>r.period.includes('TTM'));
 expect(eps.editTarget).toBe('history:niHistory:TTM:2026-06-30');expect(eps.point.val).toBe(-300);
 const incompatible=applyFinancialOverrides(te,[row('niHistory',-300),row('sharesHistory',100,{...meta,scope:'standalone'})],{manualAuthority:true});
 expect(ttmEpsPoints(incompatible)).toEqual([]);
});
