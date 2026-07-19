import { parsePercent, parseAUM, parseVolume } from './formatters';

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// Maps a value to 0-100 on a log scale between minValue (-> 0) and maxValue (-> 100).
// Used for AUM/volume, which span several orders of magnitude across funds.
function logScale(value, minValue, maxValue) {
  if (value <= 0) return 0;
  const score = ((Math.log10(value) - Math.log10(minValue)) / (Math.log10(maxValue) - Math.log10(minValue))) * 100;
  return clamp(score, 0, 100);
}

// Computes a 0-100 "quality" composite for an ETF from data already returned by
// fetchETFData (app/api/etfs/route.js): expense ratio (cost), AUM & volume (liquidity),
// and top-holdings concentration (diversification). There's no company-fundamentals
// equivalent for a fund, and Yahoo's Morningstar rating fields come back empty on the
// unauthenticated endpoint this app uses — so this sticks to what's actually reported,
// and marks a factor `available: false` rather than silently scoring it as 0 (worst) or
// 100 (best) when the underlying field is missing (e.g. "See Prospectus", or a fund like
// BND/TLT that Yahoo reports zero holdings for).
export function computeETFQualityScore(etf) {
  if (!etf) return null;

  const costAvailable = !!etf.expenseRatio && etf.expenseRatio !== 'See Prospectus';
  const expensePct = costAvailable ? parsePercent(etf.expenseRatio) : null;
  const costScore = costAvailable ? clamp(100 - (expensePct / 1.0) * 100, 0, 100) : null;

  const aumAvailable = !!etf.aum && etf.aum !== 'See Prospectus';
  const volAvailable = !!etf.volume && etf.volume !== 'N/A';
  const aumScore = aumAvailable ? logScale(parseAUM(etf.aum), 0.01, 500) : null;
  const volScore = volAvailable ? logScale(parseVolume(etf.volume), 0.05, 30) : null;
  const liquidityAvailable = aumAvailable || volAvailable;
  const liquiditySubScores = [aumScore, volScore].filter((s) => s != null);
  const liquidityScore = liquidityAvailable
    ? liquiditySubScores.reduce((a, b) => a + b, 0) / liquiditySubScores.length
    : null;

  const holdings = etf.holdings || [];
  const diversificationAvailable = holdings.length > 0;
  const top10Concentration = diversificationAvailable
    ? holdings.slice(0, 10).reduce((sum, h) => sum + parsePercent(h.weight), 0)
    : null;
  const diversificationScore = diversificationAvailable ? clamp(100 - top10Concentration, 0, 100) : null;

  const factors = {
    cost: {
      label: 'Cost',
      score: costScore,
      available: costAvailable,
      raw: costAvailable ? etf.expenseRatio : null,
      reason: costAvailable ? null : 'Expense ratio not reported',
      desc: 'Lower expense ratio scores higher',
    },
    liquidity: {
      label: 'Liquidity',
      score: liquidityScore,
      available: liquidityAvailable,
      raw: liquidityAvailable ? `${etf.aum || '—'} AUM · ${etf.volume || '—'} vol` : null,
      reason: liquidityAvailable ? null : 'AUM and volume not reported',
      desc: 'Larger AUM & volume score higher',
    },
    diversification: {
      label: 'Diversification',
      score: diversificationScore,
      available: diversificationAvailable,
      raw: diversificationAvailable ? `${top10Concentration.toFixed(1)}% in top ${Math.min(holdings.length, 10)}` : null,
      reason: diversificationAvailable ? null : 'No holdings reported',
      desc: 'Lower concentration in top holdings scores higher',
    },
  };

  const availableScores = Object.values(factors).filter((f) => f.available).map((f) => f.score);
  const composite = availableScores.length > 0
    ? availableScores.reduce((a, b) => a + b, 0) / availableScores.length
    : null;

  return { composite, factors };
}
