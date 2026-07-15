'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Treemap, ResponsiveContainer } from 'recharts';

// Fixed dark stops, independent of the app's light/dark theme toggle — like a candlestick
// chart, this map is a self-contained colored canvas (Finviz's own map is dark regardless of
// site theme too), not text-on-background that needs to stay readable against a page bg.
// Green matches the app's own teal accent instead of a generic green, red is desaturated
// enough to read clearly against the near-black cell borders. Linear 2-stop interpolation
// (red→neutral→green), clamped to ±3% same as Finviz's own map legend.
function heatColor(pct) {
  if (pct == null) return '#2a2e35';
  const c = Math.max(-3, Math.min(3, pct));
  const neg = [196, 62, 62], zero = [58, 63, 75], pos = [29, 158, 117];
  const [r0, g0, b0] = c < 0 ? neg : zero;
  const [r1, g1, b1] = c < 0 ? zero : pos;
  const t = c < 0 ? (c + 3) / 3 : c / 3;
  return `rgb(${Math.round(r0 + (r1 - r0) * t)}, ${Math.round(g0 + (g1 - g0) * t)}, ${Math.round(b0 + (b1 - b0) * t)})`;
}

// Custom cell renderer. Recharts wraps the data array in an implicit root, and possibly an
// intermediate node too — verified via a props dump that leaf (stock) nodes always land at
// depth 2 with priceChangePct/ticker/size present, but non-leaf depths aren't reliably just
// "1" (both a plain `depth === 1` check and a `children`-presence check still let a
// priceChangePct-less node fall into the leaf branch and crash on .toFixed). Checking
// "not depth 2" instead of "is a specific non-leaf depth" is the only check confirmed safe.
function HeatCell({ depth, x, y, width, height, name, priceChangePct, ticker, onSelect }) {
  if (depth !== 2) {
    return (
      <g>
        <rect x={x} y={y} width={width} height={height} fill="#14171c" stroke="#0b0f0e" strokeWidth={2} />
        {width > 40 && height > 14 && (
          <text x={x + 4} y={y + 11} fontSize={9} fontWeight={700} fill="#8a97a8"
            style={{ letterSpacing: '0.5px', fontFamily: "'JetBrains Mono', monospace" }}>
            {String(name || '').toUpperCase()}
          </text>
        )}
      </g>
    );
  }
  const showTicker = width > 22 && height > 13;
  const showPct = width > 46 && height > 30;
  return (
    <g style={{ cursor: 'pointer' }} onClick={() => onSelect(ticker)}>
      <rect x={x} y={y} width={width} height={height} fill={heatColor(priceChangePct)} stroke="#0b0f0e" strokeWidth={1} />
      {showTicker && (
        <text x={x + width / 2} y={y + height / 2 + (showPct ? -4 : 4)} textAnchor="middle"
          fontSize={Math.max(9, Math.min(14, width / 6))} fontWeight={700} fill="#fff"
          style={{ fontFamily: "'JetBrains Mono', monospace", pointerEvents: 'none' }}>
          {name}
        </text>
      )}
      {showPct && (
        <text x={x + width / 2} y={y + height / 2 + 12} textAnchor="middle" fontSize={10} fill="rgba(255,255,255,0.85)"
          style={{ fontFamily: "'JetBrains Mono', monospace", pointerEvents: 'none' }}>
          {priceChangePct > 0 ? '+' : ''}{priceChangePct.toFixed(2)}%
        </text>
      )}
    </g>
  );
}

// Groups by `sector` only (not sector → industry → stock like Finviz's map) — the app's data
// pipeline stores a single flat classification (Finnhub's finnhubIndustry) in both the
// `sector` and `industry` fields for most tickers, so a fake extra nesting level would mostly
// just duplicate the same label twice. The `sector` values themselves are already fairly
// granular (Semiconductors, Biotechnology, Metals & Mining, ...), closer to Finviz's industry
// tier than its sector tier.
export default function MarketHeatmap() {
  const router = useRouter();
  const [stocks, setStocks] = useState(null);

  useEffect(() => {
    fetch('/api/heatmap').then(r => r.json()).then(d => setStocks(d.stocks || [])).catch(() => setStocks([]));
  }, []);

  if (stocks === null) {
    return <div style={{ padding: '32px', textAlign: 'center', color: 'var(--ws-text-3)', fontSize: '12px' }}>Loading map…</div>;
  }
  if (stocks.length === 0) {
    return <div style={{ padding: '32px', textAlign: 'center', color: 'var(--ws-text-3)', fontSize: '12px' }}>No fresh data yet — the map fills in as tickers get viewed across the app.</div>;
  }

  const bySector = {};
  stocks.forEach(s => {
    if (!s.sector) return;
    (bySector[s.sector] ??= []).push({ name: s.ticker, ticker: s.ticker, size: s.marketCap, priceChangePct: s.priceChangePct });
  });
  const data = Object.entries(bySector).map(([name, children]) => ({ name, children }));

  return (
    <div style={{ width: '100%', height: '520px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <Treemap
          data={data}
          dataKey="size"
          isAnimationActive={false}
          content={<HeatCell onSelect={(ticker) => router.push(`/stock/${ticker}`)} />}
        />
      </ResponsiveContainer>
    </div>
  );
}
