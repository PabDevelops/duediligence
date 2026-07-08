import { checkIsAdmin } from '../../../../lib/isAdmin';
import { THEMES } from '../../explore/route';

// Populates stock_cache for a batch of tickers proactively, instead of relying on a real
// user searching each one first. Reuses /api/stock's existing fetch/upsert logic via an
// internal HTTP call rather than duplicating the SEC EDGAR/Finnhub/Yahoo fetching — same
// approach the auto-post-educational cron job uses to call other routes.
//
// Each /api/stock call can fire up to 3 Finnhub requests (quote, metric, profile2), and
// Finnhub's free tier caps out at 60 req/min with no retry on our side — /api/stock just
// silently caches nulls for whatever Finnhub fields come back missing. Keep concurrency
// and pacing low enough to stay well under that limit even with other traffic hitting
// Finnhub at the same time.
const CONCURRENCY = 2;
const BATCH_DELAY_MS = 8000;

export async function POST(request) {
  const cronToken = request.headers.get('X-Cron-Secret');
  const isCron = cronToken && process.env.CRON_SECRET && cronToken === process.env.CRON_SECRET;

  if (!isCron) {
    const isAdmin = await checkIsAdmin();
    if (!isAdmin) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let tickers = null;
  try {
    const body = await request.json();
    if (Array.isArray(body?.tickers) && body.tickers.length > 0) tickers = body.tickers;
  } catch (e) {}

  // Default: every ticker referenced by the Explore page's curated categories.
  if (!tickers) {
    tickers = [...new Set(Object.values(THEMES).flatMap((t) => t.tickers))];
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const seeded = [];
  const failed = [];

  for (let i = 0; i < tickers.length; i += CONCURRENCY) {
    const batch = tickers.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async (ticker) => {
      try {
        const res = await fetch(`${baseUrl}/api/stock?ticker=${encodeURIComponent(ticker)}`);
        if (res.ok) seeded.push(ticker); else failed.push(ticker);
      } catch (e) {
        failed.push(ticker);
      }
    }));

    if (i + CONCURRENCY < tickers.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  return Response.json({ total: tickers.length, seeded, failed });
}
