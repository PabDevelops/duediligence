import { getUserId } from '../../../lib/auth';
import { supabase } from '../../../lib/supabase';
import { checkIsPro } from '../../../lib/isPro';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Free signed-in tier: unlimited single-ticker analysis, but a capped watchlist — "track as
// many as you want, forever" is the one thing reserved for Pro now that nearly everything
// else (verdicts, ETFs, Radar, news, insiders...) is free even for guests.
const FREE_WATCHLIST_LIMIT = 20;

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

  const fullTickers = tickers.filter(t => byTicker[t]).map(t => ({
    ...byTicker[t],
    ticker: t,
    created_at: null,
    pie: null,
  }));

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

  // Portfolio holdings are synced into the watchlist once, at the moment a holding is actually
  // added (app/api/portfolio/route.js POST, app/api/portfolio/import/route.js) — NOT here. This
  // used to re-upsert every portfolio ticker on every single read of the watchlist, which meant
  // removing ("dejar de seguir") a ticker that was also held in Portfolio got silently undone on
  // the very next page load, since the DELETE just ran moments before this same resync fired
  // again and re-inserted it.

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

    const fullTickers = watchlistData.map(d => ({
      ...(byTicker[d.ticker] || {}),
      ticker: d.ticker,
      created_at: d.created_at,
      pie: d.pie || null,
    }));

    return Response.json({ tickers: fullTickers });
  }

  return Response.json({ tickers: watchlistData });
}

export async function POST(request) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const { ticker, pie } = await request.json();
  if (!ticker) return Response.json({ error: 'Ticker required' }, { status: 400 });

  const upperTicker = ticker.toUpperCase();

  // The limit only applies to genuinely new tickers — re-saving (e.g. moving pie) an already-
  // followed one must never get blocked by a cap the user is already at or past.
  const { data: existing } = await supabase
    .from('watchlists')
    .select('id')
    .eq('user_id', userId)
    .eq('ticker', upperTicker)
    .maybeSingle();

  if (!existing) {
    const isPro = await checkIsPro();
    if (!isPro) {
      const { count } = await supabase
        .from('watchlists')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
      if ((count || 0) >= FREE_WATCHLIST_LIMIT) {
        return Response.json({
          error: `El plan gratuito sigue hasta ${FREE_WATCHLIST_LIMIT} acciones a la vez — hazte Pro para seguir sin límite.`,
          limitReached: true,
        }, { status: 403 });
      }
    }
  }

  // Only set `pie` on the row when the caller actually passed one — omitting it lets an
  // upsert against an already-watched ticker leave its existing list assignment alone
  // instead of silently resetting it to General.
  const row = { user_id: userId, ticker: upperTicker };
  if (pie !== undefined) row.pie = pie ? pie.trim() || null : null;

  // watchlists' primary key is the surrogate `id` column, not (user_id, ticker) — without
  // onConflict naming the real unique constraint (watchlists_user_id_ticker_key), upsert()
  // targets `id` by default, which a row with no `id` in its payload can never actually
  // conflict on. Re-following a ticker that already has a row (e.g. one added via Portfolio)
  // used to hit that unique constraint as a plain INSERT and fail outright — silently, since
  // the error was never checked — instead of updating the existing row like an upsert should.
  const { error: upsertError } = await supabase.from('watchlists').upsert(row, { onConflict: 'user_id,ticker' });
  if (upsertError) {
    console.error('POST /api/watchlist upsert error:', upsertError);
    return Response.json({ error: 'No se pudo guardar' }, { status: 500 });
  }

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

// Rename an entire pie category in the watchlist across all tickers
export async function PUT(request) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const { oldPie, newPie } = await request.json();
  if (!oldPie || !newPie || !newPie.trim()) {
    return Response.json({ error: 'Old and new pie names required' }, { status: 400 });
  }

  const trimmedNewPie = newPie.trim();

  let query = supabase
    .from('watchlists')
    .update({ pie: trimmedNewPie })
    .eq('user_id', userId);

  if (oldPie === 'General') {
    query = query.is('pie', null);
  } else {
    query = query.eq('pie', oldPie);
  }

  const { error } = await query;

  if (error) {
    console.error('watchlist PUT rename pie error:', error);
    return Response.json({ error: error.message || 'Failed to rename watchlist category' }, { status: 500 });
  }

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