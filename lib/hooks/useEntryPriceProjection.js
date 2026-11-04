import { useMemo } from 'react';
import { analyzeStock } from '../engine';

// V2: the five-year "max entry price" now comes from the fundamental engine (lib/engine), NOT
// from a Monte Carlo projection of the share price. The old version drifted the PRICE with a
// blend of (market-implied growth + the stock's own 1-year price CAGR + the analyst target),
// so a stock that had just fallen projected further falls and one that had just jumped projected
// further gains, regardless of the business. Pass the full `data` object from /api/stock.
//
// The returned shape stays compatible with the previous hook (maxEntryPrice, cagr5y,
// priceCentral5y) so existing consumers keep working, and adds `engine` with everything else.
// The old arguments (beta, riskFreeRate, analystTarget, fundamentalGrowth) are accepted but
// deliberately ignored.
export function useEntryPriceProjection({ ticker, data, requiredReturn } = {}) {
  const engine = useMemo(() => {
    if (!data || data.currentPrice == null) return null;
    try {
      return analyzeStock({ ...data, ticker: data.ticker ?? ticker }, requiredReturn != null ? { requiredReturn } : {});
    } catch {
      return null;
    }
  }, [data, ticker, requiredReturn]);

  return useMemo(() => {
    const c = engine?.entry ?? null;
    return {
      loading: false,
      engine,
      maxEntryPrice: c?.maxEntryPrice ?? null,
      cagr5y: c?.cagr ?? null,
      priceCentral5y: c?.valueYear5 ?? null,
      fairValueToday: c?.fairValueToday ?? null,
      marginOfSafety: c?.marginOfSafety ?? null,
      driftAnnual: null,
      volAnnual: null,
      historicalCagr: null,
    };
  }, [engine]);
}
