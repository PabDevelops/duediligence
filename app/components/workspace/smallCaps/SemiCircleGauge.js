'use client';
import { useState } from 'react';

export default function SemiCircleGauge({
  score = 78,
  totalTracked = 3784,
  smallCount = 1500,
  microCount = 1459,
  nanoCount = 825,
  activeFilter = 'all',
  onFilterChange,
  healthRatios = [],
  riskDist = { optimalPct: 74, watchlistPct: 19, flaggedPct: 7 }
}) {
  const [hoveredRatio, setHoveredRatio] = useState(null);

  const radius = 90;
  const strokeWidth = 12;
  const normalizedRadius = radius - strokeWidth / 2;
  const circumference = Math.PI * normalizedRadius;

  const validScore = Math.min(Math.max(score, 0), 100);
  const strokeDashoffset = circumference - (validScore / 100) * circumference;

  let currentSubtext = `${totalTracked.toLocaleString()} Sub-$2B Tracked`;
  if (activeFilter === 'small') currentSubtext = `${smallCount.toLocaleString()} Small Cap ($300M - $2B)`;
  if (activeFilter === 'micro') currentSubtext = `${microCount.toLocaleString()} Micro Cap ($50M - $300M)`;
  if (activeFilter === 'nano') currentSubtext = `${nanoCount.toLocaleString()} Nano Cap (< $50M)`;

  const scoreLabel = validScore >= 80 ? 'EXCELLENT' : (validScore >= 65 ? 'OPTIMAL' : 'WATCH');
  const scoreColor = validScore >= 80 ? 'var(--ws-accent)' : (validScore >= 65 ? '#f59e0b' : 'var(--ws-red)');

  return (
    <div style={{
      background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)',
      padding: '20px', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'space-between', height: '100%', boxSizing: 'border-box'
    }}>
      {/* Card Header & Monthly Trend Badge */}
      <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--ws-accent)', letterSpacing: '1px' }}>
          UNIVERSE HEALTH
        </span>

        {/* Monthly Trend Badge */}
        <span style={{
          fontSize: '9px', fontWeight: 800, padding: '2px 8px',
          background: 'rgba(20, 184, 166, 0.15)', color: 'var(--ws-accent)',
          border: '1px solid rgba(20, 184, 166, 0.3)', fontFamily: "'JetBrains Mono', monospace"
        }}>
          ▲ +3.2 pts vs 30d
        </span>
      </div>

      {/* Cap Tier Filter Buttons (ALL, SMALL, MICRO, NANO) */}
      <div style={{ display: 'flex', gap: '2px', background: 'var(--ws-bg-2)', padding: '2px', border: '1px solid var(--ws-border)', width: '100%', justifyContent: 'center', marginBottom: '10px' }}>
        {[
          { id: 'all', label: 'ALL (<$2B)' },
          { id: 'small', label: 'SMALL' },
          { id: 'micro', label: 'MICRO' },
          { id: 'nano', label: 'NANO' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => onFilterChange && onFilterChange(t.id)}
            style={{
              flex: 1,
              background: activeFilter === t.id ? (t.id === 'nano' ? '#ef4444' : 'var(--ws-accent)') : 'transparent',
              color: activeFilter === t.id ? 'var(--ws-bg-1)' : 'var(--ws-text-3)',
              border: 'none', padding: '3px 4px', fontSize: '8px', fontWeight: 800, cursor: 'pointer',
              transition: 'all 0.15s ease', outline: 'none'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Gauge SVG Arc */}
      <div style={{ position: 'relative', width: '190px', height: '105px', display: 'flex', justifyContent: 'center' }}>
        <svg width="190" height="105" viewBox="0 0 190 105">
          <path
            d="M 10 100 A 85 85 0 0 1 180 100"
            fill="none"
            stroke="var(--ws-bg-2)"
            strokeWidth={strokeWidth}
            strokeLinecap="butt"
          />
          <path
            d="M 10 100 A 85 85 0 0 1 180 100"
            fill="none"
            stroke={scoreColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="butt"
            style={{ transition: 'stroke-dashoffset 0.8s ease-in-out, stroke 0.4s ease' }}
          />
        </svg>

        {/* Floating Center Score (100% Dynamic) */}
        <div style={{
          position: 'absolute', top: '48px', left: '50%', transform: 'translateX(-50%)',
          textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center'
        }}>
          <span style={{ fontSize: '36px', fontWeight: 900, color: 'var(--ws-text)', lineHeight: 1 }}>
            {validScore}
          </span>
          <span style={{ fontSize: '9px', fontWeight: 800, color: scoreColor, letterSpacing: '1px', marginTop: '2px' }}>
            {scoreLabel}
          </span>
        </div>
      </div>

      {/* Subtext Company Count */}
      <div style={{ fontSize: '10px', color: 'var(--ws-text-3)', margin: '4px 0 10px 0', fontFamily: "'JetBrains Mono', monospace" }}>
        {currentSubtext}
      </div>

      {/* Dynamic Segment Health Ratios */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '6px', margin: '4px 0 10px 0' }}>
        <div style={{ fontSize: '9px', fontWeight: 800, color: 'var(--ws-text-3)', letterSpacing: '1px', marginBottom: '2px' }}>
          SEGMENT HEALTH RATIOS
        </div>
        {healthRatios.map((item, idx) => {
          const totalCompanies = activeFilter === 'all' ? totalTracked : (activeFilter === 'small' ? smallCount : (activeFilter === 'micro' ? microCount : nanoCount));
          const count = Math.round((item.pct / 100) * totalCompanies);
          return (
            <div
              key={idx}
              onMouseEnter={() => setHoveredRatio(idx)}
              onMouseLeave={() => setHoveredRatio(null)}
              style={{ position: 'relative', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', marginBottom: '2px' }}>
                <span style={{ color: 'var(--ws-text-2)', fontWeight: 600 }}>{item.label}</span>
                <span style={{ fontWeight: 800, color: item.color || 'var(--ws-accent)', fontFamily: "'JetBrains Mono', monospace" }}>
                  {item.pct}%
                </span>
              </div>
              <div style={{ height: '4px', width: '100%', background: 'var(--ws-bg-2)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${item.pct}%`,
                  background: item.color || 'var(--ws-accent)',
                  transition: 'width 0.4s ease'
                }} />
              </div>

              {/* Hover Tooltip with exact company counts */}
              {hoveredRatio === idx && (
                <div style={{
                  position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
                  background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)',
                  padding: '4px 8px', fontSize: '9px', color: 'var(--ws-text)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.5)', zIndex: 10, whiteSpace: 'nowrap', marginBottom: '4px'
                }}>
                  {count.toLocaleString()} of {totalCompanies.toLocaleString()} companies
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Dynamic Universe Risk Distribution Segmented Bar */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ fontSize: '9px', fontWeight: 800, color: 'var(--ws-text-3)', letterSpacing: '1px' }}>
          UNIVERSE RISK DISTRIBUTION
        </div>
        <div style={{ display: 'flex', height: '6px', width: '100%', overflow: 'hidden', background: 'var(--ws-bg-2)' }}>
          <div style={{ width: `${riskDist.optimalPct}%`, background: 'var(--ws-accent)', transition: 'width 0.4s ease' }} title={`Optimal (${riskDist.optimalPct}%)`} />
          <div style={{ width: `${riskDist.watchlistPct}%`, background: '#f59e0b', transition: 'width 0.4s ease' }} title={`Watchlist (${riskDist.watchlistPct}%)`} />
          <div style={{ width: `${riskDist.flaggedPct}%`, background: 'var(--ws-red)', transition: 'width 0.4s ease' }} title={`Flagged (${riskDist.flaggedPct}%)`} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--ws-text-3)', fontFamily: "'JetBrains Mono', monospace" }}>
          <span style={{ color: 'var(--ws-accent)' }}>● Optimal {riskDist.optimalPct}%</span>
          <span style={{ color: '#f59e0b' }}>● Watchlist {riskDist.watchlistPct}%</span>
          <span style={{ color: 'var(--ws-red)' }}>● Flagged {riskDist.flaggedPct}%</span>
        </div>
      </div>
    </div>
  );
}
