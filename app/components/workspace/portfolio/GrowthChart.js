'use client';
import { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { formatCurrency } from '../../../../lib/formatters';

const GROWTH_PERIODS = ['1D', '1W', '1M', '3M', '1Y', 'YTD', 'MAX'];

// Returns the earliest date a period's window should start from, or null for MAX (= earliest available data).
function periodStartDate(key, today) {
  const d = new Date(today);
  if (key === '1D') d.setDate(d.getDate() - 1);
  else if (key === '1W') d.setDate(d.getDate() - 7);
  else if (key === '1M') d.setMonth(d.getMonth() - 1);
  else if (key === '3M') d.setMonth(d.getMonth() - 3);
  else if (key === '1Y') d.setFullYear(d.getFullYear() - 1);
  else if (key === 'YTD') return new Date(today.getFullYear(), 0, 1);
  else return null;
  return d;
}

export default function GrowthChart({ snapshots, currentValue, currentCost, rate, symbol }) {
  const [period, setPeriod] = useState('1M');
  const fmtC = (v) => formatCurrency(v * rate, symbol);
  const data = useMemo(() => {
    const points = snapshots.map(s => ({ date: s.date, value: Number(s.value), cost: Number(s.cost) }));
    const today = new Date().toISOString().slice(0, 10);
    if (points.length === 0 || points[points.length - 1].date !== today) {
      points.push({ date: today, value: currentValue, cost: currentCost });
    }
    return points;
  }, [snapshots, currentValue, currentCost]);

  if (data.length < 2) {
    return (
      <div className="border border-ws-border p-4">
        <div style={{ fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: 'var(--ws-text-3)', letterSpacing: '1.5px', marginBottom: '8px' }}>PORTFOLIO GROWTH</div>
        <div style={{ fontSize: '12px', color: 'var(--ws-text-3)', padding: '20px 0', textAlign: 'center' }}>
          Come back tomorrow to start seeing your growth chart — we snapshot your portfolio value daily.
        </div>
      </div>
    );
  }

  const last = data[data.length - 1];
  const target = periodStartDate(period, new Date(last.date + 'T00:00:00'));

  // Walk forward from the oldest snapshot to find the last one on/before the period's start date —
  // that's our baseline. If nothing qualifies (history is shorter than the period), fall back to
  // the earliest snapshot we have, effectively showing "since inception" for that period.
  let baseline = data[0];
  if (target) {
    for (const pt of data) {
      if (new Date(pt.date + 'T00:00:00') <= target) baseline = pt;
      else break;
    }
  }
  const chartData = data.slice(data.indexOf(baseline));
  // Gain is measured as the change in (value - cost) rather than raw value delta, so adding new
  // capital mid-period (which bumps value and cost by the same amount) doesn't get counted as "gain".
  const periodGain = (last.value - last.cost) - (baseline.value - baseline.cost);
  const periodGainPct = baseline.cost > 0 ? (periodGain / baseline.cost) * 100 : null;
  const limitedHistory = !!target && new Date(data[0].date + 'T00:00:00') > target;

  return (
    <div className="border border-ws-border p-4">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
        <div>
          <div style={{ fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: 'var(--ws-text-3)', letterSpacing: '1.5px', marginBottom: '6px' }}>PORTFOLIO GROWTH</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: periodGain >= 0 ? 'var(--ws-accent)' : 'var(--ws-red)' }}>
            {periodGain >= 0 ? '+' : ''}{fmtC(periodGain)}{periodGainPct != null && ` (${periodGainPct >= 0 ? '+' : ''}${periodGainPct.toFixed(1)}%)`}
          </div>
          {limitedHistory && (
            <div style={{ fontSize: '10px', color: 'var(--ws-text-3)', marginTop: '2px' }}>
              Since {new Date(baseline.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} — as far back as we've tracked your portfolio
            </div>
          )}
        </div>
        <div className="flex border border-ws-border overflow-hidden shrink-0">
          {GROWTH_PERIODS.map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              style={{ height: '28px', padding: '0 10px', fontSize: '10px', fontWeight: 700, border: 'none', cursor: 'pointer',
                background: period === p ? 'var(--ws-accent)' : 'var(--ws-bg-1)',
                color: period === p ? 'var(--ws-bg-1)' : 'var(--ws-text-2)' }}>
              {p}
            </button>
          ))}
        </div>
      </div>
      <div style={{ width: '100%', height: '180px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--ws-border)" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: 'var(--ws-text-3)', fontSize: 10 }} tickFormatter={d => new Date(d + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} axisLine={false} tickLine={false} minTickGap={40} />
            <YAxis tick={{ fill: 'var(--ws-text-3)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => fmtC(v)} width={56} />
            <Tooltip formatter={(v, n) => [fmtC(v), n === 'value' ? 'Market value' : 'Cost basis']}
              labelFormatter={d => new Date(d + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
              contentStyle={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', fontSize: 11, borderRadius: 8 }} />
            <Line type="monotone" dataKey="cost" stroke="var(--ws-text-3)" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
            <Line type="monotone" dataKey="value" stroke="var(--ws-accent)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: 'flex', gap: '14px', marginTop: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', color: 'var(--ws-text-3)' }}>
          <span style={{ width: '10px', height: '2px', background: 'var(--ws-accent)', display: 'inline-block' }} /> Market value
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', color: 'var(--ws-text-3)' }}>
          <span style={{ width: '10px', height: '2px', background: 'var(--ws-text-3)', display: 'inline-block', borderTop: '1px dashed var(--ws-text-3)' }} /> Cost basis
        </div>
      </div>
    </div>
  );
}
