'use client';
import { useState } from 'react';

// stock_cache only stores annual FCF history (fiscal-year keyed), never quarterly -- so this
// is a real per-fiscal-year series (app/api/small-caps/radar/route.js's buildFcfConsistency),
// not the "8 quarters" the original mockup implied. Coverage is thin today (fcfHistory only
// exists for tickers that have gone through a full /api/stock fetch at least once), so every
// number here carries its real sample size instead of implying full-universe coverage.
export default function QuarterlyEqualizer({ fcfConsistency, loading }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const series = fcfConsistency?.series || [];
  const sampleSize = fcfConsistency?.sampleSize ?? 0;
  const consistentCount = fcfConsistency?.consistentCount ?? 0;
  const consistentPct = sampleSize > 0 ? Math.round((consistentCount / sampleSize) * 100) : 0;
  const yearRange = series.length ? `${series[0].year}–${series[series.length - 1].year}` : '';

  return (
    <div style={{
      background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)',
      padding: '16px 20px', display: 'flex', flexDirection: 'column',
      height: '100%', boxSizing: 'border-box', gap: '12px', position: 'relative'
    }}>
      {/* Top Header */}
      <div>
        <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--ws-accent)', letterSpacing: '1px' }}>
          FCF CONSISTENCY {yearRange && `(${yearRange})`}
        </span>
      </div>

      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ws-text-3)', fontSize: '11px' }}>
          Loading FCF history...
        </div>
      ) : series.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ws-text-3)', fontSize: '11px', textAlign: 'center', padding: '0 10px' }}>
          No FCF history tracked yet — this fills in as more small/micro/nano tickers get their first full financial fetch.
        </div>
      ) : (
        <>
          {/* Headline KPI */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px', flex: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: '105px', flexShrink: 0 }}>
              <span style={{ fontSize: '32px', fontWeight: 900, color: 'var(--ws-text)', lineHeight: 1 }}>{consistentPct}%</span>
              <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--ws-accent)', marginTop: '4px', letterSpacing: '0.5px' }}>
                FCF-Positive Every Year
              </span>
              <span style={{ fontSize: '9px', color: 'var(--ws-text-3)', marginTop: '2px', fontFamily: "'JetBrains Mono', monospace" }}>
                {consistentCount} of {sampleSize} stocks with history
              </span>
            </div>

            {/* Per-year bars — minWidth: 0 + overflowX: auto, same reasoning as the dashboard
                grid fix: a handful of year labels can still exceed a narrow mobile drawer, so
                this degrades to a contained horizontal scroll instead of clipping silently. */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', overflowX: 'auto' }}>
              <div style={{ display: 'flex', gap: '8px', width: '100%', justifyContent: 'space-around' }}>
                {series.map((yr, idx) => {
                  const isHovered = hoveredIdx === idx;
                  return (
                    <div
                      key={yr.year}
                      onMouseEnter={() => setHoveredIdx(idx)}
                      onMouseLeave={() => setHoveredIdx(null)}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                        cursor: 'pointer', padding: '2px', background: isHovered ? 'var(--ws-bg-2)' : 'transparent',
                        position: 'relative'
                      }}
                    >
                      <div style={{ position: 'relative', width: '14px', height: '60px', background: 'var(--ws-bg-2)', display: 'flex', alignItems: 'flex-end' }}>
                        <div style={{
                          width: '100%', height: `${yr.pct}%`, minHeight: yr.total > 0 ? '2px' : 0,
                          background: isHovered ? 'var(--ws-accent)' : 'var(--ws-text-2)',
                          transition: 'height 0.3s ease, background 0.2s ease'
                        }} />
                      </div>
                      <span style={{ fontSize: '8px', color: isHovered ? 'var(--ws-accent)' : 'var(--ws-text-3)', fontFamily: "'JetBrains Mono', monospace" }}>
                        {yr.year}
                      </span>

                      {isHovered && (
                        <div style={{
                          position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
                          background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)',
                          padding: '6px 10px', fontSize: '9px', color: 'var(--ws-text)',
                          boxShadow: '0 8px 24px rgba(0,0,0,0.5)', zIndex: 40, whiteSpace: 'nowrap', marginBottom: '6px'
                        }}>
                          <div style={{ fontWeight: 800, color: 'var(--ws-accent)', marginBottom: '2px' }}>{yr.year}</div>
                          <div>{yr.positive} of {yr.total} stocks FCF-positive ({yr.pct}%)</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
