// Orientative sector reference ranges. These are NOT live market data and NOT fitted to any
// ticker: they are wide, round "cheap / fair / rich" bands for long-run, ex-bubble conditions,
// used only to put a multiple in context. Every use is labelled "orientativo" in the UI.
// Each multiple: [cheap, fair, rich].

export const SECTOR_BENCHMARKS = {
  tech:        { pe: [15, 25, 40], evEbitda: [10, 18, 28], evEbit: [12, 22, 35], evSales: [2, 6, 12], pfcf: [14, 25, 40], pb: [3, 7, 14], opMargin: 0.22, grossMargin: 0.60, fcfMargin: 0.18 },
  software:    { pe: [18, 30, 50], evEbitda: [12, 22, 35], evEbit: [15, 28, 45], evSales: [3, 7, 14], pfcf: [16, 28, 45], pb: [4, 9, 18], opMargin: 0.25, grossMargin: 0.72, fcfMargin: 0.22 },
  semis:       { pe: [12, 22, 35], evEbitda: [8, 15, 24], evEbit: [10, 18, 30], evSales: [2, 5, 10], pfcf: [12, 22, 35], pb: [2, 5, 10], opMargin: 0.25, grossMargin: 0.52, fcfMargin: 0.18 },
  healthcare:  { pe: [12, 20, 30], evEbitda: [9, 14, 22], evEbit: [11, 17, 27], evSales: [1.5, 3.5, 7], pfcf: [12, 20, 32], pb: [2, 4, 8], opMargin: 0.18, grossMargin: 0.60, fcfMargin: 0.14 },
  staples:     { pe: [14, 20, 26], evEbitda: [9, 13, 18], evEbit: [11, 16, 22], evSales: [1, 2.2, 4], pfcf: [14, 21, 30], pb: [2, 4, 8], opMargin: 0.14, grossMargin: 0.40, fcfMargin: 0.09 },
  discretionary:{ pe: [11, 18, 28], evEbitda: [7, 12, 18], evEbit: [9, 15, 23], evSales: [0.6, 1.5, 3], pfcf: [10, 18, 28], pb: [2, 4, 8], opMargin: 0.10, grossMargin: 0.35, fcfMargin: 0.06 },
  retail:      { pe: [10, 17, 25], evEbitda: [6, 10, 15], evEbit: [8, 13, 20], evSales: [0.3, 0.9, 2], pfcf: [10, 17, 26], pb: [2, 4, 8], opMargin: 0.06, grossMargin: 0.30, fcfMargin: 0.04 },
  industrial:  { pe: [12, 19, 27], evEbitda: [8, 12, 17], evEbit: [10, 15, 22], evSales: [0.8, 1.8, 3.5], pfcf: [11, 19, 28], pb: [2, 4, 8], opMargin: 0.12, grossMargin: 0.32, fcfMargin: 0.07 },
  auto:        { pe: [5, 9, 15], evEbitda: [3, 6, 10], evEbit: [4, 8, 14], evSales: [0.2, 0.6, 1.2], pfcf: [4, 9, 16], pb: [0.8, 1.5, 3], opMargin: 0.06, grossMargin: 0.15, fcfMargin: 0.03 },
  energy:      { pe: [6, 11, 17], evEbitda: [3, 5.5, 8], evEbit: [5, 9, 14], evSales: [0.6, 1.4, 2.5], pfcf: [5, 10, 17], pb: [1, 1.8, 3], opMargin: 0.12, grossMargin: 0.30, fcfMargin: 0.08 },
  materials:   { pe: [8, 14, 21], evEbitda: [5, 8, 12], evEbit: [7, 11, 17], evSales: [0.8, 1.8, 3.5], pfcf: [8, 14, 22], pb: [1, 2, 4], opMargin: 0.14, grossMargin: 0.30, fcfMargin: 0.08 },
  utilities:   { pe: [11, 17, 22], evEbitda: [7, 10, 13], evEbit: [11, 15, 20], evSales: [1.5, 2.8, 4.5], pfcf: [0, 0, 0], pb: [1, 1.6, 2.4], opMargin: 0.18, grossMargin: 0.40, fcfMargin: 0.0 },
  telecom:     { pe: [8, 14, 21], evEbitda: [5, 7.5, 10], evEbit: [8, 12, 18], evSales: [1, 2.2, 3.8], pfcf: [7, 13, 20], pb: [1, 2, 4], opMargin: 0.17, grossMargin: 0.55, fcfMargin: 0.10 },
  media:       { pe: [10, 17, 26], evEbitda: [6, 11, 17], evEbit: [8, 14, 22], evSales: [1, 3, 6], pfcf: [9, 17, 27], pb: [1.5, 3, 6], opMargin: 0.15, grossMargin: 0.50, fcfMargin: 0.10 },
  financial:   { pe: [8, 12, 17], pb: [0.8, 1.3, 2.2], opMargin: 0.25, roe: 0.11 },
  reit:        { pe: [0, 0, 0], evEbitda: [12, 16, 22], pb: [1, 1.8, 3], opMargin: 0.30 },
  default:     { pe: [11, 18, 28], evEbitda: [7, 12, 18], evEbit: [9, 15, 23], evSales: [0.8, 2, 4.5], pfcf: [10, 18, 28], pb: [2, 4, 8], opMargin: 0.12, grossMargin: 0.38, fcfMargin: 0.07 },
};

export function pickBenchmark(sector, industry) {
  const s = (sector || '').toLowerCase();
  const i = (industry || '').toLowerCase();
  const has = (str, ...keys) => keys.some((k) => str.includes(k));
  if (has(i, 'reit') || has(s, 'real estate', 'reit')) return ['reit', SECTOR_BENCHMARKS.reit];
  if (has(s, 'bank', 'insurance', 'financial') || has(i, 'bank', 'insurance', 'asset management', 'capital markets')) return ['financial', SECTOR_BENCHMARKS.financial];
  if (has(i, 'semiconductor')) return ['semis', SECTOR_BENCHMARKS.semis];
  if (has(i, 'software', 'internet content', 'information technology services')) return ['software', SECTOR_BENCHMARKS.software];
  if (has(i, 'auto')) return ['auto', SECTOR_BENCHMARKS.auto];
  if (has(i, 'department store', 'discount', 'grocery', 'specialty retail', 'home improvement', 'internet retail', 'apparel retail')) return ['retail', SECTOR_BENCHMARKS.retail];
  if (has(i, 'beverage', 'packaged food', 'household', 'tobacco', 'personal product')) return ['staples', SECTOR_BENCHMARKS.staples];
  if (has(s, 'tech', 'software')) return ['tech', SECTOR_BENCHMARKS.tech];
  if (has(s, 'health', 'pharma', 'biotech')) return ['healthcare', SECTOR_BENCHMARKS.healthcare];
  if (has(s, 'staple', 'consumer defensive', 'food', 'beverage')) return ['staples', SECTOR_BENCHMARKS.staples];
  if (has(s, 'consumer', 'retail', 'leisure')) return ['discretionary', SECTOR_BENCHMARKS.discretionary];
  if (has(s, 'industrial')) return ['industrial', SECTOR_BENCHMARKS.industrial];
  if (has(s, 'energy', 'oil', 'gas')) return ['energy', SECTOR_BENCHMARKS.energy];
  if (has(s, 'material', 'chemical', 'metal', 'mining')) return ['materials', SECTOR_BENCHMARKS.materials];
  if (has(s, 'util')) return ['utilities', SECTOR_BENCHMARKS.utilities];
  if (has(s, 'communication', 'telecom')) return has(i, 'telecom') ? ['telecom', SECTOR_BENCHMARKS.telecom] : ['media', SECTOR_BENCHMARKS.media];
  return ['default', SECTOR_BENCHMARKS.default];
}

// Sector keywords whose earnings swing with an external price or the economic cycle.
export const CYCLICAL_KEYS = ['energy', 'oil', 'gas', 'material', 'metal', 'mining', 'steel', 'chemical', 'auto', 'airline', 'homebuilder', 'residential construction', 'shipping', 'trucking', 'semiconductor', 'machinery', 'building'];
