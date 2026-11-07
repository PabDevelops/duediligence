// Dimension C: VALUATION (0-100, higher = cheaper relative to what the business delivers).
// Independent of quality. Only methods that make sense for the business model are used; the
// rest are listed as discarded with the reason. Score is null when there is not enough to
// support it (fewer than 2 scoreable signals, or a structurally loss-making business).
//
// Per-multiple score: position of the multiple inside the sector's orientative
// [cheap, fair, rich] band: <= cheap*0.5 -> 100, cheap -> 82, fair -> 55, rich -> 25,
// >= rich*1.8 -> 0 (linear in between).
// Implied return: FCF yield (after stock-based compensation) + sustainable growth (capped at
// 8%), compared with the cost of capital.
// Final = 0.65 * mean(multiple scores) + 0.35 * implied-return score (renormalized if one side
// is missing). Documented adjustments: net debt > 4x EBITDA -> -8; cyclical earnings in the
// upper part of their own cycle -> cap 60.

import { isNum, interp, median, div, round, clamp, cagr } from './util.js';
import {valuationEarnings} from '../valuationEarnings.js';
import { methodsForProfile } from './profile.js';
import { costOfCapital } from './cost_of_capital.js';
import { TIER_LABELS, tierForScore } from './tierScale.js';

export const VALUATION_WEIGHTS = { multiples: 0.65, impliedReturn: 0.35 };
// Alternate weightings, same spirit as quality.js's QUALITY_WEIGHT_SETS and potential.js's
// WEIGHT_SETS: documented judgement, used only to check how much the tier letter would change
// under a different reasonable view of which signal matters most (the multiples themselves, or
// the forward-looking implied-return read), never to pick a flattering number. Neither extreme
// zeroes out a whole signal — same reasoning as the other two: a "lens" still looks at both.
export const VALUATION_WEIGHT_SETS = {
  base: VALUATION_WEIGHTS,
  multiplesHeavy: { multiples: 0.85, impliedReturn: 0.15 },
  impliedReturnHeavy: { multiples: 0.40, impliedReturn: 0.60 },
  equal: { multiples: 0.50, impliedReturn: 0.50 },
};

const METHOD_LABEL = {
  pe: 'P/E (precio / beneficio)', forwardPe: 'P/E a futuro', evEbitda: 'EV/EBITDA', evEbit: 'EV/EBIT',
  evSales: 'EV/ventas', pfcf: 'P/FCF (tras remuneración en acciones)', fcfYield: 'Rentabilidad por caja libre', pb: 'Precio / valor contable',
};

function scoreMultiple(v, band) {
  const [cheap, fair, rich] = band;
  if (!isNum(v) || v <= 0 || !cheap || !fair || !rich) return null;
  return interp(v, [[cheap * 0.5, 100], [cheap, 82], [fair, 55], [rich, 25], [rich * 1.8, 0]]);
}

export function valuationLabel(score) {
  if (score == null) return 'No valorable con los datos actuales';
  if (score >= 70) return 'Valoración atractiva';
  if (score >= 55) return 'Valoración razonable';
  if (score >= 35) return 'Valoración exigente';
  return 'Valoración muy exigente';
}

export function sustainableGrowth(inp) {
  const r = inp.revH.slice(-4);
  const c3 = r.length >= 3 ? cagr(r[0].val, r[r.length - 1].val, r[r.length - 1].y - r[0].y) : null;
  const ttm = inp.revGrowthTTM;
  const vals = [c3, ttm].filter(isNum);
  return vals.length ? median(vals) : null;
}

// Mirrors computeScenarios/computePotential's own gating on validation.hasErrors (see index.js):
// confirmed on real data (NLY, a mortgage REIT) that computeValuation had no such gate, so a
// company the validator had already flagged with a hard data error (HISTORY_NEGATIVE_REVENUE)
// still produced a confident, standalone "Valoración atractiva" shown next to a null quality
// and a withheld potential score.
export function insufficientValuation(reason) {
  return {
    score: null, label: valuationLabel(null), tier: null, sensitivity: null, reasonNull: reason, confidence: 'baja', signalCount: 0,
    methods: [], discarded: [], impliedReturn: null, notes: [], benchmarkKey: null,
    multiples: {}, historicalValuation: { available: false, note: 'No se calcula: hay errores de coherencia en los datos (ver validaciones).' },
    weights: VALUATION_WEIGHTS,
  };
}

export function computeValuation(inp, profile) {
  const kind = profile.kind;
  const bench = inp.bench;
  const earnings=valuationEarnings(inp.raw);
  const earningsValue=earnings.adjustments.length?earnings.value:inp.ni;
  const { applicable, discarded } = methodsForProfile(kind, {...inp,ni:earningsValue});
  // Operating losses do not prove net losses. A documented positive annual net
  // result can support P/E without reclassifying the business or its scenarios.
  if(earnings.comparable&&earningsValue>0&&['structurallyUnprofitable','temporarilyUnprofitable','recovery'].includes(kind)&&!applicable.includes('pe')){
    applicable.push('pe');const index=discarded.findIndex(x=>x.method==='pe');if(index>=0)discarded.splice(index,1);
  }
  if(earnings.adjustments.length&&earnings.value==null){const item=discarded.find(x=>x.method==='pe');if(item)item.reason=earnings.reason;}
  const notes = [];
  if(earnings.adjustments.length)notes.push(`Beneficio contable: ${earnings.reported?.toLocaleString('es-ES')} ${earnings.period?.currency||''}. P/E contable: ${earnings.reportedPe!=null?earnings.reportedPe.toFixed(2)+'x':'N/D'}. ${earnings.reason}`);
  const wacc = costOfCapital(inp);
  const mc = inp.marketCap;

  const fcfAdj = isNum(inp.fcf) ? inp.fcf - (inp.sbc ?? 0) : null;
  const normalizedOi = (() => {
    if (kind !== 'cyclical') return null;
    const ms = inp.revH.map((r) => { const o = inp.oiH.find((x) => x.y === r.y); return o && r.val > 0 ? o.val / r.val : null; }).filter(isNum).slice(-7);
    return ms.length >= 4 && isNum(inp.rev) ? median(ms) * inp.rev : null;
  })();

  const raw = {
    pe: isNum(earningsValue) && earningsValue > 0 && mc ? mc / earningsValue : null,
    forwardPe: inp.forwardPE,
    evEbitda: inp.ev != null && inp.ebitda > 0 ? inp.ev / inp.ebitda : null,
    evEbit: inp.ev != null ? (kind === 'cyclical' && normalizedOi > 0 ? inp.ev / normalizedOi : (inp.oi > 0 ? inp.ev / inp.oi : null)) : null,
    evSales: inp.ev != null && inp.rev > 0 ? inp.ev / inp.rev : null,
    pfcf: fcfAdj != null && fcfAdj > 0 && mc ? mc / fcfAdj : null,
    fcfYield: fcfAdj != null && mc ? fcfAdj / mc : null,
    pb: inp.priceToBook,
  };
  if (kind === 'cyclical' && normalizedOi > 0) notes.push('EV/EBIT calculado sobre el margen operativo mediano de los últimos años, no sobre el del último año.');
  // The P/E shown elsewhere in the UI comes straight from the data source (often a TTM EPS
  // basis); this function always recomputes its own from annual net income / shares, to score
  // consistently with the rest of the engine's annual-basis figures. Confirmed on real data
  // (DAVE, HUBS, PNC, TSM) that these two numbers can differ by 20%+ without either being wrong
  // — they're just different bases — so the gap is surfaced instead of silently picking one.
  if (!earnings.adjustments.length && isNum(inp.pe) && inp.pe > 0 && isNum(raw.pe) && raw.pe > 0) {
    const peDiff = Math.abs(inp.pe - raw.pe) / raw.pe;
    if (peDiff > 0.15) notes.push(`El P/E de la ficha (${round(inp.pe, 1)}x) difiere del usado aquí (${round(raw.pe, 1)}x) porque este cálculo parte del beneficio neto anual entre acciones en circulación; la diferencia suele venir de un BPA TTM frente a uno anual, o de acciones básicas frente a diluidas.`);
  }

  const methods = [];
  let evSalesBand = bench.evSales;
  if (evSalesBand && isNum(inp.grossMargin) && isNum(bench.grossMargin)) {
    const f = clamp(inp.grossMargin / bench.grossMargin, 0.5, 2);
    evSalesBand = evSalesBand.map((x) => x * f);
  }
  const bands = { pe: bench.pe, forwardPe: bench.pe, evEbitda: bench.evEbitda, evEbit: bench.evEbit, evSales: evSalesBand, pfcf: bench.pfcf, pb: bench.pb };

  applicable.forEach((id) => {
    if (id === 'fcfYield') return; // folded into the implied-return signal below
    const v = raw[id];
    const band = bands[id];
    if (v == null || !band) return;
    const s = scoreMultiple(v, band);
    if (s == null) return;
    methods.push({ id, label: METHOD_LABEL[id], value: round(v, 2), unit: 'x', band, score: round(s, 0), orientative: true });
  });
  // Methods that were "applicable" but gave no number go to discarded with the reason.
  applicable.forEach((id) => {
    if (id !== 'fcfYield' && !methods.find((m) => m.id === id)) discarded.push({ method: id, reason: 'No hay dato suficiente en las fuentes actuales o el sector no tiene referencia.' });
  });

  // Implied return = FCF yield (or earnings yield for financials) + sustainable growth.
  let impliedReturn = null;
  const g = sustainableGrowth(inp);
  const gCap = g == null ? null : clamp(g, -0.10, 0.08);
  // Some sectors have their own benchmark explicitly marked "not applicable" for P/FCF (e.g.
  // utilities: heavy regulated capex makes negative FCF the normal case, not a red flag) — a
  // flag that already exists in benchmarks.js but, until now, was only consulted by the
  // per-multiple scoring below, never by this implied-return path. Confirmed on real data
  // (Southern Co, SO): without this check, a structurally-negative-FCF utility gets its implied
  // return dragged down by a multiple its own sector band says shouldn't be used.
  const fcfNotApplicable = !bench.pfcf || (bench.pfcf[0] === 0 && bench.pfcf[1] === 0 && bench.pfcf[2] === 0);
  const yieldUsed = kind === 'financial' || kind === 'reit' || fcfNotApplicable
    ? (raw.pe ? 1 / raw.pe : null)
    : (applicable.includes('fcfYield') ? raw.fcfYield : (raw.pe ? 1 / raw.pe : null));
  if (yieldUsed != null && gCap != null && kind !== 'structurallyUnprofitable' && kind !== 'unknown') {
    const ret = yieldUsed + gCap;
    const hurdle = kind === 'financial' ? 0.10 : wacc.value;
    const usingEarningsYield = kind === 'financial' || raw.fcfYield == null || fcfNotApplicable;
    impliedReturn = {
      yield: round(yieldUsed, 4), growth: round(gCap, 4), value: round(ret, 4), hurdle: round(hurdle, 4),
      score: round(interp(ret - hurdle, [[-0.08, 0], [-0.04, 25], [0, 50], [0.03, 68], [0.07, 88], [0.12, 100]]), 0),
      note: `Rentabilidad implícita = ${usingEarningsYield ? 'rentabilidad por beneficio' : 'rentabilidad por caja libre'} (${(yieldUsed * 100).toFixed(1)}%) + crecimiento sostenible (${(gCap * 100).toFixed(1)}%) frente al coste del capital (${(hurdle * 100).toFixed(1)}%).${fcfNotApplicable ? ' El flujo de caja libre no es el indicador adecuado para este sector (capex estructuralmente alto), se usa el beneficio.' : ''}`,
    };
  }

  // Aggregate
  const multScores = methods.map((m) => m.score);
  const signalCount = multScores.length + (impliedReturn ? 1 : 0);

  // Both adjustments below depend only on the business's own numbers (debt/EBITDA, current vs.
  // historical margin), never on how multiples vs. implied return are weighted — computed once
  // and applied identically under every weight set in scoreWith(), so the alternate weightings
  // checked by `sensitivity` below never look artificially less capped than the base weighting
  // (same reasoning as potential.js's applyCaps / quality.js's aggregate()).
  const debtPenalty = isNum(inp.netDebt) && isNum(inp.ebitda) && inp.ebitda > 0 && inp.netDebt / inp.ebitda > 4 ? 8 : 0;
  const cyclicalCap = (() => {
    if (kind !== 'cyclical') return null;
    const ms = inp.revH.map((r) => { const o = inp.oiH.find((x) => x.y === r.y); return o && r.val > 0 ? o.val / r.val : null; }).filter(isNum).slice(-7);
    const med = ms.length >= 4 ? median(ms) : null;
    return med != null && isNum(inp.opMargin) && inp.opMargin > med * 1.25 ? 60 : null;
  })();
  function scoreWith(weights) {
    const parts = [];
    if (multScores.length) parts.push({ w: weights.multiples, s: multScores.reduce((a, b) => a + b, 0) / multScores.length });
    if (impliedReturn) parts.push({ w: weights.impliedReturn, s: impliedReturn.score });
    const wSum = parts.reduce((a, p) => a + p.w, 0);
    if (wSum <= 0) return null;
    let s = parts.reduce((a, p) => a + p.w * p.s, 0) / wSum - debtPenalty;
    if (cyclicalCap != null) s = Math.min(s, cyclicalCap);
    return Math.round(clamp(s, 0, 100));
  }

  let score = null, reasonNull = null, sensitivity = null;
  if (kind === 'structurallyUnprofitable' || kind === 'unknown') {
    reasonNull = kind==='structurallyUnprofitable'
      ? 'No se puntúa la valoración global: el historial presenta pérdidas operativas persistentes. Un beneficio contable positivo aislado no demuestra rentabilidad sostenible. Los múltiplos disponibles se muestran por separado; EV/ventas es solo una referencia.'
      : 'No se puntúa la valoración global: faltan datos para identificar un modelo de negocio y una base de rentabilidad comparables.';
  } else if (signalCount < 2) {
    reasonNull = 'No hay al menos dos métodos aplicables con datos suficientes para puntuar la valoración.';
  } else {
    score = scoreWith(VALUATION_WEIGHTS);
    if (debtPenalty) notes.push('Deuda neta superior a 4 veces el EBITDA: un múltiplo aparentemente bajo exagera lo barata que es.');
    if (cyclicalCap != null) notes.push('Los márgenes actuales están por encima de su mediana histórica: un múltiplo bajo sobre beneficios altos suele ser una trampa, por eso la puntuación se limita.');
    if (kind === 'recovery') notes.push('Empresa en recuperación: el beneficio reciente puede no ser estable, la puntuación es provisional.');

    // Tier letter (same shared scale as Calidad/Potencial), widened into a range only when a
    // different reasonable weighting of multiples vs. implied return actually lands on a
    // different tier — same mechanism as lib/engine/quality.js's sensitivity.
    const byWeightSet = Object.fromEntries(Object.entries(VALUATION_WEIGHT_SETS).map(([k, w]) => [k, scoreWith(w)]));
    const vals = Object.values(byWeightSet).filter(isNum);
    const spread = vals.length ? Math.max(...vals) - Math.min(...vals) : 0;
    const tierIdxs = vals.map((v) => TIER_LABELS.indexOf(tierForScore(v)));
    const lowTier = TIER_LABELS[Math.min(...tierIdxs)];
    const highTier = TIER_LABELS[Math.max(...tierIdxs)];
    sensitivity = {
      byWeightSet, spread: round(spread, 0), dependsOnWeights: spread > 15,
      note: spread > 15 ? 'El resultado cambia más de 15 puntos según cómo se pondere: no lo tomes como una cifra precisa.' : 'El resultado es estable ante distintas ponderaciones razonables.',
      tierRange: lowTier === highTier ? null : { low: lowTier, high: highTier },
    };
  }

  if (isNum(inp.fcf) && isNum(inp.sbc) && inp.fcf > 0 && inp.sbc / inp.fcf > 0.25) notes.push(`La remuneración en acciones equivale al ${(inp.sbc / inp.fcf * 100).toFixed(0)}% de la caja libre: se resta del flujo para valorar, un P/FCF sin restarla parecería más barato.`);
  if (isNum(inp.fcf) && inp.fcf > 0 && raw.pfcf == null && fcfAdj <= 0) notes.push('La caja libre positiva desaparece al restar la remuneración en acciones: no es una caja libre real para el accionista.');

  const unadjustedPfcf = isNum(inp.fcf) && inp.fcf > 0 && mc ? mc / inp.fcf : null;
  const confidence = signalCount >= 4 ? 'alta' : signalCount >= 3 ? 'media' : 'baja';
  return {
    score, label: valuationLabel(score), tier: tierForScore(score), sensitivity, reasonNull, confidence, signalCount,
    methods, discarded: discarded.map((d) => ({ ...d, label: METHOD_LABEL[d.method] ?? d.method })),
    impliedReturn, notes, benchmarkKey: inp.benchKey,
    ...(earnings.adjustments.length?{earningsBasis:earnings}:{}),
    multiples: { ...Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, round(v, 3)])), pfcfUnadjusted: round(unadjustedPfcf, 2) },
    historicalValuation: { available: false, note: 'No hay historial de múltiplos propios en las fuentes actuales: no se compara con su valoración histórica.' },
    weights: VALUATION_WEIGHTS,
  };
}
