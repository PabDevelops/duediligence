// Groups Finnhub's raw `exchange` strings -- 70+ distinct values in stock_cache, mostly a
// long tail of national exchanges with only a handful of rows each -- into a small set of
// buckets a user can actually filter by. Order matters: more specific patterns are checked
// before the generic ones they'd otherwise be swallowed by (e.g. "NASDAQ OMX NORDIC" must hit
// Nordic before the NASDAQ check; "NYSE EURONEXT - EURONEXT PARIS" must hit Euronext before NYSE).
const EXCHANGE_GROUPS = [
  { label: 'Nordic', test: /NORDIC|OSLO B|HELSINKI|COPENHAGEN|AKTIETORGET/i },
  { label: 'Euronext', test: /EURONEXT/i },
  { label: 'Germany (Xetra)', test: /XETRA|DEUTSCHE BOERSE|BOERSE/i },
  { label: 'TSX / TSXV', test: /TORONTO|TSX|CANADIAN NATIONAL|AEQUITAS|CANADIAN SEC/i },
  { label: 'Hong Kong', test: /HONG KONG|HKSE/i },
  { label: 'Tokyo', test: /TOKYO/i },
  { label: 'China', test: /SHANGHAI|SHENZHEN|GRETAI/i },
  { label: 'ASX (Australia)', test: /\bASX\b/i },
  { label: 'London (LSE)', test: /LONDON|^LSE$/i },
  { label: 'NASDAQ', test: /NASDAQ/i },
  { label: 'NYSE', test: /NEW YORK STOCK EXCHANGE|^NYSE/i },
  { label: 'OTC Markets', test: /OTC/i },
];

const OTHER_LABEL = 'Other International';

// Every bucket a stock can land in, in a fixed display order -- catch-all last.
export const EXCHANGE_GROUP_LABELS = [...EXCHANGE_GROUPS.map(g => g.label), OTHER_LABEL];

// Groups whose listings are reliably USD-denominated regardless of the issuer's domicile
// (ADRs trade in USD on these same exchanges) -- used both to keep the guest screener slice's
// market-cap sort from being swamped by un-converted local-currency values, and to infer
// country: US for the many US tickers whose `country` field never got backfilled (see
// app/api/stock/route.js, which never writes a country field, unlike the bulk populate script).
export const US_EXCHANGE_GROUPS = ['NASDAQ', 'NYSE', 'OTC Markets'];

export function normalizeExchange(raw) {
  if (!raw) return null;
  const group = EXCHANGE_GROUPS.find(g => g.test.test(raw));
  return group ? group.label : OTHER_LABEL;
}
