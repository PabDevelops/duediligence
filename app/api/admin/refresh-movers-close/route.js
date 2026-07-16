import { checkIsAdmin } from '../../../../lib/isAdmin';

// Snapshots the true closing price/% for whatever's currently showing in Home's movers
// lists, right after market close, instead of leaving that snapshot to whenever a real user
// next happens to view one of those tickers. Same call-through-/api/stock approach and
// Finnhub-safe pacing as /api/admin/seed-tickers.
const CONCURRENCY = 2;
const BATCH_DELAY_MS = 8000;

export async function POST(request) {
  const cronToken = request.headers.get('X-Cron-Secret');
  const isCron = cronToken && process.env.CRON_SECRET && cronToken === process.env.CRON_SECRET;

  if (!isCron) {
    const isAdmin = await checkIsAdmin();
    if (!isAdmin) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const moversRes = await fetch(`${baseUrl}/api/movers`);
  const movers = await moversRes.json();
  const tickers = [...new Set([
    ...(movers.gainers || []),
    ...(movers.losers || []),
    ...(movers.bigCapMovers || []),
  ].map(s => s.ticker))];

  const refreshed = [];
  const failed = [];

  for (let i = 0; i < tickers.length; i += CONCURRENCY) {
    const batch = tickers.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async (ticker) => {
      try {
        const res = await fetch(`${baseUrl}/api/stock?ticker=${encodeURIComponent(ticker)}`);
        if (res.ok) refreshed.push(ticker); else failed.push(ticker);
      } catch (e) {
        failed.push(ticker);
      }
    }));

    if (i + CONCURRENCY < tickers.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  return Response.json({ total: tickers.length, refreshed, failed });
}
