import { checkIsAdmin } from '../../../../lib/isAdmin';
import { isCronRequest } from '../../../../lib/verifyCronAuth';

// The Calendar page's earnings list is deliberately decoupled from stock_cache (see the
// comment in app/api/earnings/route.js) so it can show every upcoming earnings date, not
// just ones someone already viewed. That means most of those tickers stay uncached until a
// user clicks in — with low traffic, most never get clicked. This pre-warms stock_cache for
// every ticker with an earnings date in the next DAYS_AHEAD days by delegating to
// seed-tickers, which already has the Finnhub-rate-limit-safe batching logic.
const DAYS_AHEAD = 35;

async function handler(request) {
  const isCron = isCronRequest(request);

  if (!isCron) {
    const isAdmin = await checkIsAdmin();
    if (!isAdmin) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const today = new Date();
  const from = today.toISOString().slice(0, 10);
  const to = new Date(today.getTime() + DAYS_AHEAD * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  let tickers = [];
  try {
    const earningsRes = await fetch(`${baseUrl}/api/earnings?from=${from}&to=${to}`);
    const { earnings } = await earningsRes.json().catch(() => ({ earnings: [] }));
    tickers = [...new Set((earnings || []).map((e) => e.ticker).filter(Boolean))];
  } catch (e) {
    return Response.json({ error: 'Failed to fetch earnings calendar' }, { status: 502 });
  }

  if (tickers.length === 0) {
    return Response.json({ ticker_count: 0, seeded: [], failed: [] });
  }

  const seedRes = await fetch(`${baseUrl}/api/admin/seed-tickers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Cron-Secret': process.env.CRON_SECRET || '',
    },
    body: JSON.stringify({ tickers }),
  });
  const result = await seedRes.json().catch(() => ({}));

  return Response.json({ ticker_count: tickers.length, ...result });
}

export async function GET(request) {
  return handler(request);
}

export async function POST(request) {
  return handler(request);
}
