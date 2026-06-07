'use client';
import { useState, useEffect } from 'react';
import Sparkline from './Sparkline';

export default function MarketBar() {
  const [markets, setMarkets] = useState([]);

  useEffect(() => {
    fetch('/api/market')
      .then(r => r.json())
      .then(d => setMarkets(d.markets || []));
  }, []);

  if (!markets.length) return (
    <div style={{ borderBottom: '1px solid var(--border)', padding: '8px 24px', display: 'flex', gap: '32px', background: 'var(--bg-1)', overflowX: 'auto' }}>
      {['S&P 500', 'NASDAQ', 'DOW JONES', 'RUSSELL 2000'].map(l => (
        <div key={l} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ color: 'var(--text-3)', fontSize: '10px', letterSpacing: '1px' }}>{l}</span>
          <div style={{ width: 80, height: 32, background: 'var(--bg-2)' }} />
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ borderBottom: '1px solid var(--border)', padding: '8px 24px', display: 'flex', justifyContent: 'space-between', background: 'var(--bg-1)', overflowX: 'auto' }}>
      {markets.map(m => {
        const isUp = m.changePct >= 0;
        const color = isUp ? 'var(--green)' : 'var(--red)';
        return (
          <div key={m.symbol} style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0, paddingRight: '16px', borderRight: '1px solid var(--border)', marginRight: '16px' }}>
            <div>
              <div style={{ color: 'var(--text-3)', fontSize: '9px', letterSpacing: '1.5px', marginBottom: '2px' }}>{m.label}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: 'var(--text)', fontSize: '13px', fontWeight: 600 }}>
                  ${m.price?.toFixed(2)}
                </span>
                <span style={{ color, fontSize: '10px' }}>
                  {isUp ? '+' : ''}{m.changePct?.toFixed(2)}%
                </span>
              </div>
            </div>
            <Sparkline data={m.candles} width={80} height={32} />
          </div>
        );
      })}
    </div>
  );
}