'use client';

const SEVERITY = {
  high: { color: 'var(--ws-red)', dim: 'var(--ws-red-dim)', icon: '🚨' },
  medium: { color: 'var(--ws-amber)', dim: 'var(--ws-amber-dim)', icon: '⚠️' },
  low: { color: 'var(--ws-text-3)', dim: 'var(--ws-bg-2)', icon: 'ⓘ' },
};

export default function RiskTriage({ riskFlags, loading, onSelect }) {
  return (
    <div style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--ws-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--ws-red)', letterSpacing: '1px' }}>🚨 RISK TRIAGE</span>
        <span style={{ fontSize: '9px', color: 'var(--ws-text-3)', fontFamily: "'JetBrains Mono', monospace" }}>{riskFlags?.length ?? 0} FLAGGED</span>
      </div>
      <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px' }}>
        {loading ? (
          <div style={{ padding: '40px 12px', textAlign: 'center', color: 'var(--ws-text-3)', fontSize: '11px' }}>Scanning universe for red flags…</div>
        ) : !riskFlags || riskFlags.length === 0 ? (
          <div style={{ padding: '40px 12px', textAlign: 'center', color: 'var(--ws-text-3)', fontSize: '11px' }}>Nothing flagged right now.</div>
        ) : (
          riskFlags.map(r => {
            const worst = r.flags.reduce((a, b) => (SEVERITY[b.severity] && (a == null || b.severity === 'high') ? b : a), null) || r.flags[0];
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
