export function financialCoverageBadge(scores=[],data={}){
  const corrections=data.manualCorrections?.length||0;
  const blocked=Object.values(data.financialIntegrity?.fields||{}).some(f=>f.status==='blocked'&&/incompatible|no coincide/i.test(f.reason||''))
    ||(data.financialIntegrity?.issues||[]).some(i=>i.severity==='error');
  if(corrections)return {kind:'manual',label:'Con correcciones manuales',description:`${corrections} partidas corregidas por administración. Esto no verifica todas las cuentas de la empresa.${blocked?' Hay datos incompatibles o cálculos retenidos.':''}`};
  if(!blocked&&scores.length===3&&scores.every(s=>s.score100!=null&&s.coverage>=.9))return {kind:'coverage',label:'Cobertura alta',description:'Growth, Value y Quality tienen al menos un 90% de cobertura cada una. La cobertura mide indicadores disponibles; no equivale a una auditoría ni garantiza su exactitud.'};
  return null;
}
