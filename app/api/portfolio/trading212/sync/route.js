import { getUserId } from '../../../../../lib/auth';
import { supabase } from '../../../../../lib/supabase';
import { syncPortfolioFromTrading212 } from '../../../../../lib/trading212Sync';

const MIN_SYNC_INTERVAL_MS = 30000;

async function syncOne(pf) {
  const { data: credential } = await supabase.rpc('t212_read_secret', { secret_id: pf.t212_secret_id });
  if (!credential) {
    await supabase.from('portfolios').update({ t212_sync_error: 'Clave no encontrada — reconecta la cuenta.' }).eq('id', pf.id);
    return { portfolio_id: pf.id, error: 'Clave no encontrada' };
  }
  try {
    const result = await syncPortfolioFromTrading212(pf.id, credential);
    return { portfolio_id: pf.id, ...result };
  } catch (err) {
    return { portfolio_id: pf.id, error: err.message };
  }
}

// Called from the client (Portfolio page, when a connected account's last
// sync is stale) — optionally for one portfolio_id, otherwise every
// connected account the signed-in user owns. A per-account minimum interval
// avoids hammering Trading 212's own rate limit if several tabs/requests
// race each other.
export async function POST(request) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const { portfolio_id } = await request.json().catch(() => ({}));

  let query = supabase.from('portfolios').select('id, t212_secret_id, t212_last_synced_at').eq('user_id', userId).not('t212_secret_id', 'is', null);
  if (portfolio_id) query = query.eq('id', portfolio_id);
  const { data: portfolios, error } = await query;

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (portfolio_id && (!portfolios || portfolios.length === 0)) {
    return Response.json({ error: 'Esa cuenta no está conectada a Trading 212' }, { status: 400 });
  }

  const now = Date.now();
  const due = (portfolios || []).filter(pf =>
    !pf.t212_last_synced_at || now - new Date(pf.t212_last_synced_at).getTime() > MIN_SYNC_INTERVAL_MS
  );

  const results = await Promise.all(due.map(syncOne));
  return Response.json({ synced: results });
}
