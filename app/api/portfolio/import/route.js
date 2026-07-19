import { getUserId } from '../../../../lib/auth';
import { supabase } from '../../../../lib/supabase';

export async function POST(request) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const { rows, portfolio_id } = await request.json();
  if (!Array.isArray(rows) || rows.length === 0 || !portfolio_id) {
    return Response.json({ error: 'No rows to import or missing portfolio_id' }, { status: 400 });
  }

  const clean = rows
    .filter(r => r.ticker && Number(r.shares) > 0 && Number(r.costBasis) >= 0)
    .slice(0, 500)
    .map(r => ({
      user_id: userId,
      portfolio_id: portfolio_id,
      ticker: String(r.ticker).toUpperCase().trim(),
      shares: Number(r.shares),
      cost_basis: Number(r.costBasis),
      cost_basis_currency: ['USD', 'EUR', 'GBP'].includes(r.costBasisCurrency) ? r.costBasisCurrency : 'USD',
      purchase_date: r.purchaseDate || new Date().toISOString().slice(0, 10),
      pie: null,
    }));

  if (clean.length === 0) return Response.json({ error: 'No valid rows to import' }, { status: 400 });

  const { error } = await supabase.from('portfolio_holdings').insert(clean);
  if (error) return Response.json({ error: 'Import failed' }, { status: 500 });

  // Auto-add imported tickers to watchlist
  try {
    const tickersToWatch = [...new Set(clean.map(r => r.ticker))];
    if (tickersToWatch.length > 0) {
      const watchlistRows = tickersToWatch.map(t => ({
        user_id: userId,
        ticker: t,
      }));
      await supabase.from('watchlists').upsert(watchlistRows);
    }
  } catch (err) {
    console.error('Failed to auto-add imported tickers to watchlist:', err);
  }

  return Response.json({ success: true, imported: clean.length });
}
