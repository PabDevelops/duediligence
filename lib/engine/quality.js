// Dimension A: BUSINESS QUALITY (0-100), independent of price.
//
// Score = weighted average of the components that could be computed, renormalized over the
// weights actually available. Returns score=null (never a made-up number) when the essential
// coverage is not met. Quality is NOT a moat: moat is reported separately and, without
// qualitative evidence, is "no determinable".

import { isNum, interp, median, stdev, div, round } from './util.js';
import { costOfCapital, effectiveTaxRate } from './cost_of_capital.js';
import { TIER_LABELS, tierForScore } from './tierScale.js';
import {qualityCashFlowInputs} from '../qualityCashFlowInputs.js';

export const QUALITY_WEIGHTS = {
  returns: 0.22,        // ROIC spread vs cost of capital (ROE vs cost of equity for financials)
  operatingMargin: 0.14,
  grossMargin: 0.06,
  fcfGeneration: 0.14,
  cashConversion: 0.10,
  marginStability: 0.10,
  balance: 0.14,
  reinvestment: 0.05,
  capitalEvolution: 0.05,
};
// Alternate weightings, same spirit as potential.js's WEIGHT_SETS: documented judgement, used
// only to check how much the word shown to the user would change under a different reasonable
// view of what matters most, never to pick a flattering number.
export const QUALITY_WEIGHT_SETS = {
  base: QUALITY_WEIGHTS,
  // Capital-efficiency lens: what you get back on capital employed, and whether that's improving.
  returnsHeavy: { returns: 0.35, operatingMargin: 0.10, grossMargin: 0.04, fcfGeneration: 0.10, cashConversion: 0.06, marginStability: 0.05, balance: 0.10, reinvestment: 0.12, capitalEvolution: 0.08 },
  // Pricing-power lens: margins and how stable they are.
  marginHeavy: { returns: 0.12, operatingMargin: 0.22, grossMargin: 0.14, fcfGeneration: 0.10, cashConversion: 0.08, marginStability: 0.18, balance: 0.10, reinvestment: 0.03, capitalEvolution: 0.03 },
  equal: Object.fromEntries(Object.keys(QUALITY_WEIGHTS).map((k) => [k, 1 / Object.keys(QUALITY_WEIGHTS).length])),
};
const MIN_COVERAGE = 0.55;
// Tier letters (S+/S/A/B/C/D/F), not a word: a school-grade/tier-list scale reads as more
// immediately recognizable than a bespoke "sólida/aceptable/débil" wording, and still carries no
// false precision the way a bare "86/100" would. Cut points only relabel the existing 0-100
// score — the score itself is computed exactly as before, nothing here changes how it's reached.
// Now the shared scale (lib/engine/tierScale.js) used by every dimension — same cutoffs as
// before this moved, so this is a pure refactor, not a behavior change.
const LABELS = TIER_LABELS;
function qualityLabel(score) {
  return tierForScore(score);
}

function roicSeries(inp, tax) {
  const out = [];
  inp.oiH.forEach((o) => {
    const a = inp.assetsH.find((x) => x.y === o.y);
    const cl = inp.clH.find((x) => x.y === o.y);
    if (!a || !cl) return;
    const ic = a.val - cl.val;
    if (ic > 0) out.push({ y: o.y, nopat: o.val * (1 - tax), capital: ic, roic: (o.val * (1 - tax)) / ic });
  });
  return out;
}

export function computeQuality(inp, profile) {
  const kind = profile.kind;
  const comps = {};
  const notes = [];
  const missing = [];
  const wacc = costOfCapital(inp);
  const tax = effectiveTaxRate(inp);
  const isFin = kind === 'financial';
  const isReit = kind === 'reit';
  const b = inp.bench;
  const cashFlowInputs=qualityCashFlowInputs(inp.raw||{fcfVal:inp.fcf,revVal:inp.rev,niVal:inp.ni,sbcVal:inp.sbc});
  const generation=cashFlowInputs.fcfGeneration.inputs,conversion=cashFlowInputs.cashConversion.inputs;

  // --- Returns -------------------------------------------------------------------------
  let roic = inp.roicReported;
  const manualFields=new Set(inp.raw?.manualCalculation?.fields||[]);
  if (isNum(roic) && roic > 0 && isNum(inp.oi) && inp.oi <= 0) {if(!manualFields.has('roic')){roic = null; notes.push('ROIC descartado: contradice el resultado operativo negativo (posible mezcla de periodos).');}else notes.push('ROIC manual utilizado pese a su discrepancia con el EBIT. Revisar su periodo y definición.'); }
  if (isFin) {
    const coe = 0.10;
    if (isNum(inp.roe) && (inp.equity > 0||manualFields.has('roe'))) {
      comps.returns = { score: interp(inp.roe - coe, [[-0.08, 0], [0, 45], [0.03, 65], [0.07, 85], [0.12, 100]]), detail: `ROE ${(inp.roe * 100).toFixed(1)}% frente a un coste del capital propio orientativo del ${(coe * 100).toFixed(0)}%` };
    } else missing.push('ROE');
  } else if (isNum(roic)) {
    const spread = roic - wacc.value;
    comps.returns = {
      score: interp(spread, [[-0.06, 0], [-0.02, 25], [0, 50], [0.04, 68], [0.08, 80], [0.14, 92], [0.22, 100]]),
      detail: `ROIC ${(roic * 100).toFixed(1)}% frente a un coste del capital de ${(wacc.value * 100).toFixed(1)}% (diferencial ${(spread * 100).toFixed(1)} puntos)`,
    };
    if (wacc.assumed) notes.push(wacc.note);
    if (roic > 1.0) notes.push('ROIC muy alto: revisa si el capital invertido es pequeño por negativos o por activos intangibles no registrados.');
  } else missing.push('ROIC');

  // --- Margins ---------------------------------------------------------------------------
  if (!isFin && isNum(inp.opMargin) && isNum(b.opMargin)) {
    const r = inp.opMargin / b.opMargin;
    comps.operatingMargin = { score: interp(r, [[-0.5, 0], [0, 15], [0.4, 40], [0.8, 62], [1.0, 72], [1.5, 90], [2.2, 100]]), detail: `margen operativo ${(inp.opMargin * 100).toFixed(1)}% (referencia orientativa del sector ${(b.opMargin * 100).toFixed(0)}%)` };
  } else if (isFin && isNum(inp.netMargin)) {
    comps.operatingMargin = { score: interp(inp.netMargin, [[0, 20], [0.12, 55], [0.22, 80], [0.35, 100]]), detail: `margen neto ${(inp.netMargin * 100).toFixed(1)}%` };
  } else missing.push('margen operativo');

  if (!isFin && !isReit && isNum(inp.grossMargin) && isNum(b.grossMargin)) {
    comps.grossMargin = { score: interp(inp.grossMargin / b.grossMargin, [[0, 10], [0.5, 35], [0.85, 60], [1.0, 70], [1.3, 90], [1.6, 100]]), detail: `margen bruto ${(inp.grossMargin * 100).toFixed(1)}% (sector ~${(b.grossMargin * 100).toFixed(0)}%)` };
  }

  // --- Free cash flow (not meaningful for banks) ----------------------------------------
  const fcfMargin = div(generation.fcfVal, generation.revVal);
  if (!isFin && fcfMargin != null) {
    const fcfAdj = isNum(generation.sbcVal) ? div(generation.fcfVal - generation.sbcVal, generation.revVal) : null;
    const base = fcfAdj != null ? (fcfMargin + fcfAdj) / 2 : fcfMargin;
    const ref = isNum(b.fcfMargin) && b.fcfMargin > 0 ? b.fcfMargin : 0.07;
    comps.fcfGeneration = { score: interp(base / ref, [[-1.0, 0], [-0.2, 10], [0, 25], [0.5, 55], [1.0, 72], [1.6, 92], [2.2, 100]]), detail: `margen de caja libre ${(fcfMargin * 100).toFixed(1)}%${fcfAdj != null ? ` (${(fcfAdj * 100).toFixed(1)}% si se resta la remuneración en acciones)` : ''}` };
  } else if (!isFin) missing.push('flujo de caja libre');

  // --- Cash conversion --------------------------------------------------------------------
  if (!isFin && isNum(conversion.niVal) && conversion.niVal > 0 && isNum(conversion.fcfVal)) {
    const ratio = conversion.fcfVal / conversion.niVal;
    const ratioAdj = isNum(conversion.sbcVal) ? (conversion.fcfVal - conversion.sbcVal) / conversion.niVal : ratio;
    const use = Math.min(ratio, (ratio + ratioAdj) / 2);
    comps.cashConversion = { score: interp(use, [[-0.5, 0], [0, 10], [0.5, 50], [0.8, 75], [1.0, 90], [1.2, 100]]), detail: `la caja libre equivale al ${(ratio * 100).toFixed(0)}% del beneficio neto` };
  } else if (!isFin && isNum(conversion.niVal) && conversion.niVal <= 0) notes.push('Sin beneficio neto positivo, la conversión de beneficios en caja no es medible.');
  if(!isFin)for(const [name,selection] of Object.entries(cashFlowInputs)){
    if(selection.reason)notes.push(`${name==='fcfGeneration'?'Generación de caja':'Conversión a caja'}: ${selection.reason}`);
  }

  // --- Margin stability --------------------------------------------------------------------
  const margins = inp.revH.map((r) => {
    const o = inp.oiH.find((x) => x.y === r.y);
    return o && r.val > 0 ? o.val / r.val : null;
  }).filter(isNum).slice(-7);
  if (!isFin && margins.length >= 4) {
    const sd = stdev(margins);
    const last = margins[margins.length - 1];
    const peak = Math.max(...margins);
    const eroded = peak > 0 ? 1 - last / peak : 0;
    const base = interp(sd, [[0.01, 100], [0.03, 82], [0.06, 55], [0.12, 20]]);
    comps.marginStability = { score: Math.max(0, base - Math.max(0, eroded - 0.25) * 60), detail: `desviación del margen operativo de ${(sd * 100).toFixed(1)} puntos en ${margins.length} años${eroded > 0.25 ? `, ahora un ${(eroded * 100).toFixed(0)}% por debajo de su máximo` : ''}` };
  } else if (!isFin) missing.push('historial de márgenes (4 años o más)');

  // --- Balance ------------------------------------------------------------------------------
  const balParts = [];
  if (isNum(inp.netDebt) && isNum(inp.ebitda) && inp.ebitda > 0) {
    const nd = inp.netDebt / inp.ebitda;
    const pts = isReit ? [[-1, 100], [3, 85], [6, 60], [8, 35], [11, 10]] : [[-1, 100], [0.5, 92], [1.5, 78], [2.5, 58], [4, 30], [6, 5]];
    if (!isFin) balParts.push({ s: interp(nd, pts), d: `deuda neta ${nd.toFixed(1)} veces el EBITDA` });
  } else if (isNum(inp.netDebt) && inp.netDebt <= 0) {
    balParts.push({ s: 95, d: 'más caja que deuda financiera' });
  } else if (isNum(inp.ebitda) && inp.ebitda <= 0 && isNum(inp.netDebt) && inp.netDebt > 0) {
    balParts.push({ s: 10, d: 'deuda neta con EBITDA negativo' });
  }
  if (isNum(inp.oi) && isNum(inp.interest) && inp.interest > 0) {
    balParts.push({ s: interp(inp.oi / inp.interest, [[0, 5], [1.5, 25], [3, 55], [6, 82], [12, 100]]), d: `el resultado operativo cubre ${(inp.oi / inp.interest).toFixed(1)} veces los intereses` });
  }
  if (!isFin && !isReit && isNum(inp.currentAssets) && isNum(inp.currentLiabilities) && inp.currentLiabilities > 0) {
    balParts.push({ s: interp(inp.currentAssets / inp.currentLiabilities, [[0.4, 10], [0.8, 40], [1.0, 60], [1.5, 82], [2.5, 100]]), d: `liquidez corriente ${(inp.currentAssets / inp.currentLiabilities).toFixed(2)}` });
  }
  if (balParts.length) comps.balance = { score: balParts.reduce((a, p) => a + p.s, 0) / balParts.length, detail: balParts.map((p) => p.d).join('; ') };
  else missing.push('solidez del balance');

  // --- Reinvestment capacity ---------------------------------------------------------------
  if (!isFin && isNum(inp.fcf) && isNum(roic)) {
    const spread = roic - wacc.value;
    const s = inp.fcf > 0 && spread > 0.03 ? 85 : inp.fcf > 0 && spread > 0 ? 62 : inp.fcf > 0 ? 40 : spread > 0.03 ? 45 : 15;
    comps.reinvestment = { score: s, detail: spread > 0 ? 'los euros reinvertidos rinden por encima del coste del capital' : 'reinvertir rinde por debajo del coste del capital' };
  }

  // --- Capital employed evolution (incremental return) -----------------------------------
  const rs = roicSeries(inp, tax.value);
  if (!isFin && rs.length >= 4) {
    const a = rs[0], z = rs[rs.length - 1];
    const dCap = z.capital - a.capital;
    const dNopat = z.nopat - a.nopat;
    if (dCap > 0.05 * a.capital) {
      const inc = dNopat / dCap;
      comps.capitalEvolution = { score: interp(inc - wacc.value, [[-0.15, 5], [-0.05, 30], [0, 55], [0.05, 75], [0.15, 95]]), detail: `cada euro de capital añadido en ${rs.length} años ha generado ${(inc * 100).toFixed(0)}% de beneficio operativo adicional` };
    } else if (dNopat >= 0) comps.capitalEvolution = { score: 75, detail: 'el beneficio operativo se mantiene sin necesitar más capital' };
    else comps.capitalEvolution = { score: 30, detail: 'el beneficio operativo cae sin que el capital se reduzca' };
  }

  // --- Aggregate ------------------------------------------------------------------------------
  const FIN_ZEROED = ['grossMargin', 'fcfGeneration', 'cashConversion', 'marginStability', 'reinvestment', 'capitalEvolution'];
  const hasEssentials = (comps.returns || comps.operatingMargin) && (comps.fcfGeneration || isFin || comps.cashConversion || comps.balance);
  function aggregate(weights) {
    let wSum = 0, sSum = 0, wAll = 0;
    Object.keys(weights).forEach((k) => {
      const applicableWeight = (isFin && FIN_ZEROED.includes(k)) ? 0 : weights[k];
      wAll += applicableWeight;
      if (comps[k] && isNum(comps[k].score) && applicableWeight > 0) { wSum += applicableWeight; sSum += applicableWeight * comps[k].score; }
    });
    const cov = wAll > 0 ? wSum / wAll : 0;
    return { score: cov >= MIN_COVERAGE && hasEssentials && wSum > 0 ? Math.round(sSum / wSum) : null, coverage: cov };
  }
  const baseAgg = aggregate(QUALITY_WEIGHTS);
  let score = baseAgg.score;
  const coverage = baseAgg.coverage;
  const reasonNull = score == null ? `No hay datos suficientes para puntuar la calidad (cobertura ${(coverage * 100).toFixed(0)}%; faltan: ${missing.join(', ') || 'varios datos'}).` : null;
  if (isReit && score != null) notes.push('Para una REIT faltan FFO/AFFO y ocupación, la puntuación es una aproximación.');
  if (isFin && score != null) notes.push('Para un banco o aseguradora se usan ROE y márgenes; faltan ratio de capital, morosidad y eficiencia.');

  // The word shown instead of the bare number, widened into a range when a different reasonable
  // weighting lands on a different word — same mechanism as potential.js.
  let sensitivity = null;
  if (score != null) {
    const byWeightSet = Object.fromEntries(Object.entries(QUALITY_WEIGHT_SETS).map(([k, w]) => [k, aggregate(w).score]));
    const vals = Object.values(byWeightSet).filter(isNum);
    const spread = vals.length ? Math.max(...vals) - Math.min(...vals) : 0;
    const wordIdxs = vals.map((v) => LABELS.indexOf(qualityLabel(v)));
    const lowLabel = LABELS[Math.min(...wordIdxs)];
    const highLabel = LABELS[Math.max(...wordIdxs)];
    sensitivity = {
      byWeightSet, spread: round(spread, 0), dependsOnWeights: spread > 15,
      note: spread > 15 ? 'El resultado cambia más de 15 puntos según cómo se pondere: no lo tomes como una cifra precisa.' : 'El resultado es estable ante distintas ponderaciones razonables.',
      labelRange: lowLabel === highLabel ? null : { low: lowLabel, high: highLabel },
    };
  }

  // Moat: financial quality is evidence consistent with an advantage, not proof of one.
  const rsSpreads = rs.map((r) => r.roic - wacc.value);
  const persistent = rsSpreads.length >= 5 && rsSpreads.slice(-5).every((s) => s > 0.04);
  const moat = {
    status: 'no_determinable',
    label: 'No puede determinarse con confianza',
    financialEvidence: persistent ? 'compatible' : (rsSpreads.length >= 5 ? 'no_concluyente' : 'insuficiente'),
    note: persistent
      ? 'Rendimientos por encima del coste del capital durante 5 años son compatibles con una ventaja competitiva, pero no la demuestran. Hace falta analizar marca, costes de cambio, escala o efecto red.'
      : 'Con datos financieros no se puede afirmar ni descartar una ventaja competitiva. Hace falta análisis cualitativo del negocio.',
  };

  return {
    score,
    label: score != null ? qualityLabel(score) : 'No concluyente',
    reasonNull,
    coverage: round(coverage, 2),
    components: Object.fromEntries(Object.entries(comps).map(([k, v]) => [k, { score: round(v.score, 0), weight: QUALITY_WEIGHTS[k], detail: v.detail }])),
    missing, notes, moat, sensitivity, cashFlowInputs,
    roic: round(roic, 4), costOfCapital: round(wacc.value, 4), costOfCapitalAssumed: wacc.assumed,
    roicSpread: isNum(roic) ? round(roic - wacc.value, 4) : null,
    weights: QUALITY_WEIGHTS,
  };
}
