// Recover only periods for unchanged amounts. Never update values during provenance recovery.
import {selectLatestFacts,validPeriod,HISTORY_FIELDS} from './financialIntegrity.js';
const mapping={annualTotalRevenue:'revHistory',annualNetIncome:'niHistory',annualNetIncomeCommonStockholders:'niHistory',annualOperatingIncome:'oiHistory',annualOperatingCashFlow:'operatingCFHistory',annualCapitalExpenditure:'capexHistory',annualTotalAssets:'assetsHistory',annualStockholdersEquity:'equityHistory',annualTotalDebt:'debtHistory',annualCashAndCashEquivalents:'cashHistory',annualDepreciationAndAmortization:'daHistory',annualBasicAverageShares:'sharesBasicHistory',annualDilutedAverageShares:'sharesDilutedHistory'};
const close=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=Math.max(1e-7,Math.abs(a)*1e-10);
export function recoverYahooPeriods(snapshot,json) {
 const d=structuredClone(snapshot);d.financialPeriods={...d.financialPeriods};const recovered=[];
 for(const r of json?.timeseries?.result||[]){const type=r.meta?.type?.[0],hist=mapping[type];if(!hist)continue;
  for(const pt of d[hist]||[]){const matches=(r[type]||[]).filter(x=>x.periodType==='12M'&&x.asOfDate?.slice(0,4)===String(pt.year)&&close(x.reportedValue?.raw,pt.val)&&(!d.currency||!x.currencyCode||d.currency===x.currencyCode));
   if(matches.length!==1)continue;const x=matches[0],balance=/^annual(TotalAssets|StockholdersEquity|TotalDebt|CashAndCashEquivalents)$/.test(type);
   Object.assign(pt,{basis:balance?'instant':'FY',periodEnd:x.asOfDate,periodStart:x.startDate||null,currency:x.currencyCode||null,scope:'provider-unspecified',source:'Yahoo Finance fundamentals-timeseries',durationMonths:12,periodConfidence:'provider-reported-end'});recovered.push({history:hist,year:pt.year,periodEnd:pt.periodEnd});
  }
  const scalar=HISTORY_FIELDS[hist],last=d[hist]?.at(-1);
  if(scalar&&last?.periodEnd&&close(d[scalar],last.val))d.financialPeriods[scalar]={...last};
  else if(scalar&&Number.isFinite(d[scalar])){const matches=(r[type]||[]).filter(x=>x.periodType==='12M'&&close(x.reportedValue?.raw,d[scalar])&&(!d.currency||!x.currencyCode||d.currency===x.currencyCode));if(matches.length===1){const x=matches[0];d.financialPeriods[scalar]={basis:/^annual(TotalAssets|StockholdersEquity|TotalDebt|CashAndCashEquivalents)$/.test(type)?'instant':'FY',periodEnd:x.asOfDate,periodStart:x.startDate||null,currency:x.currencyCode,scope:'provider-unspecified',source:'Yahoo Finance fundamentals-timeseries',durationMonths:12};recovered.push({field:scalar,periodEnd:x.asOfDate});}}
 }
 d.periodRecovery={provider:'Yahoo Finance',recovered,valuesChanged:false};return d;
}
const tags={revHistory:['RevenueFromContractWithCustomerExcludingAssessedTax','Revenues','SalesRevenueNet'],niHistory:['NetIncomeLoss'],oiHistory:['OperatingIncomeLoss'],operatingCFHistory:['NetCashProvidedByUsedInOperatingActivities'],capexHistory:['PaymentsToAcquirePropertyPlantAndEquipment'],daHistory:['DepreciationDepletionAndAmortization','DepreciationDepletionAndAmortizationPropertyPlantAndEquipment','DepreciationAndAmortization'],assetsHistory:['Assets'],equityHistory:['StockholdersEquity'],cashHistory:['CashAndCashEquivalentsAtCarryingValue'],debtHistory:['LongTermDebtCurrent','LongTermDebtNoncurrent','LongTermDebt'],currentAssetsHistory:['AssetsCurrent'],currentLiabilitiesHistory:['LiabilitiesCurrent'],ebtHistory:['IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest'],taxHistory:['IncomeTaxExpenseBenefit'],sharesBasicHistory:['WeightedAverageNumberOfSharesOutstandingBasic'],sharesDilutedHistory:['WeightedAverageNumberOfDilutedSharesOutstanding'],sharesHistory:['WeightedAverageNumberOfDilutedSharesOutstanding','WeightedAverageNumberOfSharesOutstandingBasic']};
export function recoverSecPeriods(snapshot,json) {
 const d=structuredClone(snapshot),all=json?.facts?.['us-gaap']||{},recovered=[];d.financialPeriods={...d.financialPeriods};
 const candidates={};
 for(const [hist,names] of Object.entries(tags)){
  let entries=[];for(const tag of names)for(const [unit,facts] of Object.entries(all[tag]?.units||{}))if(['USD','EUR','shares'].includes(unit))entries.push(...selectLatestFacts(facts.map(x=>({...x,unit,currency:unit==='shares'?null:unit,tag}))).map(x=>({...x,source:'SEC EDGAR companyfacts',scope:'consolidated',basis:x.start?'FY':'instant',periodStart:x.start||null,periodEnd:x.end,publicationDate:x.filed,unit:x.unit})));
  const annual=entries.filter(validPeriod),rolling=[];
  for(const fy of annual.filter(x=>x.basis==='FY')){
   for(const cur of entries.filter(x=>x.start===new Date(Date.parse(fy.end)+86400000).toISOString().slice(0,10)&&x.end>fy.end)){
    for(const prior of entries.filter(x=>x.start===fy.start&&x.end<fy.end&&x.currency===cur.currency&&x.currency===fy.currency)){
     const days=(Date.parse(cur.end)-Date.parse(prior.end))/86400000;if(days<350||days>380)continue;
     const pt={...cur,val:fy.val-prior.val+cur.val,basis:'TTM',periodStart:new Date(Date.parse(prior.end)+86400000).toISOString().slice(0,10),components:[{start:fy.start,end:fy.end,val:fy.val},{start:prior.start,end:prior.end,val:prior.val},{start:cur.start,end:cur.end,val:cur.val}]};if(validPeriod(pt))rolling.push(pt);
    }
   }
  }
  candidates[hist]=[...annual,...rolling];
  const unique=items=>[...new Map(items.map(x=>[[x.basis,x.periodStart,x.periodEnd,x.currency].join('|'),x])).values()];
  for(const pt of d[hist]||[]){const matches=unique(annual.filter(x=>x.end?.slice(0,4)===String(pt.year)&&close(x.val,pt.val)));if(matches.length===1){const x=matches[0];Object.assign(pt,x,{year:pt.year,val:pt.val,periodConfidence:'exact-source-match'});recovered.push({history:hist,year:pt.year,periodEnd:x.periodEnd});}}
  const field=HISTORY_FIELDS[hist];if(field){const matches=unique(candidates[hist].filter(x=>close(x.val,d[field])));if(matches.length===1){d.financialPeriods[field]=matches[0];recovered.push({field,periodEnd:matches[0].periodEnd});if(!d.currency&&matches[0].currency)d.currency=matches[0].currency;}}
 }
 // FCF periods require component amounts, not a coincidental scalar match alone.
 const cf=candidates.operatingCFHistory||[],cap=candidates.capexHistory||[];
 const fcfs=cf.flatMap(o=>cap.filter(c=>c.basis===o.basis&&c.periodStart===o.periodStart&&c.periodEnd===o.periodEnd&&c.currency===o.currency).map(c=>({...o,val:o.val-Math.abs(c.val)})));
 const match=fcfs.filter(x=>close(x.val,d.fcfVal));const distinct=[...new Map(match.map(x=>[x.periodStart+'|'+x.periodEnd,x])).values()];if(distinct.length===1)d.financialPeriods.fcfVal=distinct[0];
 for(const pt of d.fcfHistory||[]){const ms=fcfs.filter(x=>x.basis==='FY'&&x.periodEnd?.slice(0,4)===String(pt.year)&&close(x.val,pt.val));if(ms.length)Object.assign(pt,ms[0],{year:pt.year,val:pt.val,periodConfidence:'exact-source-match'});}
 d.periodRecovery={provider:'SEC EDGAR',recovered,valuesChanged:false};return d;
}
