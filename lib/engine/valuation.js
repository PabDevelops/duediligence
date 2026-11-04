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
import { methodsForProfile } from './profile.js';
import { costOfCapital } from './cost_of_capital.js';

export const VALUATION_WEIGHTS = { multiples: 0.65, impliedReturn: 0.35 };

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

export function computeValuation(inp, profile) {
  const kind = profile.kind;
  const bench = inp.bench;
  const { applicable, discarded } = methodsForProfile(kind, inp);
  const notes = [];
  const wacc = costOfCapital(inp);
  const mc = inp.marketCap;

  const fcfAdj = isNum(inp.fcf) ? inp.fcf - (inp.sbc ?? 0) : null;
  const normalizedOi = (() => {
    if (kind !== 'cyclical') return null;
    const ms = inp.revH.map((r) => { const o = inp.oiH.find((x) => x.y === r.y); return o && r.val > 0 ? o.val / r.val : null; }).filter(isNum).slice(-7);
    return ms.length >= 4 && isNum(inp.rev) ? median(ms) * inp.rev : null;
  })();

  const raw = {
    pe: isNum(inp.ni) && inp.ni > 0 && mc ? mc / inp.ni : null,
    forwardPe: inp.forwardPE,
    evEbitda: inp.ev != null && inp.ebitda > 0 ? inp.ev / inp.ebitda : null,
    evEbit: inp.ev != null ? (kind === 'cyclical' && normalizedOi > 0 ? inp.ev / normalizedOi : (inp.oi > 0 ? inp.ev / inp.oi : null)) : null,
    evSales: inp.ev != null && inp.rev > 0 ? inp.ev / inp.rev : null,
    pfcf: fcfAdj != null && fcfAdj > 0 && mc ? mc / fcfAdj : null,
    fcfYield: fcfAdj != null && mc ? fcfAdj / mc : null,
    pb: inp.priceToBook,
  };
  if (kind === 'cyclical' && normalizedOi > 0) notes.push('EV/EBIT calculado sobre el margen operativo mediano de los últimos años, no sobre el del último año.');

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
  const yieldUsed = kind === 'financial' || kind === 'reit'
    ? (raw.pe ? 1 / raw.pe : null)
    : (applicable.includes('fcfYield') ? raw.fcfYield : (raw.pe ? 1 / raw.pe : null));
  if (yieldUsed != null && gCap != null && kind !== 'structurallyUnprofitable' && kind !== 'unknown') {
    const ret = yieldUsed + gCap;
    const hurdle = kind === 'financial' ? 0.10 : wacc.value;
    impliedReturn = {
      yield: round(yieldUsed, 4), growth: round(gCap, 4), value: round(ret, 4), hurdle: round(hurdle, 4),
      score: round(interp(ret - hurdle, [[-0.08, 0], [-0.04, 25], [0, 50], [0.03, 68], [0.07, 88], [0.12, 100]]), 0),
      note: `Rentabilidad implícita = ${kind === 'financial' || raw.fcfYield == null ? 'rentabilidad por beneficio' : 'rentabilidad por caja libre'} (${(yieldUsed * 100).toFixed(1)}%) + crecimiento sostenible (${(gCap * 100).toFixed(1)}%) frente al coste del capital (${(hurdle * 100).toFixed(1)}%).`,
    };
  }

  // Aggregate
  const multScores = methods.map((m) => m.score);
  const parts = [];
  if (multScores.length) parts.push({ w: VALUATION_WEIGHTS.multiples, s: multScores.reduce((a, b) => a + b, 0) / multScores.length });
  if (impliedReturn) parts.push({ w: VALUATION_WEIGHTS.impliedReturn, s: impliedReturn.score });
  const signalCount = multScores.length + (impliedReturn ? 1 : 0);

  let score = null, reasonNull = null;
  if (kind === 'structurallyUnprofitable' || kind === 'unknown') {
    reasonNull = 'No se puntúa la valoración: sin beneficios ni caja positivos el precio depende de hipótesis que los datos no pueden verificar. EV/ventas se muestra solo como referencia.';
  } else if (signalCount < 2) {
    reasonNull = 'No hay al menos dos métodos aplicables con datos suficientes para puntuar la valoración.';
  } else {
    const wSum = parts.reduce((a, p) => a + p.w, 0);
    score = parts.reduce((a, p) => a + p.w * p.s, 0) / wSum;
    if (isNum(inp.netDebt) && isNum(inp.ebitda) && inp.ebitda > 0 && inp.netDebt / inp.ebitda > 4) { score -= 8; notes.push('Deuda neta superior a 4 veces el EBITDA: un múltiplo aparentemente bajo exagera lo barata que es.'); }
    if (kind === 'cyclical') {
      const ms = inp.revH.map((r) => { const o = inp.oiH.find((x) => x.y === r.y); return o && r.val > 0 ? o.val / r.val : null; }).filter(isNum).slice(-7);
      const med = ms.length >= 4 ? median(ms) : null;
      if (med != null && isNum(inp.opMargin) && inp.opMargin > med * 1.25) { score = Math.min(score, 60); notes.push('Los márgenes actuales están por encima de su mediana histórica: un múltiplo bajo sobre beneficios altos suele ser una trampa, por eso la puntuación se limita.'); }
    }
    if (kind === 'recovery') notes.push('Empresa en recuperación: el beneficio reciente puede no ser estable, la puntuación es provisional.');
    score = Math.round(clamp(score, 0, 100));
  }

  if (isNum(inp.fcf) && isNum(inp.sbc) && inp.fcf > 0 && inp.sbc / inp.fcf > 0.25) notes.push(`La remuneración en acciones equivale al ${(inp.sbc / inp.fcf * 100).toFixed(0)}% de la caja libre: se resta del flujo para valorar, un P/FCF sin restarla parecería más barato.`);
  if (isNum(inp.fcf) && inp.fcf > 0 && raw.pfcf == null && fcfAdj <= 0) notes.push('La caja libre positiva desaparece al restar la remuneración en acciones: no es una caja libre real para el accionista.');

  const unadjustedPfcf = isNum(inp.fcf) && inp.fcf > 0 && mc ? mc / inp.fcf : null;
  const confidence = signalCount >= 4 ? 'alta' : signalCount >= 3 ? 'media' : 'baja';
  return {
    score, label: valuationLabel(score), reasonNull, confidence, signalCount,
    methods, discarded: discarded.map((d) => ({ ...d, label: METHOD_LABEL[d.method] ?? d.method })),
    impliedReturn, notes, benchmarkKey: inp.benchKey,
    multiples: { ...Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, round(v, 3)])), pfcfUnadjusted: round(unadjustedPfcf, 2) },
    historicalValuation: { available: false, note: 'No hay historial de múltiplos propios en las fuentes actuales: no se compara con su valoración histórica.' },
    weights: VALUATION_WEIGHTS,
  };
}
