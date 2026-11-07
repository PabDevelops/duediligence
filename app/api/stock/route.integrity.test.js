import {writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {describe,it,expect,vi,beforeEach} from 'vitest';
import facts from '../../../lib/__fixtures__/aapl-companyfacts-integrity.json';
import flywFacts from '../../../lib/__fixtures__/flyw-companyfacts-selection.json';
import budaFacts from '../../../lib/__fixtures__/buda-companyfacts-coverage.json';
import onenFacts from '../../../lib/__fixtures__/onen-companyfacts-coverage.json';
import tygoFacts from '../../../lib/__fixtures__/tygo-revenue-scale-sec.json';
import {analyzeStock} from '../../../lib/engine';
const state=vi.hoisted(()=>({cached:null,writes:[],sourceFacts:null}));
vi.mock('../../../lib/supabase.js',()=>({supabase:{from:()=>{const q={select:()=>q,eq:()=>q,insert:async()=>({error:null}),single:async()=>({data:state.cached}),update:()=>q,maybeSingle:async()=>({data:null}),delete:()=>q,then:r=>Promise.resolve({}).then(r),upsert:async row=>{state.writes.push(row);return {}}};return q}}}));
vi.mock('../../../lib/yahooFinance.js',()=>({getYahooAuth:async()=>null,fetchYahooAnalystTarget:async()=>null,fetchYahooDescription:async()=>null}));
vi.mock('../../../lib/translateDescription.js',()=>({translateDescription:async x=>x}));
vi.mock('../../../lib/secInsiders.js',()=>({fetchForm4Transactions:async()=>[],computeInsiderOwnershipPct:()=>null}));
vi.mock('../../../lib/dataAnomalies.js',()=>({flagDataAnomaly:async()=>{}}));
import {GET} from './route.js';
describe('stock endpoint integrity across cache and SEC',()=>{
 beforeEach(()=>{state.cached=null;state.writes=[];state.sourceFacts=facts;vi.stubGlobal('fetch',vi.fn(async url=>{
  url=String(url);let d={};if(url.includes('company_tickers'))d={0:{ticker:'AAPL',cik_str:320193,title:'Apple Inc.'},1:{ticker:'FLYW',cik_str:1580560,title:'Flywire Corporation'},2:{ticker:'BUDA',cik_str:2079720,title:'Buda Juice Inc.'},3:{ticker:'ONEN',cik_str:1846416,title:'ONE Nuclear Energy Inc.'},4:{ticker:'TYGO',cik_str:1855447,title:'Tigo Energy Inc.'}};
  else if(url.includes('companyfacts'))d=state.sourceFacts;
  else if(url.includes('/stock/profile2'))d=state.sourceFacts===budaFacts?{name:'Buda Juice Inc.',finnhubIndustry:'Beverages',currency:'USD',shareOutstanding:12.567}:{name:'Apple Inc.',finnhubIndustry:'Technology',currency:'USD',shareOutstanding:14600};
  else if(url.includes('/quote?'))d=state.sourceFacts===budaFacts?{c:6.55,pc:6.55}:{c:343.93,pc:340};
  else if(url.includes('/calendar/'))d={earningsCalendar:[]};
  return {ok:true,status:200,json:async()=>d};
 }));});
 it('processes actual SEC facts without changing valuation formulas',async()=>{
  const r=await GET(new Request('https://local.test/api/stock?ticker=AAPL'));const d=await r.json();
  expect(r.status).toBe(200);expect(d.ticker).toBe('AAPL');expect(d.revVal).toBeGreaterThan(0);
  expect(d.financialPeriods.revVal.periodStart).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(d.revHistory.length).toBeGreaterThan(1);expect(d.fcfHistory.length).toBeGreaterThan(1);
  for(const pt of d.fcfHistory)expect(pt.derivation).toBe('OCF-minus-absolute-CAPEX');
  if(process.env.BULLTRACE_REPORT_DIR){mkdirSync(process.env.BULLTRACE_REPORT_DIR,{recursive:true});writeFileSync(join(process.env.BULLTRACE_REPORT_DIR,'AAPL-sec-replay.json'),JSON.stringify(d,null,2));}
  expect(d.financialIntegrity.version).toBe(2);expect(state.writes.length).toBeGreaterThan(0);
 });
 it('repairs a poisoned TYGO cache from reported SEC totals, without changing NI or multiplying/dividing amounts',async()=>{
  state.sourceFacts=tygoFacts;
  const period={basis:'FY',periodStart:'2025-01-01',periodEnd:'2025-12-31',currency:'USD',unit:'USD',scope:'consolidated',source:'SEC EDGAR',publicationDate:'2026-03-19'};
  state.cached={updated_at:new Date().toISOString(),data:{ticker:'TYGO',cik:'0001855447',currency:'USD',currentPrice:1,marketCap:1e8,niVal:12502000,revVal:103536000000,revHistory:[{...period,year:'2025',val:103536000000}],gpHistory:[{...period,year:'2025',val:44351000}],cogsHistory:[{...period,year:'2025',val:59185000}],financialPeriods:{revVal:period}}};
  const response=await GET(new Request('https://local.test/api/stock?ticker=TYGO')),d=await response.json();
  expect(response.status).toBe(200);expect(d.revHistory.find(p=>p.year==='2025')).toMatchObject({val:103536000,tag:'Revenues'});
  expect(d.revVal).toBe(104671000);expect(d.niVal).toBe(12502000);expect(d.financialPeriods.revVal.tag).toBe('Revenues');
  expect(d.secRevenueReconciliation.rescaled).toBe(false);expect(d.secRevenueScaleCheckedVersion).toBe(1);
  expect(fetch.mock.calls.some(([url])=>String(url).includes('companyfacts'))).toBe(true);
  expect(state.writes.some(r=>r.data?.revHistory?.find(p=>p.year==='2025')?.val===103536000)).toBe(true);
 });
 it('does not refetch a freshly checked but unresolved scale conflict on every view',async()=>{
  const period={basis:'FY',periodStart:'2025-01-01',periodEnd:'2025-12-31',currency:'USD',unit:'USD',scope:'consolidated',source:'SEC EDGAR',publicationDate:'2026-03-19'};
  state.cached={updated_at:new Date().toISOString(),data:{ticker:'CHECKED',currency:'USD',currentPrice:1,marketCap:1e8,niVal:12,secRevenueScaleCheckedVersion:1,revVal:100000,revHistory:[{...period,year:'2025',val:100000}],gpHistory:[{...period,year:'2025',val:40}],cogsHistory:[{...period,year:'2025',val:60}],financialPeriods:{revVal:period},financialIntegrity:{version:2,issues:[],rejected:{}}}};
  const d=await(await GET(new Request('https://local.test/api/stock?ticker=CHECKED'))).json();
  expect(d.cached).toBe(true);expect(d.revVal).toBeNull();expect(d.niVal).toBe(12);expect(fetch.mock.calls.some(([url])=>String(url).includes('companyfacts'))).toBe(false);
 });
 it('recovers BUDA annual FCF independently of fresher incompatible TTM components',async()=>{
  state.sourceFacts=budaFacts;
  const r=await GET(new Request('https://local.test/api/stock?ticker=BUDA'));const d=await r.json();
  expect(r.status).toBe(200);expect(d.fcfVal).toBe(2904000);
  expect(d.operatingCFVal).toBe(2257000);expect(d.capexVal).toBe(325000);
  expect(d.financialPeriods.fcfVal).toMatchObject({basis:'FY',periodStart:'2025-01-01',periodEnd:'2025-12-31'});
  expect(d.financialPeriods.fcfVal.cashFlowInputs.operatingCF.val).toBe(3150000);
  expect(d.financialPeriods.fcfVal.cashFlowInputs.capex.val).toBe(246000);
  expect(d.financialPeriods.fcfVal.cashFlowInputs.capex.tag).toBe('PaymentsToAcquirePropertyPlantAndEquipment');
  expect(d.cashVal).toBe(18819000);expect(d.financialPeriods.cashVal.periodEnd).toBe('2026-06-30');
  expect(d.financialIntegrity.fields.fcfVal.status).toBe('verified');
  expect(d.financialIntegrity.calculations.dcf.status).toBe('blocked');
  const analysis=analyzeStock(d,{now:'2026-11-06'});
  expect(analysis.quality.cashFlowInputs.fcfGeneration).toMatchObject({status:'matched',period:{basis:'FY',periodStart:'2025-01-01',periodEnd:'2025-12-31'}});
  expect(analysis.quality.cashFlowInputs.fcfGeneration.financialPeriods.revVal).toMatchObject({basis:'FY',periodStart:'2025-01-01',periodEnd:'2025-12-31'});
  expect(analysis.quality.components.fcfGeneration.score).toBeGreaterThanOrEqual(0);
  expect(analysis.quality.cashFlowInputs.cashConversion).toMatchObject({status:'matched',period:{basis:'FY',periodStart:'2025-01-01',periodEnd:'2025-12-31'}});
  expect(analysis.quality.cashFlowInputs.cashConversion.financialPeriods.niVal).toMatchObject({basis:'FY',periodStart:'2025-01-01',periodEnd:'2025-12-31'});
  expect(analysis.quality.components.cashConversion.score).toBeGreaterThanOrEqual(0);
  expect(d.pfcf).toBeCloseTo(28.3,1);
  if(process.env.BULLTRACE_REPORT_DIR)writeFileSync(join(process.env.BULLTRACE_REPORT_DIR,'BUDA-sec-replay.json'),JSON.stringify(d,null,2));
 });
 it('rejects future-dated ONEN balance facts without inventing post-merger financials',async()=>{
  state.sourceFacts=onenFacts;
  const r=await GET(new Request('https://local.test/api/stock?ticker=ONEN'));const d=await r.json();
  expect(r.status).toBe(200);expect(d.lastFilingDate).toBeNull();expect(d.predecessorLastFilingDate).toBe('2026-08-12');
  expect(d.listingInfo).toMatchObject({type:'spac',date:'2026-09-24',transactionDate:'2026-09-23'});
  expect(d.niVal).toBeNull();expect(d.niHistory).toEqual([]);
  expect(d.equityVal).not.toBe(-10084981);
  expect(d.revVal).toBeNull();expect(d.fcfVal).toBeNull();
  if(process.env.BULLTRACE_REPORT_DIR)writeFileSync(join(process.env.BULLTRACE_REPORT_DIR,'ONEN-sec-replay.json'),JSON.stringify(d,null,2));
 });
 it('sanitizes existing caches without refetching repeatedly after validation',async()=>{
 state.cached={updated_at:new Date().toISOString(),data:{ticker:'LLOY.L',currency:'GBP',currentPrice:.9694,marketCap:1e9,description:'Lloyds',revVal:null,pe:9.694,eps:.1,financialIntegrity:{version:2,issues:[],rejected:{}}}};
 const r=await GET(new Request('https://local.test/api/stock?ticker=LLOY.L'));const d=await r.json();expect(r.status).toBe(200);expect(d.currency).toBe('GBP');expect(d.currentPrice).toBe(.9694);expect(d.pe).toBe(9.694);expect(d.financialIntegrity.status).toBe('provisional');expect(d.cached).toBe(true);
 });
 it('recovers missing cached quote currency from Yahoo without refreshing financials',async()=>{
  state.cached={updated_at:new Date().toISOString(),data:{ticker:'ARLO',currentPrice:14.75,marketCap:1e9,description:'Arlo',financialIntegrity:{version:2,issues:[],rejected:{}}}};
  const previous=global.fetch;
  vi.stubGlobal('fetch',vi.fn(async (url,...args)=>String(url).includes('/chart/ARLO')?{ok:true,json:async()=>({chart:{result:[{meta:{currency:'USD',regularMarketPrice:14.75,chartPreviousClose:14.7}}]}})}:previous(url,...args)));
  const d=await (await GET(new Request('https://local.test/api/stock?ticker=ARLO'))).json();
  expect(d.currency).toBe('USD');expect(d.currentPrice).toBe(14.75);expect(d.cached).toBe(true);
  expect(fetch.mock.calls.some(([url])=>String(url).includes('companyfacts'))).toBe(false);
 });

 it('recovers period-compatible FLYW revenue, earnings and operating margin from actual SEC facts',async()=>{
  state.sourceFacts=flywFacts;
  const r=await GET(new Request('https://local.test/api/stock?ticker=FLYW'));const d=await r.json();
  expect(r.status).toBe(200);expect(d.revVal).toBe(763700000);expect(d.oiVal).toBe(59806000);
  expect(d.niVal).toBe(78947000);expect(d.opMargin).toBeCloseTo(7.8,1);
  for(const field of ['revVal','oiVal','niVal']){
    expect(d.financialPeriods[field]).toMatchObject({basis:'TTM',periodStart:'2025-10-01',periodEnd:'2026-09-30',currency:'USD'});
  }
  expect(d.roic).toBeNull();expect(d.financialPeriods.ebtVal.periodEnd).toBe('2026-06-30');
  expect(d.financialIntegrity.fields.roic.status).toBe('blocked');
  if(process.env.BULLTRACE_REPORT_DIR){mkdirSync(process.env.BULLTRACE_REPORT_DIR,{recursive:true});writeFileSync(join(process.env.BULLTRACE_REPORT_DIR,'FLYW-sec-replay.json'),JSON.stringify(d,null,2));}
 });

});
