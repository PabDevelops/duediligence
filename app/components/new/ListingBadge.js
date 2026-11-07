import {listingPresentation} from '../../../lib/listingIdentity';
export default function ListingBadge({data}){
 const info=listingPresentation(data);if(!info)return null;
 const date=info.date?.split('-').reverse().join('/');
 return <div style={{fontSize:11,fontWeight:500,marginTop:6,lineHeight:1.5,maxWidth:420}}>
  <span style={{display:'inline-flex',alignItems:'center',gap:6,flexWrap:'wrap',padding:'3px 8px',border:'1px solid #D8CEBA',borderRadius:8,background:'#FAF7F0',color:'#504B40'}}>
   {info.recent&&<strong>Cotización reciente</strong>}{info.status==='verified'&&<span>{info.typeLabel}</span>}{date&&<span>Desde {date}</span>}
   {info.status!=='verified'&&<span>{date?'Fecha comunicada · tipo N/D':'Cotización: datos pendientes de verificación'}</span>}
  </span>
  <details style={{marginTop:4}}><summary style={{cursor:'pointer'}}>Sobre la cotización y el histórico</summary>
   <div style={{padding:'8px 0',fontWeight:400}}>Fecha de cotización: {date||'N/D'}. Tipo: {info.typeLabel}.
    {info.transactionDate&&<> Cierre de la operación: {info.transactionDate.split('-').reverse().join('/')}.</>}
    {info.recent&&<> «Cotización reciente» se muestra durante los primeros 24 meses y no penaliza las notas.</>}
    {info.warning&&<p>{info.warning}</p>}
    {!info.warning&&<p>Una salida a bolsa no invalida los estados financieros previos de la misma empresa operativa. Las fuentes disponibles no garantizan que todo el histórico esté completo.</p>}
    <a href={info.sourceUrl} target="_blank" rel="noopener noreferrer">Fuente: {info.source}</a>
   </div>
  </details>
 </div>;
}
