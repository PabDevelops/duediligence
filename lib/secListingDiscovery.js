import {listingFromSecFiling} from './listingDiscovery';
import {REVIEWED_LISTINGS} from './listingIdentity';
const cache=new Map(),headers={'User-Agent':'BullTrace/1.0 (+https://bulltrace.app)'};
async function boundedText(response){
 if(!response.ok||Number(response.headers.get('content-length'))>2_000_000)return null;
 const reader=response.body?.getReader();if(!reader)return null;const chunks=[];let total=0;
 for(;;){const {value,done}=await reader.read();if(done)break;total+=value.length;if(total>2_000_000){await reader.cancel();return null;}chunks.push(value);}
 const bytes=new Uint8Array(total);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}return new TextDecoder().decode(bytes);
}
export async function discoverSecListing(cik,ticker,previous=null,fetcher=fetch){
 if(!/^\d{10}$/.test(cik||''))return previous;
 const reviewed=REVIEWED_LISTINGS.find(r=>r.cik===cik&&r.publicationDate<=new Date().toISOString().slice(0,10));if(reviewed&&(!previous?.publicationDate||previous.publicationDate<=reviewed.publicationDate))return reviewed;
 const key=`${cik}:${ticker}`,hit=cache.get(key);if(hit&&Date.now()-hit.time<86400000)return hit.promise;
 const promise=(async()=>{
  try{
   const response=await fetcher(`https://data.sec.gov/submissions/CIK${cik}.json`,{headers,signal:AbortSignal.timeout(5000)});if(!response.ok)return previous;
   const json=await response.json(),r=json.filings?.recent;if(!r)return previous;
   // At most one official document per fundamentals refresh. No pagination,
   // historical bulk scan or additional request on normal detail/cache reads.
   const shellIndex=r.form.findIndex((f,i)=>f==='8-K'&&r.items?.[i]?.includes('5.06')&&r.items[i].includes('2.01'));
   const index=shellIndex>=0?shellIndex:r.form.findIndex(f=>f==='424B4');
   if(index<0)return previous;
   const unresolved=shellIndex>=0&&(!previous?.publicationDate||previous.publicationDate<r.filingDate[index])?{type:'shell-transition',status:'review-required',date:null,publicationDate:r.filingDate[index],source:'SEC EDGAR 8-K: Items 2.01 and 5.06',sourceUrl:`https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${r.accessionNumber[index]?.replaceAll('-','')}/`,historyStatus:'unverified-entity-transition'}:previous;
   const document=r.primaryDocument[index],accn=r.accessionNumber[index];
   if(!/^[\w.-]+\.(?:htm|html)$/i.test(document)||!/^\d{10}-\d{2}-\d{6}$/.test(accn))return unresolved;
   const sourceUrl=`https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accn.replaceAll('-','')}/${document}`;
   let html;try{html=await boundedText(await fetcher(sourceUrl,{headers,signal:AbortSignal.timeout(5000)}));}catch{return unresolved;}if(!html)return unresolved;
   return listingFromSecFiling({html,cik,ticker,sourceUrl,publicationDate:r.filingDate[index],form:r.form[index],items:r.items?.[index],formerNames:json.formerNames})||unresolved;
  }catch{return previous;}
 })();
 if(cache.size>=500)cache.delete(cache.keys().next().value);cache.set(key,{time:Date.now(),promise});return promise;
}
