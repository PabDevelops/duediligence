import { checkIsAdmin } from '../../../../lib/isAdmin';
import { isCronRequest } from '../../../../lib/verifyCronAuth';
import { supabase } from '../../../../lib/supabase';
import { syncPortfolioFromTrading212 } from '../../../../lib/trading212Sync';

// Backstop sync for every connected Trading 212 account — the page itself
// also triggers a sync when it loads and the last one is stale, this just
// keeps data from going too far out of date for anyone who doesn't open the
// app for a while. Sequential with a small delay between accounts (not
// required by Trading 212's own per-key rate limit, just being a reasonable
// neighbor to our own Supabase/Vercel usage if this list ever gets long).
const DELAY_MS = 500;

async function handler(request) {
  const isCron = isCronRequest(request);
  if (!isCron) {
    const isAdmin = await checkIsAdmin();
    if (!isAdmin) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: portfolios, error } = await supabase
    .from('portfolios')
    .select('id, t212_secret_id')
    .not('t212_secret_id', 'is', null);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const synced = [];
  const failed = [];

  for (const pf of portfolios || []) {
    try {
      const { data: credential } = await supabase.rpc('t212_read_secret', { secret_id: pf.t212_secret_id });
      if (!credential) throw new Error('Secret not found');
      await syncPortfolioFromTrading212(pf.id, credential);
      synced.push(pf.id);
    } catch (err) {
      failed.push({ portfolio_id: pf.id, error: err.message });
    }
    await new Promise(resolve => setTimeout(resolve, DELAY_MS));
  }

  return Response.json({ total: portfolios?.length || 0, synced, failed });
}

export async function GET(request) { return handler(request); }
export async function POST(request) { return handler(request); }
