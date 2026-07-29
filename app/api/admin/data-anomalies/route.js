import { supabase } from '../../../../lib/supabase';
import { checkIsAdmin } from '../../../../lib/isAdmin';

// Weekly-review queue fed by lib/dataAnomalies.js's flagDataAnomaly calls in
// app/api/stock/route.js -- see that file for what counts as an anomaly worth logging.
export async function GET() {
  const isAdmin = await checkIsAdmin();
  if (!isAdmin) return Response.json({ error: 'Not authorized' }, { status: 403 });

  const { data, error } = await supabase
    .from('data_anomalies')
    .select('*')
    .is('reviewed_at', null)
    .order('pct_diff', { ascending: false });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ anomalies: data || [] });
}

export async function PATCH(request) {
  const isAdmin = await checkIsAdmin();
  if (!isAdmin) return Response.json({ error: 'Not authorized' }, { status: 403 });

  const { id } = await request.json().catch(() => ({}));
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });

  const { error } = await supabase.from('data_anomalies').update({ reviewed_at: new Date().toISOString() }).eq('id', id);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true });
}
