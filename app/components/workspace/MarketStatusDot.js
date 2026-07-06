'use client';
import { useState, useEffect } from 'react';
import { getMarketStatus, MARKET_STATUS_META } from '../../../lib/marketStatus';

// Small blinking dot showing whether a ticker's market is open/closed/pre/post right now.
// Computed from real trading-hour schedules (see lib/marketStatus.js) rather than an
// upstream "marketState" API field, which has proven unreliable (can freeze for hours).
export default function MarketStatusDot({ ticker, showLabel = false, size = 8 }) {
  const [status, setStatus] = useState(() => getMarketStatus(ticker));

  useEffect(() => {
    setStatus(getMarketStatus(ticker));
    const interval = setInterval(() => setStatus(getMarketStatus(ticker)), 60000);
    return () => clearInterval(interval);
  }, [ticker]);

  const meta = MARKET_STATUS_META[status];
  if (!meta) return null;

  return (
    <span title={meta.label} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
      <span style={{ position: 'relative', width: size, height: size, flexShrink: 0, display: 'inline-block' }}>
        <span style={{
          position: 'absolute', inset: 0, borderRadius: '50%', background: meta.color,
          opacity: 0.6, animation: 'market-dot-ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite',
        }} />
        <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: meta.color }} />
      </span>
      {showLabel && (
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '9px', fontWeight: 700, letterSpacing: '1px', color: meta.color }}>
          {meta.label}
        </span>
      )}
    </span>
  );
}
