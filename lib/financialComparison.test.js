import {describe,it,expect} from 'vitest';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import {join} from 'node:path';
import {sanitizeFinancialData} from './financialIntegrity.js';
import {analyzeStock} from './engine/index.js';
import {computeEasyMode,computeDCFValue} from './stockScoring.js';
import {getCompanyHeaderScores} from './companyHeaderScores.js';
const tickers=['BYTE.MC','ALC.MC','RBT.MC','SCO.MC','GRI.MC','ART.MC','AAPL','LLOY.L'];
const rows=[];const output=process.env.BULLTRACE_REPORT_DIR;
function evaluate(d){const easy=computeEasyMode(d,true),a=analyzeStock(d,{now:'2026-11-05T18:00:00Z'});return {headerScores:getCompanyHeaderScores(easy,d).map(x=>({dimension:x.id,score:x.score100})),engineQuality:a.quality.score,engineValuation:a.valuation.score,projectionStatus:a.scenarios.status,entry:a.entry,dcf:computeDCFValue(d,d.riskFreeRate||.04)}}
if(process.env.BULLTRACE_OFFICIAL_PREVIEW&&output){const preview=JSON.parse(readFileSync(process.env.BULLTRACE_OFFICIAL_PREVIEW));writeFileSync(join(output,'BYTE-official-evaluation.json'),JSON.stringify({mode:preview.mode,requiresApproval:preview.requiresApproval,proposal:preview.proposal,evaluation:evaluate(preview.proposal)},null,2));}
describe('saved production snapshot replay (no live writes)',()=>{
 for(const ticker of tickers)it(ticker+' quarantines unsupported periods and preserves the quote',()=>{
  const before=JSON.parse(readFileSync(new URL('./__fixtures__/integrity-baseline/'+ticker+'.json',import.meta.url)));
  const after=sanitizeFinancialData(before);expect(after.currentPrice).toBe(before.currentPrice);expect(after.ticker).toBe(before.ticker);
  expect(after.revHistory.every(p=>p.basis==='FY'&&p.periodStart&&p.periodEnd)).toBe(true);
  expect(after.pe).toBeNull();expect(after.fcfVal).toBeNull();expect(after.marginHistory).toEqual([]);
  const row={ticker,sourceSnapshotDate:before.updatedAt,mode:'same-snapshot-replay',corrected:Object.keys(after.financialIntegrity.rejected),unavailable:Object.entries(after).filter(([k,v])=>v===null&&k.endsWith('Val')).map(([k])=>k),ratios:{before:{pe:before.pe,roic:before.roic,opMargin:before.opMargin,fcfYield:before.fcfYield},after:{pe:after.pe,roic:after.roic,opMargin:after.opMargin,fcfYield:after.fcfYield}},before:evaluate(before),after:evaluate(after),issues:after.financialIntegrity.issues};rows.push(row);
  if(output){mkdirSync(output,{recursive:true});writeFileSync(join(output,ticker+'.after.json'),JSON.stringify(after,null,2));writeFileSync(join(output,'comparison.json'),JSON.stringify(rows,null,2));}
 });
});
