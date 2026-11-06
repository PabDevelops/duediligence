import { financialText } from './currencyPresentation';
import { validPeriod } from './financialIntegrity';
export const STATEMENTS = [['Resultados', [['Ingresos', 'rev'], ['Coste de ventas', 'cogs'], ['Beneficio bruto', 'gp'], ['Gastos de venta y administración', 'sga'], ['I+D', 'rd'], ['EBIT', 'oi'], ['Amortización y depreciación', 'da'], ['Intereses', 'interest'], ['Beneficio antes de impuestos', 'ebt'], ['Impuestos', 'tax'], ['Beneficio neto', 'ni'], ['BPA', 'eps'], ['Acciones', 'shares'], ['Acciones básicas', 'sharesBasic'], ['Acciones diluidas', 'sharesDiluted']]], ['Balance', [['Activos totales', 'assets'], ['Activos corrientes', 'currentAssets'], ['Caja', 'cash'], ['Inventario', 'inventory'], ['Clientes', 'receivables'], ['Pasivos totales', 'totalLiabilities'], ['Pasivos corrientes', 'currentLiabilities'], ['Proveedores', 'payables'], ['Deuda', 'debt'], ['Patrimonio neto', 'equity'], ['Beneficios retenidos', 'retainedEarnings']]], ['Flujos de caja', [['Flujo operativo (OCF)', 'operatingCF'], ['CAPEX', 'capex'], ['Flujo de caja libre (FCF)', 'fcf'], ['Flujo de inversión', 'investingCF'], ['Flujo de financiación', 'financingCF'], ['Dividendos pagados', 'dividendsPaid'], ['Remuneración en acciones', 'sbc'], ['Variación de capital circulante', 'wcChange']]]];
export function periodLabel(point) {
  if (!point) return 'Periodo N/D';
  const basis = point.basis === 'instant' ? 'A fecha de' : point.basis || 'Tipo N/D';
  return `${basis} · ${point.periodStart ? point.periodStart + ' → ' : ''}${point.periodEnd || point.fiscalYear || point.year || 'fecha N/D'}${!point.periodEnd ? ' (fecha exacta N/D)' : ''}`;
}
export function statementRows(data, fields, history) {
  return fields.flatMap(([label, key]) => {
    const points = history ? [...(data[key + 'History'] || [])] : [{
      ...(data.financialPeriods?.[key + 'Val'] || data.financialPeriods?.[key] || data.financialIntegrity?.fields?.[key === 'eps' ? 'eps' : key + 'Val']?.period),
      val: data[key + 'Val'] ?? (key === 'eps' ? data.eps : null)
    }];
    // Display-only union: excluded manual years stay accessible without entering
    // the annual series consumed by charts, scoring and valuations.
    if(history&&!['eps','fcf'].includes(key))for(const r of data.manualCorrections||[]){
      const prefix=`history:${key}History:`;
      if(r.target.startsWith(prefix)){
        const year=r.target.slice(prefix.length),index=points.findIndex(p=>String(p.year)===year);
        const point={...r.period,year,val:r.value};
        if(index<0)points.push(point);else points[index]=point;
      }
    }
    return points.map((point, index) => {
      const value = key === 'eps' && history ? point.eps : point.val;
      const fieldState = !history ? data.financialIntegrity?.fields?.[key === 'eps' ? 'eps' : key + 'Val'] : null;
      const directTarget=history?`history:${key}History:${point.year||point.periodEnd?.slice(0,4)}`:key==='eps'?'eps':key+'Val';
      const manual=data.manualCorrections?.find(r=>r.target===directTarget);
      const formatted = key.startsWith('shares') ? Number.isFinite(value) ? `${value.toLocaleString('es-ES')} acciones` : 'N/D' : financialText(value, point, data);
      return {
        label,
        showStoredValue:!['eps','fcf'].includes(key)||!history,
        editTarget:history?`history:${key==='eps'?'ni':key==='fcf'?'operatingCF':key}History:${point.year||point.periodEnd?.slice(0,4)}`:key==='eps'?'eps':key+'Val',
        editLabel:history&&key==='eps'?'Beneficio neto del ejercicio (base del BPA)':history&&key==='fcf'?'Flujo operativo del ejercicio (base del FCF)':label,
        point:history?(key==='eps'?(data.niHistory||[]).find(p=>String(p.year)===String(point.year)):key==='fcf'?(data.operatingCFHistory||[]).find(p=>String(p.year)===String(point.year)):point):null,
        key: `${key}-${index}`,
        period: periodLabel(point),
        value: formatted,
        source: point.source || data.financialSource || 'Fuente individual N/D',
        scope: point.scope || 'Perímetro N/D',
        status: manual?.modelExcluded?'Manual · excluido de cálculos':fieldState?.status === 'blocked' ? 'Incompatible' : point.manual||fieldState?.manual?'Manual':formatted === 'N/D' ? 'Ausente' : fieldState?.status === 'verified' || (history && validPeriod(point) && point.currency && point.source && point.scope && point.scope !== 'provider-unspecified') ? 'Verificado' : 'Provisional',
        reason: manual?.reason||fieldState?.reason || null
      };
    });
  });
}
// Yahoo/SEC adapter histories keep net income in val and per-share earnings in eps.
export function growthPoints(data, key) {
  return (data[key] || []).map(point => key === 'epsHistory' ? {
    ...point,
    val: point.eps
  } : point);
}
