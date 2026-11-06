import {describe,it,expect} from 'vitest';
import {corroboratedCashEquivalents,annualFcfEvidence} from './secCoverageRecovery';
import buda from './__fixtures__/buda-companyfacts-coverage.json';
import {sanitizeFinancialData} from './financialIntegrity';
import {analysisData} from './financialDataPolicy';
const gaap=buda.facts['us-gaap'];
const period={basis:'FY',periodStart:'2025-01-01',periodEnd:'2025-12-31',currency:'USD',scope:'consolidated',source:'SEC EDGAR'};
function input(){return {currency:'USD',fcfVal:15,operatingCFVal:30,capexVal:6,financialPeriods:{operatingCFVal:{...period,periodEnd:'2026-06-30',periodStart:'2025-07-01',basis:'TTM'},fcfVal:{...period,cashFlowInputs:{operatingCF:{...period,val:20},capex:{...period,val:5}}}}};}
describe('evidence-based recovery of incomplete SEC coverage',()=>{
 it('recovers actual BUDA cash equivalents corroborated by the total in the same filing',()=>{
  expect(corroboratedCashEquivalents(gaap)[0]).toMatchObject({val:18819000,end:'2026-06-30'});
 });
 it('does not substitute a restricted total without independent corroboration',()=>{
  expect(corroboratedCashEquivalents({CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents:gaap.CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents})).toEqual([]);
  const altered=structuredClone(gaap);altered.CashEquivalentsAtCarryingValue.units.USD.forEach(p=>p.val--);
  expect(corroboratedCashEquivalents(altered)).toEqual([]);
 });
 it('requires identical cash statement accession, not just a coincidentally equal value',()=>{
  const altered=structuredClone(gaap);altered.CashEquivalentsAtCarryingValue.units.USD.forEach(p=>p.accn='different');
  expect(corroboratedCashEquivalents(altered)).toEqual([]);
 });
 it('rejects the fallback when the same reporting date discloses restricted cash',()=>{
  const altered=structuredClone(gaap);
  altered.RestrictedCashCurrent={units:{USD:[{...altered.CashEquivalentsAtCarryingValue.units.USD.at(-1),val:100}]}};
  expect(corroboratedCashEquivalents(altered).some(p=>p.end==='2026-06-30')).toBe(false);
 });
 it('keeps annual FCF with its own complete input evidence and is idempotent',()=>{
  const d=sanitizeFinancialData(input());expect(d.fcfVal).toBe(15);
  expect(d.operatingCFVal).toBe(30);expect(d.capexVal).toBe(6);
  expect(sanitizeFinancialData(d)).toEqual(d);
 });
 it('keeps annual FCF visible but does not feed it into cross-period quality ratios',()=>{
  const raw=input();raw.revVal=100;raw.niVal=10;
  raw.financialPeriods.revVal=raw.financialPeriods.operatingCFVal;
  raw.financialPeriods.niVal=raw.financialPeriods.operatingCFVal;
  const d=sanitizeFinancialData(raw);
  expect(d.fcfVal).toBe(15);expect(analysisData(d,'standalone').fcfVal).toBe(15);
  expect(analysisData(d,'quality').fcfVal).toBeNull();
  expect(d.financialIntegrity.calculations.fcfMargin.status).toBe('blocked');
  expect(d.financialIntegrity.calculations.cashConversion.status).toBe('blocked');
 });
 it.each(['currency','scope','periodStart','periodEnd'])('rejects incompatible embedded FCF %s',field=>{
  const d=input();d.financialPeriods.fcfVal.cashFlowInputs.capex[field]='incompatible';
  expect(sanitizeFinancialData(d).fcfVal).toBeNull();
 });
 it('rejects missing CAPEX, invalid periods and inconsistent FCF arithmetic',()=>{
  const a=input();delete a.financialPeriods.fcfVal.cashFlowInputs.capex;expect(sanitizeFinancialData(a).fcfVal).toBeNull();
  const b=input();b.financialPeriods.fcfVal.periodStart=null;expect(sanitizeFinancialData(b).fcfVal).toBeNull();
  const c=input();c.fcfVal=17;expect(sanitizeFinancialData(c).fcfVal).toBeNull();
 });
 it('never constructs evidence by pairing annual cash flows from different periods',()=>{
  expect(annualFcfEvidence({start:'2025-01-01',end:'2025-12-31'},{start:'2024-01-01',end:'2024-12-31'})).toBeNull();
 });
});
