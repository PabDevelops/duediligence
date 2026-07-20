import { supabase } from '../../../../lib/supabase';
import { loadScreenerStocks } from '../../../../lib/screenerData';
import { getCapTier, isSmallOrMicro } from '../../../../lib/marketCap';

// Aggregate feed for the Small & Micro Cap Radar (app/(workspace)/small-caps/page.js). Pro-
// gating happens at the layout level (app/(workspace)/layout.js's PUBLIC_ROUTES) — this route
// itself has no auth check, same as any other authenticated-only page's data endpoint.
export const dynamic = 'force-dynamic';

// Heavier than the plain screener scan (adds two extra table reads), so a slightly longer TTL
// than lib/screenerData.js's own 60s — same in-process memo pattern, just for the derived
// modules built on top rather than the raw scan itself (which has its own, shorter-lived cache).
const RADAR_CACHE_TTL_MS = 120_000;
let radarCache = null;
let radarCachedAt = 0;

// Anchored to the exact same anchor points lib/stockScoring.js's dilutionScore/runwayScore/
// ownershipScore curves use for computeEasyMode — a flag here means "this is already scoring
// in the bottom rung of the curve," not an arbitrary new bar invented for this page.
const DILUTION_FLAG_PCT = 30;       // dilutionScore's [30, 2] anchor
const RUNWAY_FLAG_YEARS = 1;        // runwayScore's [1, 2.5] anchor
const OWNERSHIP_FLAG_PCT = 2;       // ownershipScore's [2, 2.5] anchor
const HEALTHY_GROSS_MARGIN_PCT = 40; // matches the dashboard's own "Gross Margin > 40%" label

const LEADERBOARD_SIZE = 10;
const SECTOR_TOP_N = 6;
const COUNTRY_TOP_N = 5;
const FCF_HISTORY_YEARS = 8; // however many of the last N fiscal years a stock actually reports
const CLUSTER_WINDOW_DAYS = 14; // ~10 trading days
const CLUSTER_MIN_INSIDERS = 3;
const FEED_LOOKBACK_DAYS = 30;
const FEED_LIMIT = 200;
const MIGRATION_MIN_DAYS = 25;
const MIGRATION_MAX_DAYS = 35;

function cashRunwayYears(cashVal, fcfVal) {
  if (fcfVal == null || fcfVal >= 0 || cashVal == null) return null;
  return cashVal / Math.abs(fcfVal);
}

function buildRiskTriageAndLeaderboards(stocks) {
  const universe = stocks.filter(s => isSmallOrMicro(s.marketCap));

  const riskFlags = [];
  const dilutionRows = [];
  const runwayRows = [];
  const ownershipRows = [];
  // Every small/micro/nano ticker in stock_cache, not just the ones with a risk flag or a
  // leaderboard placement — those two are deliberately narrow (only stocks with computed
  // dilution/runway/ownership data qualify), which is fine for Risk Triage and the
  // leaderboards but left the Explore tab with only the dozen-ish tickers that happened to
  // clear one of those bars, while its header badge showed the full universe count. Explore
  // browses this instead so a freshly-populated ticker (marketCap/name/sector only, financials
  // still pending their first /api/stock view) still shows up, just with '—' for the columns
  // it doesn't have data for yet.
  const universeRows = [];

  universe.forEach(s => {
    const runway = cashRunwayYears(s.cashVal, s.fcfVal);
    const flags = [];

    if (runway != null && runway < RUNWAY_FLAG_YEARS) {
      flags.push({ type: 'cash_runway', severity: 'high', value: runway, label: `${runway.toFixed(1)}y of runway left` });
    }
    if (s.shareDilution != null && s.shareDilution > DILUTION_FLAG_PCT) {
      flags.push({ type: 'dilution', severity: 'high', value: s.shareDilution, label: `${s.shareDilution.toFixed(0)}% historical dilution` });
    }
    if (s.insiderOwnershipPct != null && s.insiderOwnershipPct < OWNERSHIP_FLAG_PCT) {
      flags.push({ type: 'low_insider_ownership', severity: 'medium', value: s.insiderOwnershipPct, label: `${s.insiderOwnershipPct.toFixed(1)}% insider owned` });
    } else if (s.insiderOwnershipPct == null) {
      flags.push({ type: 'unknown_insider_ownership', severity: 'low', value: null, label: 'No insider ownership data yet' });
    }

    const realFlagCount = flags.filter(f => f.type !== 'unknown_insider_ownership').length;
    if (realFlagCount > 0) {
      riskFlags.push({
        ticker: s.ticker, name: s.name, marketCap: s.marketCap, capTier: getCapTier(s.marketCap)?.id ?? null,
        flags, flagCount: flags.length,
      });
    }

    if (s.shareDilution != null) dilutionRows.push({ ticker: s.ticker, name: s.name, marketCap: s.marketCap, shareDilution: s.shareDilution });
    if (runway != null) runwayRows.push({ ticker: s.ticker, name: s.name, marketCap: s.marketCap, cashRunwayYears: runway });
    if (s.insiderOwnershipPct != null) ownershipRows.push({ ticker: s.ticker, name: s.name, marketCap: s.marketCap, insiderOwnershipPct: s.insiderOwnershipPct });

    universeRows.push({
      ticker: s.ticker, name: s.name, marketCap: s.marketCap, sector: s.sector, exchange: s.exchange,
      country: s.country, grossMargin: s.grossMargin, fcfVal: s.fcfVal, netDebt: s.netDebt,
      insiderOwnershipPct: s.insiderOwnershipPct, cashRunwayYears: runway, fcfHistory: s.fcfHistory,
      flagCount: realFlagCount, flags,
    });
  });

  const severityWeight = { high: 2, medium: 1, low: 0 };
  riskFlags.sort((a, b) => {
    if (b.flagCount !== a.flagCount) return b.flagCount - a.flagCount;
    const aw = a.flags.reduce((sum, f) => sum + (severityWeight[f.severity] ?? 0), 0);
    const bw = b.flags.reduce((sum, f) => sum + (severityWeight[f.severity] ?? 0), 0);
    return bw - aw;
  });

  return {
    riskFlags,
    universe: universeRows,
    leaderboards: {
      leastDiluted: dilutionRows.sort((a, b) => a.shareDilution - b.shareDilution).slice(0, LEADERBOARD_SIZE),
      longestRunway: runwayRows.sort((a, b) => b.cashRunwayYears - a.cashRunwayYears).slice(0, LEADERBOARD_SIZE),
      highestInsiderOwnership: ownershipRows.sort((a, b) => b.insiderOwnershipPct - a.insiderOwnershipPct).slice(0, LEADERBOARD_SIZE),
    },
  };
}

// --- Sector / country distribution (Dashboard's TOP SECTOR DISTRIBUTION card) -------------
// Grouped by whatever's actually in stock_cache (sector from either fetch pipeline, country
// from the Finnhub-profile populate script) rather than a fixed hardcoded list, so the mix
// reflects the real tracked universe. Top N + an "Other" bucket for the long tail, ranked by
// count. `sampleSize` is how many universe rows actually have this field set (denominator for
// the percentages) — distinct from `total`, since not every ticker has a sector/country yet.
function buildDistribution(universeRows, field, topN) {
  const counts = new Map();
  let sampleSize = 0;
  universeRows.forEach(s => {
    const key = s[field];
    // Finnhub's profile2 returns the literal string "N/A" for an unclassified industry
    // instead of leaving the field null — treat it the same as missing rather than let it
    // win the #1 sector slot on count alone (it did, at 1,368 stocks, before this check).
    if (!key || key === 'N/A') return;
    sampleSize++;
    const entry = counts.get(key) || { count: 0, marketCap: 0 };
    entry.count++;
    entry.marketCap += s.marketCap || 0;
    counts.set(key, entry);
  });

  const sorted = [...counts.entries()].sort((a, b) => b[1].count - a[1].count);
  const top = sorted.slice(0, topN);
  const rest = sorted.slice(topN);
  const restCount = rest.reduce((sum, [, v]) => sum + v.count, 0);
  const restCap = rest.reduce((sum, [, v]) => sum + v.marketCap, 0);

  const pct = (n) => (sampleSize > 0 ? +((n / sampleSize) * 100).toFixed(1) : 0);
  const rows = top.map(([name, v]) => ({ name, count: v.count, marketCap: v.marketCap, pct: pct(v.count) }));
  if (restCount > 0) rows.push({ name: 'Other', count: restCount, marketCap: restCap, pct: pct(restCount) });

  return { rows, sampleSize, total: universeRows.length };
}

// --- Segment health ratios (Dashboard's SEGMENT HEALTH RATIOS gauge) -----------------------
// Each ratio's denominator is only the stocks that actually report that field, not the whole
// universe — the vast majority of freshly-populated tickers don't have financials yet (they
// hydrate on first /api/stock view), so a ratio "of 6,845" would badly overstate coverage.
// `n` (sample size) travels with every ratio so the UI can show it rather than imply
// full-universe coverage.
function buildHealthMetrics(universeRows) {
  const pct = (n, d) => (d > 0 ? +((n / d) * 100).toFixed(1) : null);

  const withFcf = universeRows.filter(s => s.fcfVal != null);
  const withGm = universeRows.filter(s => s.grossMargin != null);
  const withDebt = universeRows.filter(s => s.netDebt != null);

  const fcfPositive = withFcf.filter(s => s.fcfVal >= 0).length;
  const healthyGm = withGm.filter(s => s.grossMargin > HEALTHY_GROSS_MARGIN_PCT).length;
  const lowDebt = withDebt.filter(s => s.netDebt <= 0).length;

  return {
    fcfPositive: { pct: pct(fcfPositive, withFcf.length), n: withFcf.length, count: fcfPositive },
    healthyGrossMargin: { pct: pct(healthyGm, withGm.length), n: withGm.length, count: healthyGm },
    lowDebt: { pct: pct(lowDebt, withDebt.length), n: withDebt.length, count: lowDebt },
  };
}

// --- Universe risk distribution (Dashboard's UNIVERSE RISK DISTRIBUTION bar) ---------------
// flagCount already excludes the "no data yet" pseudo-flag (see realFlagCount above), so a
// stock with zero flags here means either "genuinely clean" or "not enough data to flag" --
// both fall in `optimal` since neither is a detected problem. That's a real trade-off given
// today's data coverage (most of the universe hasn't been individually hydrated yet): it
// means `optimal` isn't "verified healthy," just "nothing flagged." flaggedPct/watchlistPct
// are unaffected by that and stay meaningful either way.
function buildRiskDistribution(universeRows) {
  const total = universeRows.length;
  const pct = (n) => (total > 0 ? +((n / total) * 100).toFixed(1) : 0);
  const flagged = universeRows.filter(s => s.flagCount >= 2).length;
  const watchlist = universeRows.filter(s => s.flagCount === 1).length;
  const optimal = total - flagged - watchlist;
  return {
    flaggedPct: pct(flagged), flaggedCount: flagged,
    watchlistPct: pct(watchlist), watchlistCount: watchlist,
    optimalPct: pct(optimal), optimalCount: optimal,
    total,
  };
}

// --- FCF consistency (Dashboard's FCF-consistency widget) -----------------------------------
// stock_cache only stores annual fcfHistory (fiscal-year keyed, e.g. "2022".."2025") -- there
// is no quarterly figure anywhere in the schema, so this is a per-fiscal-year series over
// however many years each stock actually reports, not a fabricated "8 quarters." Coverage is
// thin today (fcfHistory only exists for tickers that have gone through the full /api/stock
// fetch at least once), so `sampleSize` matters here more than anywhere else on this page.
function buildFcfConsistency(universeRows) {
  const withHistory = universeRows.filter(s => Array.isArray(s.fcfHistory) && s.fcfHistory.length > 0);
  const byYear = new Map();
  withHistory.forEach(s => {
    s.fcfHistory.forEach(h => {
      if (h?.year == null || h?.val == null) return;
      const entry = byYear.get(h.year) || { positive: 0, total: 0 };
      entry.total++;
      if (h.val >= 0) entry.positive++;
      byYear.set(h.year, entry);
    });
  });

  const years = [...byYear.keys()].sort().slice(-FCF_HISTORY_YEARS);
  const series = years.map(year => {
    const { positive, total } = byYear.get(year);
    return { year, positive, total, pct: total > 0 ? Math.round((positive / total) * 100) : 0 };
  });

  const consistentCount = withHistory.filter(s => s.fcfHistory.every(h => h.val == null || h.val >= 0)).length;

  return { series, sampleSize: withHistory.length, consistentCount };
}

async function loadInsiderFeed() {
  const since = new Date(Date.now() - FEED_LOOKBACK_DAYS * 86_400_000).toISOString().slice(0, 10);
  const { data: events, error } = await supabase
    .from('insider_feed_events')
    .select('ticker, insider, type, shares, price, value, date, cap_tier, is_officer, is_director, is_ten_percent_owner')
    .gte('date', since)
    .order('date', { ascending: false })
    .limit(FEED_LIMIT);
  if (error) throw error;

  // Cluster-buy detection: 3+ distinct insiders buying the same ticker within a rolling
  // window — computed here in JS (aggregation lives in the route layer throughout this
  // codebase, e.g. the screener's own filters, rather than as a DB view).
  const buysByTicker = new Map();
  (events || []).forEach(e => {
    if (e.type !== 'BUY') return;
    if (!buysByTicker.has(e.ticker)) buysByTicker.set(e.ticker, []);
    buysByTicker.get(e.ticker).push(e);
  });

  const clusters = [];
  buysByTicker.forEach((buys, ticker) => {
    const sorted = [...buys].sort((a, b) => a.date.localeCompare(b.date));
    for (let i = 0; i < sorted.length; i++) {
      const windowStart = sorted[i].date;
      const windowEndMs = new Date(windowStart).getTime() + CLUSTER_WINDOW_DAYS * 86_400_000;
      const inWindow = sorted.filter(b => {
        const t = new Date(b.date).getTime();
        return t >= new Date(windowStart).getTime() && t <= windowEndMs;
      });
      const distinctInsiders = new Set(inWindow.map(b => b.insider));
      if (distinctInsiders.size >= CLUSTER_MIN_INSIDERS) {
        clusters.push({
          ticker,
          windowStart,
          windowEnd: inWindow[inWindow.length - 1].date,
          insiderCount: distinctInsiders.size,
          insiders: [...distinctInsiders],
          totalValue: inWindow.reduce((sum, b) => sum + (b.value || 0), 0),
        });
        break; // one cluster call-out per ticker is enough signal, avoid overlapping duplicates
      }
    }
  });

  return { events: events || [], clusters };
}

async function loadTierMigrations() {
  const { data: latestRows, error: latestErr } = await supabase
    .from('market_cap_snapshots')
    .select('ticker, date, market_cap, cap_tier')
    .order('date', { ascending: false })
    .limit(5000);
  if (latestErr) throw latestErr;
  if (!latestRows || latestRows.length === 0) return { migrations: [], trackingSince: null };

  const latestByTicker = new Map();
  latestRows.forEach(r => { if (!latestByTicker.has(r.ticker)) latestByTicker.set(r.ticker, r); });

  const now = Date.now();
  const minDate = new Date(now - MIGRATION_MAX_DAYS * 86_400_000).toISOString().slice(0, 10);
  const maxDate = new Date(now - MIGRATION_MIN_DAYS * 86_400_000).toISOString().slice(0, 10);
  const { data: priorRows, error: priorErr } = await supabase
    .from('market_cap_snapshots')
    .select('ticker, date, market_cap, cap_tier')
    .gte('date', minDate)
    .lte('date', maxDate)
    .order('date', { ascending: false });
  if (priorErr) throw priorErr;

  const priorByTicker = new Map();
  (priorRows || []).forEach(r => { if (!priorByTicker.has(r.ticker)) priorByTicker.set(r.ticker, r); });

  const migrations = [];
  latestByTicker.forEach((latest, ticker) => {
    const prior = priorByTicker.get(ticker);
    if (!prior || !latest.cap_tier || !prior.cap_tier || prior.cap_tier === latest.cap_tier) return;
    migrations.push({
      ticker, from: prior.cap_tier, to: latest.cap_tier,
      marketCapThen: prior.market_cap, marketCapNow: latest.market_cap, date: latest.date,
    });
  });

  const trackingSince = latestRows.reduce((min, r) => (r.date < min ? r.date : min), latestRows[0].date);
  return { migrations, trackingSince };
}

async function buildRadar() {
  const stocks = await loadScreenerStocks();
  const { riskFlags, universe, leaderboards } = buildRiskTriageAndLeaderboards(stocks);
  const [{ events, clusters }, { migrations, trackingSince }] = await Promise.all([
    loadInsiderFeed(),
    loadTierMigrations(),
  ]);

  const healthMetrics = buildHealthMetrics(universe);
  const insiderBuys = events.filter(e => e.type === 'BUY').length;
  healthMetrics.insiderBuying = {
    pct: events.length > 0 ? +((insiderBuys / events.length) * 100).toFixed(1) : null,
    n: events.length, count: insiderBuys,
  };

  return {
    riskFlags, universe, leaderboards, feed: { events, clusters }, migrations, trackingSince,
    sectorDistribution: buildDistribution(universe, 'sector', SECTOR_TOP_N),
    countryDistribution: buildDistribution(universe, 'country', COUNTRY_TOP_N),
    healthMetrics,
    riskDistribution: buildRiskDistribution(universe),
    fcfConsistency: buildFcfConsistency(universe),
  };
}

export async function GET() {
  try {
    if (radarCache && Date.now() - radarCachedAt < RADAR_CACHE_TTL_MS) {
      return Response.json(radarCache);
    }
    const payload = await buildRadar();
    radarCache = payload;
    radarCachedAt = Date.now();
    return Response.json(payload);
  } catch (e) {
    console.error('small-caps/radar failed:', e);
    return Response.json({ error: 'Failed to build radar' }, { status: 500 });
  }
}
