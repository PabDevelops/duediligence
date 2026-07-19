// Shared number/currency formatters used across app/(workspace)/*/page.js.
// Two formatCurrency-shaped concerns existed in parallel before this file:
// an abbreviating one for large totals (market cap, portfolio value — T/B/M)
// and a non-abbreviating one for per-share prices (always 2 decimals). They
// are kept as separate functions below rather than merged, since collapsing
// them would change what gets displayed for some inputs.

export function fmt(val, fallback = '—') {
  if (val === null || val === undefined) return fallback;
  if (Math.abs(val) >= 1e12) return `$${(val / 1e12).toFixed(1)}T`;
  if (Math.abs(val) >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
  if (Math.abs(val) >= 1e6) return `$${(val / 1e6).toFixed(0)}M`;
  return `$${val.toLocaleString()}`;
}

export function formatCurrency(val, symbol = '$', fallback = '—') {
  if (val === null || val === undefined) return fallback;
  const abs = Math.abs(val);
  if (abs >= 1e12) return `${symbol}${(val / 1e12).toFixed(1)}T`;
  if (abs >= 1e9) return `${symbol}${(val / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${symbol}${(val / 1e6).toFixed(0)}M`;
  return `${symbol}${val.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

const PRICE_SYMBOLS = { USD: '$', EUR: '€', GBP: '£', JPY: '¥' };

export function formatPrice(val, currency = 'USD') {
  if (val === null || val === undefined) return '—';
  const sym = PRICE_SYMBOLS[currency] || `${currency} `;
  return `${sym}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatPriceWithSymbol(val, symbol = '$') {
  if (val === null || val === undefined) return '—';
  return `${symbol}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtP(v, { decimals = null, fallback = '—' } = {}) {
  if (v === null || v === undefined) return fallback;
  return decimals != null ? `${v.toFixed(decimals)}%` : `${v}%`;
}

export function fmtN(v, d = 1, fallback = '—') {
  if (v === null || v === undefined) return fallback;
  return v.toFixed(d);
}

export function parseAUM(aumStr) {
  if (!aumStr || aumStr === 'See Prospectus') return 0;
  return parseFloat(aumStr.replace(/[$\$,B]/g, '')) || 0;
}

export function parsePercent(pctStr) {
  if (!pctStr || pctStr === 'See Prospectus') return 0;
  return parseFloat(pctStr.replace(/%/g, '')) || 0;
}

export function parseVolume(volStr) {
  if (!volStr || volStr === 'N/A') return 0;
  return parseFloat(volStr.replace(/M/g, '')) || 0;
}
