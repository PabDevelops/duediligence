// Full SEC-registered ticker/name directory (~10k US companies), used so search can
// match on any company — not just ones someone has already looked up into stock_cache.
// No financial data lives here, just identity; cached in-memory since it barely changes
// day to day (same pattern as getYahooAuth's cookie/crumb cache).
let directoryCache = null;
const CACHE_HOURS = 24;

// SEC's own registrant title appends the state (or country) of incorporation as a "/XX"
// suffix to disambiguate same-named entities — e.g. "QUALCOMM INC/DE" (Delaware), "JOHN
// DEERE CAPITAL CORP/DE". Meaningful for SEC's internal bookkeeping, meaningless (and
// confusing — reads like a stray file extension) to a user just trying to identify a
// company, so this strips it for display everywhere the raw SEC title would otherwise
// surface: search results here and the stock page's `name` (app/api/stock/route.js).
export function cleanCompanyName(title) {
  return title ? title.replace(/\/[A-Z]{2}$/, '').trim() : title;
}

export async function getSecTickerDirectory() {
  if (directoryCache && Date.now() < directoryCache.expires) return directoryCache.list;

  const res = await fetch('https://www.sec.gov/files/company_tickers.json', {
    headers: { 'User-Agent': 'DueDiligenceApp contact@example.com' },
  });
  const data = await res.json();

  const list = Object.values(data).map((c) => ({
    ticker: c.ticker,
    name: cleanCompanyName(c.title),
    cik: c.cik_str,
  }));

  directoryCache = { list, expires: Date.now() + CACHE_HOURS * 60 * 60 * 1000 };
  return list;
}
