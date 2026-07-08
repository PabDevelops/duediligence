// Full SEC-registered ticker/name directory (~10k US companies), used so search can
// match on any company — not just ones someone has already looked up into stock_cache.
// No financial data lives here, just identity; cached in-memory since it barely changes
// day to day (same pattern as getYahooAuth's cookie/crumb cache).
let directoryCache = null;
const CACHE_HOURS = 24;

export async function getSecTickerDirectory() {
  if (directoryCache && Date.now() < directoryCache.expires) return directoryCache.list;

  const res = await fetch('https://www.sec.gov/files/company_tickers.json', {
    headers: { 'User-Agent': 'DueDiligenceApp contact@example.com' },
  });
  const data = await res.json();

  const list = Object.values(data).map((c) => ({
    ticker: c.ticker,
    name: c.title,
    cik: c.cik_str,
  }));

  directoryCache = { list, expires: Date.now() + CACHE_HOURS * 60 * 60 * 1000 };
  return list;
}
