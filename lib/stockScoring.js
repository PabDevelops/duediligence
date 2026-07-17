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

// Piecewise-linear interpolation between calibrated (value, score) anchor points, instead of
// a step-function ladder (`value >= threshold ? 5 : value >= threshold*0.7 ? 4 : ...`). The
// ladder's anchors were reasonable; the problem was that everything strictly between two
// anchors got silently rounded to whichever side it fell on, so a company sitting just under a
// cutoff scored identically to one sitting right at the bottom of the tier — and every
// composite built from these (CBS, OPPO, GQS, Final Note) inherited that same clustering,
// which is why the 0-100 display kept landing on suspiciously round numbers like 70. Ramping
// linearly between the same anchors keeps the calibration but lets a 68 be a 68, not a forced
// 70. `points` must be sorted ascending by value; flat before the first and after the last.
function interpolateScore(value, points) {
  if (value <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i];
    if (value <= x1) {
      const [x0, y0] = points[i - 1];
      return y0 + (y1 - y0) * (value - x0) / (x1 - x0);
    }
  }
  return points[points.length - 1][1];
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
  const industry = (data.industry || '').toLowerCase();
  const isFinancial = sector.includes('bank') || sector.includes('insurance') || sector.includes('financial');
  const isTech = sector.includes('tech') || sector.includes('software') || sector.includes('semi');
  const isPharma = sector.includes('pharma') || sector.includes('biotech') || sector.includes('health');
  const isConsumer = sector.includes('retail') || sector.includes('consumer') || sector.includes('food') || sector.includes('beverage');
  const isEnergy = sector.includes('energy') || sector.includes('oil') || sector.includes('gas');
  // "Technology" lumps asset-light pure software (80%+ gross margin is normal) in with
  // hardware/electronics (component costs put a hard ceiling well below that) — a single 65%
  // threshold reads Apple-style hardware+services mixes as failing a bar built for a SaaS
  // company. Industry-level detail (already used the same way in computeNormalizedExitMultiple
  // below) tells them apart; sector alone still gets the SaaS-calibrated threshold as before.
  const isHardwareTech = isTech && (industry.includes('hardware') || industry.includes('electronics') || industry.includes('semiconductor') || industry.includes('computer'));
  const roicThreshold = isTech ? 0.25 : isPharma ? 0.20 : isConsumer ? 0.20 : isEnergy ? 0.12 : 0.15;
  const gmThreshold = isHardwareTech ? 0.40 : isTech ? 0.65 : isPharma ? 0.65 : isConsumer ? 0.45 : isFinancial ? 0.30 : isEnergy ? 0.25 : 0.35;
  const omThreshold = isTech ? 0.20 : isPharma ? 0.20 : isConsumer ? 0.15 : isFinancial ? 0.15 : isEnergy ? 0.12 : 0.15;

  // NOPAT (after-tax) over invested capital net of cash — the standard ROIC definition.
  // data.roic (route.js) is pre-tax operating income over gross (debt+equity), which reads a
  // large cash pile or a buyback-shrunk equity base (Apple: 80.9% by that formula) as pure
  // operating efficiency when part of it is just balance-sheet mechanics. Same effective-tax-
  // rate clamp used in computeWACC/computeReinvestmentGrowth so a one-off tax benefit/charge
  // can't send NOPAT negative. Falls back to data.roic (or Finnhub's TTM figure already merged
  // into it) when there's not enough statement detail to compute the adjusted version.
  const investedCapitalNet = data.debtVal != null && data.equityVal != null ? data.debtVal + data.equityVal - (data.cashVal ?? 0) : null;
  const effTaxRate = data.ebtVal > 0 && data.taxVal != null ? Math.min(0.35, Math.max(0, data.taxVal / data.ebtVal)) : 0.21;
  const nopat = data.oiVal != null ? data.oiVal * (1 - effTaxRate) : null;
  const roicAdj = nopat != null && investedCapitalNet > 0 ? +((nopat / investedCapitalNet) * 100).toFixed(1) : null;
  const roicForScore = roicAdj ?? data.roic;

  const roicScore = roicForScore == null ? 2.5 : interpolateScore(roicForScore / 100,
    [[0, 1], [roicThreshold * 0.4, 2], [roicThreshold * 0.7, 3], [roicThreshold, 4], [roicThreshold * 1.5, 4.5], [roicThreshold * 2, 5]]);
  const gmScore = data.grossMargin == null ? 2.5 : interpolateScore(data.grossMargin / 100,
    [[0, 1], [gmThreshold * 0.5, 2], [gmThreshold * 0.75, 3], [gmThreshold, 4], [gmThreshold * 1.15, 4.5], [gmThreshold * 1.4, 5]]);
  const omScore = data.opMargin == null ? 2.5 : interpolateScore(data.opMargin / 100,
    [[-omThreshold * 0.5, 1], [0, 2], [omThreshold * 0.65, 3], [omThreshold, 4], [omThreshold * 1.5, 4.5], [omThreshold * 2, 5]]);

  // Debt net of cash when both are available — a company sitting on more cash than debt is
  // not "leveraged" just because the gross debt figure is nonzero. Falls back to gross D/E
  // (data.debtToEquity) when cash data isn't available to net against.
  const netDebtToEquity = data.debtVal != null && data.equityVal ? Math.max(0, data.debtVal - (data.cashVal ?? 0)) / data.equityVal : data.debtToEquity;
  const deScore = netDebtToEquity == null ? 2.5 : interpolateScore(netDebtToEquity,
    [[0, 5], [0.7, 4.5], [1.2, 4], [2, 3], [3, 2], [5, 1]]);

  // Current ratio (liquidity) — new signal from the spreadsheet, absent before. The old
  // version hard-floored *any* ratio under 1.0x to the worst possible score, which reads a
  // deliberately lean working-capital operator (Apple runs ~0.9x on purpose, financed by
  // supplier terms, not distress) identically to a company that's actually can't-pay-the-bills
  // illiquid. Ramping from (0, 1) instead of cliffing at 1.0 keeps "below 1x is worse than
  // above" without treating 0.89x the same as 0.2x.
  const currentRatio = data.currentAssetsVal != null && data.currentLiabilitiesVal ? data.currentAssetsVal / data.currentLiabilitiesVal : null;
  const crScore = currentRatio == null ? 2.5 : interpolateScore(currentRatio, [[0, 1], [1, 2], [3.33, 5]]);

  // Surplus cash — FCF haircut by leverage; a small CBS bonus when positive,
  // same as the spreadsheet's "Total Surplus" > 0 check.
  const surplusCash = data.fcfVal != null && data.debtToEquity != null ? data.fcfVal * (1 - Math.min(1, data.debtToEquity) * 0.4) : null;

  const cbs = Math.min(5, Math.max(1,
    gmScore * 0.20 + omScore * 0.20 + deScore * 0.20 + crScore * 0.20 + roicScore * 0.20
    + (surplusCash != null && surplusCash > 0 ? 0.2 : 0)
  ));

  const pfcfScore = data.pfcf == null || data.pfcf <= 0 ? 1 : interpolateScore(data.pfcf,
    [[0, 5], [12, 5], [18, 4.5], [25, 4], [35, 3], [50, 2], [80, 1]]);
  const fcfYieldScore = data.fcfYield == null ? 1 : interpolateScore(data.fcfYield,
    [[-5, 1], [0, 2], [1.5, 3], [3, 4], [5, 4.5], [8, 5]]);
  const oppo = (pfcfScore*0.55 + fcfYieldScore*0.45);

  // R&D and SBC as a % of revenue — reinvestment intensity vs. dilution cost,
  // both from the spreadsheet's GQS. Only applied when the underlying line
  // items are actually reported (many non-tech/non-pharma filers omit R&D).
  const revGrowthScore = data.revGrowth == null ? 2.5 : interpolateScore(data.revGrowth,
    [[-10, 1], [0, 2], [3, 3], [8, 4], [15, 4.5], [25, 5]]);
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

  // cbs/oppo/gqs are each already capped at 5 individually, so the only way this raw sum can
  // clear 5 (i.e. the moat bonus tips an already-near-perfect business over the normal 100%
  // ceiling) is a WIDE moat stacked on top of CBS/OPPO/GQS all sitting close to their own max
  // — checked against real tickers (Visa, Mastercard, ASML, Eli Lilly): all had excellent CBS/
  // GQS but OPPO (valuation) held them back, since paying up for quality is the normal state
  // of the market. This is meant to be rare — a business that's both elite AND still priced
  // cheap, not just elite.
  const rawFinalNote = cbs*0.45 + oppo*0.30 + gqs*0.25 + moatBonus;
  const finalNote = Math.min(5, Math.max(1, rawFinalNote));
  const score100 = Math.round((finalNote / 5) * 100);
  const isBlueGem = score100 > 95;

  let verdict, verdictColor;
  if (isBlueGem) { verdict = 'Hidden Gem'; verdictColor = '#3b82f6'; }
  else if (score100 >= 80) { verdict = 'Prime Quality'; verdictColor = 'var(--ws-accent)'; }
  else if (score100 >= 70) { verdict = 'Good Quality'; verdictColor = 'var(--ws-accent)'; }
  else if (score100 >= 40) { verdict = 'Average Quality'; verdictColor = 'var(--ws-text-2)'; }
  else { verdict = 'Underperforming'; verdictColor = 'var(--ws-red)'; }

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
    roicForScore, netDebtToEquity, isBlueGem,
  };
}

// WACC via CAPM: cost of equity = risk-free + beta x ERP, cost of debt = interest
// expense / debt (pre-tax) x (1 - effective tax rate), weighted by market cap vs. debt.
// ERP (equity risk premium) is a long-run assumption (~Damodaran's US estimate), not a
// live figure — unlike a bond yield it doesn't swing day to day, so a documented
// constant is standard practice here, not the same "stale number pretending to be
// live data" problem the old Graham formula had.
const EQUITY_RISK_PREMIUM = 0.045;

// Raw single-stock beta is noisy, especially for micro/small caps with a short or wildly
// volatile trading history (a recent SPAC-era near-collapse followed by a 100x+ recovery,
// for instance) — that kind of idiosyncratic swing inflates beta well past what's actually
// systematic risk. Clamping the input here (not just the final WACC below) means two stocks
// with beta 4 and beta 8 don't both silently get pinned to the same output; they're
// distinguished right up to a ceiling that's still generous for genuinely high-beta names.
const BETA_MIN = -0.5;
const BETA_MAX = 2.5;

// Typical real-world cost-of-capital ranges by sector (Damodaran-style industry
// benchmarks, loosely calibrated to the current risk-free-rate environment) — a second,
// coarser guardrail on top of the beta clamp above. Even with beta capped, an unusual
// debt load or a noisy interest/tax figure can still push a single company's WACC well
// outside what's plausible for its industry; this keeps same-sector companies from
// diverging from each other for reasons that have nothing to do with real differences in
// cost of capital. Falls back to the old flat 4%-20% band for anything unmatched.
const SECTOR_WACC_RANGE = {
  utilities: [0.05, 0.08],
  financial: [0.06, 0.12],
  realEstate: [0.05, 0.09],
  energy: [0.06, 0.11],
  materials: [0.06, 0.12],
  industrial: [0.06, 0.12],
  aerospaceDefense: [0.06, 0.11],
  transportation: [0.06, 0.13],
  telecom: [0.05, 0.10],
  media: [0.06, 0.13],
  pharma: [0.06, 0.13],
  staples: [0.05, 0.10],
  discretionary: [0.06, 0.13],
  tech: [0.07, 0.14],
  default: [0.04, 0.20],
};

function sectorWaccRange(sector, industry) {
  const i = (industry || '').toLowerCase();
  // Industry-level (finer) checks first — same lookup order as computeNormalizedExitMultiple.
  if (i.includes('reit') || i.includes('real estate')) return SECTOR_WACC_RANGE.realEstate;
  if (i.includes('aerospace') || i.includes('defense')) return SECTOR_WACC_RANGE.aerospaceDefense;
  if (i.includes('airline') || i.includes('railroad') || i.includes('trucking') || i.includes('shipping') || i.includes('marine')) return SECTOR_WACC_RANGE.transportation;
  if (i.includes('telecom')) return SECTOR_WACC_RANGE.telecom;
  if (i.includes('media') || i.includes('entertainment') || i.includes('broadcasting')) return SECTOR_WACC_RANGE.media;
  if (i.includes('auto')) return SECTOR_WACC_RANGE.discretionary;

  const s = (sector || '').toLowerCase();
  if (s.includes('utilit')) return SECTOR_WACC_RANGE.utilities;
  if (s.includes('bank') || s.includes('insurance') || s.includes('financial')) return SECTOR_WACC_RANGE.financial;
  if (s.includes('real estate') || s.includes('reit')) return SECTOR_WACC_RANGE.realEstate;
  if (s.includes('energy') || s.includes('oil') || s.includes('gas')) return SECTOR_WACC_RANGE.energy;
  if (s.includes('material') || s.includes('chemical') || s.includes('metal') || s.includes('mining')) return SECTOR_WACC_RANGE.materials;
  if (s.includes('industrial')) return SECTOR_WACC_RANGE.industrial;
  if (s.includes('communication') || s.includes('telecom')) return SECTOR_WACC_RANGE.telecom;
  if (s.includes('pharma') || s.includes('biotech') || s.includes('health')) return SECTOR_WACC_RANGE.pharma;
  if (s.includes('retail') || s.includes('consumer staple') || s.includes('food') || s.includes('beverage')) return SECTOR_WACC_RANGE.staples;
  if (s.includes('consumer discretionary') || s.includes('auto')) return SECTOR_WACC_RANGE.discretionary;
  if (s.includes('tech') || s.includes('software') || s.includes('semi')) return SECTOR_WACC_RANGE.tech;
  return SECTOR_WACC_RANGE.default;
}

export function computeWACC(data, riskFreeRate) {
  if (!data.marketCap || riskFreeRate == null) return null;
  const beta = Math.min(BETA_MAX, Math.max(BETA_MIN, data.beta ?? 1.0));
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
  const [min, max] = sectorWaccRange(data.sector, data.industry);
  return Math.min(max, Math.max(min, wacc));
}

// Reverse-solves the Gordon Growth Model (MarketCap = FCF(1+g)/(WACC-g)) for g — the
// growth rate the market is currently pricing in, given today's FCF, market cap and WACC.
// Kept as a standalone, clearly-labeled *context* figure (what the market believes right
// now) and as one of three blended signals for the price Projection tab. It is NOT used
// to drive the DCF's own base case any more — see computeFundamentalGrowth below for why.
export function computeImpliedGrowth(marketCap, fcf, wacc) {
  if (!marketCap || !fcf || fcf <= 0 || wacc == null) return null;
  const g = (marketCap * wacc - fcf) / (fcf + marketCap);
  return Math.max(-0.15, Math.min(0.30, g));
}

// Damodaran's fundamental growth rate: g = Reinvestment Rate × ROIC — how much of after-tax
// operating profit gets plowed back into the business, times the return that reinvestment
// earns. Unlike FCF YoY (computeFundamentalGrowth's fallback below), FCF is the noisiest of
// the three statements — a single capex timing shift or working-capital swing can dominate a
// single year's number even after taking a median of only 3-4 points (see NOK: FCF YoY median
// landed on -10.65%, floor-clamped to -10%, purely because 2023 happened to be the middle of
// three noisy deltas). Reinvestment×ROIC ties growth to *why* a business can grow — capital
// deployed and the return on it — which moves far less year to year.
// Requires OI/EBT/tax/CapEx/D&A/debt/equity histories aligned by year; returns null (letting
// the caller fall back to the FCF/revenue waterfall) when there isn't enough aligned data —
// true for plenty of tickers, since D&A and debt/equity time series aren't always available
// even when a single-point-in-time balance sheet is.
function yearMap(hist) {
  const m = {};
  (hist || []).forEach(h => { if (h.val != null) m[h.year] = h.val; });
  return m;
}

// A reporting year whose revenue collapses to a small fraction of its immediate neighbors and
// then snaps back the very next year is almost always a data artifact — a fiscal-year-end
// change, a stub period misfiled as a full year, a data-provider gap — not a genuine business
// contraction (a real downturn doesn't reverse itself within one reporting period the way a
// stub period does). Verified against real data: one ticker's revenue history read
// [...3.04B, 0.86B, 0.91B, 3.86B...] — a ~4x collapse-and-snapback that dragged every ratio
// computed against those two years (FCF margin, capex/revenue, reinvestment rate) into
// nonsense, which is what actually produced an unrealistically low DCF for that name, not any
// of the growth/multiple/fade assumptions themselves. Flags years far below the series' own
// median *and* far below at least one adjacent year, so a genuine multi-year decline (which
// stays low across neighbors, not just one year) isn't caught by this.
function stubYears(revHist) {
  const bad = new Set();
  if (!revHist || revHist.length < 3) return bad;
  const vals = revHist.map(r => r.val).filter(v => v > 0).sort((a, b) => a - b);
  if (!vals.length) return bad;
  const mid = Math.floor(vals.length / 2);
  const median = vals.length % 2 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2;
  revHist.forEach((r, i) => {
    if (r.val == null || r.val <= 0) return;
    const prev = revHist[i - 1]?.val;
    const next = revHist[i + 1]?.val;
    const farBelowMedian = r.val < median * 0.5;
    const snapsBack = (prev != null && r.val < prev * 0.5) || (next != null && r.val < next * 0.5);
    if (farBelowMedian && snapsBack) bad.add(r.year);
  });
  return bad;
}

// Known macro-shock years where a broad, exogenous, one-time event depressed most economic
// activity — currently just the COVID-19 shock (2020) and its uneven, still-depressed
// recovery year (2021). Unlike stubYears above, this isn't a data-quality problem — the
// numbers are real — but a company's own one-off pandemic dip and recovery bounce shouldn't
// carry the same weight as an ordinary year when estimating a forward-looking sustainable
// growth rate (verified against real data: a travel-sector name's FCF-YoY median landed on
// 14%/yr largely because 2021→2022 was a +95% pandemic-recovery bounce, not a repeatable
// growth rate). Two conditions both have to hold before either year gets excluded — neither
// one alone is enough to tell a shock apart from ordinary fast growth:
//   1. 2020 was a genuine dip — below the pre-shock year if that's in the window, otherwise
//      below where revenue stood 2 years later (letting the immediate rebound settle first).
//   2. The 2020→2021 rebound is a real outlier against this *same* company's own ordinary
//      cadence (its most recent YoY rate), not just another year of steady compounding — a
//      business quietly growing at 25-30%/yr every year clears condition 1 on compounding
//      alone but fails this one, since its rebound rate looks just like every other year's.
// A business that grew straight through the pandemic, or simply compounds quickly every year,
// keeps that period in the sample untouched either way.
const MACRO_SHOCK_YEARS = ['2020', '2021'];
function macroShockYears(revHist) {
  const bad = new Set();
  if (!revHist || revHist.length < 3) return bad;
  const byYear = yearMap(revHist);
  const [shockYear, recoveryYear] = MACRO_SHOCK_YEARS;
  const shockVal = byYear[shockYear];
  const recoveryVal = byYear[recoveryYear];
  if (!(shockVal > 0) || !(recoveryVal > 0)) return bad;

  const priorYear = String(parseInt(shockYear, 10) - 1);
  const laterYear = String(parseInt(shockYear, 10) + 2);
  const referenceVal = byYear[priorYear] ?? byYear[laterYear];
  const wasADip = referenceVal > 0 && shockVal < referenceVal * 0.85;
  if (!wasADip) return bad;

  // "Typical" cadence = this company's own YoY rates in years untouched by the shock/recovery
  // (both endpoints outside MACRO_SHOCK_YEARS) — the median of those, not just the most recent
  // one, since a maturing company's growth naturally decelerates over time and comparing a
  // young high-growth year only against a much-later slower one would misfire on that
  // deceleration alone (verified against real data: a steadily-decelerating tech giant's 2021
  // growth cleared "double its most recent YoY rate" purely from years of slowing down, with no
  // shock involved — the median-of-all-clean-years baseline doesn't have that bias).
  const years = Object.keys(byYear).map(y => parseInt(y, 10)).filter(y => byYear[String(y)] > 0).sort((a, b) => a - b);
  const shockYearsNum = new Set(MACRO_SHOCK_YEARS.map(y => parseInt(y, 10)));
  const typicalRates = [];
  for (let i = 1; i < years.length; i++) {
    if (shockYearsNum.has(years[i]) || shockYearsNum.has(years[i - 1])) continue;
    typicalRates.push(byYear[String(years[i])] / byYear[String(years[i - 1])] - 1);
  }
  typicalRates.sort((a, b) => a - b);
  const mid = Math.floor(typicalRates.length / 2);
  const typicalRate = typicalRates.length
    ? (typicalRates.length % 2 ? typicalRates[mid] : (typicalRates[mid - 1] + typicalRates[mid]) / 2)
    : null;

  const recoveryRate = recoveryVal / shockVal - 1;
  // Both an absolute floor (a genuine COVID-hit reopening trade typically rebounded 50%+ in a
  // single year — an ordinary strong growth year for almost any business doesn't) and a
  // relative one (well past double this company's own normal cadence) have to clear, so a
  // fast-but-steady compounder isn't caught by either alone.
  const isOutlierBounce = recoveryRate > 0.5 && (typicalRate == null || recoveryRate > Math.max(0.5, Math.abs(typicalRate) * 2));

  if (isOutlierBounce) {
    MACRO_SHOCK_YEARS.forEach(y => { if (byYear[y] != null) bad.add(y); });
  }
  return bad;
}

// Combined set of years to leave out of any growth/margin/reinvestment calculation — stub/
// data-artifact years and confirmed macro-shock years alike. Every function below that used to
// call stubYears directly now calls this instead, so both exclusions stay in sync.
function excludedYears(revHist) {
  const bad = stubYears(revHist);
  macroShockYears(revHist).forEach(y => bad.add(y));
  return bad;
}

// Normalizes the DCF's starting FCF by margin rather than by level: takes the median
// FCF-to-revenue ratio over the trailing years (after dropping any stub year — see
// stubYears above) and applies it to *current* revenue, instead of anchoring the entire
// projection to whatever the single latest reported year happened to be (see
// computeDCFPointValue, which scales every line of the DCF linearly off this base — a year
// depressed by a capex ramp, a working-capital build for backlog fulfillment, or a data-source
// artifact otherwise craters the whole valuation regardless of growth/multiple assumptions).
// Margin, not dollar level, because a business growing revenue shouldn't get anchored to
// yesterday's smaller dollar-level FCF either. Median, not mean, so any one remaining noisy
// year (real or artifact) can't skew an average of only 3-4 points as hard.
export function computeNormalizedFcf(data, years = 4) {
  const revHist = data.revHistory || [];
  const bad = excludedYears(revHist);
  const fcfHist = (data.fcfHistory || []).filter(f => !bad.has(f.year)).slice(-years);
  if (fcfHist.length < 3 || !data.revVal || data.revVal <= 0) return null;

  const margins = fcfHist.map(f => {
    const r = revHist.find(r => r.year === f.year);
    return r?.val > 0 ? f.val / r.val : null;
  }).filter(m => m != null);
  if (margins.length < 3) return null;

  const sorted = [...margins].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const medianMargin = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const normalized = medianMargin * data.revVal;
  return normalized > 0 ? normalized : null;
}

// Suggests a "mature" FCF margin for the optional margin-recovery ramp (see the DCF tab's
// "Model FCF margin recovery" toggle): the best margin the company has *already* demonstrated
// over the trailing window (stub years excluded), not a hoped-for future one. Recovering to a
// level the business has actually hit before is a normalization argument, not new optimism —
// so this is a defensible default, always overridable by the user. Returns null (letting the
// caller decide what, if anything, to prefill) when there isn't enough margin history to
// suggest from.
export function suggestMatureFcfMargin(data, years = 6) {
  const revHist = data.revHistory || [];
  const bad = excludedYears(revHist);
  const fcfHist = (data.fcfHistory || []).filter(f => !bad.has(f.year)).slice(-years);
  const margins = fcfHist.map(f => {
    const r = revHist.find(r => r.year === f.year);
    return r?.val > 0 ? f.val / r.val : null;
  }).filter(m => m != null);
  if (margins.length < 3) return null;
  return Math.max(...margins);
}

// Flags a company mid capex ramp: capex/revenue running materially above its own trailing
// average (stub years excluded). In that phase the latest year's FCF understates steady-state
// cash generation (new capacity hasn't paid back yet) and the reinvestment×ROIC growth formula
// understates growth (new capital sits in the invested-capital denominator before it's
// productive) — both push a naive single-year DCF toward an unrealistically low fair value.
// This flag only decides which FCF base + growth-fade shape the DCF defaults to (see
// computeDCFValue); it never adjusts the numbers by itself.
export function detectReinvestmentPhase(data) {
  const revHist = data.revHistory || [];
  const bad = excludedYears(revHist);
  const capexHist = (data.capexHistory || []).filter(c => !bad.has(c.year));
  if (capexHist.length < 4) return false;

  const ratios = capexHist.map(c => {
    const r = revHist.find(r => r.year === c.year);
    return r?.val > 0 ? Math.abs(c.val) / r.val : null;
  }).filter(r => r != null);
  if (ratios.length < 4) return false;

  const latestRatio = ratios[ratios.length - 1];
  const priorAvg = ratios.slice(0, -1).reduce((a, b) => a + b, 0) / (ratios.length - 1);
  return priorAvg > 0 && latestRatio > priorAvg * 1.2;
}

// R&D is expensed, not capitalized, under GAAP/IFRS — so a raw reinvestment-rate calc reads
// heavy R&D spenders (Apple, pharma, semis) as barely reinvesting, since only CapEx counts as
// "investment". Verified empirically: AAPL's raw reinvestment rate comes out at -0.3% growth
// (implying ~65% DCF downside from a $314 quote) purely because CapEx tracks D&A almost
// exactly — Apple's actual growth engine is R&D and ecosystem effects, not factories. Damodaran's
// fix is to capitalize R&D as an asset amortized over its useful life, same treatment as CapEx/
// D&A: this year's R&D counts as investment, and *last* n years' R&D amortizes off at 1/n each.
// Life varies by how fast the R&D pays off / goes obsolete — drug development + patent life
// runs a decade, a software release cycle doesn't.
const RD_AMORTIZATION_YEARS = { pharma: 10, tech: 4, semi: 5, industrial: 5, default: 5 };
function rdAmortizationPeriod(sector, industry) {
  const i = (industry || '').toLowerCase();
  const s = (sector || '').toLowerCase();
  if (s.includes('pharma') || s.includes('biotech') || s.includes('health')) return RD_AMORTIZATION_YEARS.pharma;
  if (i.includes('semiconductor')) return RD_AMORTIZATION_YEARS.semi;
  if (s.includes('tech') || s.includes('software') || i.includes('software') || i.includes('internet')) return RD_AMORTIZATION_YEARS.tech;
  if (s.includes('industrial') || s.includes('auto') || i.includes('auto')) return RD_AMORTIZATION_YEARS.industrial;
  return RD_AMORTIZATION_YEARS.default;
}

// Straight-line capitalization of one year's R&D asset + this year's amortization of prior
// years' R&D. Stops at the first missing prior year instead of assuming R&D existed before our
// data window — under-capitalizes R&D-heavy names with short histories (pharma's 10yr window
// rarely has 10 years of data available) rather than fabricating figures, so this is a
// conservative floor on the adjustment, not the textbook-complete version.
function capitalizedRnD(rdByYear, year, amortYears) {
  const t = parseInt(year, 10);
  let asset = 0, amort = 0;
  for (let j = 0; j < amortYears; j++) {
    const val = rdByYear[String(t - j)];
    if (val == null) break;
    asset += val * (amortYears - j) / amortYears;
    if (j >= 1) amort += val / amortYears;
  }
  return { asset, amort };
}

export function computeReinvestmentGrowth(data) {
  const oi = yearMap(data.oiHistory);
  const ebt = yearMap(data.ebtHistory);
  const tax = yearMap(data.taxHistory);
  const capex = yearMap(data.capexHistory);
  const da = yearMap(data.daHistory);
  const debt = yearMap(data.debtHistory);
  const equity = yearMap(data.equityHistory);
  const wc = yearMap(data.wcChangeHistory); // optional — treated as 0 (no WC drag/boost) when absent for a year
  const rd = yearMap(data.rdHistory); // optional — capitalizedRnD degrades to {asset:0, amort:0} when absent, so this reduces to the un-adjusted formula for sectors without R&D

  // Debt/equity are no longer required to align year-by-year with the flow statements — total
  // debt/equity for a mature company rarely swings the way revenue or FCF do, and some data
  // sources return a debt history that's misaligned or stale relative to the other statements
  // (verified against real data: one ticker's debtHistory came back covering 2010-2014 while
  // every other series covered 2020-2025 — zero overlap, which silently killed this entire
  // growth engine for that name). debtForYear/equityForYear below fall back to the latest
  // known point-in-time figure (data.debtVal/data.equityVal) whenever a given year is missing,
  // rather than dropping the year — a much smaller error than losing the reinvestment×ROIC
  // signal entirely and falling back to the noisier FCF-YoY waterfall.
  const debtForYear = (yy) => debt[yy] ?? data.debtVal ?? 0;
  const equityForYear = (yy) => equity[yy] ?? data.equityVal ?? 0;

  const bad = excludedYears(data.revHistory);
  const years = Object.keys(oi).filter(y =>
    !bad.has(y) && ebt[y] != null && tax[y] != null && capex[y] != null && da[y] != null
  );
  if (years.length < 2) return null;

  // Cap the amortization schedule to however many years of R&D history we actually have.
  // Using the full assumed life (10yr for pharma) against only 4-6 years of data means every
  // year in the window sits on an immature, still-ramping-up schedule — asset and amortization
  // both computed against a 10-year denominator that never fills in the years before our data
  // starts — which understates amortization relative to newly-capitalized R&D and inflates
  // adjusted NOPAT every year, not just the first. Shrinking the schedule to match what we can
  // actually observe reaches a "steady state" within the window instead.
  const amortYears = Math.min(rdAmortizationPeriod(data.sector, data.industry), Object.keys(rd).length || 1);
  const yearlyG = [];
  for (const y of years) {
    const rdVal = rd[y] ?? 0;
    const { asset: rdAsset, amort: rdAmort } = capitalizedRnD(rd, y, amortYears);

    // ROIC's denominator is lagged 2 years (falling back to the current year when that far
    // back isn't in the data) — newly deployed capital shouldn't be judged by the NOPAT it
    // hasn't had time to produce yet. Without this, a company mid capex ramp (new plant,
    // new capacity) shows an artificially depressed ROIC exactly during its highest-reinvestment
    // years, which — since g = reinvestment rate × ROIC — understates the sustainable growth
    // rate precisely when the business is arguably compounding fastest.
    const lagYear = String(parseInt(y, 10) - 2);
    const lagDebt = debtForYear(lagYear);
    const lagEquity = equityForYear(lagYear);
    const lagRdAsset = rd[lagYear] != null ? capitalizedRnD(rd, lagYear, amortYears).asset : rdAsset;
    const investedCapital = lagDebt + lagEquity + lagRdAsset;
    if (investedCapital <= 0) continue;
    // Effective tax rate per year, same clamp as computeWACC's costOfDebtAfterTax so a single
    // one-off tax benefit/charge (Nokia's 2022 deferred-tax gain, e.g.) can't send NOPAT negative
    // or above the operating income itself. Computed from reported EBT/tax, not the R&D-adjusted
    // income below — re-deriving a hypothetical tax on a hypothetical income overcomplicates this.
    const taxRate = ebt[y] > 0 ? Math.min(0.35, Math.max(0, tax[y] / ebt[y])) : 0.21;
    const adjustedOI = oi[y] + rdVal - rdAmort; // add back this year's R&D expense, subtract its amortization instead
    const nopat = adjustedOI * (1 - taxRate);
    if (nopat <= 0) continue; // reinvestment rate is meaningless as a fraction of a loss

    const netCapex = Math.abs(capex[y]) - da[y]; // capex beyond what depreciation already replaces
    const wcInvestment = wc[y] != null ? -wc[y] : 0; // wc[y] is cash-flow-signed: negative = cash used = investment
    const reinvestment = netCapex + wcInvestment + rdVal - rdAmort;

    const reinvestmentRate = reinvestment / nopat;
    const roic = nopat / investedCapital;
    // Clamp each year's contribution before averaging — one extreme year (e.g. a reinvestment
    // rate over 100% in a low-earnings year) shouldn't be able to dominate the multi-year
    // average any more than a single YoY outlier should dominate the FCF median above.
    yearlyG.push(Math.max(-0.30, Math.min(0.30, reinvestmentRate * roic)));
  }
  if (yearlyG.length < 2) return null;

  const avg = yearlyG.reduce((a, b) => a + b, 0) / yearlyG.length;
  return Math.max(-0.10, Math.min(0.20, avg));
}

// Mirror image of the marginDepressed case in computeDCFValue below: flags a company whose FCF
// margin has expanded sharply and recently leveled off near its own high-water mark — SaaS/
// platform businesses crossing into sustained profitability are the textbook case (verified
// against real data: Wix's FCF margin ran 2.7% → 15.9% → 28.3% → 29.2% over four years, a
// one-time operating-leverage re-rate as the business matured, not a repeatable annual growth
// rate). When this fires, computeFundamentalGrowth below prefers revenue growth over FCF-dollar
// growth for its fallback — the dollar-growth fallback bakes that same one-time margin re-rate
// into a rate, then compounds it for 10 more years on top of an FCF base that's already sitting
// at the post-re-rate level, double-counting the same improvement twice (Wix's case: a 17%/yr
// FCF-dollar growth rate compounded on top of a margin that had *already* reached what the
// model itself would call "mature," producing a fair value ~8x the current price). Requires the
// deceleration to be real — this year's margin gain notably smaller than last year's — so a
// margin still actively expanding isn't mistaken for one that's already leveled off.
function marginRecentlyMatured(data) {
  const revHist = data.revHistory || [];
  const bad = excludedYears(revHist);
  const margins = (data.fcfHistory || [])
    .filter(f => !bad.has(f.year))
    .map(f => {
      const r = revHist.find(r => r.year === f.year);
      return r?.val > 0 ? { year: f.year, margin: f.val / r.val } : null;
    })
    .filter(Boolean)
    .sort((a, b) => parseInt(a.year, 10) - parseInt(b.year, 10));
  if (margins.length < 4) return false;

  const n = margins.length;
  const latest = margins[n - 1].margin;
  const early = margins[0].margin;
  const latestDelta = latest - margins[n - 2].margin;
  const priorDelta = margins[n - 2].margin - margins[n - 3].margin;

  const expandedALot = latest > early * 2 || latest - early > 0.10;
  const decelerating = priorDelta > 0.02 && latestDelta < priorDelta * 0.5;
  return expandedALot && decelerating;
}

// Median YoY revenue growth — same median-of-steps construction as the FCF-YoY fallback below,
// stub/shock years excluded the same way, used in its place whenever marginRecentlyMatured
// flags the FCF trajectory itself as the noisy signal. Revenue is structurally the cleanest of
// the three statements for this purpose: no capex timing, no working-capital swings, no
// one-off tax or impairment noise baked in — just units times price.
function computeRevenueGrowthMedian(data) {
  const badYears = excludedYears(data.revHistory);
  const hist = (data.revHistory || []).filter(h => h.val > 0 && !badYears.has(h.year)).sort((a, b) => parseInt(a.year, 10) - parseInt(b.year, 10));
  if (hist.length < 3) return null;
  const yoy = [];
  for (let i = 1; i < hist.length; i++) {
    const years = parseInt(hist[i].year, 10) - parseInt(hist[i - 1].year, 10);
    if (years > 0) yoy.push(Math.pow(hist[i].val / hist[i - 1].val, 1 / years) - 1);
  }
  if (!yoy.length) return null;
  yoy.sort((a, b) => a - b);
  const mid = Math.floor(yoy.length / 2);
  const median = yoy.length % 2 ? yoy[mid] : (yoy[mid - 1] + yoy[mid]) / 2;
  return isFinite(median) ? Math.max(-0.10, Math.min(0.20, median)) : null;
}

// The DCF's actual growth assumption, independent of today's price. Solving for "the
// growth rate that justifies today's market cap" (computeImpliedGrowth above) and then
// projecting forward with that same rate is circular by construction — the DCF's "fair
// value" ends up reproducing ~today's price almost regardless of what that price is
// (verified empirically: a stock's price moved ±30% with fundamentals held fixed and the
// base-case DCF tracked it within ~2-3% at every point). A genuine fair-value estimate
// needs a growth rate that comes from the business, not from its own quote: Damodaran's
// reinvestment×ROIC when there's enough statement history to compute it (see
// computeReinvestmentGrowth above), falling back to revenue growth when the FCF margin has
// just finished a one-time re-rate (see marginRecentlyMatured above), then FCF growth over the
// reported history, then latest YoY revenue growth, then a flat conservative default.
export function computeFundamentalGrowth(data) {
  const reinvestmentGrowth = computeReinvestmentGrowth(data);
  if (reinvestmentGrowth != null) return reinvestmentGrowth;

  if (marginRecentlyMatured(data)) {
    const revenueGrowth = computeRevenueGrowthMedian(data);
    if (revenueGrowth != null) return revenueGrowth;
  }

  const badYears = excludedYears(data.revHistory);
  const hist = (data.fcfHistory || []).filter(h => h.val > 0 && !badYears.has(h.year)).sort((a, b) => parseInt(a.year, 10) - parseInt(b.year, 10));
  if (hist.length >= 3) {
    // Median year-over-year growth, not endpoint-to-endpoint CAGR — a CAGR anchored on just
    // the first and last data points is one anomalous year (an impairment-depressed base
    // year, a one-off capex spike, a working-capital swing) away from wildly overstating a
    // decade of forecast growth. The median of each YoY step is far less sensitive to any
    // single outlier year.
    const yoy = [];
    for (let i = 1; i < hist.length; i++) {
      const years = parseInt(hist[i].year, 10) - parseInt(hist[i - 1].year, 10);
      if (years > 0) yoy.push(Math.pow(hist[i].val / hist[i - 1].val, 1 / years) - 1);
    }
    if (yoy.length) {
      yoy.sort((a, b) => a - b);
      const mid = Math.floor(yoy.length / 2);
      const median = yoy.length % 2 ? yoy[mid] : (yoy[mid - 1] + yoy[mid]) / 2;
      if (isFinite(median)) return Math.max(-0.10, Math.min(0.20, median));
    }
  }
  if (hist.length === 2) {
    const [first, last] = hist;
    const years = parseInt(last.year, 10) - parseInt(first.year, 10);
    if (years > 0 && first.val > 0) {
      const cagr = Math.pow(last.val / first.val, 1 / years) - 1;
      if (isFinite(cagr)) return Math.max(-0.10, Math.min(0.20, cagr));
    }
  }
  if (data.revGrowth != null) return Math.max(-0.10, Math.min(0.20, data.revGrowth / 100));
  return 0.05;
}

// A normalized, sector-typical long-run P/FCF exit multiple — independent of the stock's
// own current trading multiple, for the same circularity reason as computeFundamentalGrowth
// above (defaulting the exit multiple to data.pfcf means the terminal value bakes in
// today's own pricing twice over). The multiples themselves are rough long-run benchmarks,
// not fitted to any individual ticker.
//
// The old single "consumer" bucket (18x) lumped discount/general retailers (thin margins,
// little pricing power, typically trade well under 15x FCF) in with branded staples names
// that command a real moat premium (Coca-Cola-style pricing power, 18-20x+) — on a
// low-margin discounter that meant the terminal value alone implied >70% upside at *zero*
// forecast growth, before the growth assumption even entered the picture. Industry (finer
// than sector) lets us tell those apart; sector remains the fallback when industry is
// missing.
const SECTOR_EXIT_MULTIPLES = {
  tech: 24,
  semiconductor: 22,
  pharma: 20,
  staples: 19,
  aerospaceDefense: 19,
  railroad: 17,
  realEstate: 17,
  discountRetail: 13,
  restaurant: 16,
  media: 15,
  industrial: 15,
  homebuilder: 10,
  autoManufacturer: 9,
  autoParts: 12,
  chemicals: 13,
  metalsMining: 9,
  transportation: 12,
  telecom: 12,
  airline: 8,
  financial: 13,
  utilities: 15,
  energy: 11,
  default: 16,
};
export function computeNormalizedExitMultiple(sector, industry) {
  const i = (industry || '').toLowerCase();
  // Industry-level (finer than sector) checked first, so two names sharing a broad sector but
  // very different competitive dynamics — e.g. a discount grocer vs. a branded staples name,
  // or an airline vs. an aerospace parts supplier — don't get lumped into the same multiple.
  if (i.includes('discount stor') || i.includes('department stor') || i.includes('grocery') || i.includes('apparel retail') || i.includes('specialty retail')) return SECTOR_EXIT_MULTIPLES.discountRetail;
  if (i.includes('restaurant')) return SECTOR_EXIT_MULTIPLES.restaurant;
  if (i.includes('beverage') || i.includes('household') || i.includes('personal product') || i.includes('packaged food') || i.includes('tobacco')) return SECTOR_EXIT_MULTIPLES.staples;
  // Long-duration, government/backlog-secured cash flows and high switching costs (sole-source
  // certified parts) command a persistent premium over generic industrial/capital-goods names.
  if (i.includes('aerospace') || i.includes('defense')) return SECTOR_EXIT_MULTIPLES.aerospaceDefense;
  if (i.includes('semiconductor')) return SECTOR_EXIT_MULTIPLES.semiconductor;
  if (i.includes('railroad')) return SECTOR_EXIT_MULTIPLES.railroad;
  if (i.includes('reit') || i.includes('real estate')) return SECTOR_EXIT_MULTIPLES.realEstate;
  if (i.includes('media') || i.includes('entertainment') || i.includes('broadcasting') || i.includes('publishing')) return SECTOR_EXIT_MULTIPLES.media;
  if (i.includes('homebuilder') || i.includes('residential construction')) return SECTOR_EXIT_MULTIPLES.homebuilder;
  if (i.includes('auto part')) return SECTOR_EXIT_MULTIPLES.autoParts;
  if (i.includes('auto')) return SECTOR_EXIT_MULTIPLES.autoManufacturer;
  if (i.includes('chemical')) return SECTOR_EXIT_MULTIPLES.chemicals;
  if (i.includes('metal') || i.includes('mining') || i.includes('steel')) return SECTOR_EXIT_MULTIPLES.metalsMining;
  if (i.includes('airline')) return SECTOR_EXIT_MULTIPLES.airline;
  if (i.includes('trucking') || i.includes('shipping') || i.includes('marine') || i.includes('logistics') || i.includes('air freight')) return SECTOR_EXIT_MULTIPLES.transportation;
  if (i.includes('telecom')) return SECTOR_EXIT_MULTIPLES.telecom;
  if (i.includes('machinery') || i.includes('capital goods') || i.includes('construction & engineering') || i.includes('building products')) return SECTOR_EXIT_MULTIPLES.industrial;

  const s = (sector || '').toLowerCase();
  if (s.includes('tech') || s.includes('software') || s.includes('semi')) return SECTOR_EXIT_MULTIPLES.tech;
  if (s.includes('pharma') || s.includes('biotech') || s.includes('health')) return SECTOR_EXIT_MULTIPLES.pharma;
  if (s.includes('bank') || s.includes('insurance') || s.includes('financial')) return SECTOR_EXIT_MULTIPLES.financial;
  if (s.includes('real estate') || s.includes('reit')) return SECTOR_EXIT_MULTIPLES.realEstate;
  if (s.includes('utilit')) return SECTOR_EXIT_MULTIPLES.utilities;
  if (s.includes('material') || s.includes('chemical') || s.includes('metal') || s.includes('mining')) return SECTOR_EXIT_MULTIPLES.metalsMining;
  if (s.includes('communication') || s.includes('telecom')) return SECTOR_EXIT_MULTIPLES.telecom;
  if (s.includes('industrial')) return SECTOR_EXIT_MULTIPLES.industrial;
  if (s.includes('energy') || s.includes('oil') || s.includes('gas')) return SECTOR_EXIT_MULTIPLES.energy;
  // Sector-only retail/consumer/food match with no industry detail to disambiguate a moat —
  // treat as commodity retail (the conservative assumption) rather than defaulting to the
  // richer staples multiple.
  if (s.includes('retail') || s.includes('consumer') || s.includes('food') || s.includes('beverage')) return SECTOR_EXIT_MULTIPLES.discountRetail;
  return SECTOR_EXIT_MULTIPLES.default;
}

// Single-point WACC-discounted DCF: 10 years of FCF growing from the near-term rate down
// to a sustainable long-run rate, terminal value via exit P/FCF multiple (not Gordon
// perpetuity — matches the source spreadsheet), both discounted back at WACC. `dilutionPct`
// and `fcfMultiplier` model share dilution and FCF-quality risk respectively (both default
// to "no change") — the two extra dimensions the small-cap version of the spreadsheet adds
// on top of the large-cap one, since they matter for any cash-burning grower, not just small
// caps. Every parameter is independently overridable so this one function can produce both
// the bear/base/bull scenarios and every cell of the stress-test grids below.
export function computeDCFPointValue(data, riskFreeRate, overrides = {}) {
  // fcfBase overrides data.fcfVal entirely (see computeNormalizedFcf) — lets a company mid
  // capex/working-capital ramp be valued off a margin-normalized cash flow instead of a single
  // depressed reported year, without touching the raw data object.
  const fcfBase = overrides.fcfBase ?? data.fcfVal;
  if (!fcfBase || fcfBase <= 0 || !data.sharesOutstanding || !data.marketCap) return null;

  const baseWacc = computeWACC(data, riskFreeRate);
  if (!baseWacc) return null;
  const wacc = overrides.wacc ?? baseWacc;

  const growth = overrides.growth ?? computeFundamentalGrowth(data);
  // Fade the near-term growth rate down to a sustainable long-run rate by year 10 instead
  // of compounding it flat for a full decade. No business grows faster than the economy
  // forever, and flat-compounding a double-digit near-term rate for 10 years overstates the
  // explicit cash flows *and* — via the exit multiple, applied to that inflated year-10 FCF —
  // the terminal value even more. The ceiling is the risk-free rate (Damodaran's stable-growth
  // heuristic), floored so a bear case doesn't fade into outright decline.
  const terminalGrowth = Math.max(-0.02, Math.min(growth, riskFreeRate ?? 0.03));

  const exitMultiple = overrides.exitMultiple ?? computeNormalizedExitMultiple(data.sector, data.industry);
  const dilutionPct = overrides.dilutionPct ?? 0;
  const fcfMultiplier = overrides.fcfMultiplier ?? 1;

  // Plateau years: hold the near-term growth rate flat before the fade to terminalGrowth
  // starts, instead of starting to dilute it from year 1. A business with real forward
  // visibility (a reported backlog, disclosed multi-year contracts) doesn't dilute toward its
  // long-run rate the moment the projection starts — it dilutes once that visibility runs out.
  // 0 (default) reproduces the original linear fade exactly.
  const plateauYears = Math.max(0, Math.min(9, Math.round(overrides.plateauYears ?? 0)));
  const fadeYears = 10 - plateauYears;

  // Optional margin-ramp mode: instead of compounding FCF at yearGrowth directly (which bakes
  // in today's — possibly capex-depressed — FCF-to-revenue ratio for the full 10 years),
  // project revenue at yearGrowth and let the FCF margin itself ramp from today's actual
  // margin toward a supplied mature margin over fcfMarginRampYears. Disabled unless the caller
  // supplies matureFcfMargin and revenue is available; when disabled this reduces to the
  // original fcf-compounding behavior exactly.
  const matureFcfMargin = overrides.matureFcfMargin ?? null;
  const revenue0 = data.revVal;
  const useMarginRamp = matureFcfMargin != null && revenue0 > 0;
  const currentMargin = useMarginRamp ? fcfBase / revenue0 : null;
  const fcfMarginRampYears = Math.max(1, overrides.fcfMarginRampYears ?? 5);

  const surplusCash = fcfBase * (1 - Math.min(1, data.debtToEquity ?? 0) * 0.4);
  const shares = data.sharesOutstanding * (1 + dilutionPct);

  let revenue = revenue0;
  let fcf = fcfBase * fcfMultiplier;
  let pvExplicit = 0;
  for (let year = 1; year <= 10; year++) {
    const yearGrowth = year <= plateauYears
      ? growth
      : growth - (growth - terminalGrowth) * (year - plateauYears - 1) / Math.max(1, fadeYears - 1);

    if (useMarginRamp) {
      revenue = revenue * (1 + yearGrowth);
      const rampT = Math.min(1, year / fcfMarginRampYears);
      const margin = currentMargin + (matureFcfMargin - currentMargin) * rampT;
      fcf = revenue * margin;
    } else {
      fcf = fcf * (1 + yearGrowth);
    }
    pvExplicit += fcf / Math.pow(1 + wacc, year);
  }
  const terminalValue = fcf * exitMultiple;
  const pvTerminal = terminalValue / Math.pow(1 + wacc, 10);
  const totalPV = pvExplicit + pvTerminal;
  const value = (totalPV + surplusCash) / shares;

  return value > 0 ? value : null;
}

// True when today's reported FCF margin sits well below the best margin this company has
// already demonstrated (see suggestMatureFcfMargin) — the general form of "cash generation
// understates steady state," of which a visible capex ramp (detectReinvestmentPhase) is only
// one specific cause. A 40%+ shortfall against the company's own proven margin is a large,
// non-noise gap — small year-to-year margin wobble doesn't trip this.
function isMarginDepressedVsHistory(data) {
  const latestFcf = data.fcfVal;
  if (!latestFcf || latestFcf <= 0 || !data.revVal || data.revVal <= 0) return false;
  const currentMargin = latestFcf / data.revVal;
  const matureMargin = suggestMatureFcfMargin(data);
  return matureMargin != null && currentMargin < matureMargin * 0.6;
}

// No user-facing toggles here on purpose — every assumption below is decided from the
// company's own reported history, not left for someone to dial in. Three adjustments are
// bundled together automatically whenever the data itself signals that today's FCF understates
// steady state (a visible capex/working-capital ramp, or a margin well below what the company
// has already proven it can do): (1) FCF base normalizes to the median margin over its own
// recent history instead of anchoring on one reported year, (2) the growth fade holds for 3
// years before dilluting instead of starting immediately, (3) FCF margin ramps from today's
// actual margin toward the best margin already on record, over 6 years, instead of assuming
// today's depressed conversion persists for the full 10yr projection. Every other company keeps
// the original behavior untouched: latest-year FCF, immediate fade, no margin ramp.
export function computeDCFValue(data, riskFreeRate) {
  const wacc = computeWACC(data, riskFreeRate);
  if (!wacc || !data.sharesOutstanding || !data.marketCap) return null;

  const normalizedFcf = computeNormalizedFcf(data);
  const latestFcf = data.fcfVal;
  const reinvestmentPhase = detectReinvestmentPhase(data);
  const marginDepressed = isMarginDepressedVsHistory(data);
  const needsNormalization = reinvestmentPhase || marginDepressed || !latestFcf || latestFcf <= 0;

  const fcfBaseMethod = needsNormalization && normalizedFcf != null ? 'normalized' : 'latest';
  const fcfBase = fcfBaseMethod === 'normalized' ? normalizedFcf : latestFcf;
  if (!fcfBase || fcfBase <= 0) return null;

  const baseGrowth = computeFundamentalGrowth(data);
  const exitMultiple = computeNormalizedExitMultiple(data.sector, data.industry);
  // Context only — what the market is currently pricing in, shown alongside baseGrowth so
  // a user can judge whether the market looks more optimistic or pessimistic than the
  // fundamentals-based assumption actually driving the valuation below.
  const impliedGrowth = computeImpliedGrowth(data.marketCap, fcfBase, wacc);

  const plateauYears = needsNormalization ? 3 : 0;
  const matureFcfMargin = needsNormalization ? suggestMatureFcfMargin(data) : null;
  const fcfMarginRampYears = 6;

  const buildScenario = (key, label, waccDelta, growthDelta, primary) => {
    const scenarioWacc = Math.min(0.25, Math.max(0.04, wacc + waccDelta));
    const scenarioGrowth = Math.max(-0.20, Math.min(0.35, baseGrowth + growthDelta));
    const value = +computeDCFPointValue(data, riskFreeRate, {
      wacc: scenarioWacc, growth: scenarioGrowth, exitMultiple, fcfBase, plateauYears, matureFcfMargin, fcfMarginRampYears,
    }).toFixed(2);
    return { key, label, primary, value, wacc: scenarioWacc, growth: scenarioGrowth };
  };

  return {
    wacc, baseGrowth, exitMultiple, impliedGrowth,
    normalizedFcf, latestFcf, reinvestmentPhase, marginDepressed, fcfBaseMethod, fcfBase, plateauYears, matureFcfMargin, fcfMarginRampYears,
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

export function computeDCFStressGrid(data, riskFreeRate, tableKey, baseOverrides = {}) {
  const cfg = DCF_STRESS_TABLES[tableKey];
  if (!cfg) return null;
  const matrix = cfg.rowAxis.map(row =>
    cfg.colAxis.map(col => {
      const value = computeDCFPointValue(data, riskFreeRate, { ...baseOverrides, [cfg.rowParam]: row.value, [cfg.colParam]: col.value });
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

// Blends two volatility signals for the price projector: historical realized vol (what the
// stock has actually done) and beta x the market's current volatility (VIX/100) — a
// systematic-risk estimate that's independent of the stock's own trading history, so it
// stays useful even when that history is thin or stale. (Options-implied vol would be the
// ideal third signal — Yahoo's free/unauthenticated options endpoint doesn't carry live
// bid/ask, so its impliedVolatility field is unusable garbage; that path was tried and
// dropped rather than shipping a plausible-looking but fake number.) Simple average of
// whichever signals are available, same blending pattern as computeProjectionDrift, then
// clamped to the same sane bounds computeAnnualizedVolatility already uses.
export function computeBlendedVolatility({ historicalVol, beta, marketVolAnnual }) {
  // Same clamp as computeWACC's beta input (BETA_MAX above) — an unclamped beta from a
  // wildly volatile small/micro-cap is mostly idiosyncratic noise, not systematic risk, so
  // it shouldn't be allowed to dominate this blend uncapped either.
  const clampedBeta = beta != null ? Math.min(BETA_MAX, Math.abs(beta)) : null;
  const betaMarketVol = clampedBeta != null && marketVolAnnual != null ? clampedBeta * marketVolAnnual : null;
  const signals = [historicalVol, betaMarketVol].filter(v => v != null && isFinite(v) && v > 0);
  if (!signals.length) return null;
  const avg = signals.reduce((a, b) => a + b, 0) / signals.length;
  return Math.max(0.12, Math.min(1.5, avg));
}

// Historical CAGR from the first/last close of a daily series — one of the three
// projection drift signals blended by computeProjectionDrift above. Clamped because this is
// pure trailing price action, the noisiest and most reflexive of the three signals (a single
// strong rally year, not necessarily anything to do with the business) — unclamped, it can
// swamp the other two. Case in point: JNJ's DCF put fundamentals-based FCF growth at -0.7%
// (fair value 42% *below* the current price) while its 1Y CAGR was pushing +65%, blending to
// a 32% "expected" drift that contradicted the DCF's own verdict for the same company. Capped
// to the same order of magnitude as a single fundamentals-based growth signal is ever allowed
// to be (computeFundamentalGrowth's own ceiling is 20%) rather than letting one rally year
// dominate a multi-year projection.
export function computeHistoricalCagr(closes) {
  if (!closes || closes.length < 2) return null;
  const first = closes[0], last = closes[closes.length - 1];
  if (!(first > 0) || !(last > 0)) return null;
  const years = closes.length / 252;
  if (years < 0.25) return null;
  const cagr = Math.pow(last / first, 1 / years) - 1;
  return Math.max(-0.25, Math.min(0.25, cagr));
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

// Deterministic PRNG (mulberry32) seeded from a string (djb2 hash) — lets the projection's
// simulated fan be a pure function of its real inputs (ticker, horizon, drift, vol) instead
// of wall-clock randomness. Same inputs always produce the same fan, so reloading the page
// or re-rendering the component doesn't silently reshuffle the paths; the fan only changes
// when an input that should actually change it changes (e.g. the user edits the drift).
export function createSeededRng(seedStr) {
  let h = 0;
  for (let i = 0; i < seedStr.length; i++) h = (Math.imul(31, h) + seedStr.charCodeAt(i)) | 0;
  let t = h >>> 0;
  return function () {
    t |= 0; t = (t + 0x6D2B79F5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// A decade of a flat, compounded near-term drift is exactly the bug the DCF fixed a while
// back (see computeDCFPointValue's fade-to-sustainable-growth comment): DAVE's blended
// drift signal (up to the 40% ceiling) held flat for 10 years put its own "base case" over
// 10x today's price and its bull case in the tens of thousands of dollars for a ~$400
// stock — no equity compounds a near-term growth-stock rate for a full decade. Drift fades
// down to a generic long-run equity-market return (risk-free rate + the same equity risk
// premium CAPM/WACC already use above) by this many years out, then holds flat. Volatility
// gets the same treatment (see PROJECTION_TERMINAL_VOL below) for the same reason: today's
// realized/beta-implied vol reflects real but likely transient turbulence (a small-cap
// fintech's wild swing year, a post-IPO overreaction), not a rate the stock stays at for a
// full decade — holding it flat was still overstating the 10yr spread even after the drift
// fix, since a GBM band's width scales with vol x sqrt(t).
const PROJECTION_FADE_YEARS = 10;

// Fintech/growth-stock-style volatility (DAVE's 56%, say) doesn't persist forever; this is
// roughly a "typical, still-liquid single stock" long-run figure — higher than the index
// itself (VIX/broad-market vol is usually 15-20%) since any individual name carries
// idiosyncratic risk the index diversifies away, but well below what a name is showing
// during an unusually turbulent stretch.
const PROJECTION_TERMINAL_VOL = 0.25;

// Instantaneous value at time s: fades linearly from `value0` toward `terminalValue` over
// PROJECTION_FADE_YEARS, then holds flat. Used for the per-step simulated paths, where each
// small increment should use the drift/vol *at that point in time* — not, as an earlier
// version of this function mistakenly computed, the average of everything since day one
// (which fades noticeably slower than the true instantaneous curve for any point past t=0).
function fadedInstant(value0, terminalValue, s) {
  if (s >= PROJECTION_FADE_YEARS) return terminalValue;
  return value0 - (value0 - terminalValue) * (s / PROJECTION_FADE_YEARS);
}

// Average of the above over [0, t] — the closed-form integral divided by t. The analytic
// percentile band accumulates drift/volatility over the *whole* elapsed horizon, so it
// needs the cumulative average up to t (a point at t=1yr should barely be faded; one at
// t=10yr should be pulled most of the way to the terminal rate), not the instantaneous
// value used for the per-step paths above.
function fadedAverage(value0, terminalValue, t) {
  if (t <= 0) return value0;
  if (t >= PROJECTION_FADE_YEARS) {
    const fadeAvg = (value0 + terminalValue) / 2;
    return (fadeAvg * PROJECTION_FADE_YEARS + terminalValue * (t - PROJECTION_FADE_YEARS)) / t;
  }
  return value0 - (value0 - terminalValue) * (t / (2 * PROJECTION_FADE_YEARS));
}

// Geometric Brownian Motion price projection: a small fan of simulated random-walk paths
// (so the chart reads like a spread of real, organic-looking outcomes) plus an analytic
// p10/p50/p90 confidence band computed in closed form from GBM's lognormal distribution at
// each step — far cheaper than running enough Monte Carlo paths for stable percentiles, and
// exact rather than sampled; the band never depends on how many paths get drawn. One path
// gets flagged as "most probable": not literally more likely than any other single exact
// path (every continuous-time path has probability zero), but the one from the fan that
// tracked the analytic median most closely over the whole horizon — the least extreme
// sample of the bunch, in log-price terms so it's scale-consistent with the GBM itself.
// `rng` is injectable so the UI can force a fresh fan on "reroll".
export function computeProjection({ price, driftAnnual, volAnnual, horizonYears, stepsPerYear = 52, rng = Math.random, numPaths = 18, riskFreeRate = 0.045 }) {
  if (!price || price <= 0 || driftAnnual == null || volAnnual == null || !horizonYears) return null;
  const totalSteps = Math.max(1, Math.round(horizonYears * stepsPerYear));
  const dt = 1 / stepsPerYear;
  const drift0 = driftAnnual, vol0 = volAnnual;
  // Never fade *upward* — this only reins in an unusually hot near-term assumption toward
  // something more sustainable, it doesn't promise a quiet stock gets more volatile or a
  // struggling one recovers to an average market return just because a decade passes (same
  // asymmetric logic as the DCF's own terminalGrowth cap).
  const terminalDrift = Math.min(drift0, riskFreeRate + EQUITY_RISK_PREMIUM);
  const terminalVol = Math.min(vol0, PROJECTION_TERMINAL_VOL);

  const paths = Array.from({ length: numPaths }, () => {
    let simPrice = price;
    const path = [price];
    for (let i = 1; i <= totalSteps; i++) {
      const u1 = Math.max(rng(), 1e-9), u2 = rng();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      const sMid = (i - 0.5) * dt;
      const stepDrift = fadedInstant(drift0, terminalDrift, sMid);
      const stepVol = fadedInstant(vol0, terminalVol, sMid);
      simPrice = simPrice * Math.exp((stepDrift - 0.5 * stepVol * stepVol) * dt + stepVol * Math.sqrt(dt) * z);
      path.push(simPrice);
    }
    return path;
  });

  const points = [{ step: 0, t: 0, p10: price, p50: price, p90: price, paths: paths.map(p => p[0]) }];
  for (let i = 1; i <= totalSteps; i++) {
    const t = i * dt;
    const avgDrift = fadedAverage(drift0, terminalDrift, t);
    const avgVol = fadedAverage(vol0, terminalVol, t);
    const driftTerm = (avgDrift - 0.5 * avgVol * avgVol) * t;
    const spread = avgVol * Math.sqrt(t);
    const p10 = price * Math.exp(driftTerm + spread * invNormalCdf(0.10));
    const p50 = price * Math.exp(driftTerm);
    const p90 = price * Math.exp(driftTerm + spread * invNormalCdf(0.90));
    points.push({ step: i, t, p10: +p10.toFixed(2), p50: +p50.toFixed(2), p90: +p90.toFixed(2), paths: paths.map(p => +p[i].toFixed(2)) });
  }

  let bestPathIndex = 0, bestScore = Infinity;
  for (let pi = 0; pi < numPaths; pi++) {
    let sumSq = 0;
    for (let i = 0; i <= totalSteps; i++) {
      const diff = Math.log(points[i].paths[pi]) - Math.log(points[i].p50);
      sumSq += diff * diff;
    }
    if (sumSq < bestScore) { bestScore = sumSq; bestPathIndex = pi; }
  }

  return { points, driftAnnual, volAnnual, horizonYears, numPaths, bestPathIndex };
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
