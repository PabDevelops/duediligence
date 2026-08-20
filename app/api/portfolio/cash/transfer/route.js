import { getUserId } from '../../../../../lib/auth';
import { supabase } from '../../../../../lib/supabase';

export async function POST(request) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const { portfolio_id, amount, currency, direction } = await request.json();

  if (!portfolio_id || !amount || Number(amount) <= 0 || !currency) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }
  if (!['to_isa', 'to_main'].includes(direction)) {
    return Response.json({ error: 'Invalid direction' }, { status: 400 });
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

  const fromBucket = direction === 'to_isa' ? 'main' : 'isa';
  const toBucket = direction === 'to_isa' ? 'isa' : 'main';
  const amt = Number(amount);
  const ccy = currency.toUpperCase();

  // A transfer between buckets is just a withdrawal from one and a deposit into the
  // other, dated today — the ISA side starts compounding from the moment it lands there.
  const { data, error } = await supabase
    .from('portfolio_cash_ledger')
    .insert([
      { user_id: userId, portfolio_id, amount: -amt, currency: ccy, type: 'TRANSFER', bucket: fromBucket, notes: `Moved to ${toBucket === 'isa' ? 'ISA' : 'Cash'}` },
      { user_id: userId, portfolio_id, amount: amt, currency: ccy, type: 'TRANSFER', bucket: toBucket, notes: `Moved from ${fromBucket === 'isa' ? 'ISA' : 'Cash'}` },
    ])
    .select();

  if (error) {
    console.error('cash transfer error:', error);
    return Response.json({ error: error.message || 'Failed to transfer' }, { status: 500 });
  }

  return Response.json({ success: true, transactions: data });
}
