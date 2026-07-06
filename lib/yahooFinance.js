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
