import { getUserId } from '../../../../lib/auth';
import { supabase } from '../../../../lib/supabase';

// Reduces shares from a position, oldest lot first (FIFO). Does not track realized P&L —
// it just corrects how many shares of a ticker you still hold.
export async function POST(request) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const { ticker, shares, portfolio_id, addToCash, sellPrice, currency } = await request.json();
  const sellShares = Number(shares);
  if (!ticker || !(sellShares > 0) || !portfolio_id) {
    return Response.json({ error: 'Invalid input' }, { status: 400 });
  }

  const { data: lots, error: fetchError } = await supabase
    .from('portfolio_holdings')
    .select('id, shares')
    .eq('user_id', userId)
    .eq('portfolio_id', portfolio_id)
    .eq('ticker', ticker.toUpperCase())
    .order('purchase_date', { ascending: true })
    .order('created_at', { ascending: true });

  if (fetchError) return Response.json({ error: fetchError.message }, { status: 500 });

  const owned = (lots || []).reduce((a, l) => a + Number(l.shares), 0);
  if (sellShares > owned + 1e-9) {
    return Response.json({ error: `You only hold ${owned} shares of ${ticker}` }, { status: 400 });
  }

  let remaining = sellShares;
  for (const lot of lots) {
    if (remaining <= 0) break;
    const lotShares = Number(lot.shares);
    if (lotShares <= remaining + 1e-9) {
      await supabase.from('portfolio_holdings').delete().eq('id', lot.id).eq('user_id', userId);
      remaining -= lotShares;
    } else {
      await supabase.from('portfolio_holdings').update({ shares: lotShares - remaining }).eq('id', lot.id).eq('user_id', userId);
      remaining = 0;
    }
  }

  if (addToCash && sellPrice > 0) {
    const totalAmount = sellShares * Number(sellPrice);
    try {
      await supabase.from('portfolio_cash_ledger').insert({
        user_id: userId,
        portfolio_id: portfolio_id,
        amount: totalAmount,
        currency: ['USD', 'EUR', 'GBP'].includes(currency) ? currency : 'USD',
        type: 'DEPOSIT',
        notes: `Sold ${sellShares} shares of ${ticker.toUpperCase()}`
      });
    } catch (err) {
      console.error('Failed to add to cash ledger:', err);
    }
  }

  return Response.json({ success: true, sold: sellShares, remaining: owned - sellShares });
}
