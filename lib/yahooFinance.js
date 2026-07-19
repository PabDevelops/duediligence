// Yahoo's quoteSummary/fundamentals-timeseries endpoints require a session cookie + crumb
// (unauthenticated calls return "Invalid Crumb"). Cached per warm serverless instance.
let yahooAuthCache = null;
export async function getYahooAuth() {
  if (yahooAuthCache && Date.now() < yahooAuthCache.expires) return yahooAuthCache;
  const UA = 'Mozilla/5.0';
  const r1 = await fetch('https://fc.yahoo.com', { headers: { 'User-Agent': UA }, redirect: 'manual' });
  const cookie = (r1.headers.get('set-cookie') || '').split(';')[0];
  const r2 = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
    headers: { 'User-Agent': UA, Cookie: cookie },
  });
  const crumb = await r2.text();
  if (!crumb || crumb.includes('<')) throw new Error('Failed to obtain Yahoo crumb');
  yahooAuthCache = { cookie, crumb, expires: Date.now() + 50 * 60 * 1000 };
  return yahooAuthCache;
}

// Finnhub's /calendar/earnings has thin coverage for foreign private issuers (20-F filers
// like Nokia) — it can return zero rows for a ticker even when Yahoo already has a confirmed
// or estimated date. earningsDate is Yahoo's estimate window (usually a 1-2 entry array of
// unix-second timestamps bracketing the likely report date); we take the earliest one. No EPS
// estimate/hour(bmo/amc) here — Yahoo's calendarEvents module doesn't carry those the way
// Finnhub's calendar entry does.
export async function fetchYahooEarningsDate(ticker) {
  try {
    const auth = await getYahooAuth();
    const res = await fetch(
      `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=calendarEvents&crumb=${encodeURIComponent(auth.crumb)}`,
      { headers: { 'User-Agent': 'Mozilla/5.0', Cookie: auth.cookie } }
    );
    const json = await res.json();
    const dates = json?.quoteSummary?.result?.[0]?.calendarEvents?.earnings?.earningsDate;
    const raw = Array.isArray(dates) ? dates.map(d => d?.raw).filter(v => v != null).sort((a, b) => a - b)[0] : null;
    if (raw == null) return null;
    return new Date(raw * 1000).toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

// Analyst buy/hold/sell counts for the current month, in the same shape as Finnhub's
// /stock/recommendation — used to seed analyst consensus for tickers Finnhub doesn't cover.
export async function fetchYahooRecommendationTrend(ticker) {
  try {
    const auth = await getYahooAuth();
    const res = await fetch(
      `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=recommendationTrend&crumb=${encodeURIComponent(auth.crumb)}`,
      { headers: { 'User-Agent': 'Mozilla/5.0', Cookie: auth.cookie } }
    );
    const json = await res.json();
    const trend = json?.quoteSummary?.result?.[0]?.recommendationTrend?.trend;
    const current = trend?.find(t => t.period === '0m') || trend?.[0];
    if (!current) return null;
    return {
      strongBuy: current.strongBuy || 0,
      buy: current.buy || 0,
      hold: current.hold || 0,
      sell: current.sell || 0,
      strongSell: current.strongSell || 0,
    };
  } catch {
    return null;
  }
}

// Symbol/name autocomplete against Yahoo's public search endpoint — unlike quoteSummary,
// this one doesn't need the cookie/crumb dance. Returns every quoteType Yahoo matches
// (EQUITY, ETF, CURRENCY, INDEX, ...); callers filter to the type(s) they care about. Used
// to fill in ETF search results beyond what's already cached in stock_cache — there's no
// SEC-style free directory of ETF tickers the way there is for SEC-registered companies.
export async function fetchYahooSymbolSearch(query) {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=20&newsCount=0`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    const json = await res.json();
    const quotes = json?.quotes || [];
    return quotes
      .filter(q => q.symbol)
      .map(q => ({
        ticker: q.symbol,
        name: q.shortname || q.longname || q.symbol,
        exchange: q.exchange || null,
        quoteType: q.quoteType || null,
      }));
  } catch {
    return [];
  }
}
