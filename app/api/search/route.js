import { supabase } from '../../../lib/supabase';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();

  if (!q || q.length < 1) return Response.json({ results: [] });

  try {
    // First try to search by ticker (exact or prefix match)
    const tickerQuery = supabase
      .from('stock_cache')
      .select('ticker, data')
      .ilike('ticker', `${q}%`)
      .limit(8);

    // Then search by company name
    const nameQuery = supabase
      .from('stock_cache')
      .select('ticker, data')
      .ilike('data->>name', `%${q}%`)
      .limit(8);

    const [tickerResult, nameResult] = await Promise.all([
      tickerQuery,
      nameQuery
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
          name: r.data?.name || 'N/A',
          sector: r.data?.sector,
          exchange: r.data?.exchange || 'US',
        });
      }
      if (results.length >= 8) break;
    }

    return Response.json({ results });
  } catch (e) {
    console.error('Search error:', e);
    return Response.json({ results: [] });
  }
}