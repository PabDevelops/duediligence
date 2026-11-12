import { checkIsAdmin } from '../../../../lib/isAdmin';
import { isCronRequest } from '../../../../lib/verifyCronAuth';
import { THEMES } from '../../explore/route';
import { seedTickers } from '../../../../lib/seedTickers';

// Cap function time so a slow run cannot burn the 300s default (Vercel usage limits).
export const maxDuration = 60;

// The Calendar page's earnings list is deliberately decoupled from stock_cache (see the
// comment in app/api/earnings/route.js) so it can show every upcoming earnings date, not
// just ones someone already viewed. That means most of those tickers stay uncached until a
// user clicks in — with low traffic, most never get clicked. This pre-warms stock_cache for
// every ticker with an earnings date in the next DAYS_AHEAD days (plus the Explore themes) using
// lib/seedTickers.js, which skips already-cached tickers and stops on a time budget.
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

  let earningsTickers = [];
  try {
    const earningsRes = await fetch(`${baseUrl}/api/earnings?from=${from}&to=${to}`);
    const { earnings } = await earningsRes.json().catch(() => ({ earnings: [] }));
    earningsTickers = [...new Set((earnings || []).map((e) => e.ticker).filter(Boolean))];
  } catch (e) {
    return Response.json({ error: 'Failed to fetch earnings calendar' }, { status: 502 });
  }

  // Earnings tickers first, then the Explore themes: this is the single daily pre-warm cron.
  const themeTickers = Object.values(THEMES).flatMap((t) => t.tickers);
  const tickers = [...new Set([...earningsTickers, ...themeTickers])];

  // Called directly (no second HTTP hop to seed-tickers) so only one function is billed.
  const result = await seedTickers({ tickers, baseUrl });

  return Response.json({ earnings_ticker_count: earningsTickers.length, ...result });
}

export async function GET(request) {
  return handler(request);
}

export async function POST(request) {
  return handler(request);
}
