import { getUserId } from '../../../../../lib/auth';
import { supabase } from '../../../../../lib/supabase';

// Disconnecting never deletes synced holdings or the last-known cash figure —
// the account simply stops being read-only and goes back to accepting
// manual edits from this point on.
export async function POST(request) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const { portfolio_id } = await request.json();
  if (!portfolio_id) return Response.json({ error: 'portfolio_id es obligatorio' }, { status: 400 });

  const { data: pf, error: pfErr } = await supabase
    .from('portfolios')
    .select('id, t212_secret_id')
    .eq('id', portfolio_id)
    .eq('user_id', userId)
    .single();
  if (pfErr || !pf) return Response.json({ error: 'Portfolio no encontrado' }, { status: 404 });

  if (pf.t212_secret_id) {
    await supabase.rpc('t212_delete_secret', { secret_id: pf.t212_secret_id });
  }

  await supabase.from('portfolios').update({
    t212_secret_id: null,
    t212_connected_at: null,
    t212_sync_error: null,
  }).eq('id', portfolio_id);

  return Response.json({ success: true });
}
