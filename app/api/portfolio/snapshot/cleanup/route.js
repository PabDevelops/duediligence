import { getUserId } from '../../../../../lib/auth';
import { supabase } from '../../../../../lib/supabase';

// Permanent (not one-off) cleanup for historical snapshot rows that slipped past the write-
// time guard in ../route.js — a transient bad price read or FX misvaluation can still land a
// single implausible day, and past days are never touched again once written, so nothing
// self-corrects. Triggered on demand from the "Fix anomalies" control on the Performance vs
// Benchmarks card. Scoped to getUserId() like every other handler in this file — only ever
// touches the calling user's own rows. Deletes rows whose return-on-cost deviates from the
// account's own median return by more than 25pp, which comfortably separates real day-to-day
// movement from the kind of spike this guards against (seen in practice landing at 30-65%
// against an otherwise-flat baseline).
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
