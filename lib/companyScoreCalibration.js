// Isolated scoring policy: do not feed these scores back into valuation or scenarios.
import { normalizeInput } from './engine/input';
import { classifyBusiness } from './engine/profile';
import { computeQuality } from './engine/quality';
import { computeMomentum } from './engine/momentum';
import { computeValuation, insufficientValuation } from './engine/valuation';
import { validateInput } from './engine/validation';
import { interp, isNum, localizeDecimals } from './engine/util';
import { tierForScore } from './engine/tierScale';

export const MIN_SCORE_COVERAGE = 0.70;
export const MIN_INDICATIVE_SCORE_COVERAGE = 0.50;
export const GROWTH_WEIGHTS = { currentRevenue: 0.45, historicalRevenue: 0.25, acceleration: 0.15, cashEvolution: 0.15 };
export const QUALITY_WEIGHTS = { returns: 0.25, operatingMargin: 0.15, fcfGeneration: 0.15, cashConversion: 0.15, marginStability: 0.15, balance: 0.15 };
const REVENUE_POINTS = [[-30, 0], [-10, 10], [0, 30], [3, 40], [8, 55], [15, 70], [25, 85], [40, 97], [60, 100]];
const ACCELERATION_POINTS = [[-20, 20], [-4, 40], [0, 60], [4, 80], [15, 100]];
const DIRECTION_POINTS = [[-1, 20], [0, 50], [1, 85]];

function existingAnalysis(inp) {
  const profile = classifyBusiness(inp);
  const validation = validateInput(inp);
  return { profile, validation, quality: computeQuality(inp, profile), momentum: computeMomentum(inp),
    valuation: validation.hasErrors ? insufficientValuation('Datos incoherentes.') : computeValuation(inp, profile) };
}

function part(id, label, weight, score, detail = null) {
  return { id, label, weight, score: isNum(score) ? score : null, detail: localizeDecimals(detail) };
}

function aggregate(id, name, components, { essential, blocked = false, limitations = [], confidenceLimit = 'alta' }) {
  const expected = components.reduce((sum, c) => sum + c.weight, 0);
  const measured = components.filter(c => c.weight > 0 && isNum(c.score));
  const observed = measured.reduce((sum, c) => sum + c.weight, 0);
  const coverage = expected ? observed / expected : 0;
  const missing = components.filter(c => c.weight > 0 && !isNum(c.score)).map(c => c.label);
  let reason = null;
  if (blocked) reason = 'Hay datos incoherentes o demasiado antiguos para esta dimensión.';
  else if (coverage + 1e-9 < MIN_SCORE_COVERAGE || measured.length < 2) reason = `Cobertura insuficiente (${Math.round(coverage * 100)}%; mínimo 70% y dos componentes).`;
  else if (!essential(measured)) reason = 'Faltan los indicadores esenciales de esta dimensión.';
  const score100 = reason ? null : Math.round(measured.reduce((sum, c) => sum + c.weight * c.score, 0) / observed);
  // A separate display estimate; never replace the calibrated score or bypass
  // incompatible inputs, essential metrics, or the minimum component count.
  const indicativeScore = score100 == null && !blocked && measured.length >= 2
    && coverage + 1e-9 >= MIN_INDICATIVE_SCORE_COVERAGE && essential(measured)
    ? Math.round(measured.reduce((sum, c) => sum + c.weight * c.score, 0) / observed) : null;
  const indicative = indicativeScore == null ? null : {
    score100: indicativeScore, tier: tierForScore(indicativeScore),
    description: `Nota orientativa con cobertura del ${Math.round(coverage * 100)}%. Solo resume los indicadores disponibles; los datos que faltan pueden cambiarla. Confianza baja.`,
  };
  const ranks = ['baja', 'media', 'alta'];
  const baseConfidence = coverage >= 0.9 && measured.length >= 3 ? 'alta' : coverage >= 0.85 ? 'media' : 'baja';
  const confidence = score100 == null ? 'baja' : ranks[Math.min(ranks.indexOf(baseConfidence), ranks.indexOf(confidenceLimit))];
  const notes = [...limitations, ...(missing.length ? [`Faltan: ${missing.join(', ')}.`] : [])];
  return { id, name, score100, tier: tierForScore(score100), indicative, coverage, confidence, components, missing, limitations, reason,
    description: `${reason || name + ': puntuación independiente.'} Cobertura ${Math.round(coverage * 100)}%; confianza ${confidence}.${notes.length ? ' ' + notes.join(' ') : ''}` };
}

function consecutive(last, previous) {
  if (!last || !previous || last.basis !== previous.basis) return false;
  const index = snap => {
    const match = String(snap.period).match(/^(\d{4})(?:-?Q([1-4]))?$/);
    return match ? Number(match[1]) * (snap.basis === 'trimestral' ? 4 : 1) + Number(match[2] || 0) : null;
  };
  const a = index(last), b = index(previous);
  return a != null && b != null && a - b === 1;
}

export function computeCompanyScores(data, easyMode, analysis) {
  const inp = normalizeInput(data);
  const engine = analysis ?? existingAnalysis(inp);
  const kind = engine.profile.kind;
  const financial = kind === 'financial', reit = kind === 'reit';
  const insurer = financial && /insurance/.test(`${inp.sector} ${inp.industry}`.toLowerCase());
  const issues = engine.validation.issues;
  const historyError = issues.some(i => i.severity === 'error' && (i.field === 'history' || i.field === 'rev'));
  const sharedLimits = [];
  if (!inp.lastFilingDate) sharedLimits.push('Fecha de publicación del último informe N/D.');
  if (issues.some(i => i.severity === 'warning')) sharedLimits.push('Hay advertencias de coherencia en los datos del análisis.');

  const snaps = engine.momentum.snapshots ?? [];
  const last = snaps.at(-1), previous = snaps.at(-2);
  const currentGrowth = inp.revGrowthTTM ?? last?.revYoY;
  const acceleration = consecutive(last, previous) && isNum(last.revYoY) && isNum(previous.revYoY) ? (last.revYoY - previous.revYoY) * 100 : null;
  const direction = financial ? last?.eps : last?.fcf;
  const growthParts = [
    part('currentRevenue', 'Crecimiento actual de ingresos', GROWTH_WEIGHTS.currentRevenue, interp(isNum(currentGrowth) ? currentGrowth * 100 : null, REVENUE_POINTS)),
    part('historicalRevenue', 'Mediana reciente del crecimiento de ingresos', GROWTH_WEIGHTS.historicalRevenue, interp(easyMode?.growthCagrPct, REVENUE_POINTS)),
    part('acceleration', 'Aceleración de ingresos en periodos consecutivos', GROWTH_WEIGHTS.acceleration, interp(acceleration, ACCELERATION_POINTS)),
    ...(!reit ? [part('cashEvolution', financial ? 'Evolución del BPA diluido' : 'Evolución del flujo de caja libre', GROWTH_WEIGHTS.cashEvolution, interp(direction, DIRECTION_POINTS))] : []),
  ];
  const growthLimits = [...sharedLimits];
  if (!engine.momentum.basis?.startsWith('trimestral')) growthLimits.push('Evolución anual; sin confirmación trimestral.');
  if (inp.organicGrowth == null) growthLimits.push('Sin separar crecimiento orgánico y adquisiciones.');
  if (reit) growthLimits.push('Sin evolución de FFO/AFFO; el FCF industrial no es aplicable.');
  const growth = aggregate('growth', 'GROWTH', growthParts, {
    essential: measured => measured.some(c => c.id === 'currentRevenue' || c.id === 'historicalRevenue'),
    blocked: historyError, limitations: growthLimits, confidenceLimit: growthLimits.length ? 'media' : 'alta',
  });

  // One cash-flow multiple, no inverse duplicate and no implied return blending in Growth.
  const cashInapplicable = !inp.bench.pfcf || inp.bench.pfcf.every(v => v === 0);
  const valueWeights = financial ? (insurer ? { pe: 0.60, pb: 0.40 } : { pe: 0.40, pb: 0.60 })
    : reit ? { evEbitda: 0.60, pb: 0.40 }
      : kind === 'cyclical' || cashInapplicable ? { evEbit: 0.60, pe: 0.40 }
        : kind === 'recovery' ? { pfcf: 0.40, evEbit: 0.60 } : { pfcf: 0.40, pe: 0.30, evEbit: 0.30 };
  const methods = new Map(engine.valuation.methods.map(method => [method.id, method]));
  const labels = { pe: 'P/E sobre beneficio observado', pb: 'Precio / valor contable', evEbit: 'EV/EBIT aplicable al perfil', evEbitda: 'EV/EBITDA inmobiliario', pfcf: inp.sbc == null ? 'P/FCF publicado (SBC N/D)' : 'P/FCF después de SBC' };
  const valueParts = Object.entries(valueWeights).map(([id, weight]) => {
    const method = methods.get(id);
    const usable = id !== 'pb' || (isNum(inp.equity) && inp.equity > 0);
    return part(id, labels[id], weight, usable ? method?.score : null, usable ? method?.value : null);
  });
  const valueLimits = [...sharedLimits];
  if ('pfcf' in valueWeights && inp.sbc == null) valueLimits.push('SBC N/D: no se confirma el ajuste de caja por remuneración en acciones.');
  if (reit) valueLimits.push('Aproximación inmobiliaria: FFO/AFFO y valoración de activos N/D.');
  const value = aggregate('value', 'VALUE', valueParts, {
    essential: measured => measured.length >= 2, blocked: engine.validation.hasErrors,
    limitations: valueLimits, confidenceLimit: reit ? 'baja' : valueLimits.length ? 'media' : 'alta',
  });

  const qualityWeights = financial ? (insurer ? { returns: 0.60, operatingMargin: 0.40 } : { returns: 0.50, roa: 0.30, operatingMargin: 0.20 })
    : reit ? { operatingMargin: 0.30, marginStability: 0.30, balance: 0.40 } : QUALITY_WEIGHTS;
  const qualityLabels = { returns: financial ? 'ROE frente al coste del capital propio' : 'ROIC frente al coste del capital', roa: 'ROA bancario', operatingMargin: financial ? 'Margen neto' : 'Margen operativo sectorial', fcfGeneration: 'Generación de caja libre', cashConversion: 'Conversión de beneficio en caja', marginStability: 'Estabilidad histórica de márgenes', balance: 'Solidez del balance y cobertura de intereses' };
  const qualityParts = Object.entries(qualityWeights).map(([id, weight]) => part(id, qualityLabels[id], weight,
    id === 'roa' ? interp(inp.roa, [[-0.01, 0], [0, 20], [0.005, 45], [0.01, 70], [0.015, 85], [0.02, 100]]) : engine.quality.components[id]?.score,
    engine.quality.components[id]?.detail ?? null));
  const qualityLimits = [...sharedLimits];
  if (!financial && !reit && inp.sbc == null) qualityLimits.push('SBC N/D: no se confirma la caja después de remuneración en acciones.');
  if (financial) qualityLimits.push(insurer ? 'Solvencia y ratio combinado de la aseguradora N/D.' : 'Capital regulatorio, morosidad y eficiencia bancaria N/D.');
  if (reit) qualityLimits.push('Aproximación inmobiliaria: FFO/AFFO y ocupación N/D.');
  const quality = aggregate('quality', 'QUALITY', qualityParts, {
    essential: measured => financial ? measured.some(c => c.id === 'returns')
      : reit ? measured.some(c => c.id === 'balance') && measured.some(c => c.id === 'operatingMargin')
        : measured.some(c => ['returns', 'operatingMargin'].includes(c.id)) && measured.some(c => ['fcfGeneration', 'balance'].includes(c.id)),
    blocked: historyError || issues.some(i => i.severity === 'error' && ['grossMargin', 'opMargin', 'fcf'].includes(i.field)),
    limitations: qualityLimits, confidenceLimit: financial || reit ? 'baja' : qualityLimits.length ? 'media' : 'alta',
  });
  return [growth, value, quality];
}
