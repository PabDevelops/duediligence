// Reuse authenticated watchlist routes; the server resolves ownership and limits.
export async function saveStockFollow(ticker, pie, following, fetcher = fetch) {
  return request(fetcher, following ? 'PATCH' : 'POST', { ticker, pie: pie || null });
}
export async function removeStockFollow(ticker, fetcher = fetch) {
  return request(fetcher, 'DELETE', { ticker });
}
async function request(fetcher, method, body) {
  const response = await fetcher('/api/watchlist', {
    method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'No se pudo guardar el seguimiento. Inténtalo de nuevo.');
  return result;
}
