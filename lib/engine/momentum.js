// Dimension B: GROWTH AND FUNDAMENTAL MOMENTUM. Is the business improving or deteriorating?
//
// Method: build one snapshot per period (quarterly YoY when >= 8 quarters are supplied,
// otherwise annual YoY), score each indicator -1 / 0 / +1 with fixed thresholds, average them
// into a composite, and classify using the latest AND the previous period. A single period
// never gives a "confirmed" label.
//
// Indicator thresholds (documented, fixed, not tuned to any ticker):
//   revenue YoY      > +5% -> +1 ; < -3% -> -1
//   revenue accel.   > +2 pp vs previous period -> +1 ; < -2 pp -> -1
//   operating margin > +1 pp YoY -> +1 ; < -1 pp -> -1
//   operating income YoY > +10% -> +1 ; < -10% -> -1 (turning positive = +1, turning negative = -1)
//   diluted EPS YoY  same as operating income
//   FCF YoY          same as operating income
//   share count YoY  < -1% (net buyback) -> +1 ; > +3% (dilution) -> -1
//
// Classification (c0 = latest composite, c1 = previous period composite):
//   n < 3 indicators                            -> insufficient
//   c0 >= 0.4 and c1 >= 0.2                     -> confirmed_improvement
//   c0 >= 0.4 (previous period unknown/weaker)  -> possible_improvement
//   0.2 <= c0 < 0.4 and no negative indicator   -> possible_improvement
//   c0 <= -0.4 and c1 <= -0.2                   -> confirmed_deterioration
//   c0 <= -0.4 (previous unknown/milder)        -> possible_deterioration
//   -0.4 < c0 <= -0.2 and no positive indicator -> possible_deterioration
//   |c0| < 0.2 with at most one non-zero signal -> stable
//   anything else                               -> mixed

import { isNum, div, round } from './util.js';

export const MOMENTUM_LABELS = {
  confirmed_improvement: 'Mejora confirmada',
  possible_improvement: 'Posible mejora',
  stable: 'Estabilidad',
  mixed: 'Señales mixtas',
  possible_deterioration: 'Posible deterioro',
  confirmed_deterioration: 'Deterioro confirmado',
  insufficient: 'Información insuficiente',
};

const sig = (v, up, down) => (v == null ? null : v > up ? 1 : v < down ? -1 : 0);

// Growth of a signed series: turning positive from <=0 is an improvement, falling below 0 is not.
function signedGrowthSignal(now, before) {
  if (!isNum(now) || !isNum(before)) return null;
  if (before > 0) return sig(now / before - 1, 0.10, -0.10);
  if (now > 0) return 1;                       // loss -> profit
  if (now > before) return 1;                  // smaller loss
  if (now < before) return -1;                 // larger loss
  return 0;
}

function pairs(hist) { return hist.map((h) => [h.y, h.val]); }

function annualSnapshots(inp) {
  const rev = Object.fromEntries(pairs(inp.revH));
  const oi = Object.fromEntries(pairs(inp.oiH));
  const ni = Object.fromEntries(pairs(inp.niH));
  const fcf = Object.fromEntries(pairs(inp.fcfH));
  const sh = Object.fromEntries(pairs(inp.sharesH));
  const years = Object.keys(rev).map(Number).sort((a, b) => a - b);
  const snaps = [];
  years.forEach((y, idx) => {
    if (idx === 0 || y - years[idx - 1] !== 1) return;
    const p = y - 1;
    const revYoY = div(rev[y] - rev[p], Math.abs(rev[p]));
    const mNow = div(oi[y], rev[y]);
    const mBefore = div(oi[p], rev[p]);
    // EPS from net income / the same year's share count (diluted history is not always available).
    const epsNow = isNum(ni[y]) && isNum(sh[y]) && sh[y] > 0 ? ni[y] / sh[y] : null;
    const epsBefore = isNum(ni[p]) && isNum(sh[p]) && sh[p] > 0 ? ni[p] / sh[p] : null;
    snaps.push({
      period: String(y), basis: 'anual',
      revYoY,
      marginDelta: mNow != null && mBefore != null ? mNow - mBefore : null,
      oi: signedGrowthSignal(oi[y], oi[p]),
      eps: signedGrowthSignal(epsNow, epsBefore),
      fcf: signedGrowthSignal(fcf[y], fcf[p]),
      shareYoY: isNum(sh[y]) && isNum(sh[p]) && sh[p] > 0 ? sh[y] / sh[p] - 1 : null,
    });
  });
  return snaps;
}

function quarterlySnapshots(inp) {
  const q = inp.quarterly;
  if (!q || !Array.isArray(q.revenue) || q.revenue.length < 8) return null;
  const by = (arr) => (Array.isArray(arr) ? arr : []);
  const rev = q.revenue; // ascending [{period:'2025Q3', val, filed?}]
  const snaps = [];
  for (let i = 4; i < rev.length; i++) {
    const now = rev[i], before = rev[i - 4];
    const oiN = by(q.operatingIncome)[i]?.val, oiB = by(q.operatingIncome)[i - 4]?.val;
    const epsN = by(q.epsDiluted)[i]?.val, epsB = by(q.epsDiluted)[i - 4]?.val;
    const fcfN = by(q.fcf)[i]?.val, fcfB = by(q.fcf)[i - 4]?.val;
    const shN = by(q.shares)[i]?.val, shB = by(q.shares)[i - 4]?.val;
    snaps.push({
      period: now.period, basis: 'trimestral', filed: now.filed ?? null,
      revYoY: div(now.val - before.val, Math.abs(before.val)),
      marginDelta: div(oiN, now.val) != null && div(oiB, before.val) != null ? div(oiN, now.val) - div(oiB, before.val) : null,
      oi: signedGrowthSignal(oiN, oiB),
      eps: signedGrowthSignal(epsN, epsB),
      fcf: signedGrowthSignal(fcfN, fcfB),
      shareYoY: isNum(shN) && isNum(shB) && shB > 0 ? shN / shB - 1 : null,
    });
  }
  return snaps;
}

function composite(snap, prevSnap) {
  const parts = {
    revenueGrowth: snap.revYoY != null ? sig(snap.revYoY, 0.05, -0.03) : null,
    acceleration: snap.revYoY != null && prevSnap?.revYoY != null ? sig(snap.revYoY - prevSnap.revYoY, 0.02, -0.02) : null,
    operatingMargin: snap.marginDelta != null ? sig(snap.marginDelta, 0.01, -0.01) : null,
    operatingIncome: snap.oi,
    epsDiluted: snap.eps,
    freeCashFlow: snap.fcf,
    dilution: snap.shareYoY != null ? (snap.shareYoY < -0.01 ? 1 : snap.shareYoY > 0.03 ? -1 : 0) : null,
  };
  const vals = Object.values(parts).filter((v) => v != null);
  const n = vals.length;
  return {
    parts, n,
    value: n ? vals.reduce((a, b) => a + b, 0) / n : null,
    positives: vals.filter((v) => v > 0).length,
    negatives: vals.filter((v) => v < 0).length,
  };
}

export function classifyMomentum(c0, c1) {
  if (!c0 || c0.n < 3 || c0.value == null) return 'insufficient';
  const v0 = c0.value, v1 = c1 && c1.n >= 3 ? c1.value : null;
  if (v0 >= 0.4 && v1 != null && v1 >= 0.2) return 'confirmed_improvement';
  if (v0 >= 0.4) return 'possible_improvement';
  if (v0 >= 0.2 && c0.negatives === 0) return 'possible_improvement';
  if (v0 <= -0.4 && v1 != null && v1 <= -0.2) return 'confirmed_deterioration';
  if (v0 <= -0.4) return 'possible_deterioration';
  if (v0 <= -0.2 && c0.positives === 0) return 'possible_deterioration';
  if (Math.abs(v0) < 0.2 && c0.positives + c0.negatives <= 1) return 'stable';
  return 'mixed';
}

export function computeMomentum(inp) {
  const quarterly = quarterlySnapshots(inp);
  const snaps = quarterly || annualSnapshots(inp);
  const basis = quarterly ? 'trimestral (cada trimestre frente al mismo trimestre del año anterior, neutraliza la estacionalidad)' : 'anual';
  const limitations = [];
  if (!quarterly) limitations.push('No hay series trimestrales: la evolución se mide con años completos y puede tardar en reflejar un giro reciente.');
  if (!inp.guidance) limitations.push('Sin datos de revisiones de previsiones (guidance): no se evalúan.');
  if (inp.organicGrowth == null) limitations.push('Sin separar crecimiento orgánico de adquisiciones: el crecimiento podría estar inflado por compras.');
  limitations.push('Retención de clientes e ingresos recurrentes: no disponibles en las fuentes estructuradas actuales.');

  if (snaps.length < 1) {
    return { status: 'insufficient', label: MOMENTUM_LABELS.insufficient, composite: null, basis, indicators: [], limitations, reason: 'No hay suficiente historial para comparar periodos.' };
  }
  const last = snaps[snaps.length - 1];
  const prev = snaps.length >= 2 ? snaps[snaps.length - 2] : null;
  const prev2 = snaps.length >= 3 ? snaps[snaps.length - 3] : null;
  const c0 = composite(last, prev);
  const c1 = prev ? composite(prev, prev2) : null;

  // Inject TTM revenue YoY as a cross-check when the snapshot basis is annual.
  const ttmNote = !quarterly && inp.revGrowthTTM != null && last.revYoY != null
    ? `Crecimiento de ingresos de los últimos 12 meses ${(inp.revGrowthTTM * 100).toFixed(1)}% frente a ${(last.revYoY * 100).toFixed(1)}% del último año completo.`
    : null;

  const status = classifyMomentum(c0, c1);
  const label = (k) => ({
    revenueGrowth: 'Crecimiento de ingresos', acceleration: 'Aceleración', operatingMargin: 'Margen operativo',
    operatingIncome: 'Beneficio operativo', epsDiluted: 'BPA diluido', freeCashFlow: 'Flujo de caja libre', dilution: 'Número de acciones',
  }[k]);
  const indicators = Object.entries(c0.parts).map(([k, v]) => ({
    id: k, label: label(k), signal: v,
    reading: v == null ? 'N/D' : v > 0 ? 'mejora' : v < 0 ? 'empeora' : 'neutral',
  }));

  return {
    status, label: MOMENTUM_LABELS[status], basis,
    composite: round(c0.value, 2), previousComposite: c1 ? round(c1.value, 2) : null,
    period: last.period, previousPeriod: prev?.period ?? null,
    latest: { revenueYoY: round(last.revYoY, 4), marginDeltaPoints: last.marginDelta != null ? round(last.marginDelta * 100, 2) : null, shareYoY: round(last.shareYoY, 4) },
    previous: prev ? { revenueYoY: round(prev.revYoY, 4), marginDeltaPoints: prev.marginDelta != null ? round(prev.marginDelta * 100, 2) : null } : null,
    indicators, positives: c0.positives, negatives: c0.negatives, available: c0.n,
    ttmNote, limitations,
    reason: status === 'insufficient' ? 'Menos de 3 indicadores calculables en el último periodo.' : null,
    snapshots: snaps.slice(-4),
  };
}
