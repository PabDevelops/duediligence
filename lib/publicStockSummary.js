import {financialText} from './currencyPresentation';
import {periodLabel} from './analysisPresentation';
export const publicTicker=t=>typeof t==='string'&&/^[A-Z0-9][A-Z0-9.^=-]{0,24}$/.test(t);
// Explicit whitelist. Never serialize the provider payload or account/admin notes.
export function publicStockSummary(data,ticker){
  if(!publicTicker(ticker)||!data||data.error||data.isEtf)return null;
  return {ticker,name:typeof data.name==='string'?data.name:ticker,asOf:typeof data.updatedAt==='string'?data.updatedAt:null,
    rows:[['Ingresos','revVal'],['EBIT','oiVal'],['Beneficio neto','niVal'],['FCF','fcfVal'],['Deuda','debtVal']].map(([label,field])=>{
      const p=data.financialPeriods?.[field]||data.financialPeriods?.[field.replace(/Val$/,'')]||data.financialIntegrity?.fields?.[field]?.period;
      return {label,value:financialText(data[field],p,data),period:periodLabel(p),source:p?.source||data.financialSource||'Fuente individual N/D',manual:!!p?.manual,status:data.financialIntegrity?.fields?.[field]?.status||'provisional'};
    })};
}
