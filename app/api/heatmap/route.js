import { supabase } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Same freshness window as /api/movers (see the comment there) — without it "today's map"
// would mix a % change from 5 minutes ago with one from last week, since tickers only
// refresh when someone views them (no bulk daily cron).
const MAX_CACHE_AGE_HOURS = 24;

// Below this, a stock's box would be sub-pixel on the map anyway (linear market-cap sizing,
// same convention as Finviz's map) and the cache has a long tail of thinly-traded micro/nano
// caps (~$1-5M) that would just add clutter and slow layout without being visible.
const MIN_MARKET_CAP = 100e6;

export async function GET() {
  try {
    const { data: rows } = await supabase
      .from('stock_cache')
      .select('ticker, data, updated_at')
      .neq('ticker', 'INHD')
      .not('data->currentPrice', 'is', null)
      .not('data->priceChangePct', 'is', null)
      .not('data->marketCap', 'is', null)
      .not('data->sector', 'is', null);

    if (!rows?.length) return Response.json({ stocks: [] });

    const stocks = rows
      .filter(r => {
        const hoursOld = (Date.now() - new Date(r.updated_at).getTime()) / (1000 * 60 * 60);
        return hoursOld < MAX_CACHE_AGE_HOURS && r.data.marketCap >= MIN_MARKET_CAP;
      })
      .map(r => ({
        ticker: r.ticker,
        name: r.data.name,
        sector: r.data.sector,
        industry: r.data.industry || r.data.sector,
        marketCap: r.data.marketCap,
        priceChangePct: r.data.priceChangePct,
      }));

    return Response.json({ stocks });
  } catch (e) {
    console.error(e);
    return Response.json({ stocks: [] });
  }
}
