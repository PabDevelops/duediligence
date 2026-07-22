'use client';
import { useState, useMemo } from 'react';
import { getCapTier } from '../../../../lib/marketCap';

const SEVERITY = {
  high: { color: 'var(--ws-red)', dim: 'var(--ws-red-dim)', icon: '🚨' },
  medium: { color: 'var(--ws-amber)', dim: 'var(--ws-amber-dim)', icon: '⚠️' },
  low: { color: 'var(--ws-text-3)', dim: 'var(--ws-bg-2)', icon: 'ⓘ' },
};

function worstFlag(flags) {
  return flags.reduce((a, b) => (SEVERITY[b.severity] && (a == null || b.severity === 'high') ? b : a), null) || flags[0];
}

// Rendered both as the compact dashboard widget (fullPage=false, height-capped, no filters —
// just the top of the sorted list) and as the dedicated Risk Triage tab (fullPage=true), which
// gets search/tier/severity filters and the full list instead of a 280px scroll box, matching
// the treatment SmallCapsExploreTable already has.
export default function RiskTriage({ riskFlags, loading, onSelect, fullPage = false }) {
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');

  const allFlags = riskFlags || [];

  const filteredFlags = useMemo(() => {
    if (!fullPage) return allFlags;
    return allFlags.filter(r => {
      const matchesSearch = !search || r.ticker.toLowerCase().includes(search.toLowerCase()) || (r.name || '').toLowerCase().includes(search.toLowerCase());
      const matchesTier = tierFilter === 'all' || (r.capTier ?? getCapTier(r.marketCap)?.id) === tierFilter;
      const matchesSeverity = severityFilter === 'all' || r.flags.some(f => f.severity === severityFilter);
      return matchesSearch && matchesTier && matchesSeverity;
    });
  }, [allFlags, fullPage, search, tierFilter, severityFilter]);

  return (
    <div style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%', flex: fullPage ? 1 : 'none' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--ws-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--ws-red)', letterSpacing: '1px' }}>🚨 RISK TRIAGE</span>

        {fullPage ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Search ticker or name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                background: 'var(--ws-bg-2)', border: '1px solid var(--ws-border)',
                color: 'var(--ws-text)', fontSize: '11px', padding: '5px 10px', outline: 'none', width: '180px',
                maxWidth: '100%', boxSizing: 'border-box'
              }}
            />
            <div style={{ display: 'flex', gap: '2px', background: 'var(--ws-bg-2)', padding: '2px', border: '1px solid var(--ws-border)' }}>
              {['all', 'small', 'micro', 'nano'].map(t => (
                <button key={t} onClick={() => setTierFilter(t)} style={{
                  background: tierFilter === t ? (t === 'nano' ? '#ef4444' : 'var(--ws-accent)') : 'transparent',
                  color: tierFilter === t ? 'var(--ws-bg-1)' : 'var(--ws-text-3)',
                  border: 'none', padding: '3px 8px', fontSize: '9px', fontWeight: 800, cursor: 'pointer', textTransform: 'uppercase'
                }}>
                  {t}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '2px', background: 'var(--ws-bg-2)', padding: '2px', border: '1px solid var(--ws-border)' }}>
              {['all', 'high', 'medium', 'low'].map(sev => (
                <button key={sev} onClick={() => setSeverityFilter(sev)} style={{
                  background: severityFilter === sev ? (SEVERITY[sev]?.color || 'var(--ws-accent)') : 'transparent',
                  color: severityFilter === sev ? 'var(--ws-bg-1)' : 'var(--ws-text-3)',
                  border: 'none', padding: '3px 8px', fontSize: '9px', fontWeight: 800, cursor: 'pointer', textTransform: 'uppercase'
                }}>
                  {sev}
                </button>
              ))}
            </div>
            <span style={{ fontSize: '9px', color: 'var(--ws-text-3)', fontFamily: "'JetBrains Mono', monospace" }}>{filteredFlags.length.toLocaleString()} of {allFlags.length.toLocaleString()} flagged</span>
          </div>
        ) : (
          <span style={{ fontSize: '9px', color: 'var(--ws-text-3)', fontFamily: "'JetBrains Mono', monospace" }}>{allFlags.length.toLocaleString()} FLAGGED</span>
        )}
      </div>
      <div style={{ maxHeight: fullPage ? 'none' : '280px', flex: fullPage ? 1 : 'none', minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px' }}>
        {loading ? (
          <div style={{ padding: '40px 12px', textAlign: 'center', color: 'var(--ws-text-3)', fontSize: '11px' }}>Scanning universe for red flags…</div>
        ) : filteredFlags.length === 0 ? (
          <div style={{ padding: '40px 12px', textAlign: 'center', color: 'var(--ws-text-3)', fontSize: '11px' }}>
            {allFlags.length === 0 ? 'Nothing flagged right now.' : 'No flagged stocks match your filters.'}
          </div>
        ) : (
          filteredFlags.map(r => {
            const worst = worstFlag(r.flags);
            const sev = SEVERITY[worst?.severity] || SEVERITY.low;
            return (
              <div key={r.ticker} onClick={() => onSelect(r.ticker)}
                style={{
                  cursor: 'pointer', border: `1px solid ${sev.color}`, borderLeft: `3px solid ${sev.color}`,
                  background: sev.dim, padding: '8px 10px', transition: 'transform 0.1s ease',
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateX(2px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'translateX(0)'}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontWeight: 800, fontSize: '11px', marginRight: '6px', fontFamily: "'JetBrains Mono', monospace" }}>{r.ticker}</span>
                    <span style={{ fontSize: '10px', color: 'var(--ws-text-3)' }}>{r.name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    <span style={{
                      fontSize: '9px', fontWeight: 700, padding: '2px 6px',
                      background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', color: 'var(--ws-accent)',
                      fontFamily: "'JetBrains Mono', monospace"
                    }}>
                      View Insights &rarr;
                    </span>
                    <span style={{ fontSize: '9px', fontWeight: 800, color: sev.color }}>{r.flagCount}×</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {r.flags.map((f, i) => {
                    const s = SEVERITY[f.severity] || SEVERITY.low;
                    return (
                      <div key={i} style={{
                        display: 'inline-flex', alignItems: 'center', gap: '5px', width: 'fit-content',
                        fontSize: '9px', fontWeight: 700, padding: '2px 6px',
                        color: s.color, background: 'var(--ws-bg-1)',
                      }}>
                        <span>{s.icon}</span>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{f.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
