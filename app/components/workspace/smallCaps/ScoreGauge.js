'use client';

// Half-circle gauge for the Quality Score (0-100) — replaces the horizontal block-bar used
// elsewhere in the app for this same number, specifically in the Radar tab's tactical detail
// column, where a speedometer-style read is a faster glance than a bar. Uses the well-known
// polar-to-cartesian SVG-arc formula (angle 0 = top/12 o'clock, increasing clockwise) rather
// than a hand-derived one, since arc-sweep-direction math is exactly the kind of thing that's
// easy to get subtly backwards.
function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

export default function ScoreGauge({ score, color, size = 128 }) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 12;
  const pct = Math.max(0, Math.min(100, score ?? 0)) / 100;
  const progressEndAngle = -90 + pct * 180;

  return (
    <svg width={size} height={size / 2 + 24} viewBox={`0 0 ${size} ${size / 2 + 24}`}>
      <path d={describeArc(cx, cy, r, -90, 90)} fill="none" stroke="var(--ws-border)" strokeWidth="10" strokeLinecap="round" />
      {pct > 0 && (
        <path d={describeArc(cx, cy, r, -90, progressEndAngle)} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" />
      )}
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize="28" fontWeight="700" fill={color} fontFamily="'JetBrains Mono', monospace">
        {score ?? '—'}
      </text>
    </svg>
  );
}
