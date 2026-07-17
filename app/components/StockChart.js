'use client';

import { useState, useEffect, useRef } from 'react';

const RANGES = [
  { label: '1D', value: '1d' },
  { label: '1W', value: '1w' },
  { label: '1M', value: '1m' },
  { label: '3M', value: '3m' },
  { label: '1Y', value: '1y' },
  { label: 'YTD', value: 'ytd' },
  { label: 'MAX', value: 'max' },
];

const CURRENCY_SYMBOLS = { USD: '$', EUR: '€', GBP: '£', JPY: '¥', CNY: '¥', CHF: 'CHF ', CAD: 'C$', AUD: 'A$', HKD: 'HK$', INR: '₹', KRW: '₩', SEK: 'kr', NOK: 'kr', DKK: 'kr' };
const curSym = (code) => !code || code === 'USD' ? '$' : (CURRENCY_SYMBOLS[code] || `${code} `);

// Reads a CSS custom property resolved at `el`'s location in the DOM — lets a canvas-based
// chart (which can't just inherit CSS vars the way DOM elements do) still follow the current
// theme. Tries the workspace variable first, falls back to the marketing one, since this
// component renders inside both `.workspace` (stock page, light/dark) and the blog (light
// only, no --ws-* vars defined).
function cssVar(el, ...names) {
  const style = getComputedStyle(el);
  for (const name of names) {
    const v = style.getPropertyValue(name).trim();
    if (v) return v;
  }
  return null;
}

export default function StockChart({ ticker, currency }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const resizeObserverRef = useRef(null);
  const [range, setRange] = useState('1y');
  const [mode, setMode] = useState('line');
  const [candles, setCandles] = useState([]);
  const [loading, setLoading] = useState(true);
  // Bumped whenever the workspace theme toggle flips data-ws-theme, so the effect below
  // re-reads CSS vars and rebuilds the chart with the new theme's colors instead of being
  // stuck with whatever was resolved at first mount.
  const [themeVersion, setThemeVersion] = useState(0);

  useEffect(() => {
    const observer = new MutationObserver(() => setThemeVersion(v => v + 1));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-ws-theme'] });
    return () => observer.disconnect();
  }, []);

  // Fetch data
  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/chart?ticker=${ticker}&range=${range}`)
      .then(r => r.json())
      .then(d => {
        if (active) {
          setCandles(d.candles || []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [ticker, range]);

  // Keep the chart reasonably live without a full reload — refetch every 15min,
  // skipped while the tab is in the background (same visibility-aware polling
  // pattern as Home's other live widgets, see app/(workspace)/home/page.js).
  // No loading flag here so a background refresh doesn't flash "LOADING..." over the chart.
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      fetch(`/api/chart?ticker=${ticker}&range=${range}`)
        .then(r => r.json())
        .then(d => setCandles(d.candles || []))
        .catch(() => {});
    }, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [ticker, range]);

  // Create/update chart when data arrives
  useEffect(() => {
    if (loading || !candles.length || !containerRef.current) return;

    console.log('Chart effect running', { loading, candlesLength: candles.length, hasContainer: !!containerRef.current, containerWidth: containerRef.current?.clientWidth });

    const init = async () => {
      const { createChart, ColorType } = await import('lightweight-charts');

      // Remove old chart
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }

      const currencySymbol = curSym(currency);

      // Resolve theme colors from wherever this chart actually sits — .workspace (light or
      // dark) on the stock page, or the (light-only) marketing palette on the blog — instead
      // of hardcoding a single dark theme the chart no longer has a background of its own.
      const el = containerRef.current;
      const textColor = cssVar(el, '--ws-text-3', '--text-3') || '#888888';
      const gridColor = cssVar(el, '--ws-border', '--border') || 'rgba(128,128,128,0.15)';
      const green = '#10b981';
      const red = cssVar(el, '--ws-red', '--red') || '#ef4444';

      const first = candles[0]?.c;
      const last = candles[candles.length - 1]?.c;
      const trendColor = last >= first ? green : red;

      const chart = createChart(containerRef.current, {
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor,
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 10,
          // lightweight-charts renders a "Charting by TradingView" attribution link by
          // default — this is our own chart, on our own data, so it comes off.
          attributionLogo: false,
        },
        grid: {
          vertLines: { color: gridColor },
          horzLines: { color: gridColor },
        },
        crosshair: { mode: 1 },
        rightPriceScale: { borderColor: gridColor },
        timeScale: { borderColor: gridColor, timeVisible: true },
        localization: {
          priceFormatter: (price) => {
            return `${currencySymbol}${price < 1.0 ? price.toFixed(4) : price.toFixed(2)}`;
          },
        },
        width: containerRef.current.clientWidth,
        height: 320,
      });

      chartRef.current = chart;

      if (mode === 'candles') {
        const { CandlestickSeries } = await import('lightweight-charts');
        const series = chart.addSeries(CandlestickSeries, {
          upColor: green,
          downColor: red,
          borderUpColor: green,
          borderDownColor: red,
          wickUpColor: green,
          wickDownColor: red,
        });
        series.setData(candles.map(c => ({
          time: Math.floor(c.t / 1000),
          open: c.o,
          high: c.h,
          low: c.l,
          close: c.c,
        })));
      } else {
        const { AreaSeries } = await import('lightweight-charts');
        const series = chart.addSeries(AreaSeries, {
          lineColor: trendColor,
          topColor: trendColor === green ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
          bottomColor: trendColor === green ? 'rgba(16, 185, 129, 0)' : 'rgba(239, 68, 68, 0)',
          lineWidth: 2,
        });
        series.setData(candles.map(c => ({
          time: Math.floor(c.t / 1000),
          value: c.c,
        })));
      }

      chart.timeScale().fitContent();

      // ResizeObserver instead of a window 'resize' listener: this chart's container can
      // change width without the window itself resizing — e.g. Home's chart-layout picker
      // changing the grid's column count, or the sidebar collapsing.
      const resizeObserver = new ResizeObserver(() => {
        if (containerRef.current && chartRef.current) {
          chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
        }
      });
      resizeObserver.observe(containerRef.current);
      resizeObserverRef.current = resizeObserver;
    };

    init();

    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [candles, mode, loading, currency, themeVersion]);

  // var(--ws-X, var(--X)) throughout: this component renders both inside .workspace
  // (stock page, where --ws-* carries the light/dark toggle) and on the blog (marketing-only
  // light theme, no --ws-* vars defined) — the fallback picks whichever is actually in scope.
  return (
    <div style={{ background: 'var(--ws-bg-1, var(--bg-1))', padding: '16px', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '1px', background: 'var(--ws-border, var(--border))' }}>
          {RANGES.map(r => (
            <button key={r.value} onClick={() => setRange(r.value)}
              style={{ padding: '4px 8px', fontSize: '10px', letterSpacing: '1px', background: range === r.value ? 'var(--ws-accent, var(--accent))' : 'var(--ws-bg-2, var(--bg-2))', color: range === r.value ? '#000' : 'var(--ws-text-3, var(--text-3))', border: 'none', cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', fontWeight: range === r.value ? 600 : 400 }}>
              {r.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '1px', background: 'var(--ws-border, var(--border))' }}>
          {['line', 'candles'].map(m => (
            <button key={m} onClick={() => setMode(m)}
              style={{ padding: '4px 10px', fontSize: '10px', letterSpacing: '1px', background: mode === m ? 'var(--ws-accent, var(--accent))' : 'var(--ws-bg-2, var(--bg-2))', color: mode === m ? '#000' : 'var(--ws-text-3, var(--text-3))', border: 'none', cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', fontWeight: mode === m ? 600 : 400 }}>
              {m.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {loading && (
  <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ws-text-3, var(--text-3))', fontSize: '11px', letterSpacing: '2px', position: 'absolute', width: '100%' }}>
    LOADING...
  </div>
)}
<div ref={containerRef} style={{ width: '100%', opacity: loading ? 0 : 1, position: 'relative' }} />
    </div>
  );
}