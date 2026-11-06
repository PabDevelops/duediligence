import {writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {describe,it,expect,vi,beforeEach} from 'vitest';
import facts from '../../../lib/__fixtures__/aapl-companyfacts-integrity.json';
const state=vi.hoisted(()=>({cached:null,writes:[]}));
vi.mock('../../../lib/supabase.js',()=>({supabase:{from:()=>{const q={select:()=>q,eq:()=>q,insert:async()=>({error:null}),single:async()=>({data:state.cached}),update:()=>q,maybeSingle:async()=>({data:null}),delete:()=>q,then:r=>Promise.resolve({}).then(r),upsert:async row=>{state.writes.push(row);return {}}};return q}}}));
vi.mock('../../../lib/yahooFinance.js',()=>({getYahooAuth:async()=>null,fetchYahooAnalystTarget:async()=>null,fetchYahooDescription:async()=>null}));
vi.mock('../../../lib/translateDescription.js',()=>({translateDescription:async x=>x}));
vi.mock('../../../lib/secInsiders.js',()=>({fetchForm4Transactions:async()=>[],computeInsiderOwnershipPct:()=>null}));
vi.mock('../../../lib/dataAnomalies.js',()=>({flagDataAnomaly:async()=>{}}));
import {GET} from './route.js';
describe('stock endpoint integrity across cache and SEC',()=>{
 beforeEach(()=>{state.cached=null;state.writes=[];vi.stubGlobal('fetch',vi.fn(async url=>{
  url=String(url);let d={};if(url.includes('company_tickers'))d={0:{ticker:'AAPL',cik_str:320193,title:'Apple Inc.'}};
  else if(url.includes('companyfacts'))d=facts;
  else if(url.includes('/stock/profile2'))d={name:'Apple Inc.',finnhubIndustry:'Technology',currency:'USD',shareOutstanding:14600};
  else if(url.includes('/quote?'))d={c:343.93,pc:340};
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

});
