import {describe,it,expect} from 'vitest';
import {validateSuggestion,parseSuggestionNumber,documentedSuggestionMetadata,suggestionFormMetadata,financialSuggestionSnapshot,prepareSuggestionReview} from './financialSuggestions';
const metadata={basis:'FY',periodStart:'2025-01-01',periodEnd:'2025-12-31',currency:'USD',scope:'consolidated',sourceUrl:'Informe anual, página 42'};
const proposal=()=>({ticker:'TEST',target:'rdVal',label:'I+D',observedValue:null,proposedValue:30,observedMetadata:{},proposedMetadata:metadata,reason:'El informe publica otra cifra.'});
describe('documented financial suggestions, separate from approval',()=>{
 it('accepts zero, N/D and incomplete fiscal documentation without marking them verified',()=>{for(const value of [0,null,-30,1e18])expect(validateSuggestion({...proposal(),proposedValue:value,proposedMetadata:{sourceUrl:'Informe anual'}})).toBeNull();});
 it.each(['30','',{},undefined,Infinity,NaN,1e19])('rejects non-numeric or excessive JSON values: %s',value=>expect(validateSuggestion({...proposal(),proposedValue:value})).toBeTruthy());
 it.each([{ticker:'../BAD'},{target:'growthScore'},{reason:'corto'},{proposedMetadata:{}},{proposedMetadata:{sourceUrl:'javascript:alert(1)'}},{proposedMetadata:{sourceUrl:'https://user:secret@example.org'}}])('rejects invalid input %j',change=>expect(validateSuggestion({...proposal(),...change})).toBeTruthy());
 it.each([['30',30],['30,5',30.5],['0',0],['',null],['-1.5',-1.5]])('parses %s without reversing digits', (input,value)=>expect(parseSuggestionNumber(input)).toBe(value));
 it.each(['1.000.000','NaN','1,234,567','Infinity','1e19'])('rejects ambiguous number %s',input=>expect(()=>parseSuggestionNumber(input)).toThrow());
 it('round-trips European dates and preserves incomplete dates as documentation',()=>{expect(suggestionFormMetadata(metadata).periodEnd).toBe('31/12/2025');expect(documentedSuggestionMetadata({periodEnd:'30/06/2026',periodStart:'30'})).toMatchObject({periodEnd:'2026-06-30',periodStart:'30'});});
 it('takes the raw amount and exact fiscal metadata rather than a formatted display',()=>{expect(financialSuggestionSnapshot({rdVal:30000000,financialPeriods:{rdVal:metadata}},'rdVal')).toMatchObject({value:30000000,metadata});});
 it('captures a displayed saved correction rather than an older provider point',()=>expect(financialSuggestionSnapshot({manualCorrections:[{target:'history:revHistory:2025',value:40,period:metadata}]},'history:revHistory:2025',{val:30})).toMatchObject({value:40,metadata}));
 it('retains periods supplied by the integrity adapter',()=>expect(financialSuggestionSnapshot({rdVal:30,financialIntegrity:{fields:{rdVal:{period:metadata}}}},'rdVal')).toMatchObject({value:30,metadata}));
 it('distinguishes annual, quarterly, TTM and independent returns snapshots',()=>{
  const data={revHistory:[{year:2025,val:1,...metadata}],quarterlyHistories:{revHistory:[{fiscalYear:'2025',fiscalQuarter:'Q1',val:2,...metadata,basis:'Q'}]},ttmHistories:{revHistory:[{val:3,...metadata,basis:'TTM'}]},reportedIndicators:[{target:'period:roa:H1:2026-06-30',value:4,period:{basis:'H1'}}]};
  expect(financialSuggestionSnapshot(data,'history:revHistory:2025').value).toBe(1);
  expect(financialSuggestionSnapshot(data,'history:revHistory:2025:Q1').value).toBe(2);
  expect(financialSuggestionSnapshot(data,'history:revHistory:TTM:2025-12-31').value).toBe(3);
  expect(financialSuggestionSnapshot(data,'period:roa:H1:2026-06-30').value).toBe(4);
 });
 it('uses the saved proposal identity, not client ticker or target, and preserves the revision',()=>{
  const review=prepareSuggestionReview({...proposal(),status:'pending'},{action:'accepted',ticker:'OTHER',target:'growthScore',value:50,expectedId:12,note:'Revisado',metadata});
  expect(review).toMatchObject({ticker:'TEST',target:'rdVal',value:50,expectedId:12,metadata:{manual:true,storageFirst:true}});expect(review.metadata.verified).toBeUndefined();
 });
 it('requires an explicit revision and does not accept reviewed suggestions twice',()=>{expect(()=>prepareSuggestionReview({...proposal(),status:'pending'},{action:'accepted',value:30,note:'',metadata})).toThrow();expect(()=>prepareSuggestionReview({...proposal(),status:'accepted'},{action:'rejected',note:''})).toThrow();});
 it('rejects without creating a financial correction',()=>expect(prepareSuggestionReview({...proposal(),status:'pending'},{action:'rejected',note:'No documentado'})).toEqual({action:'rejected',note:'No documentado'}));
});
