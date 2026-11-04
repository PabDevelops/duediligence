import { supabase } from './supabase';
import { fetchAccount, fetchPortfolio, fetchOrderHistory, fetchDividendHistory } from './trading212';

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

  // Activity (recent buys/sells/dividends) is a nice-to-have on top of the
  // core holdings/cash sync above — a failure here (wrong endpoint, wrong
  // field names, missing scope on an older-connected key) must never undo or
  // block the sync that already succeeded.
  try {
    await syncActivity(portfolioId, pf.user_id, apiKey);
  } catch (err) {
    console.error('Trading212 activity sync failed:', err);
  }

  return { positions: rows.length };
}

// Trading 212 instrument codes look like "AAPL_US_EQ" on at least some
// endpoints — strip the exchange/type suffix so it matches the plain tickers
// used everywhere else in the app (stock lookups, the holdings table, etc.).
// A ticker with no such suffix passes through unchanged.
function normalizeTicker(ticker) {
  if (!ticker) return ticker;
  return String(ticker).replace(/_[A-Z]+_EQ$/, '');
}

// Pulls recent filled orders + dividend payments and upserts them into
// portfolio_activity, deduped by (portfolio_id, type, external_id) so
// repeated syncs never double-count an event. Both endpoints' exact response
// shape are a best guess (see lib/trading212.js) — every field read here is
// defensively optional, and the full raw item is kept in case the mapping
// needs correcting once a real key confirms the real shape.
async function syncActivity(portfolioId, userId, apiKey) {
  const [orders, dividends] = await Promise.all([
    fetchOrderHistory(apiKey).catch(err => { console.error('Trading212 order history fetch failed:', err.message); return null; }),
    fetchDividendHistory(apiKey).catch(err => { console.error('Trading212 dividend history fetch failed:', err.message); return null; }),
  ]);

  const rows = [];

  for (const o of orders?.items || []) {
    if (!o?.id || o.status !== 'FILLED') continue;
    const qty = o.filledQuantity != null ? Number(o.filledQuantity) : null;
    rows.push({
      user_id: userId,
      portfolio_id: portfolioId,
      type: 'order',
      external_id: String(o.id),
      ticker: normalizeTicker(o.ticker),
      // Sign of filledQuantity as the buy/sell indicator is the common
      // brokerage-API convention (negative = sell) but unconfirmed here —
      // left null rather than guessed wrong when quantity is missing.
      action: qty == null ? null : qty >= 0 ? 'BUY' : 'SELL',
      quantity: qty != null ? Math.abs(qty) : null,
      price: o.fillPrice != null ? Number(o.fillPrice) : null,
      amount: o.fillCost != null ? Number(o.fillCost) : null,
      currency: pick(o, ['currencyCode', 'currency'], null),
      occurred_at: o.dateExecuted || o.dateCreated || new Date().toISOString(),
      raw: o,
    });
  }

  for (const d of dividends?.items || []) {
    const paidOn = d?.paidOn || d?.paidOnUtc;
    if (!paidOn) continue;
    const externalId = d.id != null ? String(d.id) : `${d.ticker || 'unknown'}-${paidOn}`;
    rows.push({
      user_id: userId,
      portfolio_id: portfolioId,
      type: 'dividend',
      external_id: externalId,
      ticker: normalizeTicker(d.ticker),
      action: null,
      quantity: null,
      price: d.grossAmountPerShare != null ? Number(d.grossAmountPerShare) : null,
      // amountInEuro looks like it may always be EUR-normalized regardless of
      // the account's own currency — flagged as unconfirmed, not corrected
      // for yet.
      amount: pick(d, ['amount', 'amountInEuro'], null),
      currency: d.currency || (d.amountInEuro != null ? 'EUR' : null),
      occurred_at: paidOn,
      raw: d,
    });
  }

  if (rows.length === 0) return;
  const { error } = await supabase
    .from('portfolio_activity')
    .upsert(rows, { onConflict: 'portfolio_id,type,external_id', ignoreDuplicates: true });
  if (error) console.error('Trading212 activity upsert failed:', error.message);
}
