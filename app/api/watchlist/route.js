import { getUserId } from '../../../lib/auth';
import { supabase } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request) {
  const userId = await getUserId();
  if (!userId) return Response.json({ tickers: [] });

  const { searchParams } = new URL(request.url);
  const full = searchParams.get('full') === 'true';

  const { data } = await supabase
    .from('watchlists')
    .select('ticker, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (!data || data.length === 0) {
    return Response.json({ tickers: [] });
  }

  if (full) {
    const tickers = data.map(d => d.ticker);
    const { data: cacheData } = await supabase
      .from('stock_cache')
      .select('ticker, data')
      .in('ticker', tickers);

    const byTicker = Object.fromEntries((cacheData || []).map(row => [row.ticker, row.data]));

    const fullTickers = data.map(d => {
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

  return Response.json({ tickers: data || [] });
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