// Dimension E: INVESTMENT POTENTIAL. Integrates quality, valuation, momentum and risk without
// merging them: the four inputs stay visible and the result is an explicit, reproducible
// formula with documented weights, gating caps and a sensitivity check.
//
// Base weights (documented judgement, tested for sensitivity below):
//   valuation 0.35  (price paid is the main driver of the return you will actually get)
//   quality   0.30  (a better business compounds value and tolerates errors)
//   risk      0.20  (score = 100 - risk level)
//   momentum  0.15  (direction of travel; the least reliable input, so the lowest weight)
// Gating caps (a weak pillar cannot be averaged away by strong ones):
//   valuation < 30 -> max 60      quality < 40 -> max 55
//   overall risk 'alto' -> max 50 central-scenario CAGR < 0 -> max 45
//   central-scenario CAGR < 4% (about a risk-free return) -> max 64
// Sensitivity: the score is recomputed under 4 weight sets; if the spread is > 15 points the
// result is flagged as depending on the weights.

import { isNum, round } from './util.js';
import { TIER_LABELS, tierForScore } from './tierScale.js';

export const POTENTIAL_WEIGHTS = { valuation: 0.35, quality: 0.30, risk: 0.20, momentum: 0.15 };
export const WEIGHT_SETS = {
  base: POTENTIAL_WEIGHTS,
  qualityHeavy: { valuation: 0.25, quality: 0.45, risk: 0.20, momentum: 0.10 },
  valuationHeavy: { valuation: 0.50, quality: 0.20, risk: 0.20, momentum: 0.10 },
  equal: { valuation: 0.25, quality: 0.25, risk: 0.25, momentum: 0.25 },
};
const MOMENTUM_POINTS = { confirmed_improvement: 85, possible_improvement: 68, stable: 52, mixed: 45, possible_deterioration: 28, confirmed_deterioration: 12 };
// Shared 7-tier letter scale (lib/engine/tierScale.js) — same one Calidad and Valoración use, so
// a given letter means the same thing in every dimension, instead of Potencial's own 4-word
// scheme ("Potencial atractivo" etc.) with different cutoffs (40/55/70) than everywhere else.
const LABELS = TIER_LABELS;
function labelFor(score) { return tierForScore(score); }

function weighted(parts, w) {
  let ws = 0, s = 0;
  Object.keys(w).forEach((k) => { if (isNum(parts[k])) { ws += w[k]; s += w[k] * parts[k]; } });
  return ws > 0 ? s / ws : null;
}

export function computePotential({ quality, valuation, momentum, risk, scenarios, dataQuality }) {
  if (quality.score == null || valuation.score == null) {
    return { score: null, label: 'No concluyente', reason: `No se calcula el potencial porque falta ${quality.score == null ? 'la calidad' : 'la valoración'} (${quality.score == null ? quality.reasonNull : valuation.reasonNull})`, pattern: null, caps: [], sensitivity: null };
  }
  if (dataQuality?.hasErrors) {
    return { score: null, label: 'No concluyente', reason: 'Hay errores de coherencia en los datos (ver validaciones): no se calcula el potencial hasta resolverlos.', pattern: null, caps: [], sensitivity: null };
  }
  const parts = {
    valuation: valuation.score,
    quality: quality.score,
    risk: risk.overall === 'no_concluyente' || risk.level == null ? null : 100 - risk.level,
    momentum: MOMENTUM_POINTS[momentum.status] ?? null,
  };
  const results = Object.fromEntries(Object.entries(WEIGHT_SETS).map(([k, w]) => [k, weighted(parts, w)]));
  const cagrC = scenarios?.status === 'ok' ? scenarios.scenarios.find((s) => s.key === 'central')?.cagr : null;
  // The gating caps depend only on quality/valuation/risk/the scenario's CAGR, never on how the
  // four pillars are weighted — so the same caps apply whichever weight set produced the raw
  // number. Applied once here and reused for every weight set below (previously only applied to
  // the base weighting, so the alternate weightings shown in `sensitivity` could look less
  // capped than they'd actually be, overstating how much "better" a different weighting makes
  // a capped stock look).
  function applyCaps(raw) {
    if (!isNum(raw)) return { score: null, caps: [] };
    let score = raw;
    const caps = [];
    const cap = (limit, why) => { if (score > limit) { score = limit; caps.push(why); } };
    if (valuation.score < 30) cap(60, 'La valoración es muy exigente: aunque el negocio sea excelente, un precio excesivo limita la rentabilidad futura.');
    if (quality.score < 40) cap(55, 'La calidad del negocio es baja: una valoración barata no garantiza que recupere su valor.');
    if (risk.overall === 'alto') cap(50, 'El nivel de riesgo es alto.');
    if (isNum(cagrC) && cagrC < 0) cap(45, 'El escenario central proyecta una rentabilidad anual negativa a cinco años.');
    else if (isNum(cagrC) && cagrC < 0.04) cap(64, 'El escenario central proyecta menos de un 4% anual: una rentabilidad parecida a la de un activo sin riesgo.');
    return { score: Math.round(score), caps };
  }
  const capped = Object.fromEntries(Object.entries(results).map(([k, v]) => [k, applyCaps(v)]));
  const score = capped.base.score;
  const caps = capped.base.caps;

  const vals = Object.values(capped).map((c) => c.score).filter(isNum);
  const spread = Math.max(...vals) - Math.min(...vals);
  const label = labelFor(score);
  // The word shown to the user instead of the bare number: the label the score actually gets,
  // widened into a range when a different (still reasonable) weighting would land on a
  // different word — e.g. "Potencial moderado a atractivo" rather than a single "66" that implied
  // more precision than the weighting-sensitivity check below says the number actually has.
  const wordIdxs = vals.map((v) => LABELS.indexOf(labelFor(v)));
  const lowLabel = LABELS[Math.min(...wordIdxs)];
  const highLabel = LABELS[Math.max(...wordIdxs)];
  const labelRange = lowLabel === highLabel ? null : { low: lowLabel, high: highLabel };

  let pattern;
  if (quality.score >= 70 && valuation.score < 40) pattern = { id: 'good_business_expensive', text: 'Buen negocio, precio exigente: puede ser una gran empresa y aun así una compra poco atractiva al precio actual.' };
  else if (quality.score < 45 && valuation.score >= 65) pattern = { id: 'cheap_weak_business', text: 'Barata, pero con un negocio débil: que cotice barata no garantiza que recupere su valor.' };
  else if (quality.score >= 70 && valuation.score >= 60) pattern = { id: 'good_business_fair_price', text: 'Buen negocio a un precio razonable: es la combinación que más interesa estudiar con detalle.' };
  else pattern = { id: 'mixed', text: 'Las dimensiones no apuntan en la misma dirección: conviene revisar cada una por separado.' };

  return {
    score, label, pattern, caps, parts: Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, round(v, 0)])),
    weights: POTENTIAL_WEIGHTS,
    missingParts: Object.keys(parts).filter((k) => parts[k] == null),
    sensitivity: {
      byWeightSet: Object.fromEntries(Object.entries(capped).map(([k, v]) => [k, v.score])),
      spread: round(spread, 0),
      dependsOnWeights: spread > 15,
      note: spread > 15 ? 'El resultado cambia más de 15 puntos según cómo se ponderen las dimensiones: no lo tomes como una cifra precisa.' : 'El resultado es estable ante distintas ponderaciones razonables.',
      labelRange,
    },
    notAdvice: 'Es una puntuación orientativa para estudiar, no una recomendación de compra ni de venta.',
  };
}
