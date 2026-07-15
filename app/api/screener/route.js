import { getVisitor } from '../../../lib/auth';
import { supabase } from '../../../lib/supabase';
import { rateLimit, getClientIp } from '../../../lib/rateLimit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Guests get a curated, capped slice of the dataset rather than the full
// screener — enough to see real value, not enough to replace registering.
const ANON_RESULT_LIMIT = 40;

export async function GET(request) {
  const visitor = await getVisitor();

  if (visitor.type === 'anonymous') {
    const key = `screener:${visitor.id || getClientIp(request)}`;
    const { ok, retryAfterMs } = rateLimit(key, { limit: 20, windowMs: 60 * 60 * 1000 });
    if (!ok) return Response.json({ error: 'Rate limit exceeded', retryAfterMs }, { status: 429 });
  }

  try {
    const { data, error } = await supabase
      .from('stock_cache')
      .select('ticker, data, updated_at')
      .neq('ticker', 'INHD')
      .order('updated_at', { ascending: false });

    if (error) throw error;

    let stocks = (data || []).map(row => ({
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

    if (visitor.type === 'anonymous') {
      // Slice by market cap, not recency, so guests see recognizable names.
      stocks = stocks
        .slice()
        .sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0))
        .slice(0, ANON_RESULT_LIMIT);
    }

    return Response.json({ stocks, limited: visitor.type === 'anonymous' });
  } catch (e) {
    console.error(e);
    return Response.json({ stocks: [] });
  }
}
