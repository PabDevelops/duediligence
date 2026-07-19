import { getUserId } from '../../../../lib/auth';
import { supabase } from '../../../../lib/supabase';

export async function GET(request) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const portfolioId = searchParams.get('portfolioId');

  let query = supabase
    .from('portfolio_cash_ledger')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });

  if (portfolioId && portfolioId !== 'all') {
    query = query.eq('portfolio_id', portfolioId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('cash GET error:', error);
    // If the table doesn't exist yet, we just return empty so the UI doesn't crash before migration
    if (error.code === '42P01') {
       return Response.json({ transactions: [] });
    }
    return Response.json({ transactions: [], error: error.message }, { status: 500 });
  }

  return Response.json({ transactions: data || [] });
}

export async function POST(request) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const { portfolio_id, amount, currency, notes } = await request.json();

  if (!portfolio_id || !amount || !currency) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Ensure portfolio exists and belongs to user
  const { data: pfCheck, error: pfErr } = await supabase
    .from('portfolios')
    .select('id')
    .eq('id', portfolio_id)
    .eq('user_id', userId)
    .single();

  if (pfErr || !pfCheck) {
    return Response.json({ error: 'Invalid portfolio' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('portfolio_cash_ledger')
    .insert({
      user_id: userId,
      portfolio_id,
      amount: Number(amount),
      currency: currency.toUpperCase(),
      notes: notes || null
    })
    .select()
    .single();

  if (error) {
    console.error('cash POST error:', error);
    return Response.json({ error: error.message || 'Failed to record cash transaction' }, { status: 500 });
  }

  return Response.json({ success: true, transaction: data });
}
