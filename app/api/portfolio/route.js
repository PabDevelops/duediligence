import { getUserId } from '../../../lib/auth';
import { supabase } from '../../../lib/supabase';

export async function GET() {
  const userId = await getUserId();
  if (!userId) return Response.json({ holdings: [] });

  const { data, error } = await supabase
    .from('portfolio_holdings')
    .select('id, ticker, shares, cost_basis, cost_basis_currency, purchase_date, pie, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('portfolio GET error:', error);
    return Response.json({ holdings: [], error: error.message }, { status: 500 });
  }
  return Response.json({ holdings: data || [] });
}

export async function POST(request) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const { ticker, shares, costBasis, purchaseDate, pie, costBasisCurrency } = await request.json();
  if (!ticker || !shares || costBasis == null || Number(shares) <= 0 || Number(costBasis) < 0) {
    return Response.json({ error: 'Invalid input' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('portfolio_holdings')
    .insert({
      user_id: userId,
      ticker: ticker.toUpperCase(),
      shares: Number(shares),
      cost_basis: Number(costBasis),
      cost_basis_currency: ['USD', 'EUR', 'GBP'].includes(costBasisCurrency) ? costBasisCurrency : 'USD',
      purchase_date: purchaseDate || new Date().toISOString().slice(0, 10),
      pie: pie?.trim() || null,
    })
    .select()
    .single();

  if (error) {
    console.error('portfolio POST error:', error);
    return Response.json({ error: error.message || 'Failed to add holding' }, { status: 500 });
  }

  // Auto-add to watchlist when added to portfolio
  try {
    await supabase.from('watchlists').upsert({
      user_id: userId,
      ticker: ticker.toUpperCase(),
    });
  } catch (err) {
    console.error('Failed to auto-add to watchlist:', err);
  }

  return Response.json({ success: true, holding: data });
}

export async function PATCH(request) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const { id, shares, costBasis, purchaseDate, pie, costBasisCurrency } = await request.json();
  if (!id || !shares || costBasis == null || Number(shares) <= 0 || Number(costBasis) < 0) {
    return Response.json({ error: 'Invalid input' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('portfolio_holdings')
    .update({
      shares: Number(shares),
      cost_basis: Number(costBasis),
      cost_basis_currency: ['USD', 'EUR', 'GBP'].includes(costBasisCurrency) ? costBasisCurrency : 'USD',
      purchase_date: purchaseDate || new Date().toISOString().slice(0, 10),
      pie: pie?.trim() || null,
    })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    console.error('portfolio PATCH error:', error);
    return Response.json({ error: error.message || 'Failed to update holding' }, { status: 500 });
  }
  return Response.json({ success: true, holding: data });
}

export async function DELETE(request) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const { id, ticker } = await request.json();
  if (!id && !ticker) return Response.json({ error: 'id or ticker required' }, { status: 400 });

  if (id) {
    await supabase.from('portfolio_holdings').delete().eq('id', id).eq('user_id', userId);
  } else if (ticker) {
    await supabase.from('portfolio_holdings').delete().eq('ticker', ticker.toUpperCase()).eq('user_id', userId);
  }
  return Response.json({ success: true });
}
