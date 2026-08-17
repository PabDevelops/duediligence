import { getUserId } from '../../../../../lib/auth';
import { supabase } from '../../../../../lib/supabase';

// One-time cleanup for historical snapshot rows corrupted by the cost-basis/FX-drift bug
// that route.js's POST handler now guards against (rejects any >40pp day-over-day return
// swing before it's written) — that guard only protects data going forward, so rows written
// before it existed can still carry an implausible one-off return. Scoped to the calling
// user only, same as every other handler in this file; deletes rows whose return-on-cost
// deviates from the account's own median return by more than 25pp, which comfortably
// separates real day-to-day movement from the FX-drift spikes (seen in practice landing at
// 30-65% against an otherwise flat -6% to +5% baseline) without needing to know in advance
// which exact dates are bad.
export async function POST() {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const { data: snapshots, error } = await supabase
    .from('portfolio_snapshots')
    .select('date, value, cost')
    .eq('user_id', userId)
    .order('date', { ascending: true });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const real = (snapshots || []).filter(s => s.value > 0 && s.cost > 0);
  if (real.length < 3) return Response.json({ deleted: [] });

  const returns = real.map(s => ((s.value - s.cost) / s.cost) * 100).sort((a, b) => a - b);
  const mid = Math.floor(returns.length / 2);
  const median = returns.length % 2 ? returns[mid] : (returns[mid - 1] + returns[mid]) / 2;

  const THRESHOLD_PP = 25;
  const badDates = real
    .filter(s => Math.abs((((s.value - s.cost) / s.cost) * 100) - median) > THRESHOLD_PP)
    .map(s => s.date);

  if (badDates.length === 0) return Response.json({ deleted: [], median });

  const { error: delError } = await supabase
    .from('portfolio_snapshots')
    .delete()
    .eq('user_id', userId)
    .in('date', badDates);
  if (delError) return Response.json({ error: delError.message }, { status: 500 });

  return Response.json({ deleted: badDates, median });
}
