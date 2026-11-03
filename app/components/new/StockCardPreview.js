'use client';
import { NEW_COLORS as C, VERDICT_BADGE } from './theme';

// Mini preview of a real stock card, built from the same cream/lime tokens the actual stock
// page uses — not a screenshot, so it can't go stale. Shared by the landing page and About.
export default function StockCardPreview() {
  const badge = VERDICT_BADGE.good;
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '24px', boxSizing: 'border-box', boxShadow: '0 30px 60px -24px rgba(28,27,24,0.18)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div aria-hidden="true" style={{ width: '34px', height: '34px', borderRadius: '9px', background: C.ink, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: '14px', fontWeight: 800 }}>Apple Inc.</div>
            <div style={{ fontSize: '11px', color: C.text3 }}>AAPL · NASDAQ</div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '16px', fontWeight: 800 }}>$227.50</div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: C.green }}>+1.23%</div>
        </div>
      </div>

      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '20px', background: badge.bg, marginBottom: '16px' }}>
        <span aria-hidden="true" style={{ width: '6px', height: '6px', borderRadius: '50%', background: badge.dot }} />
        <span style={{ fontSize: '12px', fontWeight: 700, color: badge.text }}>Pinta bien</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: C.text3, letterSpacing: '0.04em' }}>NOTA DE CALIDAD</span>
        <span style={{ fontSize: '15px', fontWeight: 800 }}>83</span>
      </div>
      <div aria-hidden="true" style={{ width: '100%', height: '8px', borderRadius: '20px', background: C.borderSoft, overflow: 'hidden', marginBottom: '20px' }}>
        <div style={{ width: '83%', height: '100%', borderRadius: '20px', background: C.lime }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', paddingTop: '16px', borderTop: `1px solid ${C.borderSoft}` }}>
        {[['ROIC', '32%'], ['Margen bruto', '46%'], ['Deuda/capital', '1.2x']].map(([l, v]) => (
          <div key={l}>
            <div style={{ fontSize: '10px', color: C.text3, marginBottom: '3px' }}>{l}</div>
            <div style={{ fontSize: '13px', fontWeight: 800 }}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
