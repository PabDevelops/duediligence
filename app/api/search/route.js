import { supabase } from '../../../lib/supabase';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();

  if (!q || q.length < 1) return Response.json({ results: [] });

  try {
    // Search in stock_cache by ticker or name
    const { data } = await supabase
      .from('stock_cache')
      .select('ticker, data')
      .or(`ticker.ilike.${q}%,data->name.ilike.%${q}%`)
      .limit(8);

    const results = (data || []).map(r => ({
      ticker: r.ticker,
      name: r.data?.name || 'N/A',
      sector: r.data?.sector,
      exchange: r.data?.exchange || 'US',
    }));

    return Response.json({ results });
  } catch (e) {
    console.error('Search error:', e);
    return Response.json({ results: [] });
  }
}