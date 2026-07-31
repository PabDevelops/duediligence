import { useState, useEffect, useRef, useCallback } from 'react';

// A tab opened while the market was still trading and left sitting on this page shows the
// price as of that one fetch forever otherwise — including straight through the close, which
// reads exactly like a "snapshot from before close" bug even though the server-side price is
// actually fresh on every request (see app/api/stock/route.js). Revalidating when the tab
// regains focus/visibility (the moment a user is most likely looking at a stale number) and on
// a slow background poll while visible closes that gap without hammering /api/stock on every
// render.
const REVALIDATE_MS = 5 * 60 * 1000;

// Fetches /api/stock?ticker= for a single ticker and tracks data/loading/error.
// On error, `data` is left as whatever it was before (not cleared) — callers
// that want to hide stale data when `error` is set (e.g. after switching to a
// ticker that fails) should derive that themselves from the returned `error`,
// since which behavior is correct differs per page.
export function useStockData(ticker, { refresh = false } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  // Lazy-initialized to whether `ticker` is already known on first render, so
  // pages where it's present from the start (e.g. a route param) don't flash
  // an unloaded state for a frame before the fetch effect below kicks in.
  const [loading, setLoading] = useState(() => !!ticker);
  // Tracks only the manual "Actualizar datos" button's own fetch, separate from `loading`
  // (the page-level skeleton) so a manual refresh shows a local spinner without hiding the
  // data already on screen.
  const [refreshing, setRefreshing] = useState(false);

  // Ref (not state) so the focus/visibility/interval listeners below always call fetch with
  // whatever ticker is current without needing to be torn down and re-attached on every change.
  const tickerRef = useRef(ticker);
  tickerRef.current = ticker;

  const fetchTicker = useCallback((t, { silent = false, forceRefresh = false } = {}) => {
    if (!t) return Promise.resolve();
    if (!silent) setLoading(true);
    return fetch(`/api/stock?ticker=${t}${forceRefresh ? '&refresh=true' : ''}`)
      .then(r => r.json())
      .then(d => {
        if (tickerRef.current !== t) return;
        if (d.error) { setError(d.error); return; }
        setError(null);
        setData(d);
      })
      .catch(() => { if (tickerRef.current === t) setError('Connection error'); })
      .finally(() => { if (tickerRef.current === t && !silent) setLoading(false); });
  }, []);

  useEffect(() => {
    if (!ticker) { setData(null); setError(null); return; }
    fetchTicker(ticker, { forceRefresh: refresh });
  }, [ticker, refresh, fetchTicker]);

  useEffect(() => {
    if (!ticker) return;
    const revalidate = () => fetchTicker(tickerRef.current, { silent: true });
    const onVisibility = () => { if (document.visibilityState === 'visible') revalidate(); };
    window.addEventListener('focus', revalidate);
    document.addEventListener('visibilitychange', onVisibility);
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') revalidate();
    }, REVALIDATE_MS);
    return () => {
      window.removeEventListener('focus', revalidate);
      document.removeEventListener('visibilitychange', onVisibility);
      clearInterval(interval);
    };
  }, [ticker, fetchTicker]);

  // Forces a bypass of the server-side cache and refetches without touching `loading`, so the
  // "Actualizar datos" button can show its own spinner while the rest of the page keeps
  // rendering the data already loaded.
  const refetch = useCallback(() => {
    if (!tickerRef.current) return Promise.resolve();
    setRefreshing(true);
    return fetchTicker(tickerRef.current, { silent: true, forceRefresh: true }).finally(() => setRefreshing(false));
  }, [fetchTicker]);

  return { data, error, loading, refreshing, refetch };
}
