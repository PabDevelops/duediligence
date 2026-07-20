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

const LEADERBOARD_SIZE = 10;
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

    if (flags.filter(f => f.type !== 'unknown_insider_ownership').length > 0) {
      riskFlags.push({
        ticker: s.ticker, name: s.name, marketCap: s.marketCap, capTier: getCapTier(s.marketCap)?.id ?? null,
        flags, flagCount: flags.length,
      });
    }

    if (s.shareDilution != null) dilutionRows.push({ ticker: s.ticker, name: s.name, marketCap: s.marketCap, shareDilution: s.shareDilution });
    if (runway != null) runwayRows.push({ ticker: s.ticker, name: s.name, marketCap: s.marketCap, cashRunwayYears: runway });
    if (s.insiderOwnershipPct != null) ownershipRows.push({ ticker: s.ticker, name: s.name, marketCap: s.marketCap, insiderOwnershipPct: s.insiderOwnershipPct });
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
    leaderboards: {
      leastDiluted: dilutionRows.sort((a, b) => a.shareDilution - b.shareDilution).slice(0, LEADERBOARD_SIZE),
      longestRunway: runwayRows.sort((a, b) => b.cashRunwayYears - a.cashRunwayYears).slice(0, LEADERBOARD_SIZE),
      highestInsiderOwnership: ownershipRows.sort((a, b) => b.insiderOwnershipPct - a.insiderOwnershipPct).slice(0, LEADERBOARD_SIZE),
    },
  };
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
  const { riskFlags, leaderboards } = buildRiskTriageAndLeaderboards(stocks);
  const [{ events, clusters }, { migrations, trackingSince }] = await Promise.all([
    loadInsiderFeed(),
    loadTierMigrations(),
  ]);
  return { riskFlags, leaderboards, feed: { events, clusters }, migrations, trackingSince };
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
