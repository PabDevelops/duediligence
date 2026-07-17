import { supabase } from '../../../lib/supabase';
import { rateLimit, getClientIp } from '../../../lib/rateLimit';
import { getSecTickerDirectory } from '../../../lib/secTickers';

export async function GET(request) {
  const ip = getClientIp(request);
  const { ok } = rateLimit(`search:${ip}`, { limit: 60, windowMs: 60_000 });
  if (!ok) return Response.json({ results: [] }, { status: 429 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();

  if (!q || q.length < 1) return Response.json({ results: [] });

  const limit = Math.min(Number(searchParams.get('limit')) || 8, 24);

  try {
    // Only the fields the search dropdown actually renders — selecting individual jsonb
    // paths instead of the whole `data` blob (which also carries multi-year history
    // arrays) avoids pulling that weight over the wire on every keystroke.
    const SEARCH_FIELDS = 'ticker, name:data->name, sector:data->sector, exchange:data->exchange, currentPrice:data->currentPrice, priceChangePct:data->priceChangePct';

    // First try to search by ticker (exact or prefix match)
    const tickerQuery = supabase
      .from('stock_cache')
      .select(SEARCH_FIELDS)
      .ilike('ticker', `${q}%`)
      .limit(limit);

    // Then search by company name
    const nameQuery = supabase
      .from('stock_cache')
      .select(SEARCH_FIELDS)
      .ilike('data->>name', `%${q}%`)
      .limit(limit);

    const [tickerResult, nameResult, secDirectory] = await Promise.all([
      tickerQuery,
      nameQuery,
      getSecTickerDirectory().catch(() => []),
    ]);

    // Combine results, avoid duplicates
    const allResults = [...(tickerResult.data || []), ...(nameResult.data || [])];
    const uniqueTickers = new Set();
    const results = [];

    for (const r of allResults) {
      if (!uniqueTickers.has(r.ticker)) {
        uniqueTickers.add(r.ticker);
        results.push({
          ticker: r.ticker,
          name: r.name || 'N/A',
          sector: r.sector,
          exchange: r.exchange || 'US',
          currentPrice: r.currentPrice ?? null,
          priceChangePct: r.priceChangePct ?? null,
        });
      }
      if (results.length >= limit) break;
    }

    // Fill remaining slots from the full SEC universe so search isn't limited to
    // tickers someone has already looked up before. These have no live price yet —
    // /api/stock fetches it the first time the result is opened.
    if (results.length < limit) {
      const qUpper = q.toUpperCase();
      const qLower = q.toLowerCase();

      const addMatches = (matchFn) => {
        for (const c of secDirectory) {
          if (results.length >= limit) return;
          if (uniqueTickers.has(c.ticker) || !matchFn(c)) continue;
          uniqueTickers.add(c.ticker);
          results.push({
            ticker: c.ticker,
            name: c.name,
            sector: null,
            exchange: 'US',
            currentPrice: null,
            priceChangePct: null,
          });
        }
      };

      addMatches((c) => c.ticker.startsWith(qUpper));
      addMatches((c) => c.name.toLowerCase().includes(qLower));
    }

    return Response.json({ results });
  } catch (e) {
    console.error('Search error:', e);
    return Response.json({ results: [] });
  }
}