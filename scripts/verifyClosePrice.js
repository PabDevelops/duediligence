// Manual check: compares the currentPrice our own /api/stock route returns against Yahoo
// Finance's own last/close price, for a handful of tickers. Meant to be run by hand after
// market close to confirm the "current price" shown on a stock detail page actually matches
// the officla close instead of a stale intraday snapshot (see app/api/stock/route.js's
// "fast price update" path and recomputePriceRatios).
//
// Usage:
//   node scripts/verifyClosePrice.js [TICKERS...]
//   node scripts/verifyClosePrice.js LOGI AAPL MSFT
//
// Defaults to a small basket if no tickers are given. Requires the app to be reachable at
// APP_BASE_URL (defaults to http://localhost:3000) with its own env (Supabase/Finnhub keys)
// already configured — this script does not call Finnhub directly, it exercises the same
// /api/stock path a real page load would.

const DEFAULT_TICKERS = ['LOGI', 'AAPL', 'MSFT'];
const APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';
// A few cents of divergence is expected/harmless (Yahoo and Finnhub round/report slightly
// differently); anything beyond this is worth investigating.
const TOLERANCE_PCT = 0.5;

async function fetchOurPrice(ticker) {
  const res = await fetch(`${APP_BASE_URL}/api/stock?ticker=${ticker}&refresh=true`);
  if (!res.ok) throw new Error(`/api/stock?ticker=${ticker} returned ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return { price: data.currentPrice, prevClose: data.prevClose };
}

async function fetchYahooClose(ticker) {
  const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}`, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  if (!res.ok) throw new Error(`Yahoo chart for ${ticker} returned ${res.status}`);
  const data = await res.json();
  const meta = data?.chart?.result?.[0]?.meta;
  if (!meta) throw new Error(`Yahoo chart for ${ticker} had no meta`);
  // regularMarketPrice reflects the last session's close once the market is shut; previousClose
  // is the session before that.
  return { price: meta.regularMarketPrice, prevClose: meta.previousClose ?? meta.chartPreviousClose };
}

(async () => {
  const tickers = process.argv.slice(2).length ? process.argv.slice(2).map(t => t.toUpperCase()) : DEFAULT_TICKERS;
  console.log(`Comparing ${APP_BASE_URL}/api/stock currentPrice against Yahoo Finance for: ${tickers.join(', ')}\n`);

  let anyFailed = false;
  for (const ticker of tickers) {
    try {
      const [ours, yahoo] = await Promise.all([fetchOurPrice(ticker), fetchYahooClose(ticker)]);
      if (ours.price == null || yahoo.price == null) {
        console.log(`${ticker.padEnd(6)} SKIP  missing price (ours=${ours.price}, yahoo=${yahoo.price})`);
        continue;
      }
      const diffPct = Math.abs((ours.price - yahoo.price) / yahoo.price) * 100;
      const pass = diffPct <= TOLERANCE_PCT;
      if (!pass) anyFailed = true;
      console.log(
        `${ticker.padEnd(6)} ${pass ? 'PASS' : 'FAIL'}  ours=$${ours.price.toFixed(2)}  yahoo=$${yahoo.price.toFixed(2)}  diff=${diffPct.toFixed(2)}%`
      );
    } catch (err) {
      anyFailed = true;
      console.log(`${ticker.padEnd(6)} ERROR ${err.message}`);
    }
  }

  if (anyFailed) {
    console.log('\nOne or more tickers diverged beyond tolerance or errored — investigate before trusting the price feed.');
    process.exit(1);
  }
  console.log('\nAll tickers within tolerance.');
})();
