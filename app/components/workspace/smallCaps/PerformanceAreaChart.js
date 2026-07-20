'use client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const TIER_COLORS = { Small: 'var(--ws-text-2)', Micro: 'var(--ws-text-3)', Nano: '#ef4444' };

function fmtCap(val) {
  if (!val) return '$0';
  if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(0)}M`;
  return `$${val}`;
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div style={{
      background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)',
      padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)', color: 'var(--ws-text)'
    }}>
      <div style={{ fontSize: '11px', fontWeight: 800, color: p.color, marginBottom: '4px' }}>{p.name} Cap</div>
      <div style={{ fontSize: '14px', fontWeight: 900 }}>{fmtCap(p.marketCap)}</div>
      <div style={{ fontSize: '10px', color: 'var(--ws-text-3)', marginTop: '2px' }}>{p.count.toLocaleString()} stocks</div>
    </div>
  );
};

// Was a fully-fabricated multi-timeframe area chart (Daily/Weekly/Monthly/Yearly switcher,
// Buybacks/Dividends/CapEx %, a "vs Russell 2000" overlay) with hardcoded numbers that never
// moved regardless of what was in the database. None of that is honestly computable yet:
// market_cap_snapshots only has one day of history (tracking started today, see
// `trackingSince`), and stock_cache doesn't track buybacks/dividends/capex at all. This shows
// what actually is real right now — the current market-cap breakdown across the tracked
// small/micro/nano universe — and will grow a real trend line once daily snapshots accumulate.
export default function PerformanceAreaChart({ totalCapFormatted, totalCount, small, micro, nano, smallCap, microCap, nanoCap, trackingSince }) {
  const chartData = [
    { name: 'Small', label: 'SMALL ($300M-$2B)', count: small || 0, marketCap: smallCap || 0, color: TIER_COLORS.Small },
    { name: 'Micro', label: 'MICRO ($50M-$300M)', count: micro || 0, marketCap: microCap || 0, color: TIER_COLORS.Micro },
    { name: 'Nano', label: 'NANO (<$50M)', count: nano || 0, marketCap: nanoCap || 0, color: TIER_COLORS.Nano },
  ];

  return (
    <div style={{
      background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)',
      padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px', height: '100%', boxSizing: 'border-box'
    }}>
      {/* Header */}
      <div>
        <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--ws-accent)', letterSpacing: '1px' }}>
          UNIVERSE CAPITALIZATION
        </span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginTop: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '32px', fontWeight: 900, color: 'var(--ws-text)', lineHeight: 1 }}>
            {totalCapFormatted || '$0'}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--ws-text-3)' }}>
            Combined market cap &middot; {(totalCount || 0).toLocaleString()} tracked stocks
          </span>
        </div>
      </div>

      {/* Per-tier breakdown bars */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', padding: '10px 0', borderTop: '1px solid var(--ws-border)', borderBottom: '1px solid var(--ws-border)' }}>
        {chartData.map(t => (
          <div key={t.name} style={{ padding: '4px 8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--ws-text-2)' }}>{t.label}</span>
            </div>
            <div style={{ fontSize: '15px', fontWeight: 800, color: t.color, fontFamily: "'JetBrains Mono', monospace" }}>{fmtCap(t.marketCap)}</div>
            <div style={{ fontSize: '9px', color: 'var(--ws-text-3)', marginTop: '2px' }}>{t.count.toLocaleString()} stocks</div>
          </div>
        ))}
      </div>

      {/* Real bar chart — cap by tier, not a fabricated trend line */}
      <div style={{ flex: 1, minHeight: '140px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--ws-text-3)' }} axisLine={{ stroke: 'var(--ws-border)' }} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: 'var(--ws-text-3)' }} axisLine={false} tickLine={false} tickFormatter={fmtCap} width={54} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--ws-bg-2)' }} />
            <Bar dataKey="marketCap" radius={[2, 2, 0, 0]}>
              {chartData.map(t => <Cell key={t.name} fill={t.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ color: 'var(--ws-text-3)', fontSize: '9px', textAlign: 'center' }}>
        {trackingSince ? `Daily snapshots tracked since ${trackingSince} — a historical trend line will build up here over time.` : 'Snapshot tracking starts once the daily cap-tier cron runs.'}
      </div>
    </div>
  );
}
