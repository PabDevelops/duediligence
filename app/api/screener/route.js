import { getUserId } from '../../../lib/auth';
import { supabase } from '../../../lib/supabase';

export async function GET() {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  try {
    const { data, error } = await supabase
      .from('stock_cache')
      .select('ticker, data, updated_at')
      .order('updated_at', { ascending: false });

    if (error) throw error;

    const stocks = (data || []).map(row => ({
      ticker: row.ticker,
      name: row.data.name,
      sector: row.data.sector,
      exchange: row.data.exchange,
      currentPrice: row.data.currentPrice,
      priceChangePct: row.data.priceChangePct,
      marketCap: row.data.marketCap,
      pe: row.data.pe,
      beta: row.data.beta,
      revGrowth: row.data.revGrowth,
      opMargin: row.data.opMargin,
      fcfYield: row.data.fcfYield,
      roe: row.data.roe,
      netDebt: row.data.netDebt,
      grossMargin: row.data.grossMargin,
      fcfVal: row.data.fcfVal,
      revVal: row.data.revVal,
      eps: row.data.eps,
      updatedAt: row.updated_at,
    }));

    return Response.json({ stocks });
  } catch (e) {
    console.error(e);
    return Response.json({ stocks: [] });
  }
}
