import { computeWACC } from '../stockScoring.js';
import { isNum } from './util.js';

// Cost of capital used as the hurdle for ROIC and as the DCF discount rate. Reuses the
// repository's existing CAPM/WACC (risk-free + beta x 4.5% ERP, sector-clamped) so there is a
// single definition. When it cannot be computed, a clearly labelled assumption is returned
// instead of a hidden default.
export const FALLBACK_WACC = 0.09;

export function costOfCapital(inp) {
  const rf = isNum(inp.riskFreeRate) ? inp.riskFreeRate : null;
  const w = rf != null ? computeWACC(inp.raw || {}, rf) : null;
  if (isNum(w)) return { value: w, assumed: false, note: 'WACC por CAPM (tipo sin riesgo + beta x prima de riesgo 4,5%), acotado al rango habitual del sector.' };
  return { value: FALLBACK_WACC, assumed: true, note: `No hay tipo sin riesgo o capitalización para estimar el coste del capital: se usa un ${(FALLBACK_WACC * 100).toFixed(0)}% como supuesto orientativo.` };
}

export function effectiveTaxRate(inp) {
  if (isNum(inp.tax) && isNum(inp.ebt) && inp.ebt > 0) {
    return { value: Math.min(0.30, Math.max(0.05, inp.tax / inp.ebt)), assumed: false };
  }
  return { value: 0.21, assumed: true };
}
