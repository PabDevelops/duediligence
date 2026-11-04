import { supabase } from './supabase';
import { fetchAccount, fetchPortfolio } from './trading212';

// A connected account is read-only from the manual side — one source of
// truth per account, never both. Routes that accept manual writes to
// portfolio_holdings/portfolio_cash_ledger call this before writing.
export async function isPortfolioConnected(portfolioId) {
  const { data } = await supabase.from('portfolios').select('t212_connected_at').eq('id', portfolioId).single();
  return !!data?.t212_connected_at;
}

// Field names below for the account-cash and per-position currency are a best
// guess (docs.trading212.com wasn't reachable while building this) — `ticker`,
// `quantity`, `averagePrice` are solidly confirmed, these two aren't. Falls
// back to the app's own default ('USD') rather than guessing wrong silently;
// confirm against a real response and fix here once connected for real.
function pick(obj, keys, fallback) {
  for (const k of keys) if (obj?.[k] != null) return obj[k];
  return fallback;
}

// Pulls a connected portfolio's current positions + cash from Trading 212 and
// replaces portfolio_holdings for that portfolio wholesale — safe because a
// connected portfolio never has manual rows mixed in (enforced server-side
// in the portfolio/cash routes), so there's nothing manual to clobber.
export async function syncPortfolioFromTrading212(portfolioId, apiKey) {
  let account, positions;
  try {
    [account, positions] = await Promise.all([fetchAccount(apiKey), fetchPortfolio(apiKey)]);
  } catch (err) {
    await supabase.from('portfolios').update({ t212_sync_error: err.message }).eq('id', portfolioId);
    throw err;
  }

  const { data: pf } = await supabase.from('portfolios').select('user_id').eq('id', portfolioId).single();
  if (!pf) throw new Error('Portfolio not found');

  const today = new Date().toISOString().slice(0, 10);
  const rows = (positions || [])
    .filter(p => p.ticker && Number(p.quantity) > 0)
    .map(p => ({
      user_id: pf.user_id,
      portfolio_id: portfolioId,
      ticker: p.ticker,
      shares: Number(p.quantity),
      cost_basis: Number(p.averagePrice),
      cost_basis_currency: pick(p, ['currencyCode', 'currency'], 'USD'),
      purchase_date: p.initialFillDate ? String(p.initialFillDate).slice(0, 10) : today,
    }));

  await supabase.from('portfolio_holdings').delete().eq('portfolio_id', portfolioId);
  if (rows.length > 0) {
    const { error: insertError } = await supabase.from('portfolio_holdings').insert(rows);
    if (insertError) {
      await supabase.from('portfolios').update({ t212_sync_error: insertError.message }).eq('id', portfolioId);
      throw new Error(insertError.message);
    }
  }

  await supabase.from('portfolios').update({
    t212_last_synced_at: new Date().toISOString(),
    t212_sync_error: null,
    t212_cash: pick(account, ['free', 'cash'], null),
    t212_cash_currency: pick(account, ['currencyCode', 'currency'], 'USD'),
  }).eq('id', portfolioId);

  return { positions: rows.length };
}
