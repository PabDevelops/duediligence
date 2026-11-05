import { describe,it,expect } from 'vitest';
import {validPeriod,samePeriod,joinPeriods,cashFlowLessCapex,sumFourQuarters,resolveFxRate,sanitizeFinancialDataStrict as sanitizeFinancialData,rollForwardTtm,selectLatestFacts} from './financialIntegrity.js';
const p=(start='2024-01-01',end='2024-12-31',basis='FY',currency='EUR')=>({periodStart:start,periodEnd:end,basis,currency,scope:'consolidated'});
const point=(val,start,end,basis,currency)=>({...p(start,end,basis,currency),year:(end||'2024').slice(0,4),val});
describe('financial input integrity',()=>{
 it('matches fiscal windows, never array positions or calendar-year labels',()=>{
  const a=[point(100,'2024-01-01','2024-12-31')], b=[point(10,'2023-01-01','2023-12-31'),point(20,'2024-01-01','2024-12-31')];
  expect(joinPeriods(a,b).map(([a,b])=>b.val/a.val)).toEqual([.2]);
  expect(joinPeriods(a,[point(20,'2023-10-01','2024-09-30')])).toEqual([]);
 });
 it.each(['H1','Q','TTM'])('does not treat %s as FY',basis=>expect(samePeriod(p(),p('2024-01-01','2024-12-31',basis))).toBe(false));
 it('rejects missing, reversed and impossible dates/durations',()=>{expect(validPeriod({basis:'FY',periodEnd:'2024-12-31'})).toBe(false);expect(validPeriod(p('2024-12-31','2024-01-01'))).toBe(false);expect(validPeriod(p('2024-01-01','2024-06-30'))).toBe(false)});
 it('does not mix currencies or individual/consolidated',()=>{expect(samePeriod(p(),p(undefined,undefined,undefined,'USD'))).toBe(false);expect(samePeriod(p(),{...p(),scope:'individual'})).toBe(false)});
 it('rolls FY and comparable semestrals into TTM without putting H1 in an annual history',()=>{const fy=point(200,'2025-01-01','2025-12-31'),cur=point(140,'2026-01-01','2026-06-30','H1'),prior=point(70,'2025-01-01','2025-06-30','H1');const r=rollForwardTtm(fy,cur,prior);expect(r.val).toBe(270);expect(r.basis).toBe('TTM');expect(r.periodStart).toBe('2025-07-01');expect(rollForwardTtm(fy,{...cur,currency:'USD'},prior)).toBeNull();expect(rollForwardTtm(fy,cur,null)).toBeNull()});
 it('selects later filed revisions and rejects unresolved equal-date conflicts',()=>{const a={start:'2024-01-01',end:'2024-12-31',filed:'2025-03-01',val:100,unit:'USD',currency:'USD'},b={...a,filed:'2025-04-01',val:90};expect(selectLatestFacts([a,b])[0].val).toBe(90);expect(selectLatestFacts([b,{...b,val:80}])).toEqual([])});
 it('withholds malformed cached histories and nonnumeric facts without throwing',()=>{const a=sanitizeFinancialData({currency:'EUR',revHistory:{bad:true},revVal:'100',financialPeriods:{revVal:p()}});expect(a.revHistory).toEqual([]);expect(a.revVal).toBeNull()});
 it('requires CAPEX even if OCF exists, accepts explicit zero',()=>{expect(cashFlowLessCapex([point(100)],[])).toEqual([]);expect(cashFlowLessCapex([point(100)],[point(0)])[0].val).toBe(100);expect(cashFlowLessCapex([point(100)],[point(-20)])[0].val).toBe(80)});
 it('rejects conflicting duplicates rather than arbitrarily choosing',()=>expect(joinPeriods([point(100)],[point(10),point(20)])).toEqual([]));
 it('requires contiguous quarters with exact dates for a TTM',()=>{
 const qs=[point(1,'2024-01-01','2024-03-31','Q'),point(2,'2024-04-01','2024-06-30','Q'),point(3,'2024-07-01','2024-09-30','Q'),point(4,'2024-10-01','2024-12-31','Q')];expect(sumFourQuarters(qs)).toBe(10);expect(sumFourQuarters([qs[0],qs[0],qs[2],qs[3]])).toBeNull();
 });
 it('fails FX closed on missing currency, network errors and malformed rates',async()=>{
  expect(await resolveFxRate(null,'EUR')).toBeNull();expect(await resolveFxRate('EUR','EUR')).toBe(1);
  expect(await resolveFxRate('USD','EUR',async()=>{throw Error('timeout')})).toBeNull();
  expect(await resolveFxRate('USD','EUR',async()=>({ok:true,json:async()=>({})}))).toBeNull();
  expect(await resolveFxRate('USD','EUR',async()=>({ok:true,json:async()=>({chart:{result:[{meta:{regularMarketPrice:.9}}]}})}))).toBe(.9);
 });
 it('quarantines old caches without inventing dates and preserves price and raw evidence',()=>{
 const before={ticker:'BYTE.MC',currency:'EUR',currentPrice:4.6,revVal:26535660,niVal:2504376.24,eps:.02,pe:230,sharesOutstanding:30653664,revHistory:[{year:'2026',val:26535660}],fcfVal:1,opMargin:11};const after=sanitizeFinancialData(before);
 expect(after.currentPrice).toBe(4.6);expect(after.revVal).toBeNull();expect(after.fcfVal).toBeNull();expect(after.pe).toBeNull();expect(after.revHistory).toEqual([]);expect(after.financialIntegrity.rejected.revVal).toBe(before.revVal);expect(after.financialIntegrity.issues.some(x=>x.code==='EPS_SHARES_NET_INCOME_CONFLICT')).toBe(true);
 });
 it('retains valid aligned inputs and is idempotent',()=>{
 const d={currency:'EUR',revVal:100,oiVal:20,opMargin:20,operatingCFVal:30,capexVal:10,fcfVal:20,fcfYield:2,financialPeriods:Object.fromEntries(['revVal','oiVal','operatingCFVal','capexVal','fcfVal'].map(k=>[k,p()])),revHistory:[point(100)],oiHistory:[point(20)],operatingCFHistory:[point(30)],capexHistory:[point(10)]};
 const a=sanitizeFinancialData(d);expect(a.opMargin).toBe(20);expect(a.fcfVal).toBe(20);expect(a.fcfHistory[0].val).toBe(20);expect(sanitizeFinancialData(a)).toEqual(a);
 });
 it('invalidates incompatible scalars before downstream formulas see them',()=>{
 const d={currency:'EUR',revVal:100,niVal:20,netMargin:20,financialPeriods:{revVal:p(),niVal:p('2023-01-01','2023-12-31')}};expect(sanitizeFinancialData(d).niVal).toBeNull();expect(sanitizeFinancialData(d).netMargin).toBeNull();
 });
 it('does not compare EPS with period-end shares as if they were weighted averages',()=>{
 const d={currency:'EUR',revVal:100,niVal:20,eps:2,pe:5,currentPrice:10,epsShares:10,financialPeriods:{revVal:p(),niVal:p(),eps:p(),epsShares:p()}};expect(sanitizeFinancialData(d).pe).toBe(5);expect(sanitizeFinancialData({...d,eps:4}).eps).toBeNull();expect(sanitizeFinancialData({...d,epsShares:null}).pe).toBeNull();
 });
});
