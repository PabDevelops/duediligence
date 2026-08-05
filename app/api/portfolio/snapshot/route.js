import { getUserId } from '../../../../lib/auth';
import { supabase } from '../../../../lib/supabase';

export async function GET() {
  const userId = await getUserId();
  if (!userId) return Response.json({ snapshots: [] });

  const { data, error } = await supabase
    .from('portfolio_snapshots')
    .select('date, value, cost')
    .eq('user_id', userId)
    .order('date', { ascending: true });

  if (error) return Response.json({ snapshots: [], error: error.message }, { status: 500 });
  return Response.json({ snapshots: data || [] });
}

export async function POST(request) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const { value, cost } = await request.json();
  if (value == null || cost == null) return Response.json({ error: 'value and cost required' }, { status: 400 });
  const numValue = Number(value), numCost = Number(cost);
  if (!Number.isFinite(numValue) || !Number.isFinite(numCost) || numValue < 0 || numCost < 0) {
    return Response.json({ error: 'value and cost must be non-negative numbers' }, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);

  // First snapshot ever for this user — anchor the growth chart at zero the day before,
  // since the portfolio genuinely was worth $0 before it existed (so charts read from day 1,
  // same as Trading 212, instead of only starting once enough daily snapshots pile up).
  const { count } = await supabase
    .from('portfolio_snapshots')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (!count) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    await supabase
      .from('portfolio_snapshots')
      .upsert({ user_id: userId, date: yesterday.toISOString().slice(0, 10), value: 0, cost: 0 }, { onConflict: 'user_id,date' });
  }

  // Guard against writing a snapshot wildly inconsistent with the last recorded one. The
  // dashboard posts a fresh snapshot every few minutes and this upserts (overwrites) today's
  // row each time, so a single transient bad computation (prices/FX not fully loaded yet,
  // a stale render) could otherwise get locked into a whole day's data point — showing up as
  // a spike-then-revert in the Performance chart that never self-corrects, since past days
  // aren't touched again. Compares return-on-cost-basis (not raw value/cost) against the
  // most recent prior day so a legitimate capital injection — cost and value moving together
  // — doesn't trip it; only an implausible single-day swing in actual return does.
  const MAX_DAILY_RETURN_SWING_PP = 40;
  const { data: lastSnap } = await supabase
    .from('portfolio_snapshots')
    .select('date, value, cost')
    .eq('user_id', userId)
    .neq('date', today)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastSnap && lastSnap.cost > 0 && numCost > 0) {
    const oldReturnPct = ((lastSnap.value - lastSnap.cost) / lastSnap.cost) * 100;
    const newReturnPct = ((numValue - numCost) / numCost) * 100;
    if (Math.abs(newReturnPct - oldReturnPct) > MAX_DAILY_RETURN_SWING_PP) {
      console.warn(`[snapshot] Rejected implausible snapshot for user ${userId}: return moved from ${oldReturnPct.toFixed(1)}% to ${newReturnPct.toFixed(1)}% since ${lastSnap.date}`);
      return Response.json({ error: 'Snapshot rejected: implausible day-over-day change' }, { status: 422 });
    }
  }

  const { error } = await supabase
    .from('portfolio_snapshots')
    .upsert({ user_id: userId, date: today, value: numValue, cost: numCost }, { onConflict: 'user_id,date' });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}
