'use client';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const TIER_COLORS = { Small: '#5eead4', Micro: '#38bdf8', Nano: '#ef4444' };

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
      <div style={{ fontSize: '10px', color: 'var(--ws-text-3)', marginTop: '2px' }}>{p.count.toLocaleString()} stocks · {p.share}% of tracked cap</div>
    </div>
  );
};

// Was a fully-fabricated multi-timeframe area chart (Daily/Weekly/Monthly/Yearly switcher,
// Buybacks/Dividends/CapEx %, a "vs Russell 2000" overlay) with hardcoded numbers that never
// moved regardless of what was in the database. None of that is honestly computable yet:
// market_cap_snapshots only has two days of history so far (2026-07-20 seed run + 2026-07-21),
// and the seed day only covers 677 of the ~9,971 tracked tickers — not a clean baseline to
// chart a trend against yet. This renders what's honestly real right now — the current
// market-cap composition across the tracked small/micro/nano universe — as a gradient donut
// instead of the old plain bar chart, and will grow a real trend line once daily snapshots
// accumulate past that first anomalous day.
export default function PerformanceAreaChart({ totalCapFormatted, totalCount, small, micro, nano, smallCap, microCap, nanoCap, trackingSince }) {
  const totalCap = (smallCap || 0) + (microCap || 0) + (nanoCap || 0);
  const share = (v) => (totalCap > 0 ? +((v / totalCap) * 100).toFixed(1) : 0);

  const chartData = [
    { name: 'Small', label: 'SMALL ($300M-$2B)', count: small || 0, marketCap: smallCap || 0, color: TIER_COLORS.Small, share: share(smallCap) },
    { name: 'Micro', label: 'MICRO ($50M-$300M)', count: micro || 0, marketCap: microCap || 0, color: TIER_COLORS.Micro, share: share(microCap) },
    { name: 'Nano', label: 'NANO (<$50M)', count: nano || 0, marketCap: nanoCap || 0, color: TIER_COLORS.Nano, share: share(nanoCap) },
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

      {/* Gradient donut (real composition) + per-tier legend/breakdown */}
      <div style={{ flex: 1, minHeight: '140px', display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div style={{ width: '150px', height: '150px', flexShrink: 0, position: 'relative' }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <defs>
                {chartData.map(t => (
                  <linearGradient key={t.name} id={`capGradient${t.name}`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={t.color} stopOpacity={1} />
                    <stop offset="100%" stopColor={t.color} stopOpacity={0.45} />
                  </linearGradient>
                ))}
              </defs>
              <Pie
                data={chartData}
                dataKey="marketCap"
                nameKey="name"
                innerRadius="64%"
                outerRadius="100%"
                paddingAngle={3}
                stroke="var(--ws-bg-1)"
                strokeWidth={2}
              >
                {chartData.map(t => <Cell key={t.name} fill={`url(#capGradient${t.name})`} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            textAlign: 'center', pointerEvents: 'none'
          }}>
            <div style={{ fontSize: '9px', fontWeight: 800, color: 'var(--ws-text-3)', letterSpacing: '0.5px' }}>TRACKED</div>
            <div style={{ fontSize: '18px', fontWeight: 900, color: 'var(--ws-text)', lineHeight: 1.2 }}>{(totalCount || 0).toLocaleString()}</div>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {chartData.map(t => (
            <div key={t.name}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: t.color, flexShrink: 0 }} />
                  <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--ws-text-2)' }}>{t.label}</span>
                </div>
                <span style={{ fontSize: '12px', fontWeight: 800, color: t.color, fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 }}>
                  {fmtCap(t.marketCap)}
                </span>
              </div>
              <div style={{ height: '4px', width: '100%', background: 'var(--ws-bg-2)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${t.share}%`, background: t.color, transition: 'width 0.4s ease' }} />
              </div>
              <div style={{ fontSize: '9px', color: 'var(--ws-text-3)', marginTop: '2px' }}>
                {t.count.toLocaleString()} stocks &middot; {t.share}% of tracked cap
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ color: 'var(--ws-text-3)', fontSize: '9px', textAlign: 'center' }}>
        {trackingSince ? `Daily snapshots tracked since ${trackingSince} — a historical trend line will build up here over time.` : 'Snapshot tracking starts once the daily cap-tier cron runs.'}
      </div>
    </div>
  );
}
