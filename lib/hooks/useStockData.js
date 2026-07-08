import { useState, useEffect } from 'react';

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

  useEffect(() => {
    if (!ticker) { setData(null); setError(null); return; }
    let active = true;
    setLoading(true);
    fetch(`/api/stock?ticker=${ticker}${refresh ? '&refresh=true' : ''}`)
      .then(r => r.json())
      .then(d => {
        if (!active) return;
        if (d.error) { setError(d.error); return; }
        setError(null);
        setData(d);
      })
      .catch(() => { if (active) setError('Connection error'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [ticker, refresh]);

  return { data, error, loading };
}
