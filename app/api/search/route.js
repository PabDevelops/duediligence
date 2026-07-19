import { supabase } from '../../../lib/supabase';
import { rateLimit, getClientIp } from '../../../lib/rateLimit';
import { getSecTickerDirectory } from '../../../lib/secTickers';
import { fetchYahooSymbolSearch } from '../../../lib/yahooFinance';

export async function GET(request) {
  const ip = getClientIp(request);
  const { ok } = rateLimit(`search:${ip}`, { limit: 60, windowMs: 60_000 });
  if (!ok) return Response.json({ results: [] }, { status: 429 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();

  if (!q || q.length < 1) return Response.json({ results: [] });

  // `limit` is a combined cap, split evenly between stocks and ETFs (each gets its own
  // pool of candidates, so a query with hundreds of stock matches and one ETF match still
  // shows that ETF match instead of it being crowded out by stocks filling the shared cap).
  const limit = Math.min(Number(searchParams.get('limit')) || 8, 60);
  const perTypeCap = Math.ceil(limit / 2);

  try {
    // Only the fields the search dropdown actually renders — selecting individual jsonb
    // paths instead of the whole `data` blob (which also carries multi-year history
    // arrays) avoids pulling that weight over the wire on every keystroke.
    const SEARCH_FIELDS = 'ticker, name:data->name, sector:data->sector, exchange:data->exchange, currentPrice:data->currentPrice, priceChangePct:data->priceChangePct, isEtf:data->isEtf';

    const tickerQuery = supabase
      .from('stock_cache')
      .select(SEARCH_FIELDS)
      .ilike('ticker', `${q}%`)
      .limit(limit * 2);

    const nameQuery = supabase
      .from('stock_cache')
      .select(SEARCH_FIELDS)
      .ilike('data->>name', `%${q}%`)
      .limit(limit * 2);

    const [tickerResult, nameResult, secDirectory, yahooMatches] = await Promise.all([
      tickerQuery,
      nameQuery,
      getSecTickerDirectory().catch(() => []),
      fetchYahooSymbolSearch(q).catch(() => []),
    ]);

    // Combine cache hits, dedupe, and split into stock vs ETF buckets
    const cacheHits = [...(tickerResult.data || []), ...(nameResult.data || [])];
    const seenTickers = new Set();
    const stockCache = [];
    const etfCache = [];

    for (const r of cacheHits) {
      if (seenTickers.has(r.ticker)) continue;
      seenTickers.add(r.ticker);
      const item = {
        ticker: r.ticker,
        name: r.name || 'N/A',
        sector: r.sector,
        exchange: r.exchange || 'US',
        currentPrice: r.currentPrice ?? null,
        priceChangePct: r.priceChangePct ?? null,
        isEtf: r.isEtf === true,
      };
      (item.isEtf ? etfCache : stockCache).push(item);
    }

    const stocks = stockCache.slice(0, perTypeCap);
    const etfs = etfCache.slice(0, perTypeCap);

    // Fill remaining stock slots from the full SEC universe (company tickers/names) so
    // search isn't limited to tickers someone has already looked up before.
    if (stocks.length < perTypeCap) {
      const qUpper = q.toUpperCase();
      const qLower = q.toLowerCase();

      const addMatches = (matchFn) => {
        for (const c of secDirectory) {
          if (stocks.length >= perTypeCap) return;
          if (seenTickers.has(c.ticker) || !matchFn(c)) continue;
          seenTickers.add(c.ticker);
          stocks.push({
            ticker: c.ticker,
            name: c.name,
            sector: null,
            exchange: 'US',
            currentPrice: null,
            priceChangePct: null,
            isEtf: false,
          });
        }
      };

      addMatches((c) => c.ticker.startsWith(qUpper));
      addMatches((c) => c.name.toLowerCase().includes(qLower));
    }

    // Fill remaining ETF slots from Yahoo's live symbol search — there's no free SEC-style
    // directory of ETF tickers, so this is the only source for funds nobody's looked up yet.
    if (etfs.length < perTypeCap) {
      for (const y of yahooMatches) {
        if (etfs.length >= perTypeCap) break;
        if (y.quoteType !== 'ETF' || seenTickers.has(y.ticker)) continue;
        seenTickers.add(y.ticker);
        etfs.push({
          ticker: y.ticker,
          name: y.name,
          sector: null,
          exchange: y.exchange || 'US',
          currentPrice: null,
          priceChangePct: null,
          isEtf: true,
        });
      }
    }

    return Response.json({ results: [...stocks, ...etfs] });
  } catch (e) {
    console.error('Search error:', e);
    return Response.json({ results: [] });
  }
}
