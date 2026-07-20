import { checkIsAdmin } from '../../../../lib/isAdmin';
import { isCronRequest } from '../../../../lib/verifyCronAuth';
import { supabase } from '../../../../lib/supabase';
import { getCapTier, isSmallOrMicro } from '../../../../lib/marketCap';
import { fetchForm4Transactions } from '../../../../lib/secInsiders';

// Daily maintenance for the Small & Micro Cap Radar (app/(workspace)/small-caps/page.js).
// Two passes:
//   1. Snapshot every ticker's current market-cap tier into market_cap_snapshots — cheap,
//      no external API calls, powers the "Tier Migration" module (comparing today's tier
//      against the one from ~30 days ago).
//   2. Sweep a small rotating batch of already-known small/micro tickers through SEC Form 4,
//      writing into insider_feed_events — the same fetch app/api/stock/route.js already does
//      on-demand for whichever ticker a user happens to view, but that alone leaves untouched
//      any small/micro name nobody's browsing. This cron is what keeps the feed alive for the
//      rest of the universe.
const SWEEP_BATCH_SIZE = 15;
const FORM4_LIMIT_PER_TICKER = 15;
// Space out each ticker's Form 4 burst (up to 1 + FORM4_LIMIT_PER_TICKER requests, all fired
// concurrently inside fetchForm4Transactions) — SEC's fair-access guidance is ~10 req/sec
// shared across ALL of Traqcker's traffic, not just this cron, so a burst-then-cooldown
// cadence here is deliberately conservative rather than raced as fast as possible.
const SWEEP_DELAY_MS = 2000;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function dayOfYear(d = new Date()) {
  const start = Date.UTC(d.getUTCFullYear(), 0, 1);
  const diff = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - start;
  return Math.floor(diff / 86_400_000);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Lightweight paginated scan — only the 3 columns this job needs (ticker, marketCap, cik),
// not the fuller field set lib/screenerData.js's loadScreenerStocks selects for the screener/
// radar UI, and not gated behind that module's 60s cache (this runs once a day, cache would
// never hit anyway).
async function loadTickersForRadar() {
  const PAGE_SIZE = 1000;
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data: page, error } = await supabase
      .from('stock_cache')
      .select('ticker, marketCap:data->marketCap, cik:data->cik')
      .neq('ticker', 'INHD')
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(page || []));
    if (!page || page.length < PAGE_SIZE) break;
  }
  return rows;
}

async function snapshotTiers(tickers) {
  const date = todayIso();
  const rows = tickers
    .filter(t => t.marketCap != null)
    .map(t => ({ ticker: t.ticker, date, market_cap: t.marketCap, cap_tier: getCapTier(t.marketCap)?.id ?? null }));

  // Supabase upsert also caps at ~1000 rows per call in practice — batch defensively.
  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await supabase
      .from('market_cap_snapshots')
      .upsert(rows.slice(i, i + BATCH), { onConflict: 'ticker,date' });
    if (error) throw error;
  }
  return rows.length;
}

async function sweepInsiderFeed(tickers) {
  const universe = tickers
    .filter(t => isSmallOrMicro(t.marketCap) && t.cik)
    .sort((a, b) => a.ticker.localeCompare(b.ticker));
  if (universe.length === 0) return { swept: 0, written: 0 };

  const start = (dayOfYear() * SWEEP_BATCH_SIZE) % universe.length;
  const batch = [];
  for (let i = 0; i < Math.min(SWEEP_BATCH_SIZE, universe.length); i++) {
    batch.push(universe[(start + i) % universe.length]);
  }

  let written = 0;
  for (const t of batch) {
    try {
      const txns = await fetchForm4Transactions(t.cik, t.ticker, FORM4_LIMIT_PER_TICKER);
      if (txns.length > 0) {
        const capTier = getCapTier(t.marketCap);
        const rows = txns.map(tx => ({
          ticker: t.ticker, insider: tx.insider, type: tx.type, shares: tx.shares, price: tx.price, value: tx.value,
          date: tx.date, cap_tier: capTier?.id ?? null,
          is_officer: tx.isOfficer, is_director: tx.isDirector, is_ten_percent_owner: tx.isTenPercentOwner,
        }));
        const { error } = await supabase
          .from('insider_feed_events')
          .upsert(rows, { onConflict: 'ticker,insider,date,type,shares', ignoreDuplicates: true });
        if (error) throw error;
        written += rows.length;
      }
    } catch (err) {
      console.error(`refresh-small-cap-radar: Form 4 sweep failed for ${t.ticker}:`, err);
    }
    await sleep(SWEEP_DELAY_MS);
  }

  return { swept: batch.length, written };
}

async function handler(request) {
  const isCron = isCronRequest(request);
  if (!isCron) {
    const isAdmin = await checkIsAdmin();
    if (!isAdmin) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const tickers = await loadTickersForRadar();
    const snapshotted = await snapshotTiers(tickers);
    const sweep = await sweepInsiderFeed(tickers);
    return Response.json({ ok: true, snapshotted, ...sweep });
  } catch (e) {
    console.error('refresh-small-cap-radar failed:', e);
    return Response.json({ error: 'Refresh failed' }, { status: 500 });
  }
}

export async function GET(request) { return handler(request); }
export async function POST(request) { return handler(request); }
