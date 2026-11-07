// Conservative extraction of explicit completed events from official filings.
// Filing dates, ticker suffixes and first chart prices are not IPO dates.
const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
const datePattern=`(${months.join('|')})\\s+(\\d{1,2}),?\\s+(\\d{4})`;
const iso=(month,day,year)=>{
 const s=`${year}-${String(months.findIndex(m=>m.toLowerCase()===month.toLowerCase())+1).padStart(2,'0')}-${day.padStart(2,'0')}`;
 return Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s?s:null;
};
export function filingText(html){return String(html).replace(/<(script|style|ix:header)\b[^>]*>[\s\S]*?<\/\1>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&(?:nbsp|#160);/g,' ').replace(/&(?:quot|#34);/g,'"').replace(/&#(?:x201[89]|821[67]);/gi,"'").replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();}
export function listingFromSecFiling({html,cik,ticker,sourceUrl,publicationDate,form,items,formerNames=[]}){
 const text=filingText(html),shellExit=/5\.06/.test(items||'')&&/2\.01/.test(items||'');
 const spac=shellExit&&(/blank.check company|special purpose acquisition|trust account.{0,100}initial public offering/i.test(text));
 const trading=new RegExp(`(?:common stock|ordinary shares)[^.]{0,500}\\b(?:commenced|began) trading[^.]{0,300}?\\bon\\s+${datePattern}`,'gi');
 const escapedTicker=String(ticker).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const symbol=new RegExp(`\\b(?:symbol|ticker)s?\\s+(?:&#822[01];|&quot;|["'“”‘’])*${escapedTicker}(?=[^A-Za-z0-9]|$)`,'i');
 let match,date,quote;
 while((match=trading.exec(text))){const sentence=match[0];if(!symbol.test(sentence)||/expected|will commence|anticipated|proposed|would/i.test(sentence))continue;const candidate=iso(match[1],match[2],match[3]);if(candidate&&candidate<=publicationDate){if(date&&date!==candidate)return null;date=candidate;quote=sentence;}}
 if(!date)return null;
 const base={cik,date,status:'verified',publicationDate,source:'SEC EDGAR: explicit commencement of trading',sourceUrl,evidence:quote};
 if(spac){
  const closing=new RegExp(`On\\s+${datePattern}[^.]{0,150}?consummated[^.]{0,250}?(?:Business Combination|transactions)`,'i').exec(text);
  const transactionDate=closing&&iso(closing[1],closing[2],closing[3]);
  if(!transactionDate||transactionDate>date||transactionDate>publicationDate||/\b(?:not|would|will|expected|proposed|anticipated)\b/i.test(closing[0]))return null;
  return {...base,type:'spac',transactionDate,operatingEntityId:`${Number(cik)}:operating:${transactionDate}`,vehicleName:formerNames[0]?.name||'Vehículo de adquisición anterior',historyStatus:'entity-transition'};
 }
 if(form==='424B4'&&/direct listing/i.test(text))return {...base,type:'direct'};
 if(form==='424B4'&&/initial public offering/i.test(text)&&!/blank.check company|special purpose acquisition/i.test(text))return {...base,type:'ipo'};
 return null;
}
export function providerListing(profile,ticker,previous){
 if(previous)return previous;
 const date=profile?.ipo;
 if(profile?.ticker!==ticker||!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||date>new Date().toISOString().slice(0,10))return null;
 return {date,type:null,status:'provider-reported',source:'Finnhub company profile: ipo (tipo de operación no verificado)',sourceUrl:'https://finnhub.io/docs/api/company-profile2'};
}
