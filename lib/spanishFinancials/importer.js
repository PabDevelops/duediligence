// Offline administrative workflow. Never imports Supabase or writes stock_cache.
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,readdirSync,openSync,closeSync,unlinkSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {BYTE} from './issuers.js';
import {validPeriod,periodKey,sanitizeFinancialDataStrict as sanitizeFinancialData,samePeriod,cashFlowLessCapex,rollForwardTtm,comparableGrowthPeriod} from '../financialIntegrity.js';
import {computeDerivedFinancials} from '../financialStatements.js';
export const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const encode=x=>JSON.stringify(x);
export const METRICS={revenue:'revHistory',operatingIncome:'oiHistory',netIncome:'niHistory',depreciation:'daHistory',operatingCashFlow:'ocfHistory',capex:'capexHistory',assets:'assetsHistory',equity:'equityHistory',cash:'cashHistory',debt:'debtHistory',currentAssets:'currentAssetsHistory',currentLiabilities:'currentLiabilitiesHistory',basicAverageShares:'sharesBasicHistory',dilutedAverageShares:'sharesDilutedHistory'};
const BALANCE=new Set(['assets','equity','cash','debt','currentAssets','currentLiabilities']);
export function parseSpanishNumber(raw) {
 if(typeof raw!=='string'||!/^[-+]?(?:\d{1,3}(?:\.\d{3})*|\d+)(?:,\d+)?$/.test(raw))throw Error('Ambiguous numeric transcription');
 const n=Number(raw.replaceAll('.','').replace(',','.'));if(!Number.isFinite(n))throw Error('Non-finite value');return n;
}
export function validateCandidate(input,pdfBytes) {
 const d=structuredClone(input), doc=d.document;
 if(d.ticker!==BYTE.ticker||d.isin!==BYTE.isin)throw Error('Issuer/ISIN not supported or mismatched');
 if(!doc||!['audited','reviewed','preliminary','unspecified'].includes(doc.auditStatus))throw Error('Audit status required');
 const url=new URL(doc.url);
 if(url.protocol!=='https:'||!BYTE.allowedHosts.includes(url.hostname)||url.username||url.password)throw Error('Unapproved official source');
 if(!Number.isInteger(doc.pageCount)||doc.pageCount<1)throw Error('Page count required');
 if(doc.publicationDate!==null && !validPeriod({basis:'instant',periodEnd:doc.publicationDate}))throw Error('Publication date required or explicit null');
 if(!pdfBytes||!pdfBytes.subarray(0,5).equals(Buffer.from('%PDF-'))||pdfBytes.length>60*1024*1024)throw Error('Invalid/oversized PDF');
 if(doc.sha256!==hash(pdfBytes))throw Error('Document SHA-256 mismatch');
 if(!Array.isArray(d.facts)||!d.facts.length)throw Error('No facts');
 const seen=new Set();
 for(const f of d.facts) {
  if(!Object.hasOwn(METRICS,f.metric)||!validPeriod(f)||!['FY','H1','Q','instant'].includes(f.basis))throw Error('Unknown metric or invalid period');
  if(BALANCE.has(f.metric)!==(f.basis==='instant'))throw Error('Balance/flow basis mismatch');
  if(f.currency!=='EUR'||!['consolidated','individual'].includes(f.scope))throw Error('Currency/scope missing or unsupported');
  if(![1,1000,1000000].includes(f.scale)||!['currency','shares'].includes(f.unit))throw Error('Unit/scale required');
  const isShares=f.metric.includes('AverageShares');
  if(isShares!==(f.unit==='shares')||(isShares&&f.scale!==1))throw Error('Metric/unit mismatch');
  if(!Number.isInteger(f.page)||f.page<1||f.page>doc.pageCount||!f.excerpt?.includes(f.rawValue))throw Error('Page or extraction evidence missing');
  if(!['manual-transcription','pdf-text-reviewed','ocr-reviewed'].includes(f.extractionMethod))throw Error('Extraction method requires review');
  if(f.ambiguous || f.validationStatus!=='transcribed')throw Error('Ambiguous or unreviewable fact');
  f.value=parseSpanishNumber(f.rawValue)*f.scale;
  if(f.unit==='shares'&&(!Number.isInteger(f.value)||f.value<=0))throw Error('Invalid weighted shares');
  const key=f.metric+'|'+periodKey(f);if(seen.has(key))throw Error('Duplicate semantic fact');seen.add(key);
 }
 return d;
}
const rank={audited:3,reviewed:2,preliminary:1,unspecified:0};
export function selectFacts(candidates) {
 const grouped=new Map();
 for(const c of candidates)for(const fact of c.facts) {
  const k=fact.metric+'|'+periodKey(fact);const prior=grouped.get(k);
  const next={...fact,document:c.document,ticker:c.ticker};
  if(!prior||rank[next.document.auditStatus]>rank[prior.document.auditStatus])grouped.set(k,next);
  else if(rank[next.document.auditStatus]===rank[prior.document.auditStatus]&&next.value!==prior.value)throw Error('Unresolved equal-rank conflict: '+k);
 }
 return [...grouped.values()];
}
function withLock(root,fn) {
 mkdirSync(root,{recursive:true});const lock=join(root,'.lock'),fd=openSync(lock,'wx');
 try{return fn();}finally{closeSync(fd);unlinkSync(lock);}
}
// Files are content addressed. Events are append-only, ordered and hash chained.
export class ReviewStore {
 constructor(root){this.root=resolve(root);mkdirSync(join(this.root,'versions'),{recursive:true});mkdirSync(join(this.root,'documents'),{recursive:true});mkdirSync(join(this.root,'events'),{recursive:true});}
 read(id){if(!/^[a-f0-9]{64}$/.test(id))throw Error('Invalid version id');const bytes=readFileSync(join(this.root,'versions',id+'.json'));if(hash(bytes)!==id)throw Error('Version tampered');return JSON.parse(bytes);}
 events(){let previous=null;return readdirSync(join(this.root,'events')).sort().map(name=>{const e=JSON.parse(readFileSync(join(this.root,'events',name)));const {eventHash,...body}=e;if(body.previous!==previous||hash(encode(body))!==eventHash)throw Error('Event chain tampered');previous=eventHash;return e;});}
 append(type,ids,actor,note){
  if(typeof actor!=='string'||!actor.trim()||typeof note!=='string'||!note.trim())throw Error('Actor and review reason required');
  const es=this.events(),body={sequence:es.length+1,type,ids,actor,note,at:new Date().toISOString(),previous:es.at(-1)?.eventHash||null};
  const e={...body,eventHash:hash(encode(body))};writeFileSync(join(this.root,'events',String(body.sequence).padStart(10,'0')+'.json'),encode(e),{flag:'wx'});return e;
 }
 stage(candidate,bytes,actor){return withLock(this.root,()=>{
  const valid=validateCandidate(candidate,bytes), text=encode(valid),id=hash(text);
  const es=this.events();if(es.some(e=>e.type==='stage'&&e.ids[0]===id))return id;
  for(const [folder,name,content] of [['documents',valid.document.sha256+'.pdf',bytes],['versions',id+'.json',text]]){
   const path=join(this.root,folder,name);try{writeFileSync(path,content,{flag:'wx'});}catch(e){if(e.code!=='EEXIST'||!readFileSync(path).equals(Buffer.from(content)))throw e;}
  }
  this.append('stage',[id],actor,'Document fingerprint and transcription validated; not approved');return id;
 });}
 review(id,actor,note){return withLock(this.root,()=>{const c=this.read(id);validateCandidate(c,readFileSync(join(this.root,'documents',c.document.sha256+'.pdf')));return this.append('review',[id],actor,note);});}
 approve(id,actor,note){return withLock(this.root,()=>{this.read(id);const es=this.events();if(!es.some(e=>e.type==='review'&&e.ids[0]===id))throw Error('Explicit review event required before approval');if(es.some(e=>e.type==='revoke'&&e.ids[0]===id))throw Error('Revoked version cannot be reapproved');return this.append('approve',[id],actor,note);});}
 revoke(id,actor,note){return withLock(this.root,()=>{this.read(id);return this.append('revoke',[id],actor,note);});}
 activate(ids,actor,note){return withLock(this.root,()=>{
  const es=this.events();for(const id of ids){this.read(id);if(!es.some(e=>e.type==='approve'&&e.ids[0]===id)||es.some(e=>e.type==='revoke'&&e.ids[0]===id))throw Error('Only approved non-revoked versions can be activated');}
  const nextFacts=selectFacts(ids.map(id=>this.read(id)));
  const previousIds=es.filter(e=>e.type==='activate').at(-1)?.ids||[];
  const priorFacts=selectFacts(previousIds.filter(id=>!es.some(e=>e.type==='revoke'&&e.ids[0]===id)).map(id=>this.read(id)));
  for(const p of priorFacts){const next=nextFacts.find(n=>n.metric===p.metric&&periodKey(n)===periodKey(p));if(next&&rank[next.document.auditStatus]<rank[p.document.auditStatus])throw Error('Audit-status downgrade blocked');}
  return this.append('activate',ids,actor,note);
 });}
 active(){const es=this.events(),ids=es.filter(e=>e.type==='activate').at(-1)?.ids||[];const revoked=new Set(es.filter(e=>e.type==='revoke').flatMap(e=>e.ids));return ids.filter(id=>!revoked.has(id)).map(id=>{const c=this.read(id);validateCandidate(c,readFileSync(join(this.root,'documents',c.document.sha256+'.pdf')));return c;});}
 compare(baseline){return projectForComparison(baseline,this.active());}
}
export function projectForComparison(baseline,candidates) {
 if(baseline.ticker!==BYTE.ticker)throw Error('Issuer mismatch in baseline');
 // Do not merge official data into unverified provider fields. Build a separate proposal.
 const facts=selectFacts(candidates).filter(f=>f.scope==='consolidated');
 const histories=Object.fromEntries(['revHistory','niHistory','oiHistory','fcfHistory','assetsHistory','equityHistory','debtHistory','cashHistory','gpHistory','rdHistory','cogsHistory','sgaHistory','ebtHistory','taxHistory','interestHistory','sharesBasicHistory','sharesDilutedHistory','sharesHistory','currentAssetsHistory','currentLiabilitiesHistory','totalLiabilitiesHistory','capexHistory','inventoryHistory','receivablesHistory','payablesHistory','sbcHistory','daHistory','dividendsPaidHistory','investingCFHistory','financingCFHistory','retainedEarningsHistory','ocfHistory'].map(k=>[k,[]]));
 const interim=[];
 for(const f of facts){const pt={...f,val:f.value,year:f.periodEnd.slice(0,4),source:f.document.url};if(f.basis==='H1'||f.basis==='Q'){interim.push(pt);continue;}histories[METRICS[f.metric]].push(pt);}
 for(const h of Object.values(histories))h.sort((a,b)=>a.periodEnd.localeCompare(b.periodEnd));
 // End-of-period balances remain distinct from flow periods; annual close only for comparison.
 const ref=histories.revHistory.at(-1);
 const scalarHistories=structuredClone(histories);
 for(const [metric,key] of Object.entries(METRICS))if(BALANCE.has(metric))histories[key]=histories[key].filter(p=>{const annual=histories.revHistory.some(r=>r.periodEnd===p.periodEnd);if(!annual)interim.push(p);return annual;});
 histories.fcfHistory=cashFlowLessCapex(histories.ocfHistory,histories.capexHistory);
 histories.sharesHistory=histories.sharesDilutedHistory.length?histories.sharesDilutedHistory:histories.sharesBasicHistory;
 const periods={};
 for(const [metric,key] of Object.entries(METRICS)) {
   if(BALANCE.has(metric))continue;
   const fy=histories[key].at(-1),current=interim.filter(p=>p.metric===metric&&p.basis!=='instant').sort((a,b)=>a.periodEnd.localeCompare(b.periodEnd)).at(-1);
   const prior=fy&&current ? interim.find(p=>p.metric===metric&&p.periodStart===fy.periodStart&&p.basis===current.basis):null;
   const rolled=rollForwardTtm(fy,current,prior);
   if(rolled)scalarHistories[key]=[rolled];
 }
 scalarHistories.fcfHistory=cashFlowLessCapex(scalarHistories.ocfHistory,scalarHistories.capexHistory);
 scalarHistories.sharesHistory=scalarHistories.sharesDilutedHistory.length?scalarHistories.sharesDilutedHistory:scalarHistories.sharesBasicHistory;
 const d=computeDerivedFinancials(scalarHistories);
 for(const [key,pts] of Object.entries(scalarHistories)){
  let field=key.replace(/History$/,'Val');if(key==='ocfHistory')field='operatingCFVal';
  if(pts.at(-1))periods[field]=pts.at(-1);
 }
 const growthPoints=[...histories.revHistory,...interim.filter(f=>f.metric==='revenue'&&f.basis!=='instant')].sort((a,b)=>a.periodEnd.localeCompare(b.periodEnd));
 const growthCurrent=growthPoints.at(-1),growthPrior=growthCurrent&&growthPoints.find(p=>comparableGrowthPeriod({...growthCurrent,comparisonPeriod:p}));
 if(growthPrior) {
   const empty=Object.fromEntries(Object.keys(histories).map(k=>[k,[]]));
   d.revGrowth=computeDerivedFinancials({...empty,revHistory:[growthPrior,growthCurrent]}).revGrowth;
   periods.revGrowth={...growthCurrent,comparisonPeriod:growthPrior};
 }
 const proposal={ticker:BYTE.ticker,name:baseline.name||BYTE.name,currency:'EUR',currentPrice:baseline.currentPrice,marketCap:baseline.marketCap,sharesOutstanding:baseline.sharesOutstanding,sector:baseline.sector,industry:baseline.industry,riskFreeRate:baseline.riskFreeRate,...d,...histories,operatingCFHistory:histories.ocfHistory,operatingCFVal:scalarHistories.ocfHistory.at(-1)?.val??null,financialPeriods:periods,interimFinancials:interim};
 if(ref && !periods.revVal) {periods.revVal=ref;}
 proposal.financialSource='Documentos oficiales ByteTravel (propuesta administrativa)';
 const safe=sanitizeFinancialData(proposal);
 return {mode:'comparison-only',cacheKey:hash(encode({versions:candidates.map(c=>hash(encode(c))),baseline})),before:sanitizeFinancialData(baseline),proposal:safe,conflicts:facts.filter(f=>rank[f.document.auditStatus]<2).map(f=>({metric:f.metric,reason:'preliminary-or-unspecified'})),publicationEnabled:false};
}
