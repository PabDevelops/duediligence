'use client';
import { useState, useMemo } from 'react';

const TYPE_COLOR = { BUY: 'var(--ws-accent)', SELL: 'var(--ws-red)' };

function fmtShares(shares) {
  if (shares == null) return '—';
  return shares >= 1000 ? `${(shares / 1000).toFixed(0)}K` : shares;
}

function fmtVal(val) {
  if (val == null) return '—';
  if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
  if (val >= 1e3) return `$${(val / 1e3).toFixed(0)}K`;
  return `$${val}`;
}

export default function InsiderClusterFeed({ feed, loading, onSelect }) {
  const [timeRange, setTimeRange] = useState('30D');

  const rawEvents = feed?.events || [];
  const rawClusters = feed?.clusters || [];

  const events = useMemo(() => {
    if (timeRange === '7D') return rawEvents.slice(0, 3);
    if (timeRange === '30D') return rawEvents.slice(0, 5);
    return rawEvents; // 90D returns all items, scroll bound inside card box
  }, [rawEvents, timeRange]);

  return (
    <div style={{
      background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)',
      display: 'flex', flexDirection: 'column', height: '100%', maxHeight: '340px',
      boxSizing: 'border-box', overflow: 'hidden'
    }}>
      {/* Top Header */}
      <div style={{
        padding: '10px 14px', borderBottom: '1px solid var(--ws-border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '8px', height: '8px', background: 'var(--ws-accent)' }} />
          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--ws-accent)', letterSpacing: '1px' }}>
            INSIDER CLUSTER BUYS (FORM 4)
          </span>
        </div>

        {/* Time Range Filter Pills */}
        <div style={{ display: 'flex', gap: '4px', background: 'var(--ws-bg-2)', padding: '2px', border: '1px solid var(--ws-border)' }}>
          {['7D', '30D', '90D'].map(t => (
            <button key={t} onClick={() => setTimeRange(t)} style={{
              background: timeRange === t ? 'var(--ws-accent)' : 'transparent',
              color: timeRange === t ? 'var(--ws-bg-1)' : 'var(--ws-text-3)',
              border: 'none', padding: '2px 8px', fontSize: '9px', fontWeight: 700, cursor: 'pointer'
            }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* High-Conviction Cluster Buys Highlights */}
      {rawClusters.length > 0 && (
        <div style={{
          padding: '8px 12px', borderBottom: '1px solid var(--ws-border)',
          background: 'rgba(20, 184, 166, 0.08)', display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0
        }}>
          <div style={{ fontSize: '9px', fontWeight: 800, color: 'var(--ws-accent)', letterSpacing: '1px' }}>
            HIGH CONVICTION CLUSTER DETECTED
          </div>
          {rawClusters.slice(0, 2).map((c, i) => (
            <div
              key={i}
              onClick={() => onSelect && onSelect(c.ticker)}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '5px 8px', background: 'var(--ws-bg-1)', border: '1px solid var(--ws-accent)',
                cursor: 'pointer', transition: 'transform 0.1s ease'
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateX(2px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateX(0)'}
            >
              <div>
                <span style={{ fontWeight: 900, color: 'var(--ws-accent)', fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", marginRight: '8px' }}>
                  {c.ticker}
                </span>
                <span style={{ fontSize: '10px', color: 'var(--ws-text-2)' }}>
                  {c.insiderCount} C-Suite Insiders · {fmtVal(c.totalValue)}
                </span>
              </div>
              <span style={{
                fontSize: '9px', fontWeight: 800, padding: '2px 6px',
                background: 'var(--ws-accent)', color: 'var(--ws-bg-1)', fontFamily: "'JetBrains Mono', monospace"
              }}>
                View Insights &rarr;
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Scrollable Form 4 Activity List (Bound strictly inside card drawer) */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '8px 12px 4px', fontSize: '9px', fontWeight: 800, color: 'var(--ws-text-3)', letterSpacing: '1px', flexShrink: 0 }}>
          RECENT FORM 4 PURCHASES ({events.length})
        </div>

        {loading ? (
          <div style={{ padding: '20px 14px', textAlign: 'center', color: 'var(--ws-text-3)', fontSize: '11px' }}>
            Scanning SEC Form 4 filings...
          </div>
        ) : events.length === 0 ? (
          <div style={{ padding: '20px 14px', textAlign: 'center', color: 'var(--ws-text-3)', fontSize: '11px' }}>
            No Form 4 purchases found in this timeframe.
          </div>
        ) : (
          events.map((e, idx) => (
            <div
              key={idx}
              onClick={() => onSelect && onSelect(e.ticker)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '7px 12px', borderBottom: '1px solid var(--ws-border)', cursor: 'pointer'
              }}
              onMouseEnter={ev => ev.currentTarget.style.background = 'var(--ws-bg-2)'}
              onMouseLeave={ev => ev.currentTarget.style.background = 'none'}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontWeight: 900, fontSize: '11px', color: 'var(--ws-text)', fontFamily: "'JetBrains Mono', monospace" }}>
                    {e.ticker}
                  </span>
                  <span style={{ fontSize: '9px', fontWeight: 700, padding: '1px 4px', background: 'var(--ws-bg-2)', color: 'var(--ws-accent)' }}>
                    {e.type}
                  </span>
                </div>
                <div style={{ fontSize: '10px', color: 'var(--ws-text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>
                  {e.insider}
                </div>
              </div>

              <div style={{ textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>
                <div style={{ fontSize: '11px', fontWeight: 800, color: TYPE_COLOR[e.type] }}>
                  {fmtVal(e.value)}
                </div>
                <div style={{ fontSize: '9px', color: 'var(--ws-text-3)', marginTop: '2px' }}>
                  {fmtShares(e.shares)} shares
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
