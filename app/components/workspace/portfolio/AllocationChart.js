'use client';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

// Fixed multi-hue chart palette for pie/allocation slices — intentionally outside the --ws-* theme tokens
// since it needs 10 visually distinct colors, not just the app's accent/text/border set.
const PALETTE = ['#4f7a68', '#7c6fe0', '#d99a4e', '#5a9bd4', '#c1666b', '#8fb996', '#b98fc9', '#e0a458', '#6b9080', '#a4a4a4'];

// `onClick`/`open` are optional — passing them turns the card into a toggle (Watchlist's
// collapsed-by-default pie groups); omitting them keeps the plain static card Portfolio uses.
export default function AllocationChart({ title, data, onClick, open, onRename }) {
  if (data.length === 0) return null;
  return (
    <div className="border p-4" onClick={onClick}
      style={{ borderColor: open ? 'var(--ws-accent)' : 'var(--ws-border)', cursor: onClick ? 'pointer' : 'default' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: 'var(--ws-text-3)', letterSpacing: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {title}
          </div>
          {onRename && (
            <button
              onClick={(e) => { e.stopPropagation(); onRename(); }}
              title="Rename category"
              style={{ background: 'none', border: 'none', color: 'var(--ws-text-3)', cursor: 'pointer', opacity: 0.5, padding: '2px', display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}
              onMouseEnter={e => { e.currentTarget.style.opacity = 1; e.currentTarget.style.color = 'var(--ws-accent)'; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = 0.5; e.currentTarget.style.color = 'var(--ws-text-3)'; }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
              </svg>
            </button>
          )}
        </div>
        {onClick && <span style={{ fontSize: '11px', color: open ? 'var(--ws-accent)' : 'var(--ws-text-3)', flexShrink: 0 }}>{open ? '▾' : '▸'}</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ width: '120px', height: '120px', flexShrink: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={34} outerRadius={58} paddingAngle={2} stroke="none" isAnimationActive={false}>
                {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
              </Pie>
              <Tooltip formatter={(v, n) => [`${v.toFixed(1)}%`, n]} contentStyle={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', fontSize: 11, borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
          {data.slice(0, 6).map((d, i) => (
            <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: PALETTE[i % PALETTE.length], flexShrink: 0 }} />
              <span style={{ color: 'var(--ws-text)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
              <span style={{ color: 'var(--ws-text-3)', marginLeft: 'auto' }}>{d.value.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
