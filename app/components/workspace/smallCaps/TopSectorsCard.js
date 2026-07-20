'use client';
import { useState } from 'react';

function fmtCap(val) {
  if (!val) return '—';
  if (val >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(0)}M`;
  return `$${val}`;
}

// sector/country distribution is computed server-side (app/api/small-caps/radar/route.js's
// buildDistribution) from the real tracked universe — no hardcoded lists or fabricated YoY
// figures here. YoY isn't shown at all: market_cap_snapshots only has one day of history right
// now (see PerformanceAreaChart.js's comment), so there's nothing real to compute a trend from.
// marketCap sum stands in for the old YoY column instead.
export default function TopSectorsCard({ sectorDistribution, countryDistribution, loading }) {
  const [viewMode, setViewMode] = useState('sector');
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const dist = viewMode === 'sector' ? sectorDistribution : countryDistribution;
  const rows = dist?.rows || [];

  return (
    <div style={{
      background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)',
      padding: '16px 20px', display: 'flex', flexDirection: 'column',
      gap: '12px', height: '100%', boxSizing: 'border-box'
    }}>
      {/* Header with View Switcher Pills */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--ws-accent)', letterSpacing: '1px' }}>
            {viewMode === 'sector' ? 'TOP SECTOR DISTRIBUTION' : 'GEOGRAPHIC DISTRIBUTION'}
          </span>
          {dist && (
            <span style={{ fontSize: '9px', color: 'var(--ws-text-3)', fontFamily: "'JetBrains Mono', monospace" }}>
              n={dist.sampleSize.toLocaleString()}
            </span>
          )}
        </div>

        {/* View Switcher Pills */}
        <div style={{ display: 'flex', gap: '2px', background: 'var(--ws-bg-2)', padding: '2px', border: '1px solid var(--ws-border)' }}>
          <button
            onClick={() => setViewMode('sector')}
            style={{
              background: viewMode === 'sector' ? 'var(--ws-accent)' : 'transparent',
              color: viewMode === 'sector' ? 'var(--ws-bg-1)' : 'var(--ws-text-3)',
              border: 'none', padding: '2px 8px', fontSize: '9px', fontWeight: 800, cursor: 'pointer'
            }}
          >
            By Sector
          </button>
          <button
            onClick={() => setViewMode('country')}
            style={{
              background: viewMode === 'country' ? 'var(--ws-accent)' : 'transparent',
              color: viewMode === 'country' ? 'var(--ws-bg-1)' : 'var(--ws-text-3)',
              border: 'none', padding: '2px 8px', fontSize: '9px', fontWeight: 800, cursor: 'pointer'
            }}
          >
            By Country
          </button>
        </div>
      </div>

      {/* Distribution List with Progress Fill Bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, justifyContent: rows.length ? 'space-around' : 'center' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--ws-text-3)', fontSize: '11px' }}>Loading universe breakdown...</div>
        ) : rows.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--ws-text-3)', fontSize: '11px' }}>No {viewMode} data yet.</div>
        ) : rows.map((s, idx) => (
          <div
            key={s.name}
            onMouseEnter={() => setHoveredIdx(idx)}
            onMouseLeave={() => setHoveredIdx(null)}
            style={{
              position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '7px 10px', background: 'var(--ws-bg-2)', border: '1px solid var(--ws-border)',
              cursor: 'pointer', overflow: 'hidden', transition: 'all 0.15s ease'
            }}
          >
            {/* Background Visual Fill Bar */}
            <div style={{
              position: 'absolute', left: 0, top: 0, bottom: 0,
              width: `${s.pct}%`, background: 'rgba(20, 184, 166, 0.12)',
              borderRight: '2px solid var(--ws-accent)', transition: 'width 0.4s ease'
            }} />

            {/* Left Info: Name */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', zIndex: 2, minWidth: 0 }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ws-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</span>
            </div>

            {/* Right Metrics: Market Cap, Percentage & Count */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontFamily: "'JetBrains Mono', monospace", zIndex: 2, flexShrink: 0 }}>
              <span style={{ fontSize: '9px', color: 'var(--ws-text-3)', fontWeight: 700 }}>
                {fmtCap(s.marketCap)}
              </span>
              <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--ws-text)' }}>
                {s.pct.toFixed(1)}%
              </span>
              <span style={{ fontSize: '10px', color: 'var(--ws-text-3)' }}>
                {s.count.toLocaleString()} stocks
              </span>
            </div>

            {/* Hover Tooltip */}
            {hoveredIdx === idx && (
              <div style={{
                position: 'absolute', right: '10px', top: '-24px',
                background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)',
                padding: '2px 8px', fontSize: '9px', fontWeight: 800, color: 'var(--ws-accent)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)', zIndex: 10, fontFamily: "'JetBrains Mono', monospace"
              }}>
                {s.count.toLocaleString()} stocks &middot; {fmtCap(s.marketCap)} combined cap
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
