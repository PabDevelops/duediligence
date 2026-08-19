import { getUserId } from '../../../../../lib/auth';
import { supabase } from '../../../../../lib/supabase';

// One-time cleanup for a second occurrence of the same implausible-snapshot bug the write-time
// guard in route.js now catches more tightly (see MAX_DAILY_RETURN_SWING_PP_NO_CASH_FLOW there)
// — a stray bad price read inflated one day's value with cost unchanged, and that day's swing
// slipped under the old flat 40pp cutoff before the tighter guard was deployed. Scoped to the
// calling user only, same as every other handler here; deletes rows whose return-on-cost
// deviates from the account's own median return by more than 25pp.
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
