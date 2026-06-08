import { supabase } from '../../../lib/supabase';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('stock_cache')
      .select('ticker')
      .limit(1000);

    if (error || !data?.length) return Response.json({ ticker: 'AAPL' });

    const random = data[Math.floor(Math.random() * data.length)];
    return Response.json({ ticker: random.ticker });
  } catch (e) {
    return Response.json({ ticker: 'AAPL' });
  }
}