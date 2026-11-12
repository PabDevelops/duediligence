import { supabase } from './supabase';

// Shared cache pre-warmer used by the seed-tickers and seed-earnings-calendar admin routes.
//
// Designed to cost as little Vercel function time as possible:
//  - only tickers with NO stock_cache row, or one older than STALE_DAYS, are fetched (a ticker
//    that is already cached gets refreshed by /api/stock itself the next time a user opens it);
//  - missing tickers go first, then the stalest ones;
//  - the run stops on a time budget so it always finishes inside the route's maxDuration and
//    picks up the remaining tickers on the next call instead of timing out;
//  - no extra HTTP hop between the two seed routes.
export const DEFAULT_STALE_DAYS = 7;
export const DEFAULT_BUDGET_MS = 40000;
const CONCURRENCY = 2;
// Finnhub's free tier is 60 req/min and /api/stock can fire up to 3 per ticker, so keep pacing.
const BATCH_DELAY_MS = 8000;
const FETCH_TIMEOUT_MS = 15000;

// Pure: decides which tickers still need seeding and in what order.
// `cachedRows` is [{ ticker, updated_at }]. Missing rows first (input order), then stalest first.
export function planSeed(tickers, cachedRows, { staleDays = DEFAULT_STALE_DAYS, now = Date.now() } = {}) {
  const unique = [...new Set((tickers || []).filter(Boolean))];
  const updatedAt = new Map((cachedRows || []).map((r) => [r.ticker, new Date(r.updated_at).getTime()]));
  const cutoff = now - staleDays * 24 * 60 * 60 * 1000;

  const missing = [];
  const stale = [];
  let fresh = 0;
  for (const ticker of unique) {
    const ts = updatedAt.get(ticker);
    if (ts === undefined || Number.isNaN(ts)) missing.push(ticker);
    else if (ts < cutoff) stale.push({ ticker, ts });
    else fresh += 1;
  }
  stale.sort((a, b) => a.ts - b.ts);
  return { pending: [...missing, ...stale.map((s) => s.ticker)], fresh, total: unique.length };
}

export async function seedTickers({
  tickers,
  baseUrl,
  force = false,
  staleDays = DEFAULT_STALE_DAYS,
  budgetMs = DEFAULT_BUDGET_MS,
}) {
  const startedAt = Date.now();
  const unique = [...new Set((tickers || []).filter(Boolean))];

  let cachedRows = [];
  if (!force && unique.length > 0) {
    const { data } = await supabase.from('stock_cache').select('ticker, updated_at').in('ticker', unique);
    cachedRows = data || [];
  }

  const plan = force
    ? { pending: unique, fresh: 0, total: unique.length }
    : planSeed(unique, cachedRows, { staleDays });

  const seeded = [];
  const failed = [];
  let index = 0;

  while (index < plan.pending.length) {
    // Do not start another batch if it could overrun the budget.
    if (Date.now() - startedAt >= budgetMs) break;

    const batch = plan.pending.slice(index, index + CONCURRENCY);
    index += batch.length;
    await Promise.all(batch.map(async (ticker) => {
      try {
        const res = await fetch(`${baseUrl}/api/stock?ticker=${encodeURIComponent(ticker)}`, {
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        if (res.ok) seeded.push(ticker); else failed.push(ticker);
      } catch (e) {
        failed.push(ticker);
      }
    }));

    if (index < plan.pending.length && Date.now() - startedAt + BATCH_DELAY_MS < budgetMs) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
    } else if (index < plan.pending.length) {
      break;
    }
  }

  return {
    total: plan.total,
    skipped_fresh: plan.fresh,
    seeded,
    failed,
    remaining: plan.pending.length - index,
    elapsed_ms: Date.now() - startedAt,
  };
}
