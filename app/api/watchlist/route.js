import { getUserId } from '../../../lib/auth';
import { supabase } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request) {
  const userId = await getUserId();
  if (!userId) return Response.json({ tickers: [] });

  const { searchParams } = new URL(request.url);
  const full = searchParams.get('full') === 'true';

  // 1. Fetch current watchlist
  let { data: watchlistData } = await supabase
    .from('watchlists')
    .select('ticker, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  watchlistData = watchlistData || [];

  // 2. Fetch portfolio holdings to auto-sync pre-existing assets
  const { data: portfolioData } = await supabase
    .from('portfolio_holdings')
    .select('ticker')
    .eq('user_id', userId);

  if (portfolioData && portfolioData.length > 0) {
    const portfolioTickers = [...new Set(portfolioData.map(p => p.ticker))];
    const watchlistTickersSet = new Set(watchlistData.map(w => w.ticker));

    const missingTickers = portfolioTickers.filter(t => !watchlistTickersSet.has(t));
    if (missingTickers.length > 0) {
      // Upsert all missing tickers into watchlist
      const upsertRows = missingTickers.map(t => ({
        user_id: userId,
        ticker: t,
      }));
      await supabase.from('watchlists').upsert(upsertRows);

      // Re-fetch updated watchlist
      const { data: updatedWatchlistData } = await supabase
        .from('watchlists')
        .select('ticker, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      watchlistData = updatedWatchlistData || [];
    }
  }

  if (watchlistData.length === 0) {
    return Response.json({ tickers: [] });
  }

  if (full) {
    const tickers = watchlistData.map(d => d.ticker);
    const { data: cacheData } = await supabase
      .from('stock_cache')
      .select('ticker, data')
      .in('ticker', tickers);

    const byTicker = Object.fromEntries((cacheData || []).map(row => [row.ticker, row.data]));

    const fullTickers = watchlistData.map(d => {
      const stock = byTicker[d.ticker] || {};
      return {
        ticker: d.ticker,
        created_at: d.created_at,
        name: stock.name,
        currentPrice: stock.currentPrice,
        priceChangePct: stock.priceChangePct,
        exchange: stock.exchange,
        currency: stock.currency
      };
    });

    return Response.json({ tickers: fullTickers });
  }

  return Response.json({ tickers: watchlistData });
}

export async function POST(request) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const { ticker } = await request.json();
  if (!ticker) return Response.json({ error: 'Ticker required' }, { status: 400 });

  await supabase.from('watchlists').upsert({ user_id: userId, ticker: ticker.toUpperCase() });

  const { count } = await supabase
    .from('watchlists')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  return Response.json({ success: true, watchlistCount: count || 0 });
}

export async function DELETE(request) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const { ticker } = await request.json();
  if (!ticker) return Response.json({ error: 'Ticker required' }, { status: 400 });
  await supabase.from('watchlists').delete().eq('user_id', userId).eq('ticker', ticker.toUpperCase());
  return Response.json({ success: true });
}