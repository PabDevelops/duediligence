'use client';
import { fmt } from '../../../../lib/formatters';

const BOARDS = [
  { key: 'leastDiluted', title: 'LEAST DILUTED', valueKey: 'shareDilution', format: (v) => `${v > 0 ? '+' : ''}${v.toFixed(0)}%`, maxVal: 50 },
  { key: 'longestRunway', title: 'LONGEST CASH RUNWAY', valueKey: 'cashRunwayYears', format: (v) => `${v.toFixed(1)}y`, maxVal: 10 },
  { key: 'highestInsiderOwnership', title: 'HIGHEST INSIDER OWNERSHIP', valueKey: 'insiderOwnershipPct', format: (v) => `${v.toFixed(1)}%`, maxVal: 100 },
];

export default function CapitalDisciplineLeaderboards({ leaderboards, loading, onSelect }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {BOARDS.map(board => {
        const rows = leaderboards?.[board.key] || [];
        return (
          <div key={board.key} style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', overflow: 'hidden' }}>
            <div style={{ padding: '9px 14px', borderBottom: '1px solid var(--ws-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--ws-accent)', letterSpacing: '1px' }}>{board.title}</span>
              <span style={{ fontSize: '9px', color: 'var(--ws-text-3)', fontFamily: "'JetBrains Mono', monospace" }}>CAPITAL DISCIPLINE</span>
            </div>
            <div style={{ padding: '4px 0' }}>
              {loading ? (
                <div style={{ padding: '20px 14px', textAlign: 'center', color: 'var(--ws-text-3)', fontSize: '11px' }}>Loading…</div>
              ) : rows.length === 0 ? (
                <div style={{ padding: '20px 14px', textAlign: 'center', color: 'var(--ws-text-3)', fontSize: '11px' }}>Not enough data yet.</div>
              ) : (
                rows.map(r => {
                  const rawVal = r[board.valueKey] ?? 0;
                  const pct = Math.min(Math.max((Math.abs(rawVal) / board.maxVal) * 100, 10), 100);
                  return (
                    <div key={r.ticker} onClick={() => onSelect(r.ticker)}
                      style={{ display: 'flex', flexDirection: 'column', padding: '6px 14px', cursor: 'pointer', gap: '4px' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--ws-bg-2)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      <div style={{ display: 'flex', alignItems: 'baseline' }}>
                        <span style={{ fontWeight: 800, fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 }}>{r.ticker}</span>
                        <span style={{ fontSize: '9px', color: 'var(--ws-text-3)', margin: '0 6px', flexShrink: 0 }}>{fmt(r.marketCap)}</span>
                        <span style={{ flex: 1, borderBottom: '1px dotted var(--ws-border)', margin: '0 6px 3px' }} />
                        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ws-accent)', flexShrink: 0, fontFamily: "'JetBrains Mono', monospace" }}>
                          {board.format(rawVal)}
                        </span>
                      </div>
                      
                      {/* Pattern Striped Progress Bar */}
                      <div style={{
                        height: '4px', width: '100%', borderRadius: '2px', background: 'var(--ws-bg-2)', overflow: 'hidden'
                      }}>
                        <div style={{
                          height: '100%', width: `${pct}%`,
                          background: 'repeating-linear-gradient(135deg, var(--ws-accent) 0, var(--ws-accent) 4px, rgba(20,184,166,0.3) 4px, rgba(20,184,166,0.3) 8px)',
                          borderRadius: '2px', transition: 'width 0.4s ease'
                        }} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
