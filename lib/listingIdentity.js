// Evidence records describe transactions, never company-specific score rules.
// SEC 8-K Item 9.01 explicitly distinguishes both entities and their statements.
export const REVIEWED_LISTINGS=[{
 cik:'0001846416',type:'spac',status:'verified',date:'2026-09-24',transactionDate:'2026-09-23',publicationDate:'2026-09-29',
 source:'SEC EDGAR 8-K, introductory note, Items 5.06 and 9.01',
 sourceUrl:'https://www.sec.gov/Archives/edgar/data/1846416/000149315226044924/form8-k.htm',
 operatingEntityId:'1846416:operating:2026-09-23',operatingName:'ONE Nuclear Energy LLC',vehicleName:'Hennessy Capital Investment Corp. VII',
 operatingSources:['https://www.sec.gov/Archives/edgar/data/1846416/000149315226044924/ex99-1.htm'],
}];
const iso=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
const asOf=d=>String(d?.asOf||new Date().toISOString()).slice(0,10);
export function withListingIdentity(data){
 if(!data||data.error||data.isEtf)return data;
 const reviewed=REVIEWED_LISTINGS.find(r=>r.cik===data.cik&&r.publicationDate<=asOf(data));
 const listing=reviewed&&(!data.listingInfo?.publicationDate||data.listingInfo.publicationDate<=reviewed.publicationDate)?reviewed:data.listingInfo;
 return listing?{...data,listingInfo:listing}:data;
}
export function listingPresentation(data,now=new Date().toISOString().slice(0,10)){
 const info=withListingIdentity(data)?.listingInfo;if(!info)return null;
 const date=iso(info.date)&&info.date<=now?info.date:null;
 const anniversary=date?new Date(`${date}T00:00:00Z`):null;
 if(anniversary){const year=anniversary.getUTCFullYear()+2,month=anniversary.getUTCMonth(),day=anniversary.getUTCDate();anniversary.setUTCFullYear(year,month,Math.min(day,new Date(Date.UTC(year,month+1,0)).getUTCDate()));}
 const recent=!!date&&Date.parse(now)<anniversary.getTime();
 const incomplete=recent&&['revHistory','niHistory','fcfHistory'].some(h=>!data?.[h]?.some(p=>Number.isFinite(p.val)&&iso(p.periodEnd)&&p.periodEnd<date));
 return {...info,date,recent,label:recent?'Cotización reciente':null,typeLabel:info.status==='verified'?({ipo:'IPO tradicional',spac:'SPAC',direct:'Cotización directa'}[info.type]||'Tipo no verificado'):'Tipo no verificado',
  warning:info.type==='spac'?'Los estados del vehículo de adquisición y los de la empresa operativa se mantienen separados. No se utilizan periodos de entidades anteriores ni periodos que mezclen ambas entidades.':info.historyStatus==='unverified-entity-transition'?'La SEC comunica la salida de una sociedad vehículo. La fecha de cotización y la continuidad de la entidad contable están pendientes de contraste; no se atribuyen sus cifras anteriores al nuevo negocio.':info.historyStatus==='incomplete'||incomplete?'El histórico anterior a la cotización está incompleto o sin fechas de cierre contrastadas en BullTrace. Se conservan los ejercicios comparables disponibles; este aviso no penaliza las notas.':null};
}
const ratioFields=['eps','pe','forwardPE','forwardEps','roe','roa','roic','revGrowth','epsCagr','grossMargin','opMargin','netMargin','shareDilution','pfcf','fcfYield','priceToBook','evEbitda','debtToEquity','netDebt','currentRatio','cashRunway','dso','dio','dpo','ccc','inventoryTurnover','dividendYield'];
export function scopeFinancialEntity(input){
 const d=withListingIdentity(input),event=d?.listingInfo;
 const confirmed=event?.type==='spac'&&event.status==='verified'&&iso(event.transactionDate)&&event.operatingEntityId;
 const unresolved=event?.type==='shell-transition'&&event.status==='review-required';
 if(!d||(!confirmed&&!unresolved)||!event.sourceUrl)return d;
 const boundary=confirmed?event.transactionDate:null;
 if(boundary&&boundary>asOf(d)||event.publicationDate>asOf(d))return d;
 const allowed=p=>{
  if(!p)return false;
  if(unresolved)return false;
  if(iso(p.periodEnd)&&(p.periodEnd>asOf(d)||(p.publicationDate||p.filed)&&p.periodEnd>(p.publicationDate||p.filed)))return false;
  // Pro forma figures are never actual operating history.
  if(p.proForma||p.reportingEntityRole==='vehicle'||p.reportingEntityRole==='pro-forma')return false;
  if(p.reportingEntityId)return p.reportingEntityId===event.operatingEntityId&&!!p.source&&(p.reportingEntitySourceUrl||p.sourceUrl);
  if(event.operatingSources?.includes(p.sourceUrl||p.sourceReference))return true;
  if(!iso(p.periodEnd))return false;
  if(p.basis==='instant')return p.periodEnd>=boundary;
  return iso(p.periodStart)&&p.periodStart>=boundary&&p.periodEnd>=p.periodStart;
 };
 const excluded=[...(d.entityHistory||[])],seen=new Set(excluded.map(r=>r.key));
 const record=(key,field,value,p)=>{
  key=[key,p?.periodStart||'',p?.periodEnd||'',p?.accession||p?.accn||p?.sourceUrl||'',value].join('|');
  if(value==null||seen.has(key))return;seen.add(key);
  excluded.push({key,field,value,period:p||null,entity:p?.reportingEntityRole==='vehicle'||boundary&&(p?.publicationDate||p?.filed||'9999')<boundary?'vehicle':'unresolved',reason:'La entidad contable no corresponde al negocio operativo actual, o falta demostrar su continuidad. No se utiliza en cálculos.'});
 };
 const result={...d};
 if(boundary&&d.lastFilingDate&&d.lastFilingDate<boundary){result.predecessorLastFilingDate=d.lastFilingDate;result.lastFilingDate=null;}
 for(const [field,value] of Object.entries(d)){
  if(field.endsWith('History')&&Array.isArray(value))result[field]=value.filter((p,i)=>{if(allowed(p))return true;record(`${field}:${p.periodStart||p.year||i}:${p.periodEnd||''}`,field,p.val??p.eps,p);return false;});
  else if((field.endsWith('Val')||ratioFields.includes(field))&&Number.isFinite(value)){
   const p=d.financialPeriods?.[field]||d.financialPeriods?.[field.replace(/Val$/,'')];
   if(!allowed(p)){record(field,field,value,p);result[field]=null;}
  }
 }
 for(const map of ['quarterlyHistories','ttmHistories'])if(d[map])result[map]=Object.fromEntries(Object.entries(d[map]).map(([h,rows])=>[h,rows.filter((p,i)=>{if(allowed(p))return true;record(`${map}:${h}:${p.periodStart||i}:${p.periodEnd||''}`,h,p.val,p);return false;})]));
 if(d.reportedIndicators)result.reportedIndicators=d.reportedIndicators.filter(r=>{if(allowed(r.period))return true;record(r.target,r.field,r.value,r.period);return false;});
 if(d.quarterly){
  const q=Object.fromEntries(Object.entries(d.quarterly).map(([h,rows])=>[h,Array.isArray(rows)?rows.filter((p,i)=>{if(allowed(p))return true;record(`quarterly:${h}:${p.period||i}`,h,p.val,p);return false;}):rows]));
  result.quarterly=Object.fromEntries(Object.entries(q).map(([h,rows])=>[h,h==='revenue'||!Array.isArray(rows)?rows:(q.revenue||[]).map(ref=>{const matches=rows.filter(p=>p.period===ref.period);return matches.length===1?matches[0]:{...ref,val:null};})]));
 }
 if(d.prevQuarter){const scoped=scopeFinancialEntity({...d.prevQuarter,cik:d.cik,listingInfo:event});result.prevQuarter=scoped;}
 result.entityHistory=excluded;
 result.entityComparability={status:excluded.length?'separated':'comparable',boundary,operatingEntityId:event.operatingEntityId,excludedCount:excluded.length,
  warning:excluded.length?(unresolved?'Salida de sociedad vehículo comunicada a la SEC: falta conciliar la entidad contable. Sus datos quedan separados y no participan en Growth, Value, Quality ni valoraciones.':'Cambio de entidad contable tras una SPAC: hay datos del vehículo anterior o sin continuidad demostrada. Se conservan separados y no participan en Growth, Value, Quality ni valoraciones.'):null};
 // Raw manual revisions remain saved. Their display annotations must not imply
 // they bypass the accounting-entity boundary.
 if(d.manualCorrections)result.manualCorrections=d.manualCorrections.map(r=>allowed(r.period)?r:{...r,modelExcluded:true,entityExcluded:true,manualCalculation:false,reason:result.entityComparability.warning});
 return result;
}
