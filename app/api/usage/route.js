import { getVisitor } from '../../../lib/auth';
import { supabase } from '../../../lib/supabase';

const FREE_LIMIT = 5;

export async function GET() {
  const { id: visitorId } = await getVisitor();
  // No visitor id at all is an infra hiccup (missing tq_gid cookie), not a
  // reason to block someone — fail open rather than punish a real visitor.
  if (!visitorId) return Response.json({ allowed: true, count: 0, limit: FREE_LIMIT });

  const today = new Date().toISOString().slice(0, 10);

  const { data } = await supabase
    .from('usage_tracking')
    .select('count')
    .eq('user_id', visitorId)
    .eq('date', today)
    .single();

  const count = data?.count || 0;
  return Response.json({ allowed: count < FREE_LIMIT, count, limit: FREE_LIMIT });
}

export async function POST() {
  const { id: visitorId } = await getVisitor();
  if (!visitorId) return Response.json({ count: 0, limit: FREE_LIMIT, limited: false });

  const today = new Date().toISOString().slice(0, 10);

  // Atomic upsert: insert with count=1 or increment if exists
  const { data, error } = await supabase.rpc('increment_usage', {
    p_user_id: visitorId,
    p_date: today,
    p_limit: FREE_LIMIT,
  });

  if (error) {
    // Fallback to read-modify-write if rpc not available
    const { data: existing } = await supabase
      .from('usage_tracking')
      .select('count')
      .eq('user_id', visitorId)
      .eq('date', today)
      .single();

    const currentCount = existing?.count || 0;

    if (currentCount >= FREE_LIMIT) {
      return Response.json({ count: currentCount, limit: FREE_LIMIT, limited: true });
    }

    if (existing) {
      await supabase
        .from('usage_tracking')
        .update({ count: currentCount + 1 })
        .eq('user_id', visitorId)
        .eq('date', today);
      return Response.json({ count: currentCount + 1, limit: FREE_LIMIT, limited: currentCount + 1 >= FREE_LIMIT });
    } else {
      await supabase
        .from('usage_tracking')
        .insert({ user_id: visitorId, date: today, count: 1 });
      return Response.json({ count: 1, limit: FREE_LIMIT, limited: false });
    }
  }

  return Response.json({
    count: data.count,
    limit: FREE_LIMIT,
    limited: data.limited,
  });
}
