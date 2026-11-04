// FIVE-YEAR FUNDAMENTAL VALUATION ENGINE.
//
// Replaces the old projection, which drifted the SHARE PRICE with a blend of
// (market-implied growth + the stock's own trailing price CAGR + the analyst target) and then
// took the median of a Brownian path. Price history is NOT a driver here. Drivers are the
// business: revenue, operating margin, tax, reinvestment (tied to returns on capital), net
// debt and share count.
//
// Per scenario (conservative / central / optimistic; NO probabilities attached):
//   revenue_t       = revenue_{t-1} x (1 + g_t),  g fades linearly from g0 (year 1) to the terminal
//                     growth gT at year 10. Years 1-5 are the explicit horizon; years 6-10 are a
//                     transition stage computed INSIDE the value at year 5 (so a compounder is not
//                     forced to drop to GDP growth in exactly year 5)
//   operating margin ramps linearly from today's margin to the scenario's target by year 5, then holds
//   NOPAT_t         = revenue_t x margin_t x (1 - tax)          [GAAP operating income, so
//                     stock-based compensation is already a cost; it is NOT added back]
//   reinvestment_t  = NOPAT_t x min(1, max(0, g_{t+1} / incremental ROIC))
//   FCFF_t          = NOPAT_t - reinvestment_t
//   terminal value  : Gordon on FCFF_11 = NOPAT_10 (1+gT)(1 - gT/ROIC_T), discounted at WACC
//                     (or an exit EV/EBIT multiple for cyclicals, never both)
//   net debt_t      = net debt_{t-1} - (FCFF_t - after-tax interest_t)   [all cash retained]
//   equity_5        = EV_5 - net debt_5   -> value per share at year 5 = equity_5 / shares_5
//   fair value today= (PV(FCFF 1..5) + PV(TV) - net debt_0) / shares_0   [cash/debt counted once]
//   max entry price = value_5 / (1 + required return)^5            [required return: 15% default]
//   margin of safety= (fair value today - price) / fair value today [only vs. a fair-value estimate]
//   CAGR            = (value_5 / price)^(1/5) - 1
//
// Share count: stock-based compensation is already expensed in operating income, so dilution
// from SBC is NOT added again (that would count it twice). Only issuance in EXCESS of SBC
// (capital raises, acquisitions paid in stock) is projected: conservative = observed excess,
// central = half, optimistic = none.

import { isNum, clamp, median, round, cagr } from './util.js';
import { costOfCapital, effectiveTaxRate } from './cost_of_capital.js';
import { sustainableGrowth } from './valuation.js';

export const DEFAULT_CONFIG = { requiredReturn: 0.15, horizon: 5 };
const MIN_SPREAD = 0.04; // wacc - terminal growth floor, avoids a runaway Gordon denominator

function operatingMargins(inp) {
  return inp.revH.map((r) => { const o = inp.oiH.find((x) => x.y === r.y); return o && r.val > 0 ? o.val / r.val : null; }).filter(isNum).slice(-7);
}

function costOfDebt(inp) {
  if (isNum(inp.interest) && isNum(inp.debt) && inp.debt > 0) return clamp(inp.interest / inp.debt, 0.02, 0.12);
  return clamp((inp.riskFreeRate ?? 0.04) + 0.02, 0.03, 0.10);
}

// Pure projection for ONE parameter set.
export function runScenario(inp, p, cfg = DEFAULT_CONFIG) {
  const N = cfg.horizon;          // explicit horizon (5)
  const T = 2 * N;                // end of transition stage (10)
  const tax = p.tax;
  const gT = Math.min(p.gT, p.wacc - MIN_SPREAD);
  const growthAt = (t) => p.g0 + (gT - p.g0) * (Math.min(t, T) - 1) / (T - 1);
  const marginAt = (t) => p.margin0 + (p.marginTarget - p.margin0) * (Math.min(t, N) / N);
  const roicAt = (t) => (t <= N ? p.roicInc : p.roicInc + (p.roicT - p.roicInc) * ((t - N) / N));
  const kd = costOfDebt(inp);

  let rev = inp.rev;
  let netDebt = inp.netDebt;
  let issued = 0;
  let pvExplicit = 0;
  const rows = [];
  const stage2 = [];
  let nopatT = 0;
  for (let t = 1; t <= T; t++) {
    const g = growthAt(t);
    rev = rev * (1 + g);
    const margin = marginAt(t);
    const ebit = rev * margin;
    const nopat = ebit > 0 ? ebit * (1 - tax) : ebit; // losses are not tax-shielded here (conservative)
    const gNext = t < T ? growthAt(t + 1) : gT;
    const roic = roicAt(t);
    const reinvest = nopat > 0 ? nopat * clamp(gNext / roic, 0, 1) : 0;
    const fcff = nopat - reinvest;
    if (t <= N) {
      const interest = Math.max(0, netDebt) * kd * (1 - tax);
      const prevNetDebt = netDebt;
      netDebt = netDebt - (fcff - interest);
      // A company that started with net cash and burns through it must raise equity (at today's price).
      if (inp.netDebt <= 0 && netDebt > 0 && inp.price > 0) { issued += netDebt / inp.price; netDebt = 0; }
      pvExplicit += fcff / Math.pow(1 + p.wacc, t);
      rows.push({ year: t, revenue: rev, growth: g, margin, ebit, nopat, reinvestment: reinvest, fcff, netDebtEnd: netDebt, prevNetDebt });
    } else {
      stage2.push({ year: t, growth: g, fcff });
    }
    nopatT = nopat;
  }
  const last = rows[N - 1];
  let tv5, tvMethod, impliedExitMultiple;
  if (p.terminalMethod === 'multiple') {
    tv5 = Math.max(0, last.ebit) * p.exitMultiple;
    tvMethod = 'múltiplo terminal EV/EBIT';
    impliedExitMultiple = p.exitMultiple;
  } else {
    const pvStage2 = stage2.reduce((a, r) => a + r.fcff / Math.pow(1 + p.wacc, r.year - N), 0);
    const nopat11 = nopatT * (1 + gT);
    const fcff11 = nopatT > 0 ? nopat11 * (1 - gT / p.roicT) : 0;
    const tv10 = fcff11 / (p.wacc - gT);
    tv5 = pvStage2 + tv10 / Math.pow(1 + p.wacc, N);
    tvMethod = 'descuento de flujos (5 años explícitos, 5 de transición y crecimiento perpetuo)';
    impliedExitMultiple = last.ebit > 0 ? tv5 / last.ebit : null;
  }
  const pvTv = tv5 / Math.pow(1 + p.wacc, N);
  const evToday = pvExplicit + pvTv;
  const fairToday = (evToday - inp.netDebt) / inp.shares;

  const excess = p.excessDilution ?? 0;
  const shares = inp.shares * Math.pow(1 + excess, N) + issued;
  const equity5 = tv5 - last.netDebtEnd;
  const valueFuture = equity5 / shares;
  const price = inp.price;
  const cagrPrice = valueFuture > 0 && price > 0 ? Math.pow(valueFuture / price, 1 / N) - 1 : null;
  const maxEntry = valueFuture > 0 ? valueFuture / Math.pow(1 + cfg.requiredReturn, N) : null;

  return {
    key: p.key, label: p.label,
    assumptions: {
      growthYear1: round(p.g0, 4), growthYear5: round(growthAt(N), 4), growthYear10: round(growthAt(T), 4), marginToday: round(p.margin0, 4), marginYear5: round(p.marginTarget, 4),
      tax: round(tax, 3), incrementalRoic: round(p.roicInc, 3), terminalRoic: p.terminalMethod === 'gordon' ? round(p.roicT, 3) : null,
      discountRate: round(p.wacc, 4), terminalGrowth: p.terminalMethod === 'gordon' ? round(gT, 4) : null,
      exitMultiple: p.terminalMethod === 'multiple' ? round(p.exitMultiple, 1) : null, terminalMethod: tvMethod,
      excessDilutionPerYear: round(excess, 4),
    },
    revenueYear5: round(last.revenue, 0), ebitYear5: round(last.ebit, 0), nopatYear5: round(last.nopat, 0), fcffYear5: round(last.fcff, 0),
    cumulativeFcff: round(rows.reduce((a, r) => a + r.fcff, 0), 0),
    netDebtYear5: round(last.netDebtEnd, 0),
    sharesToday: round(inp.shares, 0), sharesYear5: round(shares, 0), newSharesFromFunding: round(issued, 0),
    enterpriseValueToday: round(evToday, 0),
    terminalValueShare: evToday > 0 ? round(pvTv / evToday, 3) : null,
    impliedTerminalEvEbit: round(impliedExitMultiple, 1),
    fairValueToday: isNum(fairToday) && fairToday > 0 ? round(fairToday, 2) : null,
    valueYear5: isNum(valueFuture) && valueFuture > 0 ? round(valueFuture, 2) : null,
    equityValueNegative: !(valueFuture > 0),
    cagr: round(cagrPrice, 4),
    maxEntryPrice: round(maxEntry, 2),
    marginOfSafety: isNum(fairToday) && fairToday > 0 && price > 0 ? round((fairToday - price) / fairToday, 4) : null,
    path: rows.map((r) => ({ year: r.year, revenue: round(r.revenue, 0), growth: round(r.growth, 4), margin: round(r.margin, 4), fcff: round(r.fcff, 0) })),
  };
}

function buildParams(inp, profile, wacc, taxRate) {
  const kind = profile.kind;
  const g = sustainableGrowth(inp);
  const ms = operatingMargins(inp);
  const m0 = inp.oi / inp.rev;
  const mMed = ms.length >= 4 ? median(ms) : m0;
  const mMax = ms.length >= 4 ? Math.max(...ms) : m0;
  const rf = inp.riskFreeRate;
  const gTCentral = rf != null ? Math.min(rf, 0.03) : 0.025;
  const rev = inp.revH.slice(-6);
  const revGrowthKnown = g != null;

  const g0c = clamp(g, -0.08, 0.25);
  const cyc = kind === 'cyclical';
  // Central margin: cyclicals revert fully to their own median (either direction); everything
  // else only recovers HALF of a shortfall versus its own median and never reverts a margin
  // that is currently above it (a structural improvement is not assumed away; the conservative
  // case covers a reversal).
  const marginCentral = cyc ? mMed : m0 + 0.5 * Math.max(0, mMed - m0);

  const roic0 = isNum(inp.roicReported) ? inp.roicReported : null;
  const roicCentral = clamp(roic0 ?? wacc.value, wacc.value, 0.30);
  const roicCons = Math.max(wacc.value, roicCentral * 0.7);

  const dilutionExcess = (() => {
    if (inp.shareDilutionPct == null || inp.shareHistoryYears < 3) return { v: null };
    const yrs = Math.max(1, inp.shareHistoryYears - 1);
    const annual = Math.pow(1 + inp.shareDilutionPct, 1 / yrs) - 1;
    const sbcPct = isNum(inp.sbc) && inp.marketCap > 0 ? inp.sbc / inp.marketCap : 0;
    return { v: Math.max(0, annual - sbcPct), annual, sbcPct };
  })();

  const common = { tax: taxRate.value, margin0: m0 };
  const evEbitBand = inp.bench.evEbit || [9, 15, 23];
  const declining = g0c < 0;

  const central = {
    key: 'central', label: 'Central', ...common,
    g0: g0c, gT: declining ? 0 : gTCentral,
    marginTarget: marginCentral,
    roicInc: roicCentral, roicT: wacc.value + 0.5 * (roicCentral - wacc.value),
    wacc: wacc.value,
    terminalMethod: cyc ? 'multiple' : 'gordon', exitMultiple: evEbitBand[1],
    excessDilution: dilutionExcess.v == null ? 0 : dilutionExcess.v * 0.5,
  };
  const conservative = {
    key: 'conservative', label: 'Conservador', ...common,
    g0: g0c > 0 ? g0c * 0.6 : g0c - 0.02,
    gT: declining ? Math.max(-0.03, (g0c - 0.02) / 2) : Math.max(0, gTCentral - 0.01),
    marginTarget: Math.max(0.005, Math.min(m0, mMed) * 0.85),
    roicInc: roicCons, roicT: wacc.value,
    wacc: wacc.value + 0.01,
    terminalMethod: cyc ? 'multiple' : 'gordon', exitMultiple: evEbitBand[0],
    excessDilution: dilutionExcess.v == null ? 0 : dilutionExcess.v,
  };
  const optimistic = {
    key: 'optimistic', label: 'Optimista', ...common,
    g0: g0c > 0 ? Math.min(0.30, g0c * 1.25 + 0.01) : g0c * 0.25,
    gT: rf != null ? Math.min(rf, 0.035) : 0.03,
    marginTarget: Math.max(m0, marginCentral, 0.5 * (mMed + mMax)),
    roicInc: roicCentral, roicT: wacc.value + 0.75 * (roicCentral - wacc.value),
    wacc: Math.max(0.05, wacc.value - 0.01),
    terminalMethod: cyc ? 'multiple' : 'gordon', exitMultiple: (evEbitBand[1] + evEbitBand[2]) / 2,
    excessDilution: 0,
  };
  return { conservative, central, optimistic, meta: { revGrowthKnown, mMed, mMax, m0, dilutionExcess, historyYears: rev.length } };
}

export function insufficient(reason, extra = {}) {
  return { status: 'insufficient', reason, scenarios: [], ...extra };
}

// What would have to be true for the current price to earn the required return. Not a forecast.
function requiredConditions(inp, cfg) {
  if (!isNum(inp.price) || !isNum(inp.shares) || !isNum(inp.rev) || inp.rev <= 0 || !inp.bench.evSales) return null;
  const targetEquity5 = inp.price * inp.shares * Math.pow(1 + cfg.requiredReturn, cfg.horizon);
  const nd = isNum(inp.netDebt) ? inp.netDebt : 0;
  const ev5 = targetEquity5 + nd;
  const mult = inp.bench.evSales[1];
  const revNeeded = ev5 / mult;
  const netDebtNote = isNum(inp.netDebt) ? '' : ' (No se ha podido incluir la deuda neta.)';
  if (revNeeded <= 0) {
    // Net cash alone already exceeds the required year-5 equity value (common
    // for a pre-revenue/deeply-discounted cash-rich company, exactly the kind
    // this fallback targets) — revenue growth isn't the binding constraint,
    // so there's no revenue CAGR to report. Math.pow of a negative base to a
    // fractional exponent is NaN, which isn't just wrong here, it actively
    // misleads: it reads as "unknown" when the real answer is "not required".
    return {
      requiredRevenueYear5: round(revNeeded, 0),
      requiredRevenueGrowth: null,
      referenceEvSales: mult,
      text: `Con el precio de hoy, su caja neta ya cubre lo que la empresa tendría que valer dentro de cinco años para ganar un ${(cfg.requiredReturn * 100).toFixed(0)}% anual (a ${mult} veces ventas, referencia orientativa del sector) — el crecimiento de ingresos no es la condición que falla aquí.${netDebtNote}`,
    };
  }
  const growth = Math.pow(revNeeded / inp.rev, 1 / cfg.horizon) - 1;
  return {
    requiredRevenueYear5: round(revNeeded, 0),
    requiredRevenueGrowth: round(growth, 4),
    referenceEvSales: mult,
    text: `Para ganar un ${(cfg.requiredReturn * 100).toFixed(0)}% anual con el precio de hoy, y si el mercado la valorase entonces a ${mult} veces sus ventas (referencia orientativa del sector), sus ingresos tendrían que crecer de media un ${(growth * 100).toFixed(0)}% al año durante cinco años. Es lo que tendría que ocurrir, no una previsión.${netDebtNote}`,
  };
}

function sensitivity(inp, base, cfg) {
  const gridG = [-0.03, 0, 0.03];
  const gridM = [-0.03, 0, 0.03];
  const cells = [];
  gridG.forEach((dg) => gridM.forEach((dm) => {
    const r = runScenario(inp, { ...base, g0: base.g0 + dg, marginTarget: Math.max(0.0, base.marginTarget + dm) }, cfg);
    cells.push({ dGrowth: dg, dMargin: dm, valueYear5: r.valueYear5, fairValueToday: r.fairValueToday });
  }));
  const dGrid = [-0.01, 0, 0.01];
  const waccCells = [];
  dGrid.forEach((dw) => dGrid.forEach((dgT) => {
    const r = runScenario(inp, { ...base, wacc: base.wacc + dw, gT: base.gT + dgT }, cfg);
    waccCells.push({ dWacc: dw, dTerminalGrowth: dgT, fairValueToday: r.fairValueToday });
  }));
  const vals = cells.map((c) => c.valueYear5).filter(isNum);
  const centralVal = cells.find((c) => c.dGrowth === 0 && c.dMargin === 0)?.valueYear5;
  const spread = vals.length && isNum(centralVal) && centralVal > 0 ? (Math.max(...vals) - Math.min(...vals)) / centralVal : null;
  const fv = waccCells.map((c) => c.fairValueToday).filter(isNum);
  const fvCentral = waccCells.find((c) => c.dWacc === 0 && c.dTerminalGrowth === 0)?.fairValueToday;
  const fvSpread = fv.length && isNum(fvCentral) && fvCentral > 0 ? (Math.max(...fv) - Math.min(...fv)) / fvCentral : null;
  return {
    growthMargin: cells, waccTerminal: waccCells,
    spreadGrowthMargin: round(spread, 2), spreadWaccTerminal: round(fvSpread, 2),
    verySensitive: (spread != null && spread > 1.0) || (fvSpread != null && fvSpread > 0.8),
    note: 'Valor futuro del escenario central al variar crecimiento y margen en ±3 puntos, y valor razonable de hoy al variar tasa de descuento y crecimiento terminal en ±1 punto.',
  };
}

function bankScenarios(inp, cfg) {
  if (!isNum(inp.equity) || inp.equity <= 0 || !isNum(inp.shares) || !isNum(inp.price) || !isNum(inp.ni) || inp.ni <= 0) {
    return insufficient('Para un banco o aseguradora hacen falta patrimonio y beneficio neto positivos; no están disponibles o no son positivos.');
  }
  const bvps = inp.equity / inp.shares;
  const roe0 = inp.ni / inp.equity;
  const roes = inp.niH.map((n) => { const e = inp.equityH.find((x) => x.y === n.y); return e && e.val > 0 ? n.val / e.val : null; }).filter(isNum).slice(-7);
  const roeMed = roes.length >= 3 ? median(roes) : roe0;
  const rf = inp.riskFreeRate ?? 0.04;
  const coe = clamp(rf + (inp.beta ?? 1) * 0.045, 0.08, 0.14);
  const defs = [
    { key: 'conservative', label: 'Conservador', roe: Math.min(roe0, roeMed) - 0.02, gT: 0.02, coe: coe + 0.01 },
    { key: 'central', label: 'Central', roe: (roe0 + roeMed) / 2, gT: 0.03, coe },
    { key: 'optimistic', label: 'Optimista', roe: Math.max(roe0, roeMed) + 0.01, gT: Math.min(0.035, rf), coe: coe - 0.005 },
  ];
  const scenarios = defs.map((d) => {
    const roe = Math.max(0.01, d.roe);
    const bv5 = bvps * Math.pow(1 + roe, cfg.horizon);
    const pb = clamp((roe - d.gT) / (d.coe - d.gT), 0.4, 3.0);
    const value5 = bv5 * pb;
    const fairToday = bvps * clamp((Math.min(roe0, roe) - d.gT) / (d.coe - d.gT), 0.4, 3.0);
    return {
      key: d.key, label: d.label,
      assumptions: { roeYear5: round(roe, 4), costOfEquity: round(d.coe, 4), terminalGrowth: d.gT, terminalMethod: 'P/valor contable justificado = (ROE - g) / (coste del capital - g)' },
      bookValuePerShareToday: round(bvps, 2), bookValuePerShareYear5: round(bv5, 2), justifiedPriceToBook: round(pb, 2),
      sharesToday: round(inp.shares, 0), sharesYear5: round(inp.shares, 0),
      fairValueToday: round(fairToday, 2), valueYear5: round(value5, 2),
      cagr: round(Math.pow(value5 / inp.price, 1 / cfg.horizon) - 1, 4),
      maxEntryPrice: round(value5 / Math.pow(1 + cfg.requiredReturn, cfg.horizon), 2),
      marginOfSafety: fairToday > 0 ? round((fairToday - inp.price) / fairToday, 4) : null,
    };
  });
  return {
    status: 'ok', model: 'bank_justified_pb', modelLabel: 'Modelo simplificado de P/valor contable justificado',
    scenarios, central: scenarios.find((e) => e.key === 'central'),
    warnings: ['Estimación simplificada: se asume que el banco retiene todo su beneficio. Faltan ratio de capital, morosidad y margen de intereses.'],
    conditions: scenarios.map((e) => `${e.label}: ROE de ${(e.assumptions.roeYear5 * 100).toFixed(1)}% sostenido cinco años y un P/valor contable justificado de ${e.justifiedPriceToBook}x.`),
    notProbabilities: 'Los tres escenarios no tienen probabilidades asignadas ni el central es la media de los otros dos.',
    horizon: cfg.horizon,
  };
}

export function computeScenarios(inp, profile, config = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const kind = profile.kind;
  if (!isNum(inp.price) || inp.price <= 0 || !isNum(inp.shares) || inp.shares <= 0) return insufficient('Falta el precio o el número de acciones.');
  if (kind === 'reit') return insufficient('Una REIT se valora por FFO/AFFO y valor de sus inmuebles, datos que no están en las fuentes actuales. No se genera una proyección inventada.');
  if (kind === 'financial') return { ...bankScenarios(inp, cfg), requiredReturn: cfg.requiredReturn };
  if (kind === 'unknown') return insufficient('No se pudo clasificar el modelo de negocio con los datos disponibles.');
  if (kind === 'structurallyUnprofitable' || kind === 'temporarilyUnprofitable' || !(inp.oi > 0)) {
    return insufficient(kind === 'temporarilyUnprofitable'
      ? 'Hoy no tiene beneficio operativo y no hay forma objetiva de saber cuándo y a qué nivel lo recuperará. Proyectar un margen futuro sería una conjetura.'
      : 'No tiene beneficios ni un camino a ellos demostrado por los datos. Un valor por acción dependería por completo de supuestos inventados.',
      { requiredConditions: requiredConditions(inp, cfg) });
  }
  if (!isNum(inp.rev) || inp.rev <= 0) return insufficient('Faltan los ingresos.');
  if (inp.netDebt == null) return insufficient('Falta la deuda o la caja: sin ellas no se puede pasar de valor de empresa a valor por acción sin riesgo de contar mal la deuda.');
  if (sustainableGrowth(inp) == null) return insufficient('No hay historial de ingresos para estimar el crecimiento de partida.');

  const wacc = costOfCapital(inp);
  const taxRate = effectiveTaxRate(inp);
  const params = buildParams(inp, profile, wacc, taxRate);
  const results = [params.conservative, params.central, params.optimistic].map((p) => runScenario(inp, p, cfg));
  const central = results.find((r) => r.key === 'central');
  if (central.valueYear5 == null) {
    return insufficient('El valor de la empresa no cubre su deuda neta en el escenario central, así que el valor por acción sale negativo. Suele ocurrir cuando la deuda incluye la de una división financiera propia (financieras de coches, por ejemplo) y no se puede separar con las fuentes actuales. No se muestra una cifra poco fiable.');
  }
  const sens = sensitivity(inp, params.central, cfg);

  const warnings = [];
  if (wacc.assumed) warnings.push(wacc.note);
  if (taxRate.assumed) warnings.push('Tipo impositivo efectivo no calculable: se usa un 21% como supuesto.');
  if (!isNum(inp.roicReported)) warnings.push('ROIC no disponible: se supone que el crecimiento solo rinde el coste del capital (no crea valor extra).');
  if (central.terminalValueShare != null && central.terminalValueShare > 0.75) warnings.push(`El valor terminal pesa un ${(central.terminalValueShare * 100).toFixed(0)}% del valor total: la mayor parte del resultado depende de lo que ocurra después de cinco años.`);
  if (central.impliedTerminalEvEbit != null && inp.bench.evEbit && central.impliedTerminalEvEbit > inp.bench.evEbit[2]) warnings.push(`El valor terminal implica ${central.impliedTerminalEvEbit} veces el EBIT, por encima del rango alto orientativo del sector (${inp.bench.evEbit[2]}x). Revisa si el supuesto es demasiado optimista.`);
  if (sens.verySensitive) warnings.push('El resultado es muy sensible a los supuestos de crecimiento, margen o tasa de descuento: trata la cifra como un rango, no como un precio.');
  if (params.meta.dilutionExcess.v == null) warnings.push('La dilución histórica no se puede medir (historial de acciones insuficiente): no se proyecta emisión adicional de acciones.');
  if (kind === 'recovery') warnings.push('Empresa en recuperación: el margen actual puede no ser estable y el escenario central puede quedarse corto o largo.');
  if (kind === 'cyclical') warnings.push('Empresa cíclica: el valor final usa un múltiplo terminal sobre márgenes normalizados, no un crecimiento perpetuo.');

  const conditions = [
    `Escenario conservador: ingresos con una variación del ${(params.conservative.g0 * 100).toFixed(1)}% el primer año y margen operativo que baja hasta el ${(params.conservative.marginTarget * 100).toFixed(1)}%.`,
    `Escenario central: ingresos con una variación inicial del ${(params.central.g0 * 100).toFixed(1)}% que se modera hasta ${(params.central.gT * 100).toFixed(1)}% en diez años, y margen operativo de ${(params.central.marginTarget * 100).toFixed(1)}% (${kind === 'cyclical' ? 'su mediana histórica' : 'el actual, o la mitad del camino hacia su mediana si hoy está por debajo'}).`,
    `Escenario optimista: ingresos con una variación inicial del ${(params.optimistic.g0 * 100).toFixed(1)}% y margen operativo del ${(params.optimistic.marginTarget * 100).toFixed(1)}%, sin superar lo que la empresa ya demostró.`,
  ];

  return {
    status: 'ok', model: kind === 'cyclical' ? 'cyclical_multiple' : 'dcf', modelLabel: kind === 'cyclical' ? 'Múltiplo terminal sobre márgenes normalizados' : 'Descuento de flujos de caja (DCF) con valor terminal',
    requiredReturn: cfg.requiredReturn, horizon: cfg.horizon,
    scenarios: results, central, sensitivity: sens, warnings, conditions,
    notProbabilities: 'Los tres escenarios no tienen probabilidades asignadas ni el central es la media de los otros dos.',
    meta: { historyYears: params.meta.historyYears },
  };
}
