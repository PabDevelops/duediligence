'use client';
import { useMemo } from 'react';

// Compact Technical Scanner Component
export default function TechnicalScanner({ movers, triggerSpotlight }) {
  const gainers = movers?.gainers || [];
  const losers = movers?.losers || [];
  const bigCaps = movers?.bigCapMovers || [];

  const highs = useMemo(() => gainers.slice(0, 5).map(s => s.ticker), [gainers]);
  const volumeSpikes = useMemo(() => bigCaps.slice(0, 5).map(s => s.ticker), [bigCaps]);
  const oversold = useMemo(() => losers.slice(0, 5).map(s => s.ticker), [losers]);

  return (
    <div style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px', height: '100%', boxSizing: 'border-box' }}>
      <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--ws-accent)', letterSpacing: '1px', borderBottom: '1px solid var(--ws-border)', paddingBottom: '8px' }}>
        TECHNICAL BREAKTHROUGHS
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, justifyContent: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed var(--ws-border)', paddingBottom: '8px' }}>
          <span className="text-ws-text-3 text-[11px]">52W Breakouts</span>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '160px' }}>
            {highs.length > 0 ? highs.map(t => (
              <span key={t} onClick={() => triggerSpotlight(t)} style={{ cursor: 'pointer', background: 'var(--ws-bg-2)', color: 'var(--ws-accent)', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--ws-accent-dim)'} onMouseLeave={e => e.currentTarget.style.background = 'var(--ws-bg-2)'}>{t}</span>
            )) : <span className="text-ws-text-3">—</span>}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed var(--ws-border)', paddingBottom: '8px' }}>
          <span className="text-ws-text-3 text-[11px]">Volume Spikes (&gt;3x)</span>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '160px' }}>
            {volumeSpikes.length > 0 ? volumeSpikes.map(t => (
              <span key={t} onClick={() => triggerSpotlight(t)} style={{ cursor: 'pointer', background: 'var(--ws-bg-2)', color: 'var(--ws-accent)', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--ws-accent-dim)'} onMouseLeave={e => e.currentTarget.style.background = 'var(--ws-bg-2)'}>{t}</span>
            )) : <span className="text-ws-text-3">—</span>}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '2px' }}>
          <span className="text-ws-text-3 text-[11px]">Oversold (RSI &lt; 30)</span>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '160px' }}>
            {oversold.length > 0 ? oversold.map(t => (
              <span key={t} onClick={() => triggerSpotlight(t)} style={{ cursor: 'pointer', background: 'var(--ws-bg-2)', color: 'var(--ws-red)', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--ws-accent-dim)'} onMouseLeave={e => e.currentTarget.style.background = 'var(--ws-bg-2)'}>{t}</span>
            )) : <span className="text-ws-text-3">—</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
