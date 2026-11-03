import { useState, useEffect, useMemo } from 'react';
import {
  computeProjectionDrift,
  computeAnnualizedVolatility,
  computeBlendedVolatility,
  computeHistoricalCagr,
  computeProjection,
  createSeededRng,
} from '../stockScoring';

// Phil Town-style "sticker price": discount the Monte Carlo projector's own 5-year median
// path back to today at a fixed hurdle rate, instead of introducing a second valuation
// model. The hurdle is a demanded return, not a market input, so it's a constant here
// rather than something sourced from data.
const HURDLE_RATE = 0.15;
const HORIZON_YEARS = 5;

// Same drift/vol signal blend ProjectionChart uses for its chart (impliedGrowth from
// fundamentals + 1Y historical CAGR + analyst-target drift; historical realized vol blended
// with beta x VIX), but fixed to the 5-year horizon and reduced to the two numbers a plain
// verdict card needs: the price the 15%/yr hurdle justifies paying today, and the CAGR the
// median path implies from today's price. p10/p50/p90 are closed-form in computeProjection
// (they don't depend on the simulated paths), so numPaths is kept at 1 to skip generating a
// fan nothing here renders.
export function useEntryPriceProjection({ ticker, price, beta, riskFreeRate, analystTarget, fundamentalGrowth }) {
  const [closes, setCloses] = useState(null);
  const [marketVolAnnual, setMarketVolAnnual] = useState(null);
  const [loading, setLoading] = useState(!!ticker);

  useEffect(() => {
    if (!ticker) return;
    let active = true;
    setLoading(true);
    Promise.all([
      fetch(`/api/chart?ticker=${ticker}&range=1y`).then(r => r.json()).catch(() => ({ candles: [] })),
      fetch(`/api/market`).then(r => r.json()).catch(() => ({ markets: [] })),
    ]).then(([chartData, marketData]) => {
      if (!active) return;
      setCloses((chartData.candles || []).map(c => c.c).filter(v => v > 0));
      const vix = marketData.markets?.find(m => m.symbol === '^VIX')?.price;
      setMarketVolAnnual(vix ? vix / 100 : null);
      setLoading(false);
    });
    return () => { active = false; };
  }, [ticker]);

  const historicalVol = useMemo(() => computeAnnualizedVolatility(closes), [closes]);
  const historicalCagr = useMemo(() => computeHistoricalCagr(closes), [closes]);

  const volAnnual = useMemo(
    () => computeBlendedVolatility({ historicalVol, beta, marketVolAnnual }),
    [historicalVol, beta, marketVolAnnual]
  );

  const analystDrift = analystTarget && price ? (analystTarget / price) - 1 : null;

  const driftAnnual = useMemo(
    () => computeProjectionDrift({ impliedGrowth: fundamentalGrowth ?? null, historicalCagr, analystDrift }),
    [fundamentalGrowth, historicalCagr, analystDrift]
  );

  const projection = useMemo(() => {
    if (!price || driftAnnual == null || volAnnual == null) return null;
    const seed = `entry-${ticker}-${driftAnnual.toFixed(4)}-${volAnnual.toFixed(4)}`;
    return computeProjection({
      price, driftAnnual, volAnnual, horizonYears: HORIZON_YEARS, stepsPerYear: 52,
      rng: createSeededRng(seed), numPaths: 1, riskFreeRate,
    });
  }, [ticker, price, driftAnnual, volAnnual, riskFreeRate]);

  return useMemo(() => {
    if (!projection || !price) {
      return { loading, maxEntryPrice: null, cagr5y: null, priceCentral5y: null, driftAnnual, volAnnual, historicalCagr };
    }
    const last = projection.points[projection.points.length - 1];
    const priceCentral5y = last.p50;
    const maxEntryPrice = priceCentral5y / Math.pow(1 + HURDLE_RATE, HORIZON_YEARS);
    const cagr5y = Math.pow(priceCentral5y / price, 1 / HORIZON_YEARS) - 1;
    return { loading, maxEntryPrice, cagr5y, priceCentral5y, driftAnnual, volAnnual, historicalCagr };
  }, [projection, price, loading, driftAnnual, volAnnual, historicalCagr]);
}
