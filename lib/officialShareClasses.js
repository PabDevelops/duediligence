import {recomputeFinancialPriceRatios} from './priceRatios';

// Reviewed official evidence, not a ticker-wide multiplier or a provider guess.
// Only economically equivalent common classes at ONE date may be combined.
// A newer filing or unrecognized share count requires a new reconciliation.
export const OFFICIAL_SHARE_CLASSES=[{
  ticker:'OPHC',cik:'0001288855',filingDate:'2026-08-10',asOf:'2026-08-10',
  accession:'0001493152-26-036825',form:'10-Q',currency:'USD',
  source:'https://www.sec.gov/Archives/edgar/data/1288855/000149315226036825/form10-q.htm',
  rightsSource:'https://www.sec.gov/Archives/edgar/data/1288855/000149315226036825/ex3-4.htm',
  economicallyEquivalent:true,
  classes:[{id:'voting-common',kind:'common',economicUnits:1,shares:12622470},{id:'nonvoting-common',kind:'common',economicUnits:1,shares:11458351}],
  // Recognized incomplete source counts; June balance and August cover are NOT summed.
  knownPartialCounts:[12340785,12622470],
}];

export function reconcileOfficialShareClasses(data,records=OFFICIAL_SHARE_CLASSES){
  if(!data||data.isEtf||data.error)return data;
  const evidence=records.find(r=>r.ticker===data.ticker&&r.cik===data.cik);
  if(!evidence||evidence.economicallyEquivalent!==true||evidence.currency!==data.currency)return data;
  const asOf=String(data.asOf||new Date().toISOString()).slice(0,10);
  if(!data.lastFilingDate||evidence.asOf>asOf)return data;
  if(data.financialPeriods?.sharesOutstanding?.manual||data.financialPeriods?.sharesVal?.manual
    ||data.manualCalculation?.fields?.some(f=>['sharesOutstanding','sharesVal'].includes(f)))return data;
  const classes=evidence.classes;
  if(!Array.isArray(classes)||classes.length<2||new Set(classes.map(c=>c.id)).size!==classes.length||classes.some(c=>!Number.isSafeInteger(c.shares)||c.shares<=0||c.kind!=='common'||c.economicUnits!==1||c.asOf&&c.asOf!==evidence.asOf))return data;
  const total=classes.reduce((s,c)=>s+c.shares,0);
  if(!Number.isSafeInteger(total)||!(evidence.knownPartialCounts.includes(data.sharesOutstanding)||data.sharesOutstanding===total))return data;
  if(data.lastFilingDate>evidence.filingDate&&evidence.knownPartialCounts.includes(data.sharesOutstanding))return {
    ...data,sharesOutstanding:null,sharesVal:null,marketCap:null,priceToBook:null,pfcf:null,fcfYield:null,evEbitda:null,
    shareClassEvidence:{...evidence,total,status:'review-required',providerShares:data.sharesOutstanding,
      reason:'Existe un informe posterior a la conciliación de clases y el proveedor sigue mostrando una cifra parcial conocida. Debe contrastarse el nuevo total antes de valorar.'},
  };
  if(data.lastFilingDate>evidence.filingDate)return data;
  if(data.shareClassEvidence?.accession===evidence.accession&&data.sharesOutstanding===total&&data.marketCap===data.currentPrice*total)return data;
  const sharesPeriod={basis:'instant',periodEnd:evidence.asOf,periodStart:null,unit:'shares',currency:data.currency,scope:'consolidated',source:'SEC EDGAR: clases de acciones ordinarias',sourceUrl:evidence.source,publicationDate:evidence.filingDate};
  const corrected={...data,sharesOutstanding:total,sharesVal:total,
    financialPeriods:{...data.financialPeriods,sharesOutstanding:sharesPeriod,sharesVal:sharesPeriod},
    shareClassEvidence:{...evidence,total,status:'applied',providerShares:data.shareClassEvidence?.providerShares??data.sharesOutstanding,
      priceAssumption:`Capitalización estimada aplicando la cotización de ${data.ticker} a ambas clases con iguales derechos económicos. La clase sin voto no tiene una cotización separada.`}};
  if(!(Number.isFinite(data.currentPrice)&&data.currentPrice>0))return {...corrected,marketCap:null,priceToBook:null,pfcf:null,fcfYield:null,evEbitda:null};
  return {...corrected,...recomputeFinancialPriceRatios(corrected,data.currentPrice)};
}
