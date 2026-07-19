import { getUserId } from '../../../../lib/auth';
import { supabase } from '../../../../lib/supabase';

export async function POST(request) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const { pie, sourcePortfolioId, targetPortfolioId } = await request.json();

  if (!pie || !sourcePortfolioId || !targetPortfolioId) {
    return Response.json({ error: 'Missing required parameters' }, { status: 400 });
  }

  // Update all holdings with the matching pie and sourcePortfolioId
  const { error } = await supabase
    .from('portfolio_holdings')
    .update({ portfolio_id: targetPortfolioId })
    .eq('user_id', userId)
    .eq('portfolio_id', sourcePortfolioId)
    .eq('pie', pie);

  if (error) {
    console.error('transfer pie error:', error);
    return Response.json({ error: error.message || 'Failed to transfer pie' }, { status: 500 });
  }

  return Response.json({ success: true });
}
