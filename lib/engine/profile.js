// Business-model classification. Decides WHICH valuation methods make sense; it never
// produces a score by itself.

import { isNum, median, stdev, div } from './util.js';

export const PROFILE_LABELS = {
  financial: 'Empresa financiera',
  reit: 'Inmobiliaria cotizada (REIT)',
  cyclical: 'Empresa cíclica',
  recovery: 'Empresa en recuperación',
  growth: 'Empresa de crecimiento',
  profitable: 'Negocio rentable',
  temporarilyUnprofitable: 'Negocio temporalmente no rentable',
  structurallyUnprofitable: 'Negocio estructuralmente deficitario',
  unknown: 'Perfil no determinable',
};

function hasRevenueCrash(revH) {
  for (let i = 1; i < revH.length; i++) {
    if (revH[i - 1].val > 0 && revH[i].val / revH[i - 1].val - 1 <= -0.25) {
      const rebound = revH.slice(i + 1).some((r) => r.val >= revH[i - 1].val * 0.8);
      if (rebound) return true;
    }
  }
  return false;
}

export function classifyBusiness(inp) {
  const reasons = [];
  const flags = [];
  const bench = inp.benchKey;

  if (bench === 'reit') {
    return { kind: 'reit', label: PROFILE_LABELS.reit, flags, reasons: ['Su sector es inmobiliario: el beneficio contable se distorsiona por la amortización de inmuebles, por eso se miden con FFO/AFFO.'] };
  }
  if (bench === 'financial') {
    return { kind: 'financial', label: PROFILE_LABELS.financial, flags, reasons: ['Su materia prima es el dinero: deuda y caja forman parte del negocio, así que el flujo de caja libre y el EV/EBITDA no se interpretan como en una empresa industrial.'] };
  }
  if (!isNum(inp.rev) || !isNum(inp.oi)) {
    return { kind: 'unknown', label: PROFILE_LABELS.unknown, flags, reasons: ['Faltan ingresos o resultado operativo, no se puede clasificar el modelo económico.'] };
  }

  const oiYears = inp.oiH.slice(-5);
  const positiveYears = oiYears.filter((o) => o.val > 0).length;
  const revCagr3 = (() => {
    const r = inp.revH.slice(-4);
    return r.length >= 3 && r[0].val > 0 && r[r.length - 1].val > 0 ? Math.pow(r[r.length - 1].val / r[0].val, 1 / (r.length - 1)) - 1 : null;
  })();
  const growthSignal = (revCagr3 != null && revCagr3 >= 0.15) || (inp.revGrowthTTM != null && inp.revGrowthTTM >= 0.20 && revCagr3 == null);

  const margins = inp.revH.map((r) => {
    const o = inp.oiH.find((x) => x.y === r.y);
    return o && r.val > 0 ? o.val / r.val : null;
  }).filter(isNum);
  const marginSd = stdev(margins.slice(-7));
  // 4 years, not 5: matches the minimum this codebase already uses elsewhere for a margin/growth
  // read (sustainableGrowth's revH.slice(-4), buildParams' ms.length >= 4) — 5 was stricter than
  // that for no stated reason, and excluded a genuinely volatile 4-year history from ever being
  // flagged by data alone. Confirmed against real data: GLBS (dry-bulk shipping) has exactly 4
  // years of margin history with marginSd = 0.193 (3x this threshold) and was falling through to
  // 'profitable' ("sin rasgos cíclicos") for want of a 5th year, not because the volatility wasn't there.
  const cyclicalByData = hasRevenueCrash(inp.revH) || (margins.length >= 4 && marginSd != null && marginSd > 0.06 && Math.abs(median(margins) || 0) < 0.25);
  const isCyc = inp.isCyclicalSector || cyclicalByData;
  if (isCyc) flags.push(inp.isCyclicalSector ? 'cíclico por sector' : 'cíclico por la historia de sus ingresos o márgenes');

  if (inp.oi <= 0) {
    // A cyclical business can swing to a loss at the trough without being "unprofitable" in the
    // sense this branch means: the record shows it has real cyclicality (at least one profitable
    // year among the ones available, not zero), so the current period is a low point of the
    // cycle, not evidence of a broken business model. Checked here, before the loss-making
    // classification, so a cyclical-sector company in a down year does not lose the
    // normalized-margin treatment it needs (confirmed against real data: INTC in 2024-2025 fell
    // through to temporarilyUnprofitable while TSM, same sector and same kind of swing but
    // currently profitable, correctly got 'cyclical' — the two should not diverge on which side
    // of the profit/loss line the latest period happens to land). Scoped to the explicit
    // sector-keyword signal only (not the data-driven `cyclicalByData` fallback below): a company
    // that merely has volatile margins because it is in secular decline is not the same claim as
    // "this business lives on a price/demand cycle it will come back from", and conflating the
    // two regressed a loss-making, non-cyclical-sector fixture into 'cyclical' during testing.
    if (inp.isCyclicalSector && positiveYears >= 1 && oiYears.length >= 3) {
      return { kind: 'cyclical', label: PROFILE_LABELS.cyclical, flags, reasons: ['Sus beneficios dependen de un precio externo o del ciclo económico: el periodo actual es una fase baja del ciclo, no agota su capacidad de generar beneficios en otras fases.'] };
    }
    // Loss-making now. Temporary vs structural depends on the record, not on the narrative.
    if (positiveYears >= 2) {
      return { kind: 'temporarilyUnprofitable', label: PROFILE_LABELS.temporarilyUnprofitable, flags, reasons: [`Pierde dinero en el último periodo, pero tuvo resultado operativo positivo en ${positiveYears} de sus últimos ${oiYears.length} años.`] };
    }
    if (oiYears.length >= 3) {
      return { kind: 'structurallyUnprofitable', label: PROFILE_LABELS.structurallyUnprofitable, flags: [...flags, growthSignal ? 'crece en ingresos' : 'sin crecimiento fuerte'], reasons: [`Su resultado operativo ha sido negativo o nulo en ${oiYears.length - positiveYears} de sus últimos ${oiYears.length} años.`] };
    }
    return { kind: 'unknown', label: PROFILE_LABELS.unknown, flags, reasons: ['Pierde dinero y el historial es demasiado corto para saber si es algo temporal o estructural.'] };
  }

  // Operating profit is positive.
  const prev = oiYears.length >= 2 ? oiYears[oiYears.length - 2] : null;
  const prevRev = inp.revH.find((r) => prev && r.y === prev.y);
  const prevMargin = prev && prevRev ? div(prev.val, prevRev.val) : null;
  const marginNow = div(inp.oi, inp.rev);
  if (prev && prev.val <= 0 && marginNow != null) {
    return { kind: 'recovery', label: PROFILE_LABELS.recovery, flags, reasons: [`Vuelve a tener resultado operativo positivo tras un año anterior en pérdidas o en cero. Un solo periodo no confirma la recuperación.`] };
  }
  if (prevMargin != null && marginNow != null && prevMargin > 0 && marginNow > prevMargin * 1.6 && marginNow - prevMargin > 0.04 && positiveYears <= 3) {
    return { kind: 'recovery', label: PROFILE_LABELS.recovery, flags, reasons: ['Su margen operativo ha subido con fuerza desde un nivel muy bajo.'] };
  }
  if (isCyc) {
    return { kind: 'cyclical', label: PROFILE_LABELS.cyclical, flags, reasons: ['Sus beneficios dependen de un precio externo o del ciclo económico, por eso se valora sobre márgenes normalizados y no sobre el último año.'] };
  }
  if (growthSignal) {
    return { kind: 'growth', label: PROFILE_LABELS.growth, flags, reasons: ['Sus ingresos crecen a un ritmo alto y rentable, el precio descuenta parte de ese crecimiento futuro.'] };
  }
  return { kind: 'profitable', label: PROFILE_LABELS.profitable, flags, reasons: ['Resultado operativo positivo de forma sostenida y sin rasgos de ciclo ni de hipercrecimiento.'] };
}

// Valuation methods that apply to each profile, and the ones discarded with the reason.
export function methodsForProfile(kind, inp) {
  const fcfPositive = isNum(inp.fcf) && inp.fcf > 0;
  const ebitdaPositive = isNum(inp.ebitda) && inp.ebitda > 0;
  const niPositive = isNum(inp.ni) && inp.ni > 0;
  const m = {
    pe: [niPositive, 'P/E: necesita beneficio neto positivo'],
    forwardPe: [isNum(inp.forwardPE) && inp.forwardPE > 0, 'P/E a futuro: no hay estimación de beneficio disponible o es negativa'],
    evEbitda: [ebitdaPositive, 'EV/EBITDA: el EBITDA es negativo o no está disponible, el múltiplo no tiene sentido'],
    evEbit: [isNum(inp.oi) && inp.oi > 0, 'EV/EBIT: necesita resultado operativo positivo'],
    evSales: [isNum(inp.rev) && inp.rev > 0, 'EV/ventas: faltan ingresos'],
    pfcf: [fcfPositive, 'P/FCF: el flujo de caja libre es negativo o no está disponible'],
    fcfYield: [isNum(inp.fcf), 'Rentabilidad por FCF: falta el flujo de caja libre'],
    pb: [isNum(inp.priceToBook) && inp.priceToBook > 0, 'P/valor contable: falta el dato o el patrimonio es negativo'],
  };
  const allowed = {
    profitable: ['pe', 'forwardPe', 'evEbitda', 'evEbit', 'pfcf', 'fcfYield'],
    growth: ['forwardPe', 'pe', 'evEbit', 'evEbitda', 'pfcf', 'fcfYield', 'evSales'],
    recovery: ['evSales', 'forwardPe', 'evEbit', 'pfcf', 'fcfYield'],
    cyclical: ['evEbit', 'evSales', 'pe', 'pb'],
    temporarilyUnprofitable: ['evSales', 'forwardPe', 'pb'],
    structurallyUnprofitable: ['evSales'],
    financial: ['pe', 'pb', 'forwardPe'],
    reit: ['pb', 'evEbitda'],
    unknown: [],
  }[kind] || [];
  const why = {
    financial: 'En un banco o aseguradora la deuda es materia prima, no financiación; EV/EBITDA y flujo de caja libre no son comparables.',
    reit: 'En una REIT el beneficio contable subestima su caja real por la amortización de inmuebles; falta FFO/AFFO, el indicador correcto.',
    cyclical: 'En una cíclica los beneficios del último año pueden ser un máximo o un mínimo; un múltiplo bajo sobre beneficios máximos no es una ganga.',
    structurallyUnprofitable: 'Sin beneficios ni flujo de caja positivos, solo las ventas permiten una referencia, y es una referencia débil.',
    temporarilyUnprofitable: 'El beneficio actual no representa la capacidad normal del negocio.',
  };
  const applicable = [];
  const discarded = [];
  Object.keys(m).forEach((k) => {
    if (!allowed.includes(k)) discarded.push({ method: k, reason: why[kind] ? `${why[kind]}` : 'No es el método más adecuado para este modelo de negocio.' });
    else if (!m[k][0]) discarded.push({ method: k, reason: m[k][1] });
    else applicable.push(k);
  });
  return { applicable, discarded };
}
