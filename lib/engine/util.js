// Shared helpers for the V2 analysis engine. Everything here is pure and deterministic.
// Convention: a missing figure is `null`, never 0 and never a silent default.

export const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Division that returns null instead of Infinity/NaN or a ratio against a zero/absent base.
export function div(a, b) {
  if (!isNum(a) || !isNum(b) || b === 0) return null;
  return a / b;
}

export function median(values) {
  const v = (values || []).filter(isNum).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

export function mean(values) {
  const v = (values || []).filter(isNum);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

export function stdev(values) {
  const v = (values || []).filter(isNum);
  if (v.length < 2) return null;
  const m = mean(v);
  return Math.sqrt(v.reduce((a, x) => a + (x - m) ** 2, 0) / (v.length - 1));
}

// Piecewise-linear map of a value onto a score; flat outside the anchors.
// points: ascending by x, [[x, score], ...].
export function interp(value, points) {
  if (!isNum(value)) return null;
  if (value <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i];
    if (value <= x1) {
      const [x0, y0] = points[i - 1];
      return y0 + ((y1 - y0) * (value - x0)) / (x1 - x0);
    }
  }
  return points[points.length - 1][1];
}

// Compound annual growth rate between two positive values. Null when either end is not
// positive (a CAGR across a sign change has no meaning).
export function cagr(first, last, years) {
  if (!isNum(first) || !isNum(last) || first <= 0 || last <= 0 || !(years > 0)) return null;
  return Math.pow(last / first, 1 / years) - 1;
}

// Sort a {year,val} history ascending and drop null values.
export function cleanHistory(hist) {
  return (hist || [])
    .filter((h) => h && isNum(h.val) && h.year != null)
    .map((h) => ({ ...h, y: parseInt(String(h.year).slice(0, 4), 10) }))
    .filter((h) => Number.isFinite(h.y))
    .sort((a, b) => a.y - b.y);
}

export function byYear(hist) {
  const m = {};
  cleanHistory(hist).forEach((h) => { m[h.y] = h.val; });
  return m;
}

export const round = (v, d = 2) => (isNum(v) ? +v.toFixed(d) : null);

// Provenance wrapper. Every headline figure the UI shows should carry where it came from.
//   type: 'reportado' | 'ajustado' | 'calculado' | 'estimado'
export function metric(value, meta = {}) {
  return {
    value: isNum(value) ? value : null,
    unit: meta.unit ?? null,
    currency: meta.currency ?? null,
    type: meta.type ?? 'calculado',
    source: meta.source ?? null,
    period: meta.period ?? null,
    publishedAt: meta.publishedAt ?? null,
    updatedAt: meta.updatedAt ?? null,
    note: meta.note ?? null,
    missingReason: isNum(value) ? null : (meta.missingReason ?? 'Dato no disponible en las fuentes actuales'),
  };
}

// Compact, beginner-friendly money format in Spanish ("45,0 mil M $" = 45.0 billion).
export function fmtMoney(v, sym = '$') {
  if (!isNum(v)) return 'N/D';
  const a = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  const f = (x, d) => x.toFixed(d).replace('.', ',');
  if (a >= 1e9) return `${sign}${f(a / 1e9, 1)} mil M ${sym}`;
  if (a >= 1e6) return `${sign}${f(a / 1e6, 1)} M ${sym}`;
  return `${sign}${f(a, 0)} ${sym}`;
}

// Converts decimal points to commas inside display strings (Spanish from Spain), leaving
// numbers, ids and dates untouched. Applied once to user-facing text at the end of analysis.
export function localizeDecimals(value) {
  if (typeof value === 'string') return value.replace(/(\d)\.(\d)/g, '$1,$2');
  if (Array.isArray(value)) return value.map(localizeDecimals);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, localizeDecimals(v)]));
  return value;
}
