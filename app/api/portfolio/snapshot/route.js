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

  const today = new Date().toISOString().slice(0, 10);
  const { error } = await supabase
    .from('portfolio_snapshots')
    .upsert({ user_id: userId, date: today, value: Number(value), cost: Number(cost) }, { onConflict: 'user_id,date' });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}
