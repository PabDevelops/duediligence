import { beforeEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ holdings: [], activity: [], positions: [], orders: [], dividends: [] }));
vi.mock('./supabase', () => ({ supabase: { from: table => {
  const query = {
    select: () => query,
    eq: () => query,
    single: async () => ({ data: { user_id: 'test-user' } }),
    delete: () => query,
    update: () => query,
    insert: async rows => { state.holdings.push(...rows); return {}; },
    upsert: async (rows, options) => { state.activity.push({ table, rows, options }); return {}; },
  };
  return query;
} } }));
vi.mock('./trading212', () => ({
  fetchAccount: async () => ({ currencyCode: 'GBP', free: 12 }),
  fetchPortfolio: async () => state.positions,
  fetchOrderHistory: async () => ({ items: state.orders }),
  fetchDividendHistory: async () => ({ items: state.dividends }),
}));
import { syncPortfolioFromTrading212 } from './trading212Sync';

beforeEach(() => { state.holdings = []; state.activity = []; state.positions = []; state.orders = []; state.dividends = []; });

it.each([
  ['ALUS_US_EQ', 'TE'], ['FREY_US_EQ', 'TE'], ['TE_US_EQ', 'TE'],
  ['ALUS', 'TE'], ['FREY', 'TE'], ['TE', 'TE'],
  ['KMPH_US_EQ', 'ZVRA'], ['MNTN1_US_EQ', 'MNTN'], ['AAPL_US_EQ', 'AAPL'], ['ALUSA_US_EQ', 'ALUSA'],
])('resolves %s without changing quantity, cost, ownership or purchase date', async (ticker, expected) => {
  const position = { ticker, quantity: 10.25, averagePrice: 2.29, initialFillDate: '2026-11-09T12:00:00Z' };
  state.positions = [position];
  expect(await syncPortfolioFromTrading212('test-portfolio', 'mock-only')).toEqual({ positions: 1 });
  expect(state.holdings).toEqual([{
    user_id: 'test-user', portfolio_id: 'test-portfolio', ticker: expected,
    shares: 10.25, cost_basis: 2.29, cost_basis_currency: 'USD', purchase_date: '2026-11-09',
  }]);
  expect(position.ticker).toBe(ticker);
});

it('uses the same identity for new activity while preserving broker evidence and deduplication', async () => {
  const order = { order: { id: 'order-1', status: 'FILLED', ticker: 'ALUS_US_EQ', side: 'BUY', filledQuantity: 10, instrument: { currency: 'USD' } }, fill: { price: 2.29, filledAt: '2026-11-09T12:00:00Z' } };
  const dividend = { id: 'dividend-1', ticker: 'FREY_US_EQ', paidOn: '2026-11-08', amount: 1.5, currency: 'GBP' };
  state.orders = [order]; state.dividends = [dividend];
  await syncPortfolioFromTrading212('test-portfolio', 'mock-only');
  expect(state.activity).toHaveLength(1);
  expect(state.activity[0]).toMatchObject({ table: 'portfolio_activity', options: { onConflict: 'portfolio_id,type,external_id', ignoreDuplicates: true } });
  expect(state.activity[0].rows[0]).toMatchObject({ ticker: 'TE', external_id: 'order-1', quantity: 10, price: 2.29, currency: 'USD', raw: order });
  expect(state.activity[0].rows[1]).toMatchObject({ ticker: 'TE', external_id: 'dividend-1', amount: 1.5, currency: 'GBP', raw: dividend });
});
