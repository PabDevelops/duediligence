import {describe,it,expect} from 'vitest';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import {join} from 'node:path';
import {sanitizeFinancialData,sanitizeFinancialDataStrict} from './financialIntegrity.js';
import {recoverYahooPeriods,recoverSecPeriods} from './financialPeriodRecovery.js';
import {analyzeStock} from './engine/index.js';
import {computeEasyMode,computeDCFValue} from './financialCalculations.js';
import {getCompanyHeaderScores} from './companyHeaderScores.js';
const tickers=['BYTE.MC','ALC.MC','RBT.MC','SCO.MC','GRI.MC','ART.MC','AAPL','LLOY.L'];
const rows=[],output=process.env.BULLTRACE_REPORT_DIR;
function evaluate(d){const easy=computeEasyMode(d,true),a=analyzeStock(d,{now:'2026-11-05T18:00:00Z'});return {headerScores:getCompanyHeaderScores(easy,d).map(x=>({dimension:x.id,score:x.score100,status:x.status})),engineQuality:a.quality.score,engineValuation:a.valuation.score,projectionStatus:a.scenarios.status,entry:a.entry,dcf:computeDCFValue(d,d.riskFreeRate||.04),provisional:d.financialIntegrity?.status==='provisional'}}
describe('strict versus provisional policy on unchanged saved amounts',()=>{
 for(const ticker of tickers)it(ticker+' restores only defensible inputs',()=>{
  const original=JSON.parse(readFileSync(new URL('./__fixtures__/integrity-baseline/'+ticker+'.json',import.meta.url)));
  const strict=sanitizeFinancialDataStrict(original),legacy=sanitizeFinancialData(original);
  const provider=JSON.parse(readFileSync(new URL('./__fixtures__/period-recovery/'+ticker+'.json',import.meta.url)));
  const recovered=ticker==='AAPL'?recoverSecPeriods(original,provider):recoverYahooPeriods(original,provider);
  const after=sanitizeFinancialData(recovered);
  expect(after.currentPrice).toBe(original.currentPrice);expect(after.ticker).toBe(original.ticker);
  for(const key of ['revVal','niVal','oiVal'])if(original[key]!=null)expect(after[key]).toBe(original[key]);
  expect(after.financialIntegrity.warning).toBeTruthy();
  expect(sanitizeFinancialData(after)).toEqual(after);
  if(ticker==='BYTE.MC'){expect(after.fcfVal).toBeNull();expect(after.opMargin).toBeNull();expect(evaluate(after).projectionStatus).toBe('insufficient');}
  else {expect(after.fcfVal).toBe(original.fcfVal);expect(evaluate(after).headerScores.filter(s=>s.score!==null)).toHaveLength(3);}
  const row={ticker,sourceSnapshotDate:original.updatedAt,recovery:recovered.periodRecovery,strict:evaluate(strict),legacy:evaluate(legacy),after:evaluate(after),fields:after.financialIntegrity.fields,blocked:after.financialIntegrity.issues.filter(i=>i.code==='INCOMPATIBLE_INPUT'),calculations:after.financialIntegrity.calculations};rows.push(row);
  if(output){mkdirSync(output,{recursive:true});writeFileSync(join(output,ticker+'.after.json'),JSON.stringify(after,null,2));writeFileSync(join(output,'comparison.json'),JSON.stringify(rows,null,2));}
 });
});
