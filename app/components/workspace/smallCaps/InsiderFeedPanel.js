'use client';
import { useState, useMemo } from 'react';

const TYPE_COLOR = { BUY: 'var(--ws-accent)', SELL: 'var(--ws-red)' };

function fmtShares(shares) {
  if (shares == null) return '—';
  return shares >= 1000 ? `${Math.round(shares / 1000)}K` : shares;
}

export default function InsiderFeedPanel({ feed, loading, onSelect }) {
  const [timeRange, setTimeRange] = useState('30D');

  const rawEvents = feed?.events || [];
  const rawClusters = feed?.clusters || [];

  const events = useMemo(() => {
    if (timeRange === '7D') return rawEvents.slice(0, 8);
    if (timeRange === '30D') return rawEvents.slice(0, 20);
    return rawEvents;
  }, [rawEvents, timeRange]);

  return (
    <div style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--ws-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--ws-accent)', letterSpacing: '1px' }}>INSIDER ACTIVITY FEED</span>
        
        {/* Time Range Filter Pills */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {['7D', '30D', '90D'].map(t => (
            <button key={t} onClick={() => setTimeRange(t)} style={{
              background: timeRange === t ? 'var(--ws-accent)' : 'var(--ws-bg-2)',
              color: timeRange === t ? 'var(--ws-bg-1)' : 'var(--ws-text-3)',
              border: '1px solid var(--ws-border)', padding: '2px 8px', fontSize: '9px', fontWeight: 700, cursor: 'pointer'
            }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {rawClusters.length > 0 && (
        <div style={{ padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: '5px', borderBottom: '1px solid var(--ws-border)', background: 'var(--ws-accent-dim)' }}>
          {rawClusters.map(c => (
            <div key={c.ticker} onClick={() => onSelect(c.ticker)} style={{ cursor: 'pointer', fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontWeight: 800, color: 'var(--ws-accent)' }}>▲ CLUSTER BUY</span>{' '}
                <span style={{ fontWeight: 800 }}>{c.ticker}</span>
                <span style={{ color: 'var(--ws-text-2)' }}> — {c.insiderCount} insiders</span>
              </div>
              <span style={{
                fontSize: '9px', fontWeight: 700, padding: '2px 8px',
                background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', color: 'var(--ws-accent)'
              }}>
                View Insights &rarr;
              </span>
            </div>
          ))}
        </div>
      )}

      <div style={{ maxHeight: '260px', overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: '40px 14px', textAlign: 'center', color: 'var(--ws-text-3)', fontSize: '11px' }}>Scanning Form 4 filings…</div>
        ) : events.length === 0 ? (
          <div style={{ padding: '40px 14px', textAlign: 'center', color: 'var(--ws-text-3)', fontSize: '11px' }}>
            No insider activity tracked in this window yet.
          </div>
        ) : (
          events.map((e, idx) => (
            <div key={`${e.ticker}-${e.insider}-${e.date}-${idx}`} onClick={() => onSelect(e.ticker)}
              style={{
                display: 'flex', alignItems: 'stretch', cursor: 'pointer',
                borderBottom: '1px solid var(--ws-border)',
              }}
              onMouseEnter={ev => ev.currentTarget.style.background = 'var(--ws-bg-2)'}
              onMouseLeave={ev => ev.currentTarget.style.background = 'none'}
            >
              <div style={{ width: '3px', flexShrink: 0, background: TYPE_COLOR[e.type] || 'var(--ws-text-3)' }} />
              <div style={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 12px' }}>
                <div style={{ minWidth: 0, overflow: 'hidden' }}>
                  <span style={{ fontWeight: 800, fontSize: '11px', marginRight: '6px', fontFamily: "'JetBrains Mono', monospace" }}>{e.ticker}</span>
                  <span style={{ fontSize: '10px', color: 'var(--ws-text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.insider}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '10px', fontWeight: 800, color: TYPE_COLOR[e.type] || 'var(--ws-text-3)', flexShrink: 0, fontFamily: "'JetBrains Mono', monospace" }}>
                    {e.type === 'BUY' ? '▲' : '▼'} {fmtShares(e.shares)}
                  </span>
                  <span style={{
                    fontSize: '8px', fontWeight: 700, padding: '1px 6px',
                    background: 'var(--ws-bg-2)', border: '1px solid var(--ws-border)', color: 'var(--ws-text-3)'
                  }}>
                    &rarr;
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
