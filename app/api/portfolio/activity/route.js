import { getUserId } from '../../../../lib/auth';
import { supabase } from '../../../../lib/supabase';

const FEED_LIMIT = 30;

// Read-only feed of recent Trading 212 buys/sells/dividends — only ever
// populated by the sync in lib/trading212Sync.js, never written to here.
export async function GET(request) {
  const userId = await getUserId();
  if (!userId) return Response.json({ activity: [] });

  const { searchParams } = new URL(request.url);
  const portfolioId = searchParams.get('portfolioId');

  let query = supabase
    .from('portfolio_activity')
    .select('id, portfolio_id, type, ticker, action, quantity, price, amount, currency, realized_pl, realized_pl_currency, occurred_at')
    .eq('user_id', userId)
    .order('occurred_at', { ascending: false })
    .limit(FEED_LIMIT);

  if (portfolioId && portfolioId !== 'all') {
    query = query.eq('portfolio_id', portfolioId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('portfolio/activity GET error:', error);
    if (error.code === '42P01') return Response.json({ activity: [] });
    return Response.json({ activity: [], error: error.message }, { status: 500 });
  }

  return Response.json({ activity: data || [] });
}
