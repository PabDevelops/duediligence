import { checkIsAdmin } from '../../../../lib/isAdmin';
import { supabase } from '../../../../lib/supabase';

// Every connected Trading 212 account, for troubleshooting a sync complaint without going
// straight to Supabase — surfaces exactly the fields the real MNTN-sell bug was diagnosed from
// (t212_sync_error, t212_activity_debug) instead of leaving them invisible outside the database.
export async function GET() {
  const isAdmin = await checkIsAdmin();
  if (!isAdmin) return Response.json({ error: 'Not authorized' }, { status: 403 });

  const { data: portfolios, error } = await supabase
    .from('portfolios')
    .select('id, user_id, name, t212_connected_at, t212_last_synced_at, t212_sync_error, t212_cash, t212_cash_currency, t212_activity_debug')
    .not('t212_secret_id', 'is', null)
    .order('t212_last_synced_at', { ascending: false, nullsFirst: true });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Email isn't on the portfolios row — resolve each distinct owner from auth.users individually
  // rather than paginating the whole user base (listUsers), since a connected-account count this
  // small doesn't need it.
  const uniqueUserIds = [...new Set((portfolios || []).map(p => p.user_id))];
  const emailById = {};
  await Promise.all(uniqueUserIds.map(async (id) => {
    const { data } = await supabase.auth.admin.getUserById(id);
    emailById[id] = data?.user?.email ?? null;
  }));

  const accounts = (portfolios || []).map(p => ({ ...p, email: emailById[p.user_id] ?? null }));
  return Response.json({ accounts });
}
