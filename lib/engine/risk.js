// Dimension D: RISK. Independent evaluation. Each category is one of:
//   confirmed      -> the data shows it
//   potential      -> the data suggests it or the sector implies it, not proven
//   none_detected  -> evaluated with data, nothing found
//   not_evaluable  -> no data; this is NOT the same as "no risk"
// The overall level is computed only from evaluable categories and is withheld ("no
// concluyente") when fewer than half the categories could be evaluated.

import { isNum, round, fmtMoney } from './util.js';
import { sustainableGrowth } from './valuation.js';
import { tierForScore } from './tierScale.js';

const SEV = { confirmed: 3, potential: 1.5, none_detected: 0 };

export const RISK_CATEGORIES = [
  'leverage', 'liquidity', 'refinancing', 'dilution', 'customerConcentration', 'supplierDependence',
  'cyclicality', 'regulatory', 'marginDeterioration', 'growthDependence', 'accountingQuality',
  'stockCompensation', 'valuationRisk',
];

export function computeRisk(inp, profile, ctx = {}) {
  const items = [];
  const add = (id, label, status, evidence, extra = {}) => items.push({ id, label, status, evidence, ...extra });
  const kind = profile.kind;
  const isFin = kind === 'financial';

  // Leverage
  if (isFin) add('leverage', 'Endeudamiento', 'not_evaluable', 'En un banco el apalancamiento es parte del negocio; haría falta el ratio de capital regulatorio, que no está en las fuentes actuales.');
  else if (isNum(inp.netDebt) && isNum(inp.ebitda)) {
    if (inp.netDebt <= 0) add('leverage', 'Endeudamiento', 'none_detected', 'Tiene más caja que deuda financiera.');
    else if (inp.ebitda <= 0) add('leverage', 'Endeudamiento', 'confirmed', 'Tiene deuda neta y su EBITDA es negativo: no puede pagarla con lo que genera.');
    else {
      const nd = inp.netDebt / inp.ebitda;
      const limit = kind === 'reit' ? 7 : 4;
      add('leverage', 'Endeudamiento', nd > limit ? 'confirmed' : nd > limit * 0.6 ? 'potential' : 'none_detected', `Deuda neta de ${nd.toFixed(1)} veces el EBITDA.`);
    }
  } else add('leverage', 'Endeudamiento', 'not_evaluable', 'Falta la deuda o la caja para calcular deuda neta.');

  // Liquidity / runway
  if (isNum(inp.fcf) && inp.fcf < 0 && isNum(inp.cash)) {
    const years = inp.cash / Math.abs(inp.fcf);
    add('liquidity', 'Liquidez', years < 1.5 ? 'confirmed' : years < 3 ? 'potential' : 'none_detected', `Quema ${fmtMoney(Math.abs(inp.fcf))} al año y tiene caja para ${years.toFixed(1)} años a este ritmo.`);
  } else if (isNum(inp.currentAssets) && isNum(inp.currentLiabilities) && inp.currentLiabilities > 0 && !isFin && kind !== 'reit') {
    const cr = inp.currentAssets / inp.currentLiabilities;
    add('liquidity', 'Liquidez', cr < 0.8 ? 'potential' : 'none_detected', `Liquidez corriente de ${cr.toFixed(2)}.`);
  } else add('liquidity', 'Liquidez', 'not_evaluable', 'Faltan datos de balance corriente.');

  // Refinancing: needs the maturity ladder, which we do not have.
  if (isNum(inp.netDebt) && isNum(inp.ebitda) && inp.ebitda > 0 && isNum(inp.oi) && isNum(inp.interest) && inp.interest > 0 && inp.netDebt / inp.ebitda > 3 && inp.oi / inp.interest < 3) {
    add('refinancing', 'Refinanciación', 'potential', `Deuda alta (${(inp.netDebt / inp.ebitda).toFixed(1)}x EBITDA) y cobertura de intereses de solo ${(inp.oi / inp.interest).toFixed(1)}x: refinanciar a tipos más altos le costaría caro. No hay calendario de vencimientos para confirmarlo.`);
  } else if (inp.debt === 0) add('refinancing', 'Refinanciación', 'none_detected', 'No consta deuda financiera.');
  else add('refinancing', 'Refinanciación', 'not_evaluable', 'Sin calendario de vencimientos de deuda no se puede evaluar.');

  // Dilution
  if (inp.shareDilutionPct != null) {
    const yrs = Math.max(1, inp.shareHistoryYears - 1);
    const annual = Math.pow(1 + inp.shareDilutionPct, 1 / yrs) - 1;
    add('dilution', 'Dilución', annual > 0.04 ? 'confirmed' : annual > 0.015 ? 'potential' : 'none_detected', `El número de acciones ha cambiado un ${(inp.shareDilutionPct * 100).toFixed(1)}% en ${yrs} años (${(annual * 100).toFixed(1)}% anual).`, { annualDilution: round(annual, 4) });
  } else add('dilution', 'Dilución', 'not_evaluable', 'No hay historial de acciones.');

  // Concentration / suppliers: only from explicit data.
  if (inp.concentration && isNum(inp.concentration.topCustomerPct)) {
    const p = inp.concentration.topCustomerPct;
    add('customerConcentration', 'Concentración de clientes', p > 0.25 ? 'confirmed' : p > 0.10 ? 'potential' : 'none_detected', `Su mayor cliente supone el ${(p * 100).toFixed(0)}% de los ingresos.`);
  } else add('customerConcentration', 'Concentración de clientes', 'not_evaluable', 'Las fuentes estructuradas no incluyen la concentración de clientes. Revísalo en el informe anual (10-K).');
  if (inp.concentration && isNum(inp.concentration.topSupplierPct)) {
    const p = inp.concentration.topSupplierPct;
    add('supplierDependence', 'Dependencia de proveedores', p > 0.3 ? 'confirmed' : p > 0.15 ? 'potential' : 'none_detected', `Un proveedor concentra el ${(p * 100).toFixed(0)}% de sus compras.`);
  } else add('supplierDependence', 'Dependencia de proveedores', 'not_evaluable', 'Sin datos estructurados de proveedores. Revísalo en el informe anual (10-K).');

  // Cyclicality
  add('cyclicality', 'Ciclicidad', kind === 'cyclical' ? 'confirmed' : 'none_detected',
    kind === 'cyclical' ? 'Sus resultados dependen del ciclo o de un precio externo: los beneficios actuales pueden no repetirse.' : 'Ni su sector ni su historia de ingresos y márgenes muestran un patrón cíclico marcado.');

  // Regulatory: sector-level only, honest about it.
  const regSectors = ['financial', 'healthcare', 'utilities', 'energy', 'telecom'];
  if (regSectors.includes(inp.benchKey)) add('regulatory', 'Riesgo regulatorio', 'potential', 'Su sector está sujeto a regulación intensa (precios, licencias o capital). Es una nota de sector, no un riesgo concreto detectado en esta empresa.');
  else add('regulatory', 'Riesgo regulatorio', 'not_evaluable', 'No hay datos estructurados de riesgo regulatorio de esta empresa. Revisa la sección de riesgos del 10-K.');

  // Margin deterioration (uses momentum)
  if (ctx.momentum && ctx.momentum.latest && ctx.momentum.latest.marginDeltaPoints != null) {
    const d = ctx.momentum.latest.marginDeltaPoints;
    add('marginDeterioration', 'Deterioro de márgenes', d <= -3 ? 'confirmed' : d <= -1 ? 'potential' : 'none_detected', `El margen operativo ha cambiado ${d >= 0 ? '+' : ''}${d.toFixed(1)} puntos frente al mismo periodo anterior.`);
  } else add('marginDeterioration', 'Deterioro de márgenes', 'not_evaluable', 'No hay historial para comparar márgenes.');

  // Growth dependence: price only makes sense if growth continues.
  const g = sustainableGrowth(inp);
  if (ctx.valuation?.impliedReturn && g != null) {
    const yieldPart = ctx.valuation.impliedReturn.yield;
    const hurdle = ctx.valuation.impliedReturn.hurdle;
    const needed = hurdle - yieldPart;
    add('growthDependence', 'Dependencia del crecimiento futuro', needed > 0.08 ? 'confirmed' : needed > 0.05 ? 'potential' : 'none_detected', `La rentabilidad por caja es ${(yieldPart * 100).toFixed(1)}%: para llegar al ${(hurdle * 100).toFixed(1)}% de coste del capital necesita crecer cerca de un ${(Math.max(0, needed) * 100).toFixed(1)}% anual de forma sostenida.`);
  } else add('growthDependence', 'Dependencia del crecimiento futuro', 'not_evaluable', 'Sin rentabilidad por caja o beneficio no se puede medir cuánto crecimiento descuenta el precio.');

  // Accounting quality: accruals and cash conversion
  if (!isFin && isNum(inp.ni) && isNum(inp.fcf) && isNum(inp.assets) && inp.assets > 0 && inp.ni > 0) {
    const accrual = (inp.ni - inp.fcf) / inp.assets;
    add('accountingQuality', 'Calidad contable', accrual > 0.10 ? 'confirmed' : accrual > 0.05 ? 'potential' : 'none_detected', `Diferencia entre beneficio y caja libre del ${(accrual * 100).toFixed(1)}% de los activos${accrual > 0.05 ? ': el beneficio contable no se está convirtiendo en caja' : ''}.`);
  } else add('accountingQuality', 'Calidad contable', 'not_evaluable', 'Sin beneficio positivo o activos no se puede evaluar la calidad de los beneficios.');

  // Stock compensation
  if (isNum(inp.sbc) && isNum(inp.rev) && inp.rev > 0) {
    const p = inp.sbc / inp.rev;
    add('stockCompensation', 'Remuneración en acciones', p > 0.10 ? 'confirmed' : p > 0.05 ? 'potential' : 'none_detected', `Remuneración en acciones del ${(p * 100).toFixed(1)}% de los ingresos${isNum(inp.fcf) && inp.fcf > 0 ? ` y ${(inp.sbc / inp.fcf * 100).toFixed(0)}% de la caja libre` : ''}.`);
  } else add('stockCompensation', 'Remuneración en acciones', 'not_evaluable', 'No consta la remuneración en acciones.');

  // Valuation risk
  if (ctx.valuation && ctx.valuation.score != null) {
    const s = ctx.valuation.score;
    add('valuationRisk', 'Riesgo de valoración', s < 30 ? 'confirmed' : s < 45 ? 'potential' : 'none_detected', `La valoración puntúa ${s}/100 (más bajo = más exigente).`);
  } else add('valuationRisk', 'Riesgo de valoración', 'not_evaluable', 'No se pudo puntuar la valoración.');

  const evaluable = items.filter((i) => i.status !== 'not_evaluable');
  const coverage = evaluable.length / items.length;
  const sevTotal = evaluable.reduce((a, i) => a + SEV[i.status], 0);
  const maxPossible = evaluable.length * 3;
  const level = maxPossible ? (sevTotal / maxPossible) * 100 : null;
  const confirmed = items.filter((i) => i.status === 'confirmed');
  const potential = items.filter((i) => i.status === 'potential');
  const notEvaluable = items.filter((i) => i.status === 'not_evaluable');

  let overall;
  if (coverage < 0.5 || level == null) overall = 'no_concluyente';
  else if (confirmed.length >= 3 || level >= 55) overall = 'alto';
  else if (confirmed.length >= 2 || level >= 35) overall = 'elevado';
  else if (confirmed.length >= 1 || level >= 18 || potential.length >= 3) overall = 'moderado';
  else overall = 'bajo';
  const labels = { no_concluyente: 'No concluyente', alto: 'Riesgo alto', elevado: 'Riesgo elevado', moderado: 'Riesgo moderado', bajo: 'Riesgo bajo entre los evaluables' };
  // Shared tier letter (lib/engine/tierScale.js), same scale as Calidad/Valoración/Potencial —
  // inverted (100 - level) since `level` runs the opposite way (higher = more risk). No range: a
  // weight-set sensitivity check doesn't have a natural analog here (risk isn't a weighted
  // combination of swappable "lenses" the way the other three dimensions are), so just the
  // single tier, null whenever `overall` itself is withheld for the same low-coverage reason.
  const tier = overall === 'no_concluyente' ? null : tierForScore(100 - level);
  return {
    items, overall, label: labels[overall], level: round(level, 0), coverage: round(coverage, 2), tier,
    counts: { confirmed: confirmed.length, potential: potential.length, notEvaluable: notEvaluable.length, evaluated: evaluable.length, total: items.length },
    caveat: notEvaluable.length ? `${notEvaluable.length} de ${items.length} riesgos no se pueden evaluar con las fuentes actuales. Que no se vean no significa que no existan.` : null,
  };
}
