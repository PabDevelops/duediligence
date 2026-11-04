import { getUserId } from '../../../../../lib/auth';
import { supabase } from '../../../../../lib/supabase';
import { fetchAccount } from '../../../../../lib/trading212';
import { syncPortfolioFromTrading212 } from '../../../../../lib/trading212Sync';

export async function POST(request) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const { portfolio_id, apiKey } = await request.json();
  if (!portfolio_id || !apiKey?.trim()) {
    return Response.json({ error: 'portfolio_id y apiKey son obligatorios' }, { status: 400 });
  }

  const { data: pf, error: pfErr } = await supabase
    .from('portfolios')
    .select('id, t212_secret_id')
    .eq('id', portfolio_id)
    .eq('user_id', userId)
    .single();
  if (pfErr || !pf) return Response.json({ error: 'Portfolio no encontrado' }, { status: 404 });

  // Prove the key actually works (and has the right scope) before saving it —
  // cheapest real call that needs both account-level access and a valid key.
  try {
    await fetchAccount(apiKey.trim());
  } catch (err) {
    return Response.json({ error: err.message || 'No se pudo validar la clave de Trading 212' }, { status: 400 });
  }

  // Reconnecting with a new key — drop the old secret first so it doesn't
  // linger in Vault unreferenced.
  if (pf.t212_secret_id) {
    await supabase.rpc('t212_delete_secret', { secret_id: pf.t212_secret_id });
  }

  const { data: secretId, error: secretErr } = await supabase.rpc('t212_create_secret', {
    secret_value: apiKey.trim(),
    secret_name: `t212-${portfolio_id}`,
  });
  if (secretErr) {
    console.error('t212_create_secret error:', secretErr);
    return Response.json({ error: 'No se pudo guardar la clave de forma segura' }, { status: 500 });
  }

  await supabase.from('portfolios').update({
    t212_secret_id: secretId,
    t212_connected_at: new Date().toISOString(),
    t212_sync_error: null,
  }).eq('id', portfolio_id);

  try {
    await syncPortfolioFromTrading212(portfolio_id, apiKey.trim());
  } catch (err) {
    // Connected and the key is valid (we already proved that above) — a
    // failure here is a sync hiccup, not a reason to undo the connection.
    // The error is already recorded on the portfolio row by the sync function.
    console.error('Initial Trading 212 sync failed:', err.message);
  }

  return Response.json({ success: true });
}
