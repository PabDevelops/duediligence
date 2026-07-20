// Standard market-cap tier bands (Finviz / Investopedia / Morningstar cutoffs), used both to
// classify/filter tickers (Screener, the dedicated Small & Micro Cap page) and to calibrate
// the Quality Score in stockScoring.js.
//
// Cap Tiers:
// Mega Cap: > $200B
// Large Cap: $10B - $200B
// Mid Cap: $2B - $10B
// Small Cap: $300M - $2B (~1,500 stocks)
// Micro Cap: $50M - $300M (~1,459 stocks)
// Nano Cap: < $50M (~825 stocks)
// Sub-$2B Total = Small + Micro + Nano = ~3,784 stocks

const BASELINE = { thresholdScale: 1.00, stabilityCvThreshold: 0.25, capitalDisciplineWeight: 0, weights: { cbs: 0.45, oppo: 0.30, gqs: 0.25 } };

export const CAP_TIERS = [
  { id: 'mega', label: 'MEGA CAP', short: 'Mega', min: 200e9, max: Infinity, color: '#a855f7', ...BASELINE },
  { id: 'large', label: 'LARGE CAP', short: 'Large', min: 10e9, max: 200e9, color: 'var(--ws-accent)', ...BASELINE },
  { id: 'mid', label: 'MID CAP', short: 'Mid', min: 2e9, max: 10e9, color: 'var(--ws-text)', ...BASELINE },
  {
    id: 'small', label: 'SMALL CAP', short: 'Small', min: 300e6, max: 2e9,
    color: 'var(--ws-text-2)',
    thresholdScale: 0.90, stabilityCvThreshold: 0.32, capitalDisciplineWeight: 0.20,
    weights: { cbs: 0.38, oppo: 0.28, gqs: 0.34 },
  },
  {
    id: 'micro', label: 'MICRO CAP', short: 'Micro', min: 50e6, max: 300e6,
    color: 'var(--ws-text-3)',
    thresholdScale: 0.80, stabilityCvThreshold: 0.40, capitalDisciplineWeight: 0.30,
    weights: { cbs: 0.32, oppo: 0.26, gqs: 0.42 },
  },
  {
    id: 'nano', label: 'NANO CAP', short: 'Nano', min: 0, max: 50e6,
    color: '#ef4444',
    thresholdScale: 0.70, stabilityCvThreshold: 0.45, capitalDisciplineWeight: 0.35,
    weights: { cbs: 0.30, oppo: 0.25, gqs: 0.45 },
  },
];

export function isTierAdjusted(tierId) {
  return tierId === 'small' || tierId === 'micro' || tierId === 'nano';
}

export const DEFAULT_TIER = CAP_TIERS[2];

export function getCapTier(marketCap) {
  if (marketCap == null || !(marketCap > 0)) return null;
  return CAP_TIERS.find(t => marketCap >= t.min && marketCap < t.max) || CAP_TIERS[0];
}

export function isSmallOrMicro(marketCap) {
  const tier = getCapTier(marketCap);
  return tier != null && (tier.id === 'small' || tier.id === 'micro' || tier.id === 'nano');
}
