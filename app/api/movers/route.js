import { supabase } from '../../../lib/supabase';
import { computeEasyMode } from '../../../lib/stockScoring';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Tickers only get re-fetched when someone actually views them (no bulk daily cron), so
// stock_cache rows sit at wildly different ages. Without this filter, "today's movers"
// would mix a % change from 5 minutes ago with one from last week. 24h matches the same
// freshness window /api/stock already treats as "current" (see CACHE_HOURS there).
const MAX_CACHE_AGE_HOURS = 24;

// This endpoint is public and identical for every caller, but gets hit on every Home
// page load plus a client-side poll every few minutes — memoize the raw table scan
// in-process for a short window instead of re-pulling it from Supabase on every request.
const MOVERS_CACHE_TTL_MS = 60_000;
let moversRowsCache = null;
let moversRowsCachedAt = 0;

async function loadMoversRows() {
  if (moversRowsCache && Date.now() - moversRowsCachedAt < MOVERS_CACHE_TTL_MS) return moversRowsCache;

  // Only the fields actually used below — selecting individual jsonb paths instead of the
  // whole `data` blob (which also carries multi-year history arrays) cuts the egress for
  // what is otherwise a near-full-table scan.
  const { data: rows } = await supabase
    .from('stock_cache')
    .select('ticker, updated_at, name:data->name, sector:data->sector, industry:data->industry, exchange:data->exchange, currentPrice:data->currentPrice, priceChangePct:data->priceChangePct, roic:data->roic, fcfYield:data->fcfYield, revGrowth:data->revGrowth, grossMargin:data->grossMargin, opMargin:data->opMargin, debtToEquity:data->debtToEquity, pfcf:data->pfcf, marketCap:data->marketCap, debtVal:data->debtVal, equityVal:data->equityVal, cashVal:data->cashVal, ebtVal:data->ebtVal, taxVal:data->taxVal, oiVal:data->oiVal, currentAssetsVal:data->currentAssetsVal, currentLiabilitiesVal:data->currentLiabilitiesVal, fcfVal:data->fcfVal, rdVal:data->rdVal, revVal:data->revVal, sbcVal:data->sbcVal, fcfHistory:data->fcfHistory, marginHistory:data->marginHistory, revHistory:data->revHistory')
    .neq('ticker', 'INHD')
    .not('data->currentPrice', 'is', null)
    .not('data->priceChangePct', 'is', null);

  moversRowsCache = rows || [];
  moversRowsCachedAt = Date.now();
  return moversRowsCache;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const isFull = searchParams.get('full') === 'true';
    const limit = isFull ? 100 : 10;

    const rows = await loadMoversRows();

    if (!rows?.length) return Response.json({ gainers: [], losers: [], topRoic: [], topFcfYield: [], topRevGrowth: [], topScore: [], topQuality: [], topOppo: [], bigCapMovers: [] });

    const freshRows = rows.filter(r => {
      const hoursOld = (Date.now() - new Date(r.updated_at).getTime()) / (1000 * 60 * 60);
      return hoursOld < MAX_CACHE_AGE_HOURS;
    });

    const stocks = freshRows;

    const calcScore = (d) => {
      if (!d) return { score: null, cbs: null, oppo: null, gqs: null };
      const hasFundamentals = d.revVal != null || d.niVal != null || d.marketCap != null
        || d.roic != null || d.grossMargin != null || (d.revHistory?.length ?? 0) > 0;
      const easy = computeEasyMode(d, hasFundamentals);
      if (!easy) return { score: null, cbs: null, oppo: null, gqs: null };
      return {
        score: +(easy.finalNote).toFixed(1),
        cbs: +(easy.cbs).toFixed(1),
        oppo: +(easy.oppo).toFixed(1),
        gqs: +(easy.gqs).toFixed(1)
      };
    };

    const withScore = stocks.map(s => ({ ...s, ...calcScore(s) }));
    const sorted = (arr, key, dir = 'desc', max = null) => [...arr]
  .filter(s => s[key] != null)
  .filter(s => max === null || Math.abs(s[key]) <= max)
  .sort((a, b) => dir === 'desc' ? b[key] - a[key] : a[key] - b[key]);

    // Big caps (>$10B) ranked by size of today's move either direction — a 5% swing in a
    // mega-cap moves the market more than the same swing in an illiquid micro-cap.
    const BIG_CAP_THRESHOLD = 10e9;
    const bigCapMovers = withScore
      .filter(s => s.marketCap != null && s.marketCap >= BIG_CAP_THRESHOLD && s.priceChangePct != null)
      .sort((a, b) => Math.abs(b.priceChangePct) - Math.abs(a.priceChangePct))
      .slice(0, 40);

    return Response.json({
      gainers: sorted(withScore, 'priceChangePct').slice(0, 40),
      losers: sorted(withScore, 'priceChangePct', 'asc').slice(0, 40),
      topRoic: sorted(withScore, 'roic', 'desc', 200).slice(0, limit),
      topFcfYield: sorted(withScore, 'fcfYield', 'desc', 50).slice(0, limit),
      topRevGrowth: sorted(withScore, 'revGrowth', 'desc', 300).slice(0, limit),
      topScore: sorted(withScore, 'score').slice(0, limit),
      topQuality: sorted(withScore, 'cbs').slice(0, limit),
      topOppo: sorted(withScore, 'oppo').slice(0, limit),
      bigCapMovers,
      leaders: isFull ? withScore : undefined,
    });
  } catch (e) {
    console.error(e);
    return Response.json({ gainers: [], losers: [], topRoic: [], topFcfYield: [], topRevGrowth: [], topScore: [], topQuality: [], topOppo: [], bigCapMovers: [] });
  }
}