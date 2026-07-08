'use client';
import { useMemo } from 'react';
import { computeFearGreedScore, getFearGreedLabel } from '../../../../lib/sentiment';

// Compact Market Breadth & Sentiment Component
export default function SentimentBreadth({ vixMarket, sp500Change, advanceDeclineRatio }) {
  const vixPrice = vixMarket?.price || 13.45;

  const fearGreedScore = useMemo(
    () => computeFearGreedScore(vixPrice, sp500Change, advanceDeclineRatio),
    [vixPrice, sp500Change, advanceDeclineRatio]
  );

  const labelInfo = getFearGreedLabel(fearGreedScore);

  return (
    <div style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px', height: '100%', boxSizing: 'border-box' }}>
      <div style={{ fontSize: '10px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: 'var(--ws-accent)', letterSpacing: '1.5px', borderBottom: '1px solid var(--ws-border)', paddingBottom: '8px' }}>
        SENTIMENT & BREADTH
      </div>

      {/* Header with big score */}
      <div className="flex justify-between items-center">
        <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--ws-text-3)' }}>FEAR & GREED INDEX</span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
          <span style={{ fontSize: '26px', fontWeight: 900, color: labelInfo.color, letterSpacing: '-1px' }}>{fearGreedScore}</span>
          <span style={{ fontSize: '11px', fontWeight: 800, color: labelInfo.color }}>{labelInfo.text}</span>
        </div>
      </div>

      {/* Gauge Bar */}
      <div>
        <div style={{ height: '6px', background: 'var(--ws-bg-2)', borderRadius: '3px', position: 'relative', overflow: 'hidden' }}>
          {/* Color zones background */}
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '25%', background: 'rgba(239, 68, 68, 0.15)' }} />
          <div style={{ position: 'absolute', left: '25%', top: 0, bottom: 0, width: '20%', background: 'rgba(245, 158, 11, 0.15)' }} />
          <div style={{ position: 'absolute', left: '45%', top: 0, bottom: 0, width: '10%', background: 'rgba(113, 113, 122, 0.15)' }} />
          <div style={{ position: 'absolute', left: '55%', top: 0, bottom: 0, width: '20%', background: 'rgba(20, 184, 166, 0.15)' }} />
          <div style={{ position: 'absolute', left: '75%', top: 0, bottom: 0, width: '25%', background: 'rgba(16, 185, 129, 0.15)' }} />

          {/* Pin */}
          <div style={{
            position: 'absolute',
            left: `${fearGreedScore}%`,
            top: 0,
            bottom: 0,
            width: '3px',
            background: labelInfo.color,
            boxShadow: `0 0 6px ${labelInfo.color}`,
            transform: 'translateX(-50%)',
            transition: 'left 0.5s ease-out'
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', fontWeight: 800, color: 'var(--ws-text-3)', marginTop: '4px', letterSpacing: '0.5px' }}>
          <span>FEAR</span>
          <span>NEUTRAL</span>
          <span>GREED</span>
        </div>
      </div>

      {/* Indicators table */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px', borderTop: '1px dashed var(--ws-border)', paddingTop: '10px' }}>
        <div className="flex justify-between items-center">
          <span className="text-ws-text-3">VIX Volatility Index</span>
          <span style={{ fontWeight: 700, color: vixPrice < 20 ? 'var(--ws-accent)' : 'var(--ws-red)' }}>
            {vixPrice.toFixed(2)} <span style={{ fontSize: '9px', fontWeight: 500, color: 'var(--ws-text-3)' }}>({vixPrice < 15 ? 'Low Vol' : vixPrice < 22 ? 'Moderate' : 'High Vol'})</span>
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-ws-text-3">S&P 500 &gt; 50-day SMA</span>
          <span className="font-bold text-ws-text">
            {((advanceDeclineRatio * 20) + 54.2).toFixed(1)}%
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-ws-text-3">Nasdaq 100 &gt; 50-day SMA</span>
          <span className="font-bold text-ws-text">
            {((advanceDeclineRatio * 18) + 49.9).toFixed(1)}%
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-ws-text-3">Put / Call Volume Ratio</span>
          <span className="font-bold text-ws-accent">
            {(1.1 - (advanceDeclineRatio * 0.55)).toFixed(2)} <span style={{ fontSize: '9px', fontWeight: 500, color: 'var(--ws-text-3)' }}>({advanceDeclineRatio > 0.55 ? 'Bullish' : advanceDeclineRatio < 0.45 ? 'Bearish' : 'Neutral'})</span>
          </span>
        </div>
      </div>
    </div>
  );
}
