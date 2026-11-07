import {it,expect} from 'vitest';
import {valuationEarnings,secEarningsAdjustments} from './valuationEarnings';
import {computeCompanyScores} from './companyScoreCalibration';
import {computeEasyMode,computeDCFValue} from './financialCalculations';
import {analyzeStock} from './engine';
import {methodsForProfile} from './engine/profile';
import {normalizeInput} from './engine/input';
import {scoreCoverageDetails} from './scoreCoverageDetails';
import {msftLike} from './engine/__fixtures__/companies';
import tygo from './__fixtures__/TYGO-entity-earnings.json';
import apple from './__fixtures__/integrity-baseline/AAPL.json';
import altia from './__fixtures__/integrity-baseline/ALC.MC.json';
import lloyds from './__fixtures__/integrity-baseline/LLOY.L.json';
const p={basis:'FY',periodStart:'2025-01-01',periodEnd:'2025-12-31',currency:'USD',unit:'USD',scope:'consolidated',source:'Synthetic official fixture'};
const event=patch=>({...p,id:'sale',category:'asset-sale',classification:'non-recurring',incomeEffect:20,afterTaxEffect:15,publicationDate:'2026-03-01',sourceUrl:'https://example.org/report',...patch});
const data=patch=>({...msftLike,asOf:'2026-11-07',niVal:100,marketCap:1000,currentPrice:100,sharesOutstanding:10,currency:'USD',financialPeriods:{niVal:p,revVal:p},...patch});
const score=d=>computeCompanyScores(d,computeEasyMode(d,true),analyzeStock(d));
it('TYGO reconciles the SEC TTM and identifies both sale gains without modifying accounting income',()=>{
 const before=structuredClone(tygo),e=valuationEarnings(tygo);
 expect(-1880000-(-13597000)+785000).toBe(12502000);
 expect(e).toMatchObject({reported:12502000,status:'review-required',value:null,comparable:true});
 expect(e.reportedPe).toBeCloseTo(tygo.marketCap/12502000);expect(e.adjustments.reduce((s,r)=>s+r.incomeEffect,0)).toBe(14992000);
 expect(e.reason).toContain('efecto fiscal');expect(tygo).toEqual(before);
 const analysis=analyzeStock(tygo),part=score(tygo)[1].components.find(c=>c.id==='pe');
 expect(methodsForProfile(analysis.profile.kind,normalizeInput(tygo)).discarded.some(m=>m.method==='pe')).toBe(true);
 expect(part.score).toBeNull();expect(part.evaluation.earningsBasis.reported).toBe(12502000);
 expect(analysis.valuation.earningsBasis.reportedPe).toBeCloseTo(e.reportedPe);
 expect(scoreCoverageDetails(score(tygo)[1],tygo,analysis).find(c=>c.id==='pe').reason).toContain('efecto fiscal');
 expect(tygo.niVal).toBe(12502000);
});
it('applies the same rule with a different ticker, without symbol-specific formulas',()=>expect(valuationEarnings({...tygo,ticker:'OTHER'})).toEqual(valuationEarnings(tygo)));
it('does not treat a known special item as absent merely because the earnings period is undocumented',()=>expect(valuationEarnings({...tygo,financialPeriods:{}})).toMatchObject({status:'review-required',value:null}));
it('uses a documented after-tax effect for positive recurring earnings and existing P/E scoring',()=>{
 const d=data({earningsAdjustments:[event()]});const a=analyzeStock(d);
 expect(valuationEarnings(d)).toMatchObject({status:'adjusted',value:85,reported:100,adjustment:15});
 expect(a.valuation.multiples.pe).toBeCloseTo(1000/85,3);expect(d.niVal).toBe(100);
 const baseline=data({niVal:85});expect(a.valuation.methods.find(m=>m.id==='pe').score).toBe(analyzeStock(baseline).valuation.methods.find(m=>m.id==='pe').score);
});
it('evaluates documented negative recurring earnings as zero without a negative P/E',()=>{
 const d=data({earningsAdjustments:[event({incomeEffect:200,afterTaxEffect:150})]});
 expect(valuationEarnings(d).value).toBe(-50);expect(analyzeStock(d).valuation.multiples.pe).toBeNull();
 expect(score(d)[1].components.find(c=>c.id==='pe')).toMatchObject({score:0,evaluation:{state:'negative-results',denominator:-50}});
});
it('can add back a documented exceptional loss without absolute values',()=>expect(valuationEarnings(data({niVal:-100,earningsAdjustments:[event({incomeEffect:-200,taxEffect:-40,afterTaxEffect:undefined})]})).value).toBe(60));
it('does not assume zero tax, use aggregate tax rates, or assume missing adjustments are zero',()=>{
 const d=data({taxVal:30,earningsAdjustments:[event({afterTaxEffect:undefined,taxEffect:undefined})]});
 expect(valuationEarnings(d).value).toBeNull();expect(valuationEarnings({...d,earningsAdjustments:[event({afterTaxEffect:undefined,taxEffect:0})]}).value).toBe(80);
});
it.each([{currency:'EUR'},{unit:'shares'},{scope:'standalone'},{periodStart:'2024-07-01'},{classification:'pending'},{incomeEffect:undefined},{sourceUrl:''}])('does not normalize incompatible or uncertain special items %j',patch=>expect(valuationEarnings(data({earningsAdjustments:[event(patch)]})).value).toBeNull());
it('rejects duplicate special items and never double subtracts',()=>expect(valuationEarnings(data({earningsAdjustments:[event(),event()]})).value).toBeNull());
it('does not use future publications or events outside the earnings period',()=>{
 for(const patch of [{publicationDate:'2027-01-01'},{periodStart:'2024-01-01',periodEnd:'2024-12-31'}])expect(valuationEarnings(data({earningsAdjustments:[event(patch)]}))).toMatchObject({value:100,status:'reported'});
});
it('can evaluate positive comparable earnings despite an operating-loss profile, without changing that profile',()=>{
 const d=data({oiVal:-100,oiHistory:[2023,2024,2025].map(year=>({year:String(year),val:-100})),revVal:1000,gpVal:500});
 const a=analyzeStock(d);expect(a.profile.kind).toBe('structurallyUnprofitable');expect(a.valuation.methods.find(m=>m.id==='pe')).toBeTruthy();expect(a.valuation.score).toBeNull();
 expect(score(d)[1].components.find(c=>c.id==='pe').score).not.toBeNull();
});
it.each([apple,altia,lloyds])('does not affect ordinary earnings or change Growth, Quality, DCF or scenarios: $ticker',d=>{
 const e=valuationEarnings(d);expect(e.adjustments).toEqual([]);expect(e.value).toBe(d.niVal??null);
 const withAdjustment={...d,earningsAdjustments:[event({...p,currency:d.currency,afterTaxEffect:15})]};
 const before=score(d),after=score(withAdjustment);expect(after[0]).toEqual(before[0]);expect(after[2]).toEqual(before[2]);expect(analyzeStock(withAdjustment).scenarios).toEqual(analyzeStock(d).scenarios);expect(computeDCFValue(withAdjustment,.1)).toEqual(computeDCFValue(d,.1));
});
it('extracts only explicitly reported complete SEC legs; missing YTD never means zero',()=>{
 const ni={...p,basis:'TTM',periodStart:'2025-07-01',periodEnd:'2026-06-30',components:[{start:'2025-01-01',end:'2025-12-31'},{start:'2025-01-01',end:'2025-06-30'},{start:'2026-01-01',end:'2026-06-30'}]};
 const rows=ni.components.map((r,i)=>({...r,val:[10,2,3][i],form:i===0?'10-K':'10-Q',filed:'2026-08-01',accn:'0000000001-26-000001'}));
 const json={facts:{'us-gaap':{IncomeLossFromDiscontinuedOperationsNetOfTax:{units:{USD:rows}}}}},d=data({cik:'0000000001',financialPeriods:{niVal:ni}});
 expect(secEarningsAdjustments(d,json)[0]).toMatchObject({afterTaxEffect:11,classification:'non-recurring',basis:'TTM'});
 rows.pop();expect(secEarningsAdjustments(d,json)).toEqual([]);
});
