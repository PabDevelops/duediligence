// Finnhub's profile2 endpoint (finnhubIndustry) returns GICS industry-group-level strings
// (e.g. "Metals & Mining", "Banking", "Biotechnology") rather than the 11 broad GICS sectors
// ("Basic Materials", "Financial Services", "Healthcare"...) that the screener/calendar sector
// filters are meant to work with. This mapping collapses those ~50 industry strings down to
// the 11 canonical sectors so `sector` and `industry` stop being duplicates of the same
// granular value (see app/api/stock/route.js's sector/industry assignment).
const CANONICAL_SECTORS = [
  'Basic Materials',
  'Communication Services',
  'Consumer Cyclical',
  'Consumer Defensive',
  'Energy',
  'Financial Services',
  'Healthcare',
  'Industrials',
  'Real Estate',
  'Technology',
  'Utilities',
];

const CANONICAL_SET = new Set(CANONICAL_SECTORS);

// Keys are lowercased Finnhub finnhubIndustry values (or other vendors' industry-level
// strings encountered in stock_cache). Values are one of CANONICAL_SECTORS above.
const INDUSTRY_TO_SECTOR = {
  // Basic Materials
  'metals & mining': 'Basic Materials',
  'chemicals': 'Basic Materials',
  'paper & forest': 'Basic Materials',
  'packaging': 'Basic Materials',

  // Energy
  'energy': 'Energy',
  'oil & gas': 'Energy',

  // Industrials
  'electrical equipment': 'Industrials',
  'machinery': 'Industrials',
  'commercial services & supplies': 'Industrials',
  'construction': 'Industrials',
  'professional services': 'Industrials',
  'aerospace & defense': 'Industrials',
  'trading companies & distributors': 'Industrials',
  'road & rail': 'Industrials',
  'building': 'Industrials',
  'marine': 'Industrials',
  'industrial conglomerates': 'Industrials',
  'logistics & transportation': 'Industrials',
  'distributors': 'Industrials',
  'airlines': 'Industrials',
  'transportation infrastructure': 'Industrials',

  // Consumer Cyclical
  'retail': 'Consumer Cyclical',
  'hotels, restaurants & leisure': 'Consumer Cyclical',
  'textiles, apparel & luxury goods': 'Consumer Cyclical',
  'auto components': 'Consumer Cyclical',
  'diversified consumer services': 'Consumer Cyclical',
  'leisure products': 'Consumer Cyclical',
  'automobiles': 'Consumer Cyclical',
  'consumer products': 'Consumer Cyclical',

  // Consumer Defensive
  'food products': 'Consumer Defensive',
  'beverages': 'Consumer Defensive',
  'tobacco': 'Consumer Defensive',

  // Healthcare
  'biotechnology': 'Healthcare',
  'health care': 'Healthcare',
  'pharmaceuticals': 'Healthcare',
  'life sciences tools & services': 'Healthcare',

  // Financial Services
  'banking': 'Financial Services',
  'financial services': 'Financial Services',
  'insurance': 'Financial Services',

  // Technology
  'technology': 'Technology',
  'semiconductors': 'Technology',

  // Communication Services
  'media': 'Communication Services',
  'telecommunication': 'Communication Services',
  'communications': 'Communication Services',

  // Real Estate
  'real estate': 'Real Estate',

  // Utilities
  'utilities': 'Utilities',
};

// Raw values that mean "no classification available" rather than an unmapped industry string.
const UNKNOWN_VALUES = new Set(['n/a', 'na', 'unknown', '']);

// Maps a raw sector/industry string (Finnhub's finnhubIndustry, or anything already clean) to
// one of CANONICAL_SECTORS. Returns null when the input is empty/"N/A" or when it's an industry
// string this mapping doesn't recognize yet (rather than guessing).
function normalizeSector(raw) {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed || UNKNOWN_VALUES.has(trimmed.toLowerCase())) return null;
  if (CANONICAL_SET.has(trimmed)) return trimmed;
  return INDUSTRY_TO_SECTOR[trimmed.toLowerCase()] || null;
}

// Plain CommonJS export (rather than `export`/`export const`) so this file can be `require()`d
// as-is from the standalone Node scripts in scripts/ (populateFullMarket.js, normalizeSectors.js
// — those run via plain `node`, no bundler) while still working as a named import from the
// Next.js app (`import { normalizeSector } from '../../../lib/sectorMapping.js'`), which Next's
// bundler resolves fine via standard CJS/ESM interop.
module.exports = { CANONICAL_SECTORS, normalizeSector };
