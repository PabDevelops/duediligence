'use client';
import { LineChart, Line, YAxis, ResponsiveContainer } from 'recharts';

export default function Sparkline({ data, color, width = 80, height = 32 }) {
  if (!data || data.length < 2) return <div style={{ width, height, background: 'var(--bg-2)' }} />;
  
  const first = data[0]?.c;
  const last = data[data.length - 1]?.c;
  const isUp = last >= first;
  const lineColor = color || (isUp ? 'var(--green)' : 'var(--red)');
  const chartData = data.map(d => ({ v: d.c }));

  return (
    <ResponsiveContainer width={width} height={height}>
      <LineChart data={chartData} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
        <YAxis domain={['auto', 'auto']} hide={true} />
        <Line type="monotone" dataKey="v" stroke={lineColor} strokeWidth={1.5} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}