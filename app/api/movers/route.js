import {loadMoversRows} from '../../../lib/moversData';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Tickers only get re-fetched when someone actually views them (no bulk daily cron), so
// stock_cache rows sit at wildly different ages. Without this filter, "today's movers"
// would mix a % change from 5 minutes ago with one from last week. 24h matches the same
// freshness window /api/stock already treats as "current" (see CACHE_HOURS there).
const MAX_CACHE_AGE_HOURS = 24;

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

    const withScore = stocks;
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
      coverage:{companies:withScore.length,limit:1000,source:'recent-cache'},
      leaders: isFull ? withScore : undefined,
    });
  } catch (e) {
    console.error(e);
    return Response.json({error:'No se pudieron cargar los movimientos del mercado.'},{status:503});
  }
}
