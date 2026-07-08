'use client';
import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const RANGES = [
  { label: '1D', range: '1d' },
  { label: '1W', range: '1w' },
  { label: '1M', range: '1m' },
  { label: '3M', range: '3m' },
  { label: '1Y', range: '1y' },
  { label: 'YTD', range: 'ytd' },
  { label: 'MAX', range: 'max' },
];

const CURRENCY_SYMBOLS = { USD: '$', EUR: '€', GBP: '£', JPY: '¥', CNY: '¥', CHF: 'CHF ', CAD: 'C$', AUD: 'A$', HKD: 'HK$', INR: '₹', KRW: '₩', SEK: 'kr', NOK: 'kr', DKK: 'kr' };
const curSym = (code) => !code || code === 'USD' ? '$' : (CURRENCY_SYMBOLS[code] || `${code} `);

const CustomTooltip = ({ active, payload, currency }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', padding: '4px 8px', fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: 'var(--text)' }}>
      {curSym(currency)}{payload[0].value?.toFixed(2)}
    </div>
  );
};

export default function SparklineHeader({ ticker, currency }) {
  const [range, setRange] = useState('1m');
  const [data, setData] = useState(null);

  useEffect(() => {
    let active = true;
    setData(null);
    fetch(`/api/sparkline?ticker=${ticker}&range=${range}`)
      .then(r => r.json())
      .then(d => {
        if (active) {
          setData(d.candles || null);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
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
            style={{ padding: '2px 8px', fontSize: '9px', letterSpacing: '1px', background: range === r.range ? 'var(--accent)' : 'transparent', color: range === r.range ? '#000' : 'var(--text-3)', border: 'none', cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', fontWeight: range === r.range ? 700 : 400 }}>
            {r.label}
          </button>
        ))}
      </div>
      {/* Chart */}
      {data && data.length > 1 ? (
        <ResponsiveContainer width="100%" height={48}>
          <LineChart data={chartData} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
            <YAxis domain={['auto', 'auto']} hide />
            <Tooltip content={(props) => <CustomTooltip {...props} currency={currency} />} />
            <Line type="monotone" dataKey="v" stroke={lineColor} strokeWidth={1.5} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div style={{ height: 48, background: 'var(--bg-2)', opacity: 0.3 }} />
      )}
    </div>
  );
}