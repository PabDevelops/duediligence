import { checkIsAdmin } from '../../../../lib/isAdmin';
import { isCronRequest } from '../../../../lib/verifyCronAuth';
import { supabase } from '../../../../lib/supabase';

// Bulk-hydrates stock_cache rows that only have the lightweight profile written by
// scripts/populateFullMarket.js (name/sector/marketCap, no financials) by calling this app's
// own /api/stock for a small batch of them -- the same full SEC EDGAR + Finnhub + Form4
// pipeline a user visiting that ticker's page would trigger on-demand, just automated for the
// tickers nobody's browsing yet. Same "small batch + spaced-out delay" shape as
// refresh-small-cap-radar's Form4 sweep, for the same reason: SEC's ~10 req/sec fair-access
// limit is shared across ALL of Traqcker's traffic, not just this job.
//
// Unlike that route's day-of-year rotation (built for exactly one run/day), this reads
// "whichever rows still have no revVal, in ticker order" on every call -- each hydrated ticker
// naturally drops out of the next call's batch, so calling this endpoint many times back-to-
// back (not just once a day) makes real forward progress instead of repeating the same slice.
export const maxDuration = 60;

const BATCH_SIZE = 10;
const DELAY_MS = 1500;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Same reasoning as lib/screenerData.js's loadScreenerStocks: PostgREST caps a plain select at
// 1000 rows, so page through with .range() rather than risk silently missing tickers past the
// first page as the table grows.
async function loadUnhydratedTickers(limit) {
  const PAGE_SIZE = 1000;
  const out = [];
  for (let offset = 0; out.length < limit; offset += PAGE_SIZE) {
    const { data: page, error } = await supabase
      .from('stock_cache')
      .select('ticker, revVal:data->revVal')
      .neq('ticker', 'INHD')
      .order('ticker', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    if (!page || page.length === 0) break;
    page.forEach(r => { if (r.revVal == null && out.length < limit) out.push(r.ticker); });
    if (page.length < PAGE_SIZE) break;
  }
  return out;
}

async function handler(request) {
  const isCron = isCronRequest(request);
  if (!isCron) {
    const isAdmin = await checkIsAdmin();
    if (!isAdmin) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const tickers = await loadUnhydratedTickers(BATCH_SIZE);
    if (tickers.length === 0) return Response.json({ ok: true, done: true, hydrated: 0, failed: 0 });

    // Same origin as this request (production, a preview deployment, or localhost during
    // testing) — never a hardcoded domain, so this works unmodified wherever it's deployed.
    const origin = new URL(request.url).origin;

    let hydrated = 0;
    const failedTickers = [];
    for (const ticker of tickers) {
      try {
        const res = await fetch(`${origin}/api/stock?ticker=${encodeURIComponent(ticker)}`);
        const body = await res.json().catch(() => null);
        if (res.ok && !body?.error) hydrated++;
        else failedTickers.push(ticker);
      } catch (err) {
        failedTickers.push(ticker);
        console.error(`hydrate-financials: failed for ${ticker}:`, err);
      }
      await sleep(DELAY_MS);
    }

    return Response.json({ ok: true, batchSize: tickers.length, hydrated, failed: failedTickers.length, failedTickers });
  } catch (e) {
    console.error('hydrate-financials failed:', e);
    return Response.json({ error: 'Hydration failed' }, { status: 500 });
  }
}

export async function GET(request) { return handler(request); }
export async function POST(request) { return handler(request); }
