import { supabase } from './supabase';
import { fetchAccount, fetchPortfolio, fetchOrderHistory, fetchDividendHistory } from './trading212';

// A connected account is read-only from the manual side — one source of
// truth per account, never both. Routes that accept manual writes to
// portfolio_holdings/portfolio_cash_ledger call this before writing.
export async function isPortfolioConnected(portfolioId) {
  const { data } = await supabase.from('portfolios').select('t212_connected_at').eq('id', portfolioId).single();
  return !!data?.t212_connected_at;
}

// Pulls a connected portfolio's current positions + cash from Trading 212 and
// replaces portfolio_holdings for that portfolio wholesale — safe because a
// connected portfolio never has manual rows mixed in (enforced server-side
// in the portfolio/cash routes), so there's nothing manual to clobber.
export async function syncPortfolioFromTrading212(portfolioId, credential) {
  let account, positions;
  try {
    [account, positions] = await Promise.all([fetchAccount(credential), fetchPortfolio(credential)]);
  } catch (err) {
    await supabase.from('portfolios').update({ t212_sync_error: err.message }).eq('id', portfolioId);
    throw err;
  }

  const { data: pf } = await supabase.from('portfolios').select('user_id').eq('id', portfolioId).single();
  if (!pf) throw new Error('Portfolio not found');

  const today = new Date().toISOString().slice(0, 10);
  const accountCurrency = account?.currencyCode || 'USD';
  // A position carries no currency field at all (confirmed) — but averagePrice
  // is in the INSTRUMENT's own listing currency, not the account's. A real
  // GBP ISA holding USD-listed stocks confirmed this the hard way: treating
  // averagePrice as GBP (the earlier assumption here) and converting it to
  // USD inflated every cost basis, turning real small gains into fake 20%+
  // losses — the giveaway was each position being up several percent "today"
  // while somehow down double digits overall. Trading 212's catalogue is
  // overwhelmingly USD-listed (especially the kind of small/mid-cap names
  // this synced), so USD is the far safer default than the account currency;
  // still not guaranteed correct for a GBP-listed stock in a non-GBP account,
  // but no currency field means there's no way to know for sure per position.
  const rows = (positions || [])
    .filter(p => p.ticker && Number(p.quantity) > 0)
    .map(p => ({
      user_id: pf.user_id,
      portfolio_id: portfolioId,
      ticker: normalizeTicker(p.ticker),
      shares: Number(p.quantity),
      cost_basis: Number(p.averagePrice),
      cost_basis_currency: 'USD',
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
    t212_cash: account?.free ?? null,
    t212_cash_currency: accountCurrency,
  }).eq('id', portfolioId);

  // Activity (recent buys/sells/dividends) is a nice-to-have on top of the
  // core holdings/cash sync above — a failure here (wrong endpoint, wrong
  // field names, missing scope on an older-connected key) must never undo or
  // block the sync that already succeeded.
  try {
    await syncActivity(portfolioId, pf.user_id, credential);
  } catch (err) {
    console.error('Trading212 activity sync failed:', err);
  }

  return { positions: rows.length };
}

// Trading 212 sometimes still reports a company's old ticker after a real
// rename/relist — not a Trading 212 quirk like the digit suffix below, just
// their instrument data lagging a real corporate action. Not something a
// general rule can catch; this is a plain lookup of specific cases found in
// a real account, extend it as more turn up.
//   KMPH → ZVRA: KemPharm, Inc. renamed to Zevra Therapeutics, Inc. in 2023.
//   ALUS → FREY → TE: Alussa/FREYR combination in July 2021, then
//   FREYR renamed T1 Energy and began trading as TE on 3 March 2025.
//   Sources: https://www.sec.gov/Archives/edgar/data/1781115/000121390021035104/ea143604ex99-2_alussa.htm
//   https://www.sec.gov/Archives/edgar/data/1992243/000121390025015030/ea0231365-8k_freyrbat.htm
// These aliases identify broker positions, not interchangeable financial histories.
const KNOWN_TICKER_RENAMES = { KMPH: 'ZVRA', ALUS: 'TE', FREY: 'TE' };

// Trading 212 instrument codes look like "AAPL_US_EQ" (confirmed on
// /equity/portfolio against a real account) — strip the exchange/type suffix
// so it matches the plain tickers used everywhere else in the app (stock
// lookups, the holdings table, etc.).
//
// Trading 212 also sometimes appends a single digit to the base symbol
// itself — e.g. "MNTN1_US_EQ" for MNTN, Inc. (real ticker: MNTN) — to
// disambiguate it from another instrument in their own listing that shares
// the same base symbol. That digit is Trading 212's own internal
// disambiguator, not part of the real market ticker, so a lone trailing
// digit left after stripping the exchange suffix is stripped too — the
// app's own stock data has no ticker ending in a bare digit today, so this
// can't collide with a real one.
function normalizeTicker(ticker) {
  if (!ticker) return ticker;
  const base = String(ticker)
    .replace(/_[A-Z]+_EQ$/, '')
    .replace(/^([A-Z]+)\d$/, '$1');
  return KNOWN_TICKER_RENAMES[base] || base;
}

// Pulls recent filled orders + dividend payments and upserts them into
// portfolio_activity, deduped by (portfolio_id, type, external_id) so
// repeated syncs never double-count an event. Both endpoints' exact response
// shape are a best guess (see lib/trading212.js) — every field read here is
// defensively optional, and the full raw item is kept in case the mapping
// needs correcting once a real key confirms the real shape.
async function syncActivity(portfolioId, userId, credential) {
  let ordersError = null, dividendsError = null;
  const [orders, dividends] = await Promise.all([
    fetchOrderHistory(credential).catch(err => { ordersError = err.message; console.error('Trading212 order history fetch failed:', err.message); return null; }),
    fetchDividendHistory(credential).catch(err => { dividendsError = err.message; console.error('Trading212 dividend history fetch failed:', err.message); return null; }),
  ]);

  // Debug trail, independent of whether syncActivity itself throws below — this app has no
  // visibility into Vercel's server logs from outside, and a sync that succeeds with 0 order
  // rows looks identical in portfolio_activity to one that silently failed. Persisted here so
  // the exact cause (a request error vs. an unexpected status value vs. a genuinely empty
  // response) can be read back from the database instead of guessed at. Not shown in the UI.
  const debug = {
    at: new Date().toISOString(),
    ordersError,
    ordersCount: orders?.items?.length ?? null,
    ordersStatuses: orders?.items ? [...new Set(orders.items.map(o => o.order?.status))] : null,
    ordersSample: orders?.items?.slice(0, 3) ?? null,
    dividendsError,
    dividendsCount: dividends?.items?.length ?? null,
  };
  await supabase.from('portfolios').update({ t212_activity_debug: debug }).eq('id', portfolioId);

  const rows = [];

  // Confirmed against a real account (previous guess — a flat { id, ticker, status,
  // filledQuantity, fillPrice, fillCost, ... } object — was wrong and silently dropped every
  // single order: `o.status`/`o.id` were always undefined, so `if (!o?.id ...)` skipped all 50
  // items on a real sync). Each item is actually { fill: {...}, order: {...} }: `order` carries
  // the order-level fields (id, status, side, ticker, instrument, createdAt, filledQuantity),
  // `fill` carries the execution (price in the instrument's own currency, filledAt,
  // walletImpact in the account's base currency after FX conversion). `order.side` ('BUY'/'SELL')
  // is given directly — no need to infer it from the quantity sign anymore.
  for (const o of orders?.items || []) {
    const ord = o?.order;
    if (!ord?.id || ord.status !== 'FILLED') continue;
    const qty = ord.filledQuantity != null ? Number(ord.filledQuantity) : null;
    const price = o.fill?.price != null ? Number(o.fill.price) : null;
    rows.push({
      user_id: userId,
      portfolio_id: portfolioId,
      type: 'order',
      external_id: String(ord.id),
      ticker: normalizeTicker(ord.ticker),
      action: ord.side === 'BUY' || ord.side === 'SELL' ? ord.side : (qty == null ? null : qty >= 0 ? 'BUY' : 'SELL'),
      quantity: qty != null ? Math.abs(qty) : null,
      price,
      // price is in the instrument's own listing currency (confirmed: MNTN's fill.price ~$6.27
      // matches its real USD quote; walletImpact.netValue is the GBP-converted amount in the
      // account's base currency instead, via the fxRate alongside it) — price × quantity here
      // keeps amount in that same instrument currency, not silently mixed with the account's.
      amount: price != null && qty != null ? Math.abs(price * qty) : null,
      currency: ord.instrument?.currency ?? null,
      // Only present on a SELL fill (confirmed: absent on every BUY in a real account's history)
      // — Trading 212 computes this itself from the position's actual cost basis, in the
      // account's own base currency (walletImpact.currency), not the instrument's. Kept in its
      // own currency rather than converted, same reasoning as cost_basis_currency elsewhere in
      // this file: there's no reliable FX rate to re-derive after the fact.
      realized_pl: o.fill?.walletImpact?.realisedProfitLoss != null ? Number(o.fill.walletImpact.realisedProfitLoss) : null,
      realized_pl_currency: o.fill?.walletImpact?.currency ?? null,
      occurred_at: o.fill?.filledAt || ord.createdAt || new Date().toISOString(),
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
      // Confirmed against a real account: amount/currency come through in the
      // account's own currency (GBP dividends showed up as GBP, not
      // EUR-normalized) — the earlier amountInEuro fallback guess wasn't needed.
      amount: d.amount != null ? Number(d.amount) : null,
      currency: d.currency || null,
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
