import { supabase } from '../../../lib/supabase';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.toUpperCase().trim();

  if (!q || q.length < 1) return Response.json({ results: [] });

  try {
    const { data } = await supabase
      .from('stock_cache')
      .select('ticker, data->name, data->sector, data->exchange')
      .or(`ticker.ilike.${q}%,data->name.ilike.%${q}%`)
      .limit(8);

    const results = (data || []).map(r => ({
      ticker: r.ticker,
      name: r.name,
      sector: r.sector,
      exchange: r.exchange,
    }));

    return Response.json({ results });
  } catch (e) {
    return Response.json({ results: [] });
  }
}