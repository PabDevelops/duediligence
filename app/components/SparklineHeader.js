'use client';
import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const RANGES = [
  { label: '5D', range: '5d', interval: '1d' },
  { label: '1M', range: '1mo', interval: '1d' },
  { label: '3M', range: '3mo', interval: '1d' },
  { label: '6M', range: '6mo', interval: '1wk' },
  { label: '1Y', range: '1y', interval: '1wk' },
];

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', padding: '4px 8px', fontSize: '10px', fontFamily: 'IBM Plex Mono, monospace', color: 'var(--text)' }}>
      ${payload[0].value?.toFixed(2)}
    </div>
  );
};

export default function SparklineHeader({ ticker }) {
  const [range, setRange] = useState('1mo');
  const [data, setData] = useState(null);

  useEffect(() => {
    setData(null);
    fetch(`/api/sparkline?ticker=${ticker}&range=${range}`)
      .then(r => r.json())
      .then(d => setData(d.candles || null))
      .catch(() => {});
  }, [ticker, range]);

  const first = data?.[0]?.c;
  const last = data?.[data.length - 1]?.c;
  const isUp = last >= first;
  const lineColor = isUp ? 'var(--green)' : 'var(--red)';
  const chartData = data?.map(d => ({ v: d.c })) || [];

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      {/* Range selector */}
      <div style={{ display: 'flex', gap: '1px', marginBottom: '6px' }}>
        {RANGES.map(r => (
          <button key={r.label} onClick={() => setRange(r.range)}
            style={{ padding: '2px 8px', fontSize: '9px', letterSpacing: '1px', background: range === r.range ? 'var(--accent)' : 'transparent', color: range === r.range ? '#000' : 'var(--text-3)', border: 'none', cursor: 'pointer', fontFamily: 'IBM Plex Mono, monospace', fontWeight: range === r.range ? 700 : 400 }}>
            {r.label}
          </button>
        ))}
      </div>
      {/* Chart */}
      {data && data.length > 1 ? (
        <ResponsiveContainer width="100%" height={48}>
          <LineChart data={chartData} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
            <YAxis domain={['auto', 'auto']} hide />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="v" stroke={lineColor} strokeWidth={1.5} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div style={{ height: 48, background: 'var(--bg-2)', opacity: 0.3 }} />
      )}
    </div>
  );
}