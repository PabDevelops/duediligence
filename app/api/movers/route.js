import { supabase } from '../../../lib/supabase';

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
    .select('ticker, updated_at, name:data->name, sector:data->sector, exchange:data->exchange, currentPrice:data->currentPrice, priceChangePct:data->priceChangePct, roic:data->roic, fcfYield:data->fcfYield, revGrowth:data->revGrowth, grossMargin:data->grossMargin, opMargin:data->opMargin, debtToEquity:data->debtToEquity, pfcf:data->pfcf, marketCap:data->marketCap')
    .neq('ticker', 'INHD')
    .not('data->currentPrice', 'is', null)
    .not('data->priceChangePct', 'is', null);

  moversRowsCache = rows || [];
  moversRowsCachedAt = Date.now();
  return moversRowsCache;
}

export async function GET() {
  try {
    const rows = await loadMoversRows();

    if (!rows?.length) return Response.json({ gainers: [], losers: [], topRoic: [], topFcfYield: [], topRevGrowth: [], topScore: [], topQuality: [], topOppo: [], bigCapMovers: [] });

    const freshRows = rows.filter(r => {
      const hoursOld = (Date.now() - new Date(r.updated_at).getTime()) / (1000 * 60 * 60);
      return hoursOld < MAX_CACHE_AGE_HOURS;
    });

    const stocks = freshRows;

    const calcScore = (d) => {
      if (!d) return null;
      const sec = (d.sector || '').toLowerCase();
      const isTech = sec.includes('tech') || sec.includes('software') || sec.includes('semi');
      const isPharma = sec.includes('pharma') || sec.includes('biotech') || sec.includes('health');
      const isFinancial = sec.includes('bank') || sec.includes('insurance') || sec.includes('financial');
      const roicT = isTech ? 0.25 : isPharma ? 0.20 : 0.15;
      const gmT = isTech ? 0.65 : isPharma ? 0.65 : isFinancial ? 0.30 : 0.35;
      const omT = isTech ? 0.20 : isPharma ? 0.20 : 0.15;
      const roicS = d.roic == null ? 2.5 : d.roic/100 >= roicT*2 ? 5 : d.roic/100 >= roicT*1.5 ? 4.5 : d.roic/100 >= roicT ? 4 : d.roic/100 >= roicT*0.7 ? 3 : 2;
      const gmS = d.grossMargin == null ? 2.5 : d.grossMargin/100 >= gmT*1.4 ? 5 : d.grossMargin/100 >= gmT*1.15 ? 4.5 : d.grossMargin/100 >= gmT ? 4 : d.grossMargin/100 >= gmT*0.75 ? 3 : 2;
      const omS = d.opMargin == null ? 2.5 : d.opMargin/100 >= omT*2 ? 5 : d.opMargin/100 >= omT*1.5 ? 4.5 : d.opMargin/100 >= omT ? 4 : d.opMargin/100 >= omT*0.65 ? 3 : 2;
      const deS = d.debtToEquity == null ? 2.5 : d.debtToEquity < 0.3 ? 5 : d.debtToEquity < 0.7 ? 4.5 : d.debtToEquity < 1.2 ? 4 : d.debtToEquity < 2 ? 3 : 2;
      const cbs = roicS*0.4 + gmS*0.25 + omS*0.25 + deS*0.1;
      const pfcfS = d.pfcf == null || d.pfcf <= 0 ? 1 : d.pfcf < 12 ? 5 : d.pfcf < 18 ? 4.5 : d.pfcf < 25 ? 4 : d.pfcf < 35 ? 3 : 2;
      const fcfYS = d.fcfYield == null ? 1 : d.fcfYield > 8 ? 5 : d.fcfYield > 5 ? 4.5 : d.fcfYield > 3 ? 4 : d.fcfYield > 1.5 ? 3 : 2;
      const oppo = pfcfS*0.55 + fcfYS*0.45;
      const revGS = d.revGrowth == null ? 2.5 : d.revGrowth > 25 ? 5 : d.revGrowth > 15 ? 4.5 : d.revGrowth > 8 ? 4 : d.revGrowth > 3 ? 3 : 2;
      const gqs = Math.min(5, revGS*0.6 + 3*0.4);
      const score = +((cbs*0.45 + oppo*0.30 + gqs*0.25)).toFixed(1);
      return { score, cbs: +cbs.toFixed(1), oppo: +oppo.toFixed(1) };
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
      topRoic: sorted(withScore, 'roic', 'desc', 200).slice(0, 10),
      topFcfYield: sorted(withScore, 'fcfYield', 'desc', 50).slice(0, 10),
      topRevGrowth: sorted(withScore, 'revGrowth', 'desc', 300).slice(0, 10),
      topScore: sorted(withScore, 'score').slice(0, 10),
      topQuality: sorted(withScore, 'cbs').slice(0, 10),
      topOppo: sorted(withScore, 'oppo').slice(0, 10),
      bigCapMovers,
    });
  } catch (e) {
    console.error(e);
    return Response.json({ gainers: [], losers: [], topRoic: [], topFcfYield: [], topRevGrowth: [], topScore: [], topQuality: [], topOppo: [], bigCapMovers: [] });
  }
}