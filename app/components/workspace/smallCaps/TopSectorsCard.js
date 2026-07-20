'use client';
import { useState } from 'react';

const SECTOR_DATA = [
  { tag: 'TECH', name: 'Technology & AI', pct: 28.4, count: '142 stocks', yoy: '+5.2%' },
  { tag: 'HLTH', name: 'Healthcare & Biotech', pct: 21.2, count: '106 stocks', yoy: '+2.1%' },
  { tag: 'IND', name: 'Industrials & Robotics', pct: 16.8, count: '84 stocks', yoy: '+1.4%' },
  { tag: 'FIN', name: 'Financials & Fintech', pct: 14.5, count: '73 stocks', yoy: '-0.8%' },
  { tag: 'ENRG', name: 'Energy & CleanTech', pct: 11.1, count: '56 stocks', yoy: '+3.9%' },
  { tag: 'CONS', name: 'Consumer & Retail', pct: 8.0, count: '40 stocks', yoy: '-1.2%' },
];

const COUNTRY_DATA = [
  { tag: 'US', name: 'United States', pct: 64.2, count: '322 stocks', yoy: '+4.8%' },
  { tag: 'EU', name: 'European Union', pct: 18.5, count: '93 stocks', yoy: '+1.5%' },
  { tag: 'JP', name: 'Japan & Asia-Pac', pct: 8.3, count: '42 stocks', yoy: '+2.7%' },
  { tag: 'GB', name: 'United Kingdom', pct: 5.2, count: '26 stocks', yoy: '+0.4%' },
  { tag: 'CA', name: 'Canada & Mining', pct: 3.8, count: '18 stocks', yoy: '-0.9%' },
];

export default function TopSectorsCard() {
  const [viewMode, setViewMode] = useState('sector');
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const activeData = viewMode === 'sector' ? SECTOR_DATA : COUNTRY_DATA;

  return (
    <div style={{
      background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)',
      padding: '16px 20px', display: 'flex', flexDirection: 'column',
      gap: '12px', height: '100%', boxSizing: 'border-box'
    }}>
      {/* Header with View Switcher Pills */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--ws-accent)', letterSpacing: '1px' }}>
          {viewMode === 'sector' ? 'TOP SECTOR DISTRIBUTION' : 'GEOGRAPHIC DISTRIBUTION'}
        </span>

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

      {/* Distribution List with Progress Fill Bars (No Emojis) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, justifyContent: 'space-around' }}>
        {activeData.map((s, idx) => (
          <div
            key={idx}
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

            {/* Left Info: Code Tag + Name */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', zIndex: 2 }}>
              <span style={{
                fontSize: '9px', fontWeight: 800, padding: '1px 5px',
                background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)',
                color: 'var(--ws-accent)', fontFamily: "'JetBrains Mono', monospace"
              }}>
                {s.tag}
              </span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ws-text)' }}>{s.name}</span>
            </div>

            {/* Right Metrics: Percentage, Count & YoY */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontFamily: "'JetBrains Mono', monospace", zIndex: 2 }}>
              <span style={{ fontSize: '9px', color: s.yoy.startsWith('+') ? 'var(--ws-accent)' : 'var(--ws-red)', fontWeight: 700 }}>
                {s.yoy}
              </span>
              <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--ws-text)' }}>
                {s.pct.toFixed(1)}%
              </span>
              <span style={{ fontSize: '10px', color: 'var(--ws-text-3)' }}>
                {s.count}
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
                {s.count} · {s.yoy} YoY Growth
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
