import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST, PATCH, DELETE } from './route';
import * as baskets from './baskets/route';
import { getBasketNames } from '../../../lib/watchlistBaskets';

const mocks = vi.hoisted(() => ({ user: vi.fn(), from: vi.fn(), rpc: vi.fn(), pro: vi.fn() }));
vi.mock('../../../lib/auth', () => ({ getUserId: mocks.user }));
vi.mock('../../../lib/supabase', () => ({ supabase: { from: mocks.from, rpc: mocks.rpc } }));
vi.mock('../../../lib/isPro', () => ({ checkIsPro: mocks.pro }));

function query(result) {
  const chain = {};
  for (const method of ['select', 'eq', 'is', 'order', 'in', 'limit', 'maybeSingle', 'insert', 'upsert', 'update', 'delete']) {
    chain[method] = vi.fn(() => chain);
  }
  chain.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return chain;
}
function request(body, method = 'POST') {
  return new Request('http://localhost/api/watchlist', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.mockResolvedValue('user-a');
  mocks.pro.mockResolvedValue(false);
});

describe('existing watchlist compatibility', () => {
  it('keeps every tracked row, date and basket even without cached company data', async () => {
    const rows = [{ ticker: 'AAA', created_at: '2020-01-01', pie: 'General' }, { ticker: 'BBB', created_at: '2021-01-01', pie: null }];
    const watchlist = query({ data: rows });
    mocks.from.mockReturnValueOnce(watchlist).mockReturnValueOnce(query({ data: [{ ticker: 'AAA', data: { name: 'Alpha', pie: 'wrong', created_at: 'wrong' } }] }));
    const res = await GET(new Request('http://localhost/api/watchlist?full=true'));
    expect((await res.json()).tickers).toEqual([{ name: 'Alpha', ...rows[0] }, rows[1]]);
    expect(watchlist.eq).toHaveBeenCalledWith('user_id', 'user-a');
  });

  it('reports a read failure instead of claiming the watchlist is empty', async () => {
    mocks.from.mockReturnValue(query({ error: { message: 'unavailable' } }));
    expect((await GET(new Request('http://localhost/api/watchlist'))).status).toBe(500);
  });

  it('keeps guest enrichment read-only and deduplicates symbols', async () => {
    mocks.user.mockResolvedValue(null);
    const cache = query({ data: [{ ticker: 'AAA', data: { name: 'Alpha' } }] });
    mocks.from.mockReturnValue(cache);
    const res = await GET(new Request('http://localhost/api/watchlist?full=true&tickers=aaa,AAA'));
    expect((await res.json()).tickers).toEqual([{ ticker: 'AAA', name: 'Alpha', created_at: null, pie: null }]);
    expect(mocks.from).toHaveBeenCalledExactlyOnceWith('stock_cache');
    expect(cache.in).toHaveBeenCalledWith('ticker', ['AAA']);
  });

  it('re-following at the free limit neither clears a basket nor checks the new-symbol cap', async () => {
    const upsert = query({ error: null });
    mocks.from.mockReturnValueOnce(query({ data: { id: 42 } })).mockReturnValueOnce(upsert).mockReturnValueOnce(query({ count: 20 }));
    expect((await POST(request({ ticker: 'aaa' }))).status).toBe(200);
    expect(upsert.upsert).toHaveBeenCalledWith({ user_id: 'user-a', ticker: 'AAA' }, { onConflict: 'user_id,ticker' });
    expect(mocks.pro).not.toHaveBeenCalled();
  });

  it('still rejects a new ticker at the free limit', async () => {
    mocks.from.mockReturnValueOnce(query({ data: null })).mockReturnValueOnce(query({ count: 20 }));
    expect((await POST(request({ ticker: 'NEW', pie: 'Growth' }))).status).toBe(403);
    expect(mocks.from).toHaveBeenCalledTimes(2);
  });

  it('allows adding a new ticker directly to a basket', async () => {
    const upsert = query({ error: null });
    mocks.from.mockReturnValueOnce(query({ data: null })).mockReturnValueOnce(query({ count: 2 })).mockReturnValueOnce(upsert).mockReturnValueOnce(query({ count: 3 }));
    expect((await POST(request({ ticker: 'NEW', pie: 'Growth' }))).status).toBe(200);
    expect(upsert.upsert.mock.calls[0][0]).toEqual({ user_id: 'user-a', ticker: 'NEW', pie: 'Growth' });
  });

  it.each(['Growth', 'General', ' Legacy ', null])('moves a ticker without rewriting any other tracking field: %s', async pie => {
    const update = query({ data: [{ ticker: 'AAA' }], error: null });
    mocks.from.mockReturnValue(update);
    expect((await PATCH(request({ ticker: ' aaa ', pie }, 'PATCH'))).status).toBe(200);
    expect(update.update).toHaveBeenCalledWith({ pie });
    expect(update.eq.mock.calls).toEqual([['user_id', 'user-a'], ['ticker', 'AAA']]);
  });

  it.each([{ ticker: 'AAA' }, { ticker: 9, pie: null }, { ticker: '', pie: 'X' }, { ticker: 'AAA', pie: [] }])('rejects an invalid move: %j', async body => {
    expect((await PATCH(request(body, 'PATCH'))).status).toBe(400);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('reports failed moves and missing tickers', async () => {
    mocks.from.mockReturnValueOnce(query({ error: { message: 'write failed' } })).mockReturnValueOnce(query({ data: [] }));
    expect((await PATCH(request({ ticker: 'AAA', pie: 'Growth' }, 'PATCH'))).status).toBe(500);
    expect((await PATCH(request({ ticker: 'AAA', pie: 'Growth' }, 'PATCH'))).status).toBe(404);
  });

  it('reports failed unfollows so the client can keep the row visible', async () => {
    const deletion = query({ error: { message: 'write failed' } });
    mocks.from.mockReturnValue(deletion);
    expect((await DELETE(request({ ticker: 'AAA' }, 'DELETE'))).status).toBe(500);
    expect(deletion.eq).toHaveBeenCalledWith('user_id', 'user-a');
  });
});

describe('named baskets', () => {
  it.each(['GET', 'POST', 'PATCH', 'DELETE'])('requires sign-in for %s', async method => {
    mocks.user.mockResolvedValue(null);
    expect((await baskets[method](request({ name: 'Growth', newName: 'Value' }))).status).toBe(401);
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('reads saved empty baskets only for the current user', async () => {
    const names = query({ data: [{ name: 'Empty' }] });
    mocks.from.mockReturnValue(names);
    expect(await (await baskets.GET()).json()).toEqual({ baskets: ['Empty'] });
    expect(names.eq).toHaveBeenCalledWith('user_id', 'user-a');
  });

  it('combines exact legacy names with persisted empty baskets', () => {
    expect(getBasketNames([{ pie: null }, { pie: 'General' }, { pie: ' Legacy ' }, { pie: 'General' }], ['Empty', 'General']))
      .toEqual([' Legacy ', 'Empty', 'General']);
  });

  it.each([undefined, '', '   ', 12, {}, 'x'.repeat(81)])('rejects invalid names: %j', async name => {
    expect((await baskets.POST(request({ name }))).status).toBe(400);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON', async () => {
    const req = new Request('http://localhost', { method: 'POST', body: '{' });
    expect((await baskets.POST(req)).status).toBe(400);
  });

  it('creates a trimmed empty basket without accepting a forged user id', async () => {
    const insert = query({ error: null });
    mocks.from.mockReturnValueOnce(query({ data: [] })).mockReturnValueOnce(insert);
    const res = await baskets.POST(request({ name: '  Growth  ', user_id: 'user-b' }));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ name: 'Growth' });
    expect(insert.insert).toHaveBeenCalledWith({ user_id: 'user-a', name: 'Growth' });
  });

  it('rejects duplicate legacy or saved names without merging their companies', async () => {
    mocks.from.mockReturnValueOnce(query({ data: [{ ticker: 'AAA' }] }));
    expect((await baskets.POST(request({ name: 'Growth' }))).status).toBe(409);
    mocks.from.mockReturnValueOnce(query({ data: [] })).mockReturnValueOnce(query({ error: { code: '23505' } }));
    expect((await baskets.POST(request({ name: 'Growth' }))).status).toBe(409);
  });

  it('renames an exact legacy name transactionally for the authenticated user', async () => {
    mocks.rpc.mockResolvedValue({ error: null });
    expect((await baskets.PATCH(request({ name: ' General ', newName: ' Value ', user_id: 'user-b' }, 'PATCH'))).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith('change_watchlist_basket', { p_user_id: 'user-a', p_name: ' General ', p_new_name: 'Value' });
  });

  it('deletes a basket through the transaction that clears labels, never through watchlist deletion', async () => {
    mocks.rpc.mockResolvedValue({ error: null });
    expect((await baskets.DELETE(request({ name: 'Growth' }, 'DELETE'))).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith('change_watchlist_basket', { p_user_id: 'user-a', p_name: 'Growth', p_new_name: null });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it.each([['23505', 409], ['P0002', 404], ['PGRST202', 503]])('reports RPC failure %s as HTTP %s', async (code, status) => {
    mocks.rpc.mockResolvedValue({ error: { code } });
    expect((await baskets.PATCH(request({ name: 'Growth', newName: 'Value' }, 'PATCH'))).status).toBe(status);
  });

  it('fails safely if the additive migration has not been applied', async () => {
    mocks.from.mockReturnValue(query({ error: { code: '42P01' } }));
    expect((await baskets.GET()).status).toBe(503);
  });
});
