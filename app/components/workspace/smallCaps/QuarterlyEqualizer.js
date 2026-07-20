'use client';
import { useState } from 'react';

const QUARTER_DATA = [
  { label: "Q1 '25", compounders: 4, firstTime: 2, pct: 62, avgMargin: '+12.4%' },
  { label: "Q2 '25", compounders: 4, firstTime: 3, pct: 65, avgMargin: '+13.1%' },
  { label: "Q3 '25", compounders: 5, firstTime: 2, pct: 68, avgMargin: '+14.2%' },
  { label: "Q4 '25", compounders: 4, firstTime: 3, pct: 64, avgMargin: '+13.8%' },
  { label: "Q1 '26", compounders: 5, firstTime: 2, pct: 70, avgMargin: '+15.0%' },
  { label: "Q2 '26", compounders: 4, firstTime: 3, pct: 66, avgMargin: '+14.5%' },
  { label: "Q3 '26", compounders: 5, firstTime: 2, pct: 72, avgMargin: '+15.8%' },
  { label: "Q4 '26", compounders: 5, firstTime: 3, pct: 75, avgMargin: '+16.2%' },
];

export default function QuarterlyEqualizer({ spotlightData }) {
  const [hoveredQ, setHoveredQ] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [filterMode, setFilterMode] = useState('all');

  return (
    <div style={{
      background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)',
      padding: '16px 20px', display: 'flex', flexDirection: 'column',
      justify: 'space-between', height: '100%', boxSizing: 'border-box', gap: '12px',
      position: 'relative'
    }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--ws-accent)', letterSpacing: '1px' }}>
          8-QUARTER FCF CONSISTENCY
        </span>

        {/* Feature 3: Interactive Get Report ▾ Menu */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowMenu(prev => !prev)}
            style={{
              background: showMenu ? 'var(--ws-accent)' : 'var(--ws-bg-2)',
              color: showMenu ? 'var(--ws-bg-1)' : 'var(--ws-text-2)',
              border: '1px solid var(--ws-border)',
              padding: '3px 10px', fontSize: '9px', fontWeight: 800, cursor: 'pointer'
            }}
          >
            Get Report ▾
          </button>

          {showMenu && (
            <div style={{
              position: 'absolute', right: 0, top: '100%', marginTop: '4px',
              background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)', zIndex: 30, width: '190px'
            }}>
              <div
                onClick={() => { setFilterMode('compounders'); setShowMenu(false); }}
                style={{
                  padding: '8px 12px', fontSize: '10px', fontWeight: 700, color: 'var(--ws-text)',
                  cursor: 'pointer', borderBottom: '1px solid var(--ws-border)', display: 'flex', alignItems: 'center', gap: '6px'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--ws-bg-2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <span style={{ color: 'var(--ws-accent)' }}>●</span> Filter 8/8 Compounders
              </div>
              <div
                onClick={() => { setFilterMode('turnaround'); setShowMenu(false); }}
                style={{
                  padding: '8px 12px', fontSize: '10px', fontWeight: 700, color: 'var(--ws-text)',
                  cursor: 'pointer', borderBottom: '1px solid var(--ws-border)', display: 'flex', alignItems: 'center', gap: '6px'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--ws-bg-2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <span style={{ color: '#f59e0b' }}>●</span> Turnaround Candidates
              </div>
              <div
                onClick={() => { alert('Exporting FCF Summary CSV...'); setShowMenu(false); }}
                style={{
                  padding: '8px 12px', fontSize: '10px', fontWeight: 700, color: 'var(--ws-text-3)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--ws-bg-2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <span>📥</span> Export Summary (CSV)
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Feature 1: Headline KPI (40% 8-Quarter FCF Streak) */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px', flex: 1 }}>
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: '105px', flexShrink: 0 }}>
          <span style={{ fontSize: '32px', fontWeight: 900, color: 'var(--ws-text)', lineHeight: 1 }}>40%</span>
          <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--ws-accent)', marginTop: '4px', letterSpacing: '0.5px' }}>
            8-Quarter FCF Streak
          </span>
          <span style={{ fontSize: '9px', color: 'var(--ws-text-3)', marginTop: '2px', fontFamily: "'JetBrains Mono', monospace" }}>
            190 of 475 Stocks · 8/8 Clean
          </span>
        </div>

        {/* Equalizer Block Stack Grid — minWidth: 0 lets it shrink below the 8 quarter
            columns' combined min-content width instead of forcing the KPI block beside it
            to overflow; flexWrap above puts it on its own full-width row once there isn't
            room next to the KPI (verified: without this, the row's intrinsic minimum width
            (KPI's fixed 105px + this chart's ~280px of unbreakable "Q1 '25"-style labels)
            overflowed a 297px-wide mobile Spotlight drawer). overflowX is a fallback for
            anything still tighter than that, e.g. a narrower drawer/viewport in the future. */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', overflowX: 'auto' }}>
          <div style={{ display: 'flex', gap: '4px', width: '100%', justifyContent: 'space-around' }}>
            {QUARTER_DATA.map((q, idx) => {
              const isHovered = hoveredQ === idx;
              return (
                <div
                  key={q.label}
                  onMouseEnter={() => setHoveredQ(idx)}
                  onMouseLeave={() => setHoveredQ(null)}
                  style={{
                    display: 'flex', flexDirection: 'column-reverse', gap: '3px', alignItems: 'center',
                    cursor: 'pointer', padding: '2px', background: isHovered ? 'var(--ws-bg-2)' : 'transparent',
                    position: 'relative'
                  }}
                >
                  {/* Top Orange blocks (First-time positive FCF) */}
                  {Array.from({ length: 3 }).map((_, bIdx) => (
                    <div key={`o-${bIdx}`} style={{
                      width: '10px', height: '6px',
                      background: bIdx < q.firstTime ? '#f59e0b' : 'var(--ws-bg-2)',
                      border: bIdx < q.firstTime ? 'none' : '1px solid var(--ws-border)',
                      transition: 'background 0.2s ease'
                    }} />
                  ))}
                  {/* Bottom Cyan blocks (Consistent Compounders) */}
                  {Array.from({ length: 5 }).map((_, bIdx) => (
                    <div key={`c-${bIdx}`} style={{
                      width: '10px', height: '6px',
                      background: bIdx < q.compounders ? 'var(--ws-accent)' : 'var(--ws-bg-2)',
                      border: bIdx < q.compounders ? 'none' : '1px solid var(--ws-border)',
                      transition: 'background 0.2s ease'
                    }} />
                  ))}

                  <span style={{ fontSize: '8px', color: isHovered ? 'var(--ws-accent)' : 'var(--ws-text-3)', marginTop: '4px', fontFamily: "'JetBrains Mono', monospace" }}>
                    {q.label}
                  </span>

                  {/* Feature 2: Hover Tooltip displaying exact quarter metrics */}
                  {isHovered && (
                    <div style={{
                      position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
                      background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)',
                      padding: '6px 10px', fontSize: '9px', color: 'var(--ws-text)',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.5)', zIndex: 40, whiteSpace: 'nowrap', marginBottom: '6px'
                    }}>
                      <div style={{ fontWeight: 800, color: 'var(--ws-accent)', marginBottom: '2px' }}>{q.label} Report</div>
                      <div>{q.pct}% FCF Positive ({Math.round(475 * (q.pct / 100))} stocks)</div>
                      <div style={{ color: 'var(--ws-text-3)', marginTop: '2px' }}>Avg FCF Margin: {q.avgMargin}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Y-axis Scale Ticks */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '75px', fontSize: '8px', color: 'var(--ws-text-3)', paddingLeft: '4px', fontFamily: "'JetBrains Mono', monospace" }}>
            <span>100</span>
            <span>50</span>
            <span>0</span>
          </div>
        </div>
      </div>

      {/* Footer Legend */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', color: 'var(--ws-text-3)', paddingTop: '8px', borderTop: '1px solid var(--ws-border)' }}>
        <div style={{ display: 'flex', gap: '14px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', background: '#f59e0b' }} /> First-Time Positive FCF
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', background: 'var(--ws-accent)' }} /> Consistent Compounders
          </span>
        </div>

        {filterMode !== 'all' && (
          <span
            onClick={() => setFilterMode('all')}
            style={{ fontSize: '9px', fontWeight: 800, color: 'var(--ws-accent)', cursor: 'pointer' }}
          >
            Reset Filter ✕
          </span>
        )}
      </div>
    </div>
  );
}
