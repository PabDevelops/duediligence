import { useState, useEffect } from 'react';

// Approximate fallback rates in case the live fetch fails (network/CORS) —
// overwritten once the frankfurter.dev fetch below succeeds.
const FALLBACK_RATES = { EUR: 0.92, GBP: 0.79 };

// A lot's cost basis was fixed the moment it was entered — converting it with today's live
// FX rate instead of a stable one made it silently drift with exchange-rate movement every
// session, which fed straight into retPct% and the Performance chart's day-to-day snapshots
// as noise unrelated to actual portfolio performance (see toUSDStable below). Persisted so
// the same rate is reused across page loads instead of re-locking a new one every session.
const LOCKED_RATE_KEY = 'traqcker_locked_fx_rates';

function getLockedRates() {
  try {
    return JSON.parse(localStorage.getItem(LOCKED_RATE_KEY) || '{}');
  } catch {
    return {};
  }
}

function lockRatesOnce(liveRates) {
  try {
    const locked = getLockedRates();
    let changed = false;
    for (const ccy of Object.keys(liveRates)) {
      if (locked[ccy] == null) { locked[ccy] = liveRates[ccy]; changed = true; }
    }
    if (changed) localStorage.setItem(LOCKED_RATE_KEY, JSON.stringify(locked));
  } catch {}
}

// Was duplicated between portfolio and home (each fetching independently —
// this doesn't add caching between them, just removes the duplicated code).
export function useCurrencyRates() {
  const [rates, setRates] = useState(FALLBACK_RATES);
  // Starts false so callers that post a portfolio snapshot (home/page.js, portfolio/page.js)
  // can wait for the real rate instead of the hardcoded FALLBACK_RATES approximation —
  // those posts were racing this fetch, occasionally computing a GBP/EUR holding's USD value
  // off the guessed fallback rate for the split second before the live rate arrived, and that
  // one-off bad value could still slip past the write-time 40pp swing guard (see
  // /api/portfolio/snapshot/route.js) if it wasn't an extreme enough miss. Set true once the
  // fetch settles either way (success or failure) so a real API outage doesn't block posting
  // forever — FALLBACK_RATES is still the best available number at that point.
  const [fxReady, setFxReady] = useState(false);

  useEffect(() => {
    // frankfurter.app moved to frankfurter.dev (old domain 301-redirects) —
    // pointing directly at the new one avoids relying on a redirect being followed.
    fetch('https://api.frankfurter.dev/v1/latest?from=USD&to=EUR,GBP')
      .then(r => r.json())
      .then(d => {
        if (d.rates && d.rates.EUR && d.rates.GBP) {
          setRates(d.rates);
          lockRatesOnce(d.rates);
        } else console.warn('FX rates response missing EUR/GBP, using fallback:', d);
      })
      .catch(e => console.warn('FX rates fetch failed, using fallback rates:', e))
      .finally(() => setFxReady(true));
  }, []);

  // Lots/prices can be in whatever currency the source actually reported —
  // this normalizes to USD so gain/loss math is always apples-to-apples.
  const toUSD = (amount, ccy) => {
    if (!ccy || ccy === 'USD' || amount === null || amount === undefined) return amount;
    const r = rates[ccy];
    return r ? amount / r : amount;
  };

  // Same conversion, but for cost basis specifically: uses the first FX rate this browser
  // ever resolved (locked in localStorage) instead of today's live rate, so cost stays
  // stable day to day. Falls back to the live rate until one has been locked in yet.
  const toUSDStable = (amount, ccy) => {
    if (!ccy || ccy === 'USD' || amount === null || amount === undefined) return amount;
    const locked = getLockedRates();
    const r = locked[ccy] ?? rates[ccy];
    return r ? amount / r : amount;
  };

  return { rates, toUSD, toUSDStable, fxReady };
}
