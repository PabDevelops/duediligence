import { getUserId } from '../../../lib/auth';
import { supabase } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Guests have no persisted watchlist row, but the client keeps a session-only
// list in sessionStorage (see lib/guestWatchlist.js) and passes it here to
// enrich with live data. Read-only — nothing is written for anonymous callers.
const GUEST_LOOKUP_LIMIT = 25;

async function lookupGuestTickers(tickersParam) {
  if (!tickersParam) return Response.json({ tickers: [] });
  const tickers = [...new Set(tickersParam.split(',').map(t => t.trim().toUpperCase()).filter(Boolean))].slice(0, GUEST_LOOKUP_LIMIT);
  if (tickers.length === 0) return Response.json({ tickers: [] });

  const { data: cacheData } = await supabase.from('stock_cache').select('ticker, data').in('ticker', tickers);
  const byTicker = Object.fromEntries((cacheData || []).map(row => [row.ticker, row.data]));

  const fullTickers = tickers.filter(t => byTicker[t]).map(t => {
    const stock = byTicker[t];
    return {
      ticker: t,
      created_at: null,
      pie: null,
      name: stock.name,
      currentPrice: stock.currentPrice,
      priceChangePct: stock.priceChangePct,
      exchange: stock.exchange,
      currency: stock.currency,
      pe: stock.pe,
      dividendYield: stock.dividendYield,
      sector: stock.sector,
    };
  });

  return Response.json({ tickers: fullTickers });
}

export async function GET(request) {
  const userId = await getUserId();
  const { searchParams } = new URL(request.url);
  const full = searchParams.get('full') === 'true';

  if (!userId) {
    return full ? lookupGuestTickers(searchParams.get('tickers')) : Response.json({ tickers: [] });
  }

  // 1. Fetch current watchlist
  let { data: watchlistData, error: watchlistError } = await supabase
    .from('watchlists')
    .select('ticker, created_at, pie')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (watchlistError) console.error('GET /api/watchlist:', watchlistError);
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
        .select('ticker, created_at, pie')
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
        pie: d.pie || null,
        name: stock.name,
        currentPrice: stock.currentPrice,
        priceChangePct: stock.priceChangePct,
        exchange: stock.exchange,
        currency: stock.currency,
        pe: stock.pe,
        dividendYield: stock.dividendYield,
        sector: stock.sector,
      };
    });

    return Response.json({ tickers: fullTickers });
  }

  return Response.json({ tickers: watchlistData });
}

export async function POST(request) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const { ticker, pie } = await request.json();
  if (!ticker) return Response.json({ error: 'Ticker required' }, { status: 400 });

  // Only set `pie` on the row when the caller actually passed one — omitting it lets an
  // upsert against an already-watched ticker leave its existing list assignment alone
  // instead of silently resetting it to General.
  const row = { user_id: userId, ticker: ticker.toUpperCase() };
  if (pie !== undefined) row.pie = pie ? pie.trim() || null : null;

  await supabase.from('watchlists').upsert(row);

  const { count } = await supabase
    .from('watchlists')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  return Response.json({ success: true, watchlistCount: count || 0 });
}

// Move a ticker to a different pie (or back to General with pie: null).
export async function PATCH(request) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const { ticker, pie } = await request.json();
  if (!ticker) return Response.json({ error: 'Ticker required' }, { status: 400 });

  await supabase.from('watchlists')
    .update({ pie: pie ? pie.trim() || null : null })
    .eq('user_id', userId)
    .eq('ticker', ticker.toUpperCase());

  return Response.json({ success: true });
}

export async function DELETE(request) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const { ticker } = await request.json();
  if (!ticker) return Response.json({ error: 'Ticker required' }, { status: 400 });
  await supabase.from('watchlists').delete().eq('user_id', userId).eq('ticker', ticker.toUpperCase());
  return Response.json({ success: true });
}