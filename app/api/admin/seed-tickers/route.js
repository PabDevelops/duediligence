import { checkIsAdmin } from '../../../../lib/isAdmin';
import { isCronRequest } from '../../../../lib/verifyCronAuth';
import { THEMES } from '../../explore/route';
import { seedTickers } from '../../../../lib/seedTickers';

// Cap function time so a slow run cannot burn the 300s default (Vercel usage limits).
export const maxDuration = 60;

// Populates stock_cache proactively, instead of relying on a real user searching each ticker
// first. Reuses /api/stock's existing fetch/upsert logic via an internal HTTP call rather than
// duplicating the SEC EDGAR/Finnhub/Yahoo fetching.
//
// Kept cheap on purpose (see lib/seedTickers.js): it only fetches tickers that are missing from
// stock_cache or stale (>7 days), stops after a ~40s time budget and resumes on the next call.
// Pass ?force=1 to re-fetch every ticker regardless of cache state (slow; may need several calls).

async function handler(request) {
  const isCron = isCronRequest(request);

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
  const force = new URL(request.url).searchParams.get('force') === '1';

  return Response.json(await seedTickers({ tickers, baseUrl, force }));
}

export async function GET(request) {
  return handler(request);
}

export async function POST(request) {
  return handler(request);
}
