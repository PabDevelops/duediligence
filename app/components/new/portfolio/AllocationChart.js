'use client';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { NEW_COLORS as C } from '../theme';

// Fixed multi-hue chart palette for pie/allocation slices — intentionally outside the
// cream/lime theme tokens since it needs several visually distinct colors, not just the
// app's ink/lime/border set. Tuned to sit well against the cream background.
const PALETTE = ['#5A8A74', '#8B7FE8', '#D99A4E', '#5A9BD4', '#C1666B', '#7FA88A', '#B98FC9', '#E0A458', '#4F7A68', '#A4A4A4'];

export default function AllocationChart({ title, data }) {
  if (data.length === 0) return null;
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '20px', boxSizing: 'border-box' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, color: C.text3, letterSpacing: '0.8px', marginBottom: '12px', textTransform: 'uppercase' }}>
        {title}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ width: '110px', height: '110px', flexShrink: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={32} outerRadius={54} paddingAngle={2} stroke="none" isAnimationActive={false}>
                {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
              </Pie>
              <Tooltip formatter={(v, n) => [`${v.toFixed(1)}%`, n]} contentStyle={{ background: C.surface, border: `1px solid ${C.border}`, fontSize: 11, borderRadius: 10, fontFamily: 'inherit' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '7px', minWidth: 0 }}>
          {data.slice(0, 6).map((d, i) => (
            <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: PALETTE[i % PALETTE.length], flexShrink: 0 }} />
              <span style={{ color: C.ink, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
              <span style={{ color: C.text3, marginLeft: 'auto' }}>{d.value.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
