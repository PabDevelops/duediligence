export function financialCoverageBadge(scores=[],data={}){
  const corrections=data.manualCorrections?.length||0;
  const manualText=corrections===1?'1 partida corregida por administración':`${corrections} partidas corregidas por administración`;
  const blocked=Object.values(data.financialIntegrity?.fields||{}).some(f=>f.status==='blocked'&&/incompatible|no coincide/i.test(f.reason||''))
    ||(data.financialIntegrity?.issues||[]).some(i=>i.severity==='error');
  const dimensions=['growth','value','quality'].map(id=>scores.find(s=>s?.id===id));
  const complete=scores.length===3&&dimensions.every(s=>Number.isFinite(s?.coverage)&&s.coverage>=0&&s.coverage<=1);
  const average=complete?dimensions.reduce((sum,s)=>sum+s.coverage,0)/3:null;
  const percent=value=>(value*100).toLocaleString('es-ES',{maximumFractionDigits:2});
  if(!blocked&&average!=null&&average-.8>1e-9)return {kind:'coverage',label:'Cobertura alta',description:`Cobertura media ${percent(average)}%: Growth ${percent(dimensions[0].coverage)}%, Value ${percent(dimensions[1].coverage)}% y Quality ${percent(dimensions[2].coverage)}%.${corrections?` Incluye ${manualText}.`:''}${dimensions.some(s=>s.score100==null)?' Alguna dimensión no tiene nota definitiva; consulta su desglose.':''} La cobertura mide indicadores disponibles; no equivale a una auditoría ni garantiza su exactitud.`};
  if(corrections)return {kind:'manual',label:'Con correcciones manuales',description:`${manualText}. Esto no verifica todas las cuentas de la empresa.${blocked?' Hay datos incompatibles o cálculos retenidos.':''}`};
  return null;
}
