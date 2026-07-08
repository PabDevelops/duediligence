import { useState, useEffect } from 'react';

// Debounced ticker/company search against /api/search. Was duplicated with
// the same 200ms debounce in portfolio, compare, and search — this is the
// one implementation, parameterized where those call sites actually differed
// (whether search is currently enabled, and an optional result limit).
export function useTickerSearch(query, { enabled = true, debounceMs = 200, limit } = {}) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || query.trim().length < 1) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(() => {
      const url = `/api/search?q=${encodeURIComponent(query.trim())}${limit ? `&limit=${limit}` : ''}`;
      fetch(url)
        .then(r => r.json())
        .then(d => setSuggestions(d.results || []))
        .catch(() => setSuggestions([]))
        .finally(() => setLoading(false));
    }, debounceMs);
    return () => clearTimeout(t);
  }, [query, enabled, debounceMs, limit]);

  return { suggestions, loading };
}
