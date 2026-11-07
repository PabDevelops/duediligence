import {periodLabel,STATEMENTS} from '../../../lib/analysisPresentation';
const labels=Object.fromEntries(STATEMENTS.flatMap(([,fields])=>fields.flatMap(([label,key])=>[[key+'Val',label],[key+'History',label],[key,label]])));
Object.assign(labels,{pe:'P/E',revGrowth:'Crecimiento de ingresos',epsCagr:'Crecimiento del BPA',roe:'ROE',roa:'ROA',roic:'ROIC',grossMargin:'Margen bruto',opMargin:'Margen operativo',netMargin:'Margen neto',priceToBook:'Precio/valor contable',evEbitda:'EV/EBITDA',fcfYield:'Rentabilidad por FCF',shareDilution:'Dilución',revenue:'Ingresos',operatingIncome:'EBIT',netIncome:'Beneficio neto'});
export default function EntityHistory({data}){
 const rows=data?.entityHistory||[];if(!rows.length)return null;
 return <details className="analysis-card"><summary>Históricos de otra entidad o sin continuidad demostrada ({rows.length})</summary>
  <p>Estas cifras se conservan como referencia separada. No pertenecen a las series utilizadas para calcular las notas o valoraciones del negocio operativo actual. Las cifras pro forma tampoco sustituyen resultados reales.</p>
  <div className="analysis-table-scroll" role="region" tabIndex={0} aria-label="Históricos separados por entidad"><table className="analysis-table"><thead><tr><th>Partida</th><th>Valor original</th><th>Periodo</th><th>Entidad y fuente</th></tr></thead><tbody>{rows.map(r=><tr key={r.key}><td>{labels[r.field]||'Indicador financiero'}</td><td>{Number.isFinite(r.value)?r.value.toLocaleString('es-ES'):'N/D'} {r.period?.unit||r.period?.currency||''}</td><td>{periodLabel(r.period)}</td><td>{r.entity==='vehicle'?data.listingInfo?.vehicleName||'Vehículo de adquisición':'Continuidad contable no demostrada'}<br/>{r.period?.source||'Fuente individual no documentada'}<br/>{r.reason}</td></tr>)}</tbody></table></div>
 </details>;
}
