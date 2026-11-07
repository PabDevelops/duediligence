import {it,expect,vi} from 'vitest';
import {listingFromSecFiling,providerListing} from './listingDiscovery';
import {discoverSecListing} from './secListingDiscovery';
const closing='On September 23, 2026 (the Closing Date), the registrant consummated the previously announced transactions pursuant to the Business Combination Agreement. The Trust Account holds proceeds from the initial public offering. The Common Stock commenced trading on Nasdaq under the symbol "TEST" on September 24, 2026.';
const input=patch=>({html:closing,cik:'0000000001',ticker:'TEST',form:'8-K',items:'2.01,5.06',publicationDate:'2026-09-29',sourceUrl:'https://www.sec.gov/Archives/test.htm',formerNames:[{name:'Synthetic SPAC'}],...patch});
it('recognizes a completed shell exit and the explicitly reported trading date',()=>expect(listingFromSecFiling(input())).toMatchObject({type:'spac',status:'verified',date:'2026-09-24',transactionDate:'2026-09-23',operatingEntityId:'1:operating:2026-09-23'}));
it.each(['expected to commence trading','will commence trading','would have commenced trading','anticipated to begin trading'])('does not turn an anticipated listing into a fact: %s',phrase=>expect(listingFromSecFiling(input({html:closing.replace('commenced trading',phrase)}))).toBeNull());
it('does not infer transaction dates from report dates, former-name dates or a ticker',()=>{expect(listingFromSecFiling(input({html:closing.replace('On September 23, 2026','At the closing')}))).toBeNull();expect(listingFromSecFiling(input({ticker:'OTHER'}))).toBeNull();});
it('does not mistake an ordinary 8-K acquisition for a SPAC',()=>expect(listingFromSecFiling(input({items:'2.01'}))).toBeNull());
it('supports documented traditional IPOs and direct listings independently of finance history',()=>{
 const text='This is an initial public offering. Common Stock began trading under symbol TEST on October 2, 2026.';
 expect(listingFromSecFiling(input({html:text,form:'424B4',items:''}))).toBeNull();
 expect(listingFromSecFiling(input({html:text,form:'424B4',items:'',publicationDate:'2026-10-03'}))).toMatchObject({type:'ipo',date:'2026-10-02'});
 expect(listingFromSecFiling(input({html:text.replace('initial public offering','direct listing'),form:'424B4',items:'',publicationDate:'2026-10-03'}))).toMatchObject({type:'direct'});
});
it('does not call the provider date a traditional IPO and checks the requested symbol',()=>{
 expect(providerListing({ticker:'TEST',ipo:'2026-10-01'},'TEST')).toMatchObject({date:'2026-10-01',status:'provider-reported',type:null});
 expect(providerListing({ticker:'OTHER',ipo:'2026-10-01'},'TEST')).toBeNull();
 expect(providerListing({ticker:'TEST',ipo:'2026-02-30'},'TEST')).toBeNull();
});
it('limits discovery to one official filing, reuses the promise, and rejects arbitrary document paths',async()=>{
 const fetcher=vi.fn(async url=>url.includes('/submissions/')?{ok:true,json:async()=>({filings:{recent:{form:['8-K'],items:['2.01,5.06'],primaryDocument:['form8-k.htm'],accessionNumber:['0000000002-26-000001'],filingDate:['2026-09-29']}}})}:new Response(closing));
 const [a,b]=await Promise.all([discoverSecListing('0000000002','TEST',null,fetcher),discoverSecListing('0000000002','TEST',null,fetcher)]);
 expect(a).toMatchObject({type:'spac'});expect(b).toEqual(a);expect(fetcher).toHaveBeenCalledTimes(2);
 const bad=vi.fn(async()=>({ok:true,json:async()=>({filings:{recent:{form:['424B4'],primaryDocument:['https://evil.test/file.htm'],accessionNumber:['0000000003-26-000001']}}})}));
 expect(await discoverSecListing('0000000003','TEST',null,bad)).toBeNull();expect(bad).toHaveBeenCalledOnce();
});
it('fails safely on SEC outages without inventing event metadata',async()=>{const prior={date:'2025-10-01',status:'provider-reported'};expect(await discoverSecListing('0000000004','TEST',prior,async()=>{throw Error('offline');})).toBe(prior);});
it('does not keep using the vehicle financials if SEC reports a shell exit but the document cannot be read',async()=>{
 const fetcher=vi.fn(async url=>url.includes('/submissions/')?{ok:true,json:async()=>({filings:{recent:{form:['8-K'],items:['2.01,5.06'],primaryDocument:['form8-k.htm'],accessionNumber:['0000000005-26-000001'],filingDate:['2026-09-29']}}})}:new Response('unavailable',{status:503}));
 expect(await discoverSecListing('0000000005','TEST',null,fetcher)).toMatchObject({type:'shell-transition',date:null,status:'review-required'});
});
