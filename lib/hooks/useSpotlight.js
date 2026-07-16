'use client';
import { useState, useMemo, useCallback } from 'react';

// Local Traqcker Score 100, ported from the old standalone Radar page — same
// weighting as the stock detail page's Quality tab, just computed client-side
// against whatever the Spotlight panel already has loaded, for a compact ticker
// preview instead of a full stock page navigation.
function computeSpotlightQuality(d) {
  const hasFundamentals = d.revVal != null || d.niVal != null || d.marketCap != null
    || d.roic != null || d.grossMargin != null || (d.revHistory?.length ?? 0) > 0;
  if (!hasFundamentals) return null;

  const sector = (d.sector || '').toLowerCase();
  const isFinancial = sector.includes('bank') || sector.includes('insurance') || sector.includes('financial');
  const isTech = sector.includes('tech') || sector.includes('software') || sector.includes('semi');
  const isPharma = sector.includes('pharma') || sector.includes('biotech') || sector.includes('health');

  const roicThreshold = isTech ? 0.25 : isPharma ? 0.20 : 0.15;
  const gmThreshold = isTech ? 0.65 : isPharma ? 0.65 : isFinancial ? 0.30 : 0.35;
  const omThreshold = isTech ? 0.20 : isPharma ? 0.20 : isFinancial ? 0.15 : 0.15;

  const roicScore = d.roic == null ? 2.5 : d.roic / 100 >= roicThreshold * 2 ? 5 : d.roic / 100 >= roicThreshold * 1.5 ? 4.5 : d.roic / 100 >= roicThreshold ? 4 : d.roic / 100 >= roicThreshold * 0.7 ? 3 : d.roic / 100 >= roicThreshold * 0.4 ? 2 : 1;
  const gmScore = d.grossMargin == null ? 2.5 : d.grossMargin / 100 >= gmThreshold * 1.4 ? 5 : d.grossMargin / 100 >= gmThreshold * 1.15 ? 4.5 : d.grossMargin / 100 >= gmThreshold ? 4 : d.grossMargin / 100 >= gmThreshold * 0.75 ? 3 : d.grossMargin / 100 >= gmThreshold * 0.5 ? 2 : 1;
  const omScore = d.opMargin == null ? 2.5 : d.opMargin / 100 >= omThreshold * 2 ? 5 : d.opMargin / 100 >= omThreshold * 1.5 ? 4.5 : d.opMargin / 100 >= omThreshold ? 4 : d.opMargin / 100 >= omThreshold * 0.65 ? 3 : d.opMargin / 100 > 0 ? 2 : 1;
  const deScore = d.debtToEquity == null ? 2.5 : d.debtToEquity < 0.3 ? 5 : d.debtToEquity < 0.7 ? 4.5 : d.debtToEquity < 1.2 ? 4 : d.debtToEquity < 2 ? 3 : d.debtToEquity < 3 ? 2 : 1;

  const cbs = (roicScore * 0.4 + gmScore * 0.25 + omScore * 0.25 + deScore * 0.1);
  const pfcfScore = d.pfcf == null || d.pfcf <= 0 ? 1 : d.pfcf < 12 ? 5 : d.pfcf < 18 ? 4.5 : d.pfcf < 25 ? 4 : d.pfcf < 35 ? 3 : d.pfcf < 50 ? 2 : 1;
  const fcfYieldScore = d.fcfYield == null ? 1 : d.fcfYield > 8 ? 5 : d.fcfYield > 5 ? 4.5 : d.fcfYield > 3 ? 4 : d.fcfYield > 1.5 ? 3 : d.fcfYield > 0 ? 2 : 1;

  const oppo = (pfcfScore * 0.55 + fcfYieldScore * 0.45);
  const revGrowthScore = d.revGrowth == null ? 2.5 : d.revGrowth > 25 ? 5 : d.revGrowth > 15 ? 4.5 : d.revGrowth > 8 ? 4 : d.revGrowth > 3 ? 3 : d.revGrowth > 0 ? 2 : 1;

  const fcfTrend = d.fcfHistory?.length >= 3 ? d.fcfHistory[d.fcfHistory.length - 1]?.val > d.fcfHistory[0]?.val ? 1 : 0 : null;
  const marginTrend = d.marginHistory?.length >= 3 ? (d.marginHistory[d.marginHistory.length - 1]?.margin || 0) > (d.marginHistory[0]?.margin || 0) ? 1 : 0 : null;
  const trendBonus = (fcfTrend === 1 ? 0.5 : 0) + (marginTrend === 1 ? 0.5 : 0);
  const gqs = Math.min(5, revGrowthScore * 0.6 + (2.5 + trendBonus * 2) * 0.4);

  const finalNote = (cbs * 0.45 + oppo * 0.30 + gqs * 0.25);
  const score100 = Math.round((finalNote / 5) * 100);

  let verdict, verdictColor;
  if (score100 >= 70) { verdict = 'Solid & steady'; verdictColor = 'var(--ws-accent)'; }
  else if (score100 >= 40) { verdict = 'Mixed signals'; verdictColor = 'var(--ws-text-2)'; }
  else { verdict = 'Needs caution'; verdictColor = 'var(--ws-red)'; }

  return { score100, verdict, verdictColor };
}

// Drives the Spotlight side panel: fetch a ticker's quote + sparkline on demand so any
// list on the page (movers, sectors, baskets, calendar, insider activity...) can offer a
// quick preview without a full navigation to /stock/[ticker].
export function useSpotlight() {
  const [ticker, setTicker] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sparkline, setSparkline] = useState(null);

  const trigger = useCallback(async (rawTicker) => {
    const t = rawTicker.toUpperCase();
    setTicker(t);
    setLoading(true);
    setData(null);
    setSparkline(null);

    try {
      const [stockRes, sparkRes] = await Promise.all([
        fetch(`/api/stock?ticker=${t}`),
        fetch(`/api/sparkline?ticker=${t}`)
      ]);
      const stockData = await stockRes.json();
      const sparkData = await sparkRes.json();

      if (!stockData.error) setData(stockData);
      setSparkline(sparkData.candles || null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const close = useCallback(() => { setTicker(null); setData(null); setSparkline(null); }, []);

  const quality = useMemo(() => (data ? computeSpotlightQuality(data) : null), [data]);

  return { ticker, data, loading, sparkline, quality, trigger, close };
}
