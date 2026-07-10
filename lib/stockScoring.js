// Pure scoring/valuation calculations for the stock detail page. Moved out
// of app/(workspace)/stock/[ticker]/page.js verbatim — the formulas below
// are unchanged, only their location and parameters (previously closures
// over component state/props) changed.

export function getDimScore(dim, questions, answers) {
  const indices = questions.map((q, i) => q.dim === dim ? i : -1).filter(i => i >= 0);
  const answered = indices.filter(i => answers[i] === 'YES' || answers[i] === 'NO');
  if (!answered.length) return null;
  return Math.round((answered.filter(i => answers[i] === 'YES').length / answered.length) * 100);
}

export function totalScore(dims, questions, answers) {
  const scores = dims.map(d => getDimScore(d, questions, answers)).filter(s => s !== null);
  if (!scores.length) return null;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

// "Numbers, Simplified" quality score — adapted from the user's own personal
// stock-picking spreadsheet (CBS/GQS/OPPO/Moat/Final Note naming and structure
// come directly from it). One deliberate deviation: the spreadsheet scores ROIC
// against WACC (ROIC spread), but this app doesn't estimate WACC per ticker yet,
// so `roicScore` below stays a sector-relative-threshold proxy for that spread
// until WACC estimation gets built. Returns null when `hasFundamentals` is
// false — computing this on a ticker with no SEC/Finnhub data would just
// produce a plausible-looking but entirely made-up result, since every input
// would default to its neutral midpoint.
export function computeEasyMode(data, hasFundamentals) {
  if (!hasFundamentals) return null;
  const sector = (data.sector || '').toLowerCase();
  const isFinancial = sector.includes('bank') || sector.includes('insurance') || sector.includes('financial');
  const isTech = sector.includes('tech') || sector.includes('software') || sector.includes('semi');
  const isPharma = sector.includes('pharma') || sector.includes('biotech') || sector.includes('health');
  const isConsumer = sector.includes('retail') || sector.includes('consumer') || sector.includes('food') || sector.includes('beverage');
  const isEnergy = sector.includes('energy') || sector.includes('oil') || sector.includes('gas');
  const roicThreshold = isTech ? 0.25 : isPharma ? 0.20 : isConsumer ? 0.20 : isEnergy ? 0.12 : 0.15;
  const gmThreshold = isTech ? 0.65 : isPharma ? 0.65 : isConsumer ? 0.45 : isFinancial ? 0.30 : isEnergy ? 0.25 : 0.35;
  const omThreshold = isTech ? 0.20 : isPharma ? 0.20 : isConsumer ? 0.15 : isFinancial ? 0.15 : isEnergy ? 0.12 : 0.15;
  const roicScore = data.roic == null ? 2.5 : data.roic/100 >= roicThreshold*2 ? 5 : data.roic/100 >= roicThreshold*1.5 ? 4.5 : data.roic/100 >= roicThreshold ? 4 : data.roic/100 >= roicThreshold*0.7 ? 3 : data.roic/100 >= roicThreshold*0.4 ? 2 : 1;
  const gmScore = data.grossMargin == null ? 2.5 : data.grossMargin/100 >= gmThreshold*1.4 ? 5 : data.grossMargin/100 >= gmThreshold*1.15 ? 4.5 : data.grossMargin/100 >= gmThreshold ? 4 : data.grossMargin/100 >= gmThreshold*0.75 ? 3 : data.grossMargin/100 >= gmThreshold*0.5 ? 2 : 1;
  const omScore = data.opMargin == null ? 2.5 : data.opMargin/100 >= omThreshold*2 ? 5 : data.opMargin/100 >= omThreshold*1.5 ? 4.5 : data.opMargin/100 >= omThreshold ? 4 : data.opMargin/100 >= omThreshold*0.65 ? 3 : data.opMargin/100 > 0 ? 2 : 1;
  const deScore = data.debtToEquity == null ? 2.5 : data.debtToEquity < 0.3 ? 5 : data.debtToEquity < 0.7 ? 4.5 : data.debtToEquity < 1.2 ? 4 : data.debtToEquity < 2 ? 3 : data.debtToEquity < 3 ? 2 : 1;

  // Current ratio (liquidity) — new signal from the spreadsheet, absent before.
  const currentRatio = data.currentAssetsVal != null && data.currentLiabilitiesVal ? data.currentAssetsVal / data.currentLiabilitiesVal : null;
  const crScore = currentRatio == null ? 2.5 : currentRatio < 1 ? 1 : Math.min(5, currentRatio * 1.5);

  // Surplus cash — FCF haircut by leverage; a small CBS bonus when positive,
  // same as the spreadsheet's "Total Surplus" > 0 check.
  const surplusCash = data.fcfVal != null && data.debtToEquity != null ? data.fcfVal * (1 - Math.min(1, data.debtToEquity) * 0.4) : null;

  const cbs = Math.min(5, Math.max(1,
    gmScore * 0.20 + omScore * 0.20 + deScore * 0.20 + crScore * 0.20 + roicScore * 0.20
    + (surplusCash != null && surplusCash > 0 ? 0.2 : 0)
  ));

  const pfcfScore = data.pfcf == null || data.pfcf <= 0 ? 1 : data.pfcf < 12 ? 5 : data.pfcf < 18 ? 4.5 : data.pfcf < 25 ? 4 : data.pfcf < 35 ? 3 : data.pfcf < 50 ? 2 : 1;
  const fcfYieldScore = data.fcfYield == null ? 1 : data.fcfYield > 8 ? 5 : data.fcfYield > 5 ? 4.5 : data.fcfYield > 3 ? 4 : data.fcfYield > 1.5 ? 3 : data.fcfYield > 0 ? 2 : 1;
  const oppo = (pfcfScore*0.55 + fcfYieldScore*0.45);

  // R&D and SBC as a % of revenue — reinvestment intensity vs. dilution cost,
  // both from the spreadsheet's GQS. Only applied when the underlying line
  // items are actually reported (many non-tech/non-pharma filers omit R&D).
  const revGrowthScore = data.revGrowth == null ? 2.5 : data.revGrowth > 25 ? 5 : data.revGrowth > 15 ? 4.5 : data.revGrowth > 8 ? 4 : data.revGrowth > 3 ? 3 : data.revGrowth > 0 ? 2 : 1;
  const rdToRevenue = data.rdVal != null && data.revVal ? data.rdVal / data.revVal : null;
  const sbcToRevenue = data.sbcVal != null && data.revVal ? data.sbcVal / data.revVal : null;
  const rdBonus = rdToRevenue == null ? 0 : rdToRevenue > 0.15 ? 0.5 : rdToRevenue < 0.05 ? -0.25 : 0;
  const sbcPenalty = sbcToRevenue == null ? 0 : sbcToRevenue > 0.10 ? -1 : sbcToRevenue < 0.04 ? 0.25 : 0;
  const lossPenalty = data.opMargin != null && data.opMargin < 0 ? -0.2 : 0;
  const gqs = Math.min(5, Math.max(1, roicScore * 0.5 + revGrowthScore * 0.5 + rdBonus + sbcPenalty + lossPenalty));

  // Moat — wide if the business earns outsized returns AND margins, narrow if
  // just one of the two, none otherwise. Same shape as the spreadsheet, with
  // roicScore standing in for ROIC spread for the reason noted above.
  const moat = roicScore >= 4 && data.opMargin != null && data.opMargin > 20 ? 'WIDE'
    : (roicScore >= 3 || (data.opMargin != null && data.opMargin > 12)) ? 'NARROW'
    : 'NONE';
  const moatBonus = moat === 'WIDE' ? 0.2 : moat === 'NARROW' ? 0 : -0.2;
  const moatColor = moat === 'WIDE' ? 'var(--ws-accent)' : moat === 'NARROW' ? 'var(--ws-text-2)' : 'var(--ws-red)';

  const finalNote = Math.min(5, Math.max(1, cbs*0.45 + oppo*0.30 + gqs*0.25 + moatBonus));
  const score100 = Math.round((finalNote / 5) * 100);

  let verdict, verdictColor;
  if (score100 >= 70) { verdict = 'Solid & steady'; verdictColor = 'var(--ws-accent)'; }
  else if (score100 >= 40) { verdict = 'Mixed signals'; verdictColor = 'var(--ws-text-2)'; }
  else { verdict = 'Needs caution'; verdictColor = 'var(--ws-red)'; }

  let summary;
  if (data.revGrowth != null && data.fcfVal != null && data.debtToEquity != null) {
    const growthPart = data.revGrowth > 5 ? `grows revenue at a healthy pace` : data.revGrowth > 0 ? `grows revenue slowly` : `has shrinking revenue`;
    const cashPart = data.fcfVal > 0 ? `generates strong cash flow` : `is burning cash`;
    const debtPart = data.debtToEquity < 1.2 ? `carries manageable debt` : `carries significant debt`;
    summary = `${data.name?.split(' ')[0] || 'This company'} ${growthPart}, ${cashPart}, and ${debtPart}.`;
  } else {
    summary = `Not enough data yet to give a full picture for ${data.name || 'this company'}.`;
  }

  return {
    score100, verdict, verdictColor, summary,
    cbs, oppo, gqs, finalNote, moat, moatColor,
    roicThreshold, gmThreshold, omThreshold,
    roicScore, gmScore, omScore, deScore, crScore, pfcfScore, fcfYieldScore, revGrowthScore,
    currentRatio, rdToRevenue, sbcToRevenue, surplusCash,
  };
}

// WACC via CAPM: cost of equity = risk-free + beta x ERP, cost of debt = interest
// expense / debt (pre-tax) x (1 - effective tax rate), weighted by market cap vs. debt.
// ERP (equity risk premium) is a long-run assumption (~Damodaran's US estimate), not a
// live figure — unlike a bond yield it doesn't swing day to day, so a documented
// constant is standard practice here, not the same "stale number pretending to be
// live data" problem the old Graham formula had.
const EQUITY_RISK_PREMIUM = 0.045;

export function computeWACC(data, riskFreeRate) {
  if (!data.marketCap || riskFreeRate == null) return null;
  const beta = data.beta ?? 1.0;
  const costOfEquity = riskFreeRate + beta * EQUITY_RISK_PREMIUM;

  const debt = data.debtVal ?? 0;
  const equity = data.marketCap;
  const totalCapital = debt + equity;
  const debtWeight = totalCapital > 0 ? debt / totalCapital : 0;
  const equityWeight = 1 - debtWeight;

  const costOfDebtPretax = data.interestVal != null && debt > 0
    ? Math.min(0.15, Math.max(0.02, data.interestVal / debt))
    : riskFreeRate + 0.02;
  const taxRate = data.taxVal != null && data.ebtVal
    ? Math.min(0.35, Math.max(0, data.taxVal / data.ebtVal))
    : 0.21;
  const costOfDebtAfterTax = costOfDebtPretax * (1 - taxRate);

  const wacc = equityWeight * costOfEquity + debtWeight * costOfDebtAfterTax;
  return Math.min(0.20, Math.max(0.04, wacc));
}

// Reverse-solves the Gordon Growth Model (MarketCap = FCF(1+g)/(WACC-g)) for g — the
// growth rate the market is currently pricing in, given today's FCF, market cap and WACC.
// Used as the DCF's central growth assumption so the model starts from what the market
// already believes rather than an arbitrary guess, the same way the source spreadsheet
// anchors its projection.
export function computeImpliedGrowth(marketCap, fcf, wacc) {
  if (!marketCap || !fcf || fcf <= 0 || wacc == null) return null;
  const g = (marketCap * wacc - fcf) / (fcf + marketCap);
  return Math.max(-0.15, Math.min(0.30, g));
}

// Single-point WACC-discounted DCF: 10 years of FCF compounded at a flat growth rate,
// terminal value via exit P/FCF multiple (not Gordon perpetuity — matches the source
// spreadsheet), both discounted back at WACC. `dilutionPct` and `fcfMultiplier` model
// share dilution and FCF-quality risk respectively (both default to "no change") — the
// two extra dimensions the small-cap version of the spreadsheet adds on top of the
// large-cap one, since they matter for any cash-burning grower, not just small caps.
// Every parameter is independently overridable so this one function can produce both
// the bear/base/bull scenarios and every cell of the stress-test grids below.
export function computeDCFPointValue(data, riskFreeRate, overrides = {}) {
  if (!data.fcfVal || data.fcfVal <= 0 || !data.sharesOutstanding || !data.marketCap) return null;

  const baseWacc = computeWACC(data, riskFreeRate);
  if (!baseWacc) return null;
  const wacc = overrides.wacc ?? baseWacc;

  const baseGrowth = computeImpliedGrowth(data.marketCap, data.fcfVal, baseWacc);
  if (baseGrowth == null) return null;
  const growth = overrides.growth ?? baseGrowth;

  const exitMultiple = overrides.exitMultiple ?? (data.pfcf && data.pfcf > 0 ? data.pfcf : 15);
  const dilutionPct = overrides.dilutionPct ?? 0;
  const fcfMultiplier = overrides.fcfMultiplier ?? 1;

  const surplusCash = data.fcfVal * (1 - Math.min(1, data.debtToEquity ?? 0) * 0.4);
  const shares = data.sharesOutstanding * (1 + dilutionPct);

  let fcf = data.fcfVal * fcfMultiplier;
  let pvExplicit = 0;
  for (let year = 1; year <= 10; year++) {
    fcf = fcf * (1 + growth);
    pvExplicit += fcf / Math.pow(1 + wacc, year);
  }
  const terminalValue = fcf * exitMultiple;
  const pvTerminal = terminalValue / Math.pow(1 + wacc, 10);
  const totalPV = pvExplicit + pvTerminal;
  const value = (totalPV + surplusCash) / shares;

  return value > 0 ? value : null;
}

export function computeDCFValue(data, riskFreeRate) {
  const wacc = computeWACC(data, riskFreeRate);
  if (!wacc || !data.fcfVal || data.fcfVal <= 0 || !data.sharesOutstanding || !data.marketCap) return null;

  const baseGrowth = computeImpliedGrowth(data.marketCap, data.fcfVal, wacc);
  if (baseGrowth == null) return null;

  const exitMultiple = data.pfcf && data.pfcf > 0 ? data.pfcf : 15;

  const buildScenario = (key, label, waccDelta, growthDelta, primary) => {
    const scenarioWacc = Math.min(0.25, Math.max(0.04, wacc + waccDelta));
    const scenarioGrowth = Math.max(-0.20, Math.min(0.35, baseGrowth + growthDelta));
    const value = +computeDCFPointValue(data, riskFreeRate, { wacc: scenarioWacc, growth: scenarioGrowth, exitMultiple }).toFixed(2);
    return { key, label, primary, value, wacc: scenarioWacc, growth: scenarioGrowth };
  };

  return {
    wacc, baseGrowth, exitMultiple,
    scenarios: [
      buildScenario('bear', 'BEAR CASE', 0.015, -0.02, false),
      buildScenario('base', 'BASE CASE', 0, 0, true),
      buildScenario('bull', 'BULL CASE', -0.015, 0.02, false),
    ],
  };
}

// The 6 stress-test grids from both spreadsheets (large-cap DASHBOARD's 4 + the
// small-cap version's 2 extra: dilution and FCF-quality). Each sweeps 2 of the DCF's 5
// parameters across a fixed axis while the rest stay at their computed base case —
// same "one formula, many what-ifs" shape as the source sheets' MAKEARRAY tables.
const PCT_AXIS = (vals) => vals.map(v => ({ value: v, label: `${(v * 100).toFixed(0)}%` }));
const MULT_AXIS = (vals) => vals.map(v => ({ value: v, label: `${v}x` }));

export const DCF_STRESS_TABLES = {
  growthWacc: {
    label: 'Growth × WACC Stress Test',
    rowParam: 'wacc', rowAxis: PCT_AXIS([0.06, 0.08, 0.10, 0.12, 0.15]), rowLabel: 'WACC',
    colParam: 'growth', colAxis: PCT_AXIS([0, 0.05, 0.10, 0.15, 0.20, 0.25]), colLabel: 'GROWTH',
  },
  buyTrigger: {
    label: 'Buy Trigger (Opportunity Calculator)',
    rowParam: 'wacc', rowAxis: PCT_AXIS([0.10, 0.15, 0.20, 0.25, 0.30]), rowLabel: 'DEMANDED RETURN',
    colParam: 'growth', colAxis: PCT_AXIS([0, 0.05, 0.10, 0.15, 0.20, 0.25]), colLabel: 'GROWTH',
  },
  crashTest: {
    label: 'Crash Test (Macro Squeeze)',
    rowParam: 'wacc', rowAxis: PCT_AXIS([0.06, 0.08, 0.10, 0.12, 0.15]), rowLabel: 'WACC',
    colParam: 'exitMultiple', colAxis: MULT_AXIS([8, 12, 16, 20, 25, 30]), colLabel: 'EXIT MULTIPLE',
  },
  ownerShare: {
    label: 'Owner Share (Market Reality)',
    rowParam: 'exitMultiple', rowAxis: MULT_AXIS([10, 15, 20, 25, 30]), rowLabel: 'EXIT MULTIPLE',
    colParam: 'growth', colAxis: PCT_AXIS([0, 0.05, 0.10, 0.15, 0.20, 0.25]), colLabel: 'GROWTH',
  },
  dilutionSqueeze: {
    label: 'Dilution Squeeze (Value Trap)',
    rowParam: 'growth', rowAxis: PCT_AXIS([0, 0.05, 0.10, 0.15, 0.20]), rowLabel: 'GROWTH',
    colParam: 'dilutionPct', colAxis: PCT_AXIS([0, 0.05, 0.10, 0.15, 0.25, 0.40]), colLabel: 'DILUTION',
  },
  marginSqueeze: {
    label: 'Margin Check (Profit Squeeze)',
    rowParam: 'growth', rowAxis: PCT_AXIS([0, 0.05, 0.10, 0.15, 0.20]), rowLabel: 'GROWTH',
    colParam: 'fcfMultiplier', colAxis: MULT_AXIS([0.5, 0.7, 0.85, 1.0, 1.15, 1.3]), colLabel: 'FCF MULTIPLIER',
  },
};

export function computeDCFStressGrid(data, riskFreeRate, tableKey) {
  const cfg = DCF_STRESS_TABLES[tableKey];
  if (!cfg) return null;
  const matrix = cfg.rowAxis.map(row =>
    cfg.colAxis.map(col => {
      const value = computeDCFPointValue(data, riskFreeRate, { [cfg.rowParam]: row.value, [cfg.colParam]: col.value });
      return value != null ? +value.toFixed(2) : null;
    })
  );
  return { ...cfg, matrix };
}

// `estimate` is always positive when present — computeTraqckerValue already refuses to
// produce a value on non-positive EPS, so callers only need to check for null here.
// Blends up to three drift signals into one annualized rate for the price projector: the
// DCF's market-implied growth (same figure driving the DCF tab), the stock's own historical
// CAGR (what it has actually done), and the sell-side consensus target (what analysts expect
// over roughly the next 12 months). Averages whichever are available and clamps to a wide but
// finite band so a CREG-style outlier can't send the projection to the moon or to zero.
export function computeProjectionDrift({ impliedGrowth, historicalCagr, analystDrift }) {
  const signals = [impliedGrowth, historicalCagr, analystDrift].filter(v => v != null && isFinite(v));
  if (!signals.length) return null;
  const avg = signals.reduce((a, b) => a + b, 0) / signals.length;
  return Math.max(-0.25, Math.min(0.40, avg));
}

// Annualized volatility from a series of daily closes (stdev of daily log returns x
// sqrt(252)). Clamped to a floor/ceiling so a handful of stale or illiquid prints can't
// collapse the confidence band to a flat line or blow it out to something unusable.
export function computeAnnualizedVolatility(closes) {
  if (!closes || closes.length < 10) return null;
  const rets = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > 0 && closes[i - 1] > 0) rets.push(Math.log(closes[i] / closes[i - 1]));
  }
  if (rets.length < 5) return null;
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1);
  return Math.max(0.12, Math.min(1.5, Math.sqrt(variance) * Math.sqrt(252)));
}

// Historical CAGR from the first/last close of a daily series — one of the three
// projection drift signals blended by computeProjectionDrift above.
export function computeHistoricalCagr(closes) {
  if (!closes || closes.length < 2) return null;
  const first = closes[0], last = closes[closes.length - 1];
  if (!(first > 0) || !(last > 0)) return null;
  const years = closes.length / 252;
  if (years < 0.25) return null;
  return Math.pow(last / first, 1 / years) - 1;
}

// Inverse standard normal CDF (Acklam's rational approximation, ~1.15e-9 max error) — lets
// the GBM percentile band below be computed analytically instead of needing thousands of
// Monte Carlo paths for stable p10/p50/p90 estimates.
function invNormalCdf(p) {
  const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
  const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
  const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
  const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
  const pLow = 0.02425, pHigh = 1 - pLow;
  let q, r;
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= pHigh) {
    q = p - 0.5; r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  q = Math.sqrt(-2 * Math.log(1 - p));
  return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
}

// Geometric Brownian Motion price projection: one simulated random-walk path (so it reads
// like a real price chart, with genuine ups and downs) plus an analytic p10/p50/p90
// confidence band computed in closed form from GBM's lognormal distribution at each step —
// far cheaper than running enough Monte Carlo paths to get smooth percentiles, and exact
// rather than sampled. `rng` is injectable so the UI can force a fresh path on "reroll".
export function computeProjection({ price, driftAnnual, volAnnual, horizonYears, stepsPerYear = 52, rng = Math.random }) {
  if (!price || price <= 0 || driftAnnual == null || volAnnual == null || !horizonYears) return null;
  const totalSteps = Math.max(1, Math.round(horizonYears * stepsPerYear));
  const dt = 1 / stepsPerYear;

  let simPrice = price;
  const points = [{ step: 0, t: 0, sim: price, p10: price, p50: price, p90: price }];

  for (let i = 1; i <= totalSteps; i++) {
    const u1 = Math.max(rng(), 1e-9), u2 = rng();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    simPrice = simPrice * Math.exp((driftAnnual - 0.5 * volAnnual * volAnnual) * dt + volAnnual * Math.sqrt(dt) * z);

    const t = i * dt;
    const driftTerm = (driftAnnual - 0.5 * volAnnual * volAnnual) * t;
    const spread = volAnnual * Math.sqrt(t);
    const p10 = price * Math.exp(driftTerm + spread * invNormalCdf(0.10));
    const p50 = price * Math.exp(driftTerm);
    const p90 = price * Math.exp(driftTerm + spread * invNormalCdf(0.90));

    points.push({ step: i, t, sim: +simPrice.toFixed(2), p10: +p10.toFixed(2), p50: +p50.toFixed(2), p90: +p90.toFixed(2) });
  }

  return { points, driftAnnual, volAnnual, horizonYears };
}

export function computeFairValue(estimate, price) {
  if (!estimate || !price) return null;
  const ratio = price / estimate;
  const pct = Math.max(2, Math.min(98, ((ratio - 0.5) / 1.0) * 100));
  let tag;
  if (ratio < 0.85) tag = 'UNDERVALUED';
  else if (ratio < 1.05) tag = 'FAIR VALUE';
  else if (ratio < 1.3) tag = 'SLIGHTLY EXPENSIVE';
  else tag = 'EXPENSIVE';
  const tagColor = ratio < 0.85 ? 'var(--ws-accent)' : ratio < 1.05 ? 'var(--ws-accent)' : ratio < 1.3 ? 'var(--ws-text-2)' : 'var(--ws-red)';
  return { pct, tag, tagColor, estimate };
}
