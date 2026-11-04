'use client';
import StockLogo from '../../workspace/StockLogo';
import { NEW_COLORS as C } from '../theme';

// Blossom-style donut: one SVG stroke segment per top position, each with a floating pill
// (logo + %) positioned around the ring by angle, and the day's aggregate performance in the
// center. All coordinates are in the SVG's 0–100 viewBox, which doubles as CSS percentages for
// the HTML pills since the container is a square filled edge-to-edge by the SVG — 1 viewBox
// unit = 1% of the container's width/height, so the same x/y numbers position both.
const PALETTE = ['#5A8A74', '#8B7FE8', '#D99A4E', '#5A9BD4', '#C1666B', '#7FA88A'];
const OTHER_COLOR = '#C8C1AC';
const MAX_SEGMENTS = 6;
const RADIUS = 38;
const STROKE = 9;
const LABEL_RADIUS = 47;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const GAP = CIRCUMFERENCE * 0.012; // small visual gap between segments

export default function PortfolioRing({ positions, todayPct, onSelectTicker }) {
  const withValue = positions
    .map(p => ({ ticker: p.ticker, name: p.name, value: Math.max(0, p.marketValue ?? p.cost ?? 0) }))
    .filter(p => p.value > 0)
    .sort((a, b) => b.value - a.value);

  const totalValue = withValue.reduce((a, p) => a + p.value, 0);
  if (totalValue === 0) return null;

  const top = withValue.slice(0, MAX_SEGMENTS);
  const restValue = withValue.slice(MAX_SEGMENTS).reduce((a, p) => a + p.value, 0);
  const segments = top.map((p, i) => ({ ...p, pct: (p.value / totalValue) * 100, color: PALETTE[i % PALETTE.length], clickable: true }));
  if (restValue > 0) {
    segments.push({ ticker: null, name: 'Otros', pct: (restValue / totalValue) * 100, color: OTHER_COLOR, clickable: false });
  }

  // Each segment's own share of the circle, plus the fraction already placed by every
  // segment before it (recomputed per item via slice+reduce, not a mutable running total,
  // so this stays a pure render-time computation — there are at most 7 segments, so the
  // O(n²) re-sum costs nothing in practice).
  const arcs = segments.map((seg, i) => {
    const fraction = seg.pct / 100;
    const priorFraction = segments.slice(0, i).reduce((a, s) => a + s.pct / 100, 0);
    const midFraction = priorFraction + fraction / 2;
    const angle = midFraction * 2 * Math.PI - Math.PI / 2; // 0 fraction = 12 o'clock, clockwise
    const x = 50 + LABEL_RADIUS * Math.cos(angle);
    const y = 50 + LABEL_RADIUS * Math.sin(angle);
    const visibleLen = Math.max(0, fraction * CIRCUMFERENCE - GAP);
    const dashOffset = -(priorFraction * CIRCUMFERENCE);
    return { ...seg, x, y, visibleLen, dashOffset };
  });

  const todayColor = todayPct == null ? C.text3 : todayPct >= 0 ? C.green : C.red;

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: '380px', aspectRatio: '1 / 1', margin: '0 auto', boxSizing: 'border-box' }}>
      <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', display: 'block' }} aria-hidden="true">
        <circle cx="50" cy="50" r={RADIUS} fill="none" stroke={C.borderSoft} strokeWidth={STROKE} />
        {arcs.map((a, i) => (
          <circle key={i} cx="50" cy="50" r={RADIUS} fill="none" stroke={a.color} strokeWidth={STROKE} strokeLinecap="round"
            strokeDasharray={`${a.visibleLen} ${CIRCUMFERENCE - a.visibleLen}`}
            strokeDashoffset={a.dashOffset}
            transform="rotate(-90 50 50)" />
        ))}
      </svg>

      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        <div style={{ fontSize: 'clamp(22px, 7.5vw, 32px)', fontWeight: 800, color: todayColor, lineHeight: 1 }}>
          {todayPct == null ? '—' : `${todayPct >= 0 ? '+' : ''}${todayPct.toFixed(2)}%`}
        </div>
        <div style={{ fontSize: '11px', fontWeight: 700, color: C.text3, letterSpacing: '0.6px', textTransform: 'uppercase', marginTop: '4px' }}>Hoy</div>
      </div>

      {arcs.map((a, i) => {
        const Tag = a.clickable ? 'button' : 'div';
        return (
          <Tag key={i}
            type={a.clickable ? 'button' : undefined}
            onClick={a.clickable ? () => onSelectTicker(a.ticker) : undefined}
            title={a.clickable ? `${a.name || a.ticker} · ${a.pct.toFixed(1)}% — editar` : `${a.name} · ${a.pct.toFixed(1)}%`}
            style={{
              position: 'absolute', left: `${a.x}%`, top: `${a.y}%`, transform: 'translate(-50%, -50%)',
              display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px 4px 4px', borderRadius: '20px',
              background: C.surface, border: `1px solid ${C.border}`, boxShadow: '0 2px 8px rgba(28,27,24,0.08)',
              cursor: a.clickable ? 'pointer' : 'default', whiteSpace: 'nowrap', fontFamily: 'inherit',
            }}>
            {a.ticker ? <StockLogo ticker={a.ticker} size={20} /> : (
              <span aria-hidden="true" style={{ width: '20px', height: '20px', borderRadius: '50%', background: a.color, flexShrink: 0 }} />
            )}
            <span style={{ fontSize: '11px', fontWeight: 700, color: C.ink }}>{a.pct.toFixed(0)}%</span>
          </Tag>
        );
      })}
    </div>
  );
}
