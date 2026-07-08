import { useState, useEffect } from 'react';

// Approximate fallback rates in case the live fetch fails (network/CORS) —
// overwritten once the frankfurter.dev fetch below succeeds.
const FALLBACK_RATES = { EUR: 0.92, GBP: 0.79 };

// Was duplicated between portfolio and home (each fetching independently —
// this doesn't add caching between them, just removes the duplicated code).
export function useCurrencyRates() {
  const [rates, setRates] = useState(FALLBACK_RATES);

  useEffect(() => {
    // frankfurter.app moved to frankfurter.dev (old domain 301-redirects) —
    // pointing directly at the new one avoids relying on a redirect being followed.
    fetch('https://api.frankfurter.dev/v1/latest?from=USD&to=EUR,GBP')
      .then(r => r.json())
      .then(d => {
        if (d.rates && d.rates.EUR && d.rates.GBP) setRates(d.rates);
        else console.warn('FX rates response missing EUR/GBP, using fallback:', d);
      })
      .catch(e => console.warn('FX rates fetch failed, using fallback rates:', e));
  }, []);

  // Lots/prices can be in whatever currency the source actually reported —
  // this normalizes to USD so gain/loss math is always apples-to-apples.
  const toUSD = (amount, ccy) => {
    if (!ccy || ccy === 'USD' || amount === null || amount === undefined) return amount;
    const r = rates[ccy];
    return r ? amount / r : amount;
  };

  return { rates, toUSD };
}
