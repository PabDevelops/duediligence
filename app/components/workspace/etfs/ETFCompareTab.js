'use client';
import { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { parsePercent, parseAUM, parseVolume } from '../../../../lib/formatters';

const RANGES = [
  { label: '1M', value: '1m' },
  { label: '3M', value: '3m' },
  { label: '1Y', value: '1y' },
  { label: 'YTD', value: 'ytd' },
  { label: 'MAX', value: 'max' },
];

// Fixed 4-color palette so each of up to 4 compared tickers gets a stable,
// distinct line color across renders (accent first, since it's already the
// "primary" color everywhere else in the workspace).
const SERIES_COLORS = ['var(--ws-accent)', '#f59e0b', '#8b5cf6', '#38bdf8'];

// Rows shown in the metrics table. `better` picks which direction is "best"
// so that value can be highlighted — null means purely informational (no
// winner). Raw price is intentionally excluded: it's not comparable across
// tickers priced in different currencies (e.g. USD vs GBp), unlike these
// currency-agnostic ratios.
const METRIC_ROWS = [
  { key: 'expenseRatio', label: 'Expense Ratio', parse: parsePercent, better: 'min' },
  { key: 'yield', label: 'Dividend Yield', parse: parsePercent, better: 'max' },
  { key: 'aum', label: 'AUM', parse: parseAUM, better: 'max' },
  { key: 'volume', label: 'Avg Daily Volume', parse: parseVolume, better: 'max' },
  { key: 'pe', label: 'PE Ratio', parse: null, better: null },
  { key: 'beta', label: 'Beta (1Y)', parse: null, better: null },
  { key: 'issuer', label: 'Issuer', parse: null, better: null },
  { key: 'inception', label: 'Inception Date', parse: null, better: null },
];

function bestIndex(row, etfs) {
  if (!row.better || !row.parse) return -1;
  const values = etfs.map(e => row.parse(e[row.key]));
  const target = row.better === 'min' ? Math.min(...values) : Math.max(...values);
  if (!isFinite(target)) return -1;
  return values.indexOf(target);
}

// Normalizes each ticker's daily closes to "% change from that ticker's first
// available close in the fetched range", then merges them onto the sorted
// union of every date seen across all tickers. Tickers trade on different
// calendars (a London-listed .L fund vs a US fund), so any single date may be
// missing for some tickers — those points are left undefined and the line is
// drawn with connectNulls so a foreign holiday doesn't show as a broken chart.
function buildNormalizedSeries(candlesByTicker, tickers) {
  const perTickerPct = {};
  for (const ticker of tickers) {
    const candles = (candlesByTicker[ticker] || []).filter(c => c.c != null);
    if (candles.length === 0) { perTickerPct[ticker] = new Map(); continue; }
    const base = candles[0].c;
    const map = new Map();
    for (const c of candles) {
      const date = new Date(c.t).toISOString().slice(0, 10);
      map.set(date, base ? ((c.c / base) - 1) * 100 : 0);
    }
    perTickerPct[ticker] = map;
  }

  const allDates = new Set();
  Object.values(perTickerPct).forEach(map => map.forEach((_, date) => allDates.add(date)));
  const sortedDates = [...allDates].sort();

  return sortedDates.map(date => {
    const point = { date };
    for (const ticker of tickers) {
      point[ticker] = perTickerPct[ticker]?.get(date);
    }
    return point;
  });
}

export default function ETFCompareTab({ tickers, etfsList, onAddTicker, onRemoveTicker }) {
  const [range, setRange] = useState('1y');
  const [candlesByTicker, setCandlesByTicker] = useState({});
  const [loadingChart, setLoadingChart] = useState(true);
  const [addValue, setAddValue] = useState('');

  const etfs = useMemo(
    () => tickers.map(t => etfsList.find(e => e.ticker === t)).filter(Boolean),
    [tickers, etfsList]
  );

  const addableOptions = useMemo(
    () => etfsList.filter(e => !tickers.includes(e.ticker)).sort((a, b) => a.ticker.localeCompare(b.ticker)),
    [etfsList, tickers]
  );

  useEffect(() => {
    if (tickers.length < 2) { setLoadingChart(false); return; }
    let active = true;
    setLoadingChart(true);
    Promise.all(tickers.map(t =>
      fetch(`/api/chart?ticker=${t}&range=${range}`)
        .then(r => r.json())
        .then(d => [t, d.candles || []])
        .catch(() => [t, []])
    )).then(entries => {
      if (!active) return;
      setCandlesByTicker(Object.fromEntries(entries));
      setLoadingChart(false);
    });
    return () => { active = false; };
  }, [tickers, range]);

  const chartData = useMemo(
    () => buildNormalizedSeries(candlesByTicker, tickers),
    [candlesByTicker, tickers]
  );

  const handleAdd = (e) => {
    const ticker = e.target.value;
    if (ticker) onAddTicker(ticker);
    setAddValue('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* SELECTED TICKERS + ADD CONTROL */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        {etfs.map((e, i) => (
          <div key={e.ticker} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', background: 'var(--ws-bg-2)', border: `1px solid ${SERIES_COLORS[i]}`, borderRadius: '20px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: SERIES_COLORS[i] }} />
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ws-text)' }}>{e.ticker}</span>
            <button onClick={() => onRemoveTicker(e.ticker)} style={{ background: 'none', border: 'none', color: 'var(--ws-text-3)', cursor: 'pointer', fontSize: '11px', padding: 0, lineHeight: 1 }}>✕</button>
          </div>
        ))}
        {tickers.length < 4 && (
          <select value={addValue} onChange={handleAdd}
            style={{ height: '28px', padding: '0 8px', fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", border: '1px dashed var(--ws-border)', borderRadius: '20px', background: 'var(--ws-bg-2)', color: 'var(--ws-text-2)', outline: 'none', cursor: 'pointer' }}>
            <option value="">+ Add ETF to compare</option>
            {addableOptions.map(e => <option key={e.ticker} value={e.ticker}>{e.ticker} — {e.name}</option>)}
          </select>
        )}
      </div>

      {tickers.length < 2 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ws-text-3)', fontSize: '12px', border: '1px dashed var(--ws-border)' }}>
          Select at least one more ETF — check the boxes in the table on the left, or use &quot;+ Add ETF to compare&quot; above.
        </div>
      ) : (
        <>
          {/* PERFORMANCE CHART */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--ws-text-3)', letterSpacing: '1px' }}>NORMALIZED PERFORMANCE (% CHANGE)</span>
              <div style={{ display: 'flex', gap: '1px', background: 'var(--ws-border)' }}>
                {RANGES.map(r => (
                  <button key={r.value} onClick={() => setRange(r.value)}
                    style={{ padding: '4px 10px', fontSize: '10px', fontWeight: range === r.value ? 700 : 400, background: range === r.value ? 'var(--ws-accent)' : 'var(--ws-bg-2)', color: range === r.value ? 'var(--ws-bg-1)' : 'var(--ws-text-3)', border: 'none', cursor: 'pointer' }}>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ width: '100%', height: '280px' }}>
              {loadingChart ? (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ws-text-3)', fontSize: '11px', letterSpacing: '2px' }}>LOADING...</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke="var(--ws-border)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: 'var(--ws-text-3)', fontSize: 10 }} tickFormatter={d => new Date(d + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} axisLine={false} tickLine={false} minTickGap={40} />
                    <YAxis tick={{ fill: 'var(--ws-text-3)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v.toFixed(0)}%`} width={44} />
                    <Tooltip formatter={(v, n) => [v != null ? `${v.toFixed(2)}%` : '—', n]}
                      labelFormatter={d => new Date(d + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      contentStyle={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', fontSize: 11, borderRadius: 8 }} />
                    {tickers.map((t, i) => (
                      <Line key={t} type="monotone" dataKey={t} stroke={SERIES_COLORS[i]} strokeWidth={2} dot={false} connectNulls />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* METRICS TABLE */}
          <div style={{ border: '1px solid var(--ws-border)', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: 'var(--ws-bg-2)' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '10px', color: 'var(--ws-text-3)', fontWeight: 700, borderBottom: '1px solid var(--ws-border)' }}>METRIC</th>
                  {etfs.map((e, i) => (
                    <th key={e.ticker} style={{ padding: '8px 12px', textAlign: 'right', fontSize: '10px', color: SERIES_COLORS[i], fontWeight: 700, borderBottom: '1px solid var(--ws-border)', whiteSpace: 'nowrap' }}>{e.ticker}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {METRIC_ROWS.map((row, idx) => {
                  const winner = bestIndex(row, etfs);
                  return (
                    <tr key={row.key} style={{ background: idx % 2 === 0 ? 'var(--ws-bg-1)' : 'var(--ws-bg-2)' }}>
                      <td style={{ padding: '8px 12px', color: 'var(--ws-text-3)', fontWeight: 600, borderBottom: '1px solid var(--ws-border)' }}>{row.label}</td>
                      {etfs.map((e, i) => (
                        <td key={e.ticker} style={{
                          padding: '8px 12px', textAlign: 'right', borderBottom: '1px solid var(--ws-border)',
                          color: i === winner ? 'var(--ws-accent)' : 'var(--ws-text)',
                          fontWeight: i === winner ? 800 : 500,
                        }}>
                          {e[row.key] ?? '—'}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* HOLDINGS & SECTORS */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${etfs.length}, 1fr)`, gap: '16px' }}>
            {etfs.map((e, i) => (
              <div key={e.ticker} style={{ border: '1px solid var(--ws-border)' }}>
                <div style={{ background: 'var(--ws-bg-2)', borderBottom: '1px solid var(--ws-border)', padding: '8px 12px' }}>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: SERIES_COLORS[i], letterSpacing: '1px' }}>{e.ticker} · TOP HOLDINGS</span>
                </div>
                <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {e.holdings.length === 0 ? (
                    <span style={{ fontSize: '11px', color: 'var(--ws-text-3)' }}>No holdings reported.</span>
                  ) : e.holdings.slice(0, 5).map((h, hi) => (
                    <div key={hi} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                      <span style={{ color: 'var(--ws-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '8px' }}>{h.name}</span>
                      <span style={{ color: 'var(--ws-text)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h.weight}</span>
                    </div>
                  ))}
                </div>
                <div style={{ background: 'var(--ws-bg-2)', borderTop: '1px solid var(--ws-border)', borderBottom: '1px solid var(--ws-border)', padding: '8px 12px' }}>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: SERIES_COLORS[i], letterSpacing: '1px' }}>TOP SECTORS</span>
                </div>
                <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {e.sectors.length === 0 ? (
                    <span style={{ fontSize: '11px', color: 'var(--ws-text-3)' }}>No sector data reported.</span>
                  ) : e.sectors.slice(0, 5).map((s, si) => (
                    <div key={si} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                      <span style={{ color: 'var(--ws-text-2)' }}>{s.name}</span>
                      <span style={{ color: 'var(--ws-text)', fontWeight: 600 }}>{s.weight}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
