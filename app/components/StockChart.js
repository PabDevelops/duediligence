'use client';
import { useState, useEffect, useRef } from 'react';

const RANGES = [
  { label: '1D', value: '1d' },
  { label: '5D', value: '5d' },
  { label: '15D', value: '15d' },
  { label: '1M', value: '1m' },
  { label: '6M', value: '6m' },
  { label: '1Y', value: '1y' },
  { label: '3Y', value: '3y' },
  { label: '5Y', value: '5y' },
];

const CURRENCY_SYMBOLS = { USD: '$', EUR: '€', GBP: '£', JPY: '¥', CNY: '¥', CHF: 'CHF ', CAD: 'C$', AUD: 'A$', HKD: 'HK$', INR: '₹', KRW: '₩', SEK: 'kr', NOK: 'kr', DKK: 'kr' };
const curSym = (code) => !code || code === 'USD' ? '$' : (CURRENCY_SYMBOLS[code] || `${code} `);

export default function StockChart({ ticker, currency }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const [range, setRange] = useState('1y');
  const [mode, setMode] = useState('line');
  const [candles, setCandles] = useState([]);
  const [loading, setLoading] = useState(true);

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

      const chart = createChart(containerRef.current, {
        layout: {
          background: { type: ColorType.Solid, color: '#111111' },
          textColor: '#555555',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 10,
        },
        grid: {
          vertLines: { color: '#1a1a1a' },
          horzLines: { color: '#1a1a1a' },
        },
        crosshair: { mode: 1 },
        rightPriceScale: { borderColor: '#222222' },
        timeScale: { borderColor: '#222222', timeVisible: true },
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
          upColor: '#22c55e',
          downColor: '#ef4444',
          borderUpColor: '#22c55e',
          borderDownColor: '#ef4444',
          wickUpColor: '#22c55e',
          wickDownColor: '#ef4444',
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
          lineColor: '#F59E0B',
          topColor: 'rgba(245, 158, 11, 0.15)',
          bottomColor: 'rgba(245, 158, 11, 0)',
          lineWidth: 2,
        });
        series.setData(candles.map(c => ({
          time: Math.floor(c.t / 1000),
          value: c.c,
        })));
      }

      chart.timeScale().fitContent();

      const handleResize = () => {
        if (containerRef.current && chartRef.current) {
          chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
        }
      };
      window.addEventListener('resize', handleResize);
    };

    init();

    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [candles, mode, loading, currency]);

  return (
    <div style={{ background: 'var(--bg-1)', padding: '16px', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '1px', background: 'var(--border)' }}>
          {RANGES.map(r => (
            <button key={r.value} onClick={() => setRange(r.value)}
              style={{ padding: '4px 8px', fontSize: '10px', letterSpacing: '1px', background: range === r.value ? 'var(--accent)' : 'var(--bg-2)', color: range === r.value ? '#000' : 'var(--text-3)', border: 'none', cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', fontWeight: range === r.value ? 600 : 400 }}>
              {r.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '1px', background: 'var(--border)' }}>
          {['line', 'candles'].map(m => (
            <button key={m} onClick={() => setMode(m)}
              style={{ padding: '4px 10px', fontSize: '10px', letterSpacing: '1px', background: mode === m ? 'var(--accent)' : 'var(--bg-2)', color: mode === m ? '#000' : 'var(--text-3)', border: 'none', cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', fontWeight: mode === m ? 600 : 400 }}>
              {m.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {loading && (
  <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: '11px', letterSpacing: '2px', position: 'absolute', width: '100%' }}>
    LOADING...
  </div>
)}
<div ref={containerRef} style={{ width: '100%', opacity: loading ? 0 : 1, position: 'relative' }} />
    </div>
  );
}