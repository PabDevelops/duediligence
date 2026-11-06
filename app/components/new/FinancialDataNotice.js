export default function FinancialDataNotice({data}) {
 const integrity=data?.financialIntegrity;
 if(!integrity?.warning&&!integrity?.issues?.length)return null;
 const blocked=[...new Set((integrity.issues||[]).filter(i=>['INCOMPATIBLE_INPUT','HISTORY_BLOCKED','FCF_HISTORY_BLOCKED'].includes(i.code)).map(i=>i.message))];
 return <aside role="status" aria-label="Estado de los datos financieros" style={{padding:'12px 16px',border:'1px solid #b59b51',borderRadius:'12px',fontSize:'12px',lineHeight:1.5}}>
   {integrity.warning&&<div><strong>Datos provisionales.</strong> Algunas fechas fiscales o fuentes siguen sin verificarse. Las notas y proyecciones que dependan de ellos también son provisionales.</div>}
   {blocked.length>0&&<div><strong>Cálculos retenidos:</strong> {blocked.slice(0,4).join(' ')}</div>}
 </aside>;
}
