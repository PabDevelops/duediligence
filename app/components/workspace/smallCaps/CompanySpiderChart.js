'use client';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';

function getMetricValue(spotlightData) {
  if (!spotlightData) return { growth: 50, margin: 50, roic: 50, val: 50, stability: 50, health: 50 };

  const revG = spotlightData.revGrowth ?? 0;
  const growthScore = Math.min(Math.max((revG + 10) * 2.5, 0), 100);

  const gMargin = spotlightData.grossMargin ?? 0;
  const marginScore = Math.min(Math.max(gMargin * 1.33, 0), 100);

  const roic = spotlightData.roic ?? 0;
  const roicScore = Math.min(Math.max(roic * 4, 0), 100);

  const pe = spotlightData.pe;
  let valScore = 50;
  if (pe != null && pe > 0) {
    valScore = Math.min(Math.max(100 - ((pe - 5) * 2), 0), 100);
  }

  const beta = spotlightData.beta ?? 1;
  const stabilityScore = Math.min(Math.max(100 - ((beta - 0.5) * 50), 0), 100);

  const de = spotlightData.debtToEquity ?? 1;
  const healthScore = Math.min(Math.max(100 - (de * 33), 0), 100);

  return {
    growth: Math.round(growthScore),
    margin: Math.round(marginScore),
    roic: Math.round(roicScore),
    val: Math.round(valScore),
    stability: Math.round(stabilityScore),
    health: Math.round(healthScore)
  };
}

function normalizeStockData(spotlightData, peerData) {
  const primary = getMetricValue(spotlightData);
  const peer = peerData ? getMetricValue(peerData) : null;

  return [
    { subject: 'Growth', value: primary.growth, peerValue: peer?.growth },
    { subject: 'Margin', value: primary.margin, peerValue: peer?.margin },
    { subject: 'ROIC', value: primary.roic, peerValue: peer?.roic },
    { subject: 'Valuation', value: primary.val, peerValue: peer?.val },
    { subject: 'Stability', value: primary.stability, peerValue: peer?.stability },
    { subject: 'Health', value: primary.health, peerValue: peer?.health },
  ];
}

const CustomTooltip = ({ active, payload, primaryTicker, peerTicker }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: 'var(--ws-bg-2)', border: '1px solid var(--ws-border)',
        padding: '8px 12px', fontSize: '11px',
        color: 'var(--ws-text)', boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
      }}>
        <div style={{ fontWeight: 800, color: 'var(--ws-accent)', marginBottom: '4px' }}>{payload[0].payload.subject}</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <span style={{ color: 'var(--ws-accent)', fontWeight: 700 }}>{primaryTicker || 'Stock'}: {payload[0].value}/100</span>
          {payload[1] && (
            <span style={{ color: '#f59e0b', fontWeight: 700 }}>{peerTicker || 'Peer'}: {payload[1].value}/100</span>
          )}
        </div>
      </div>
    );
  }
  return null;
};

export default function CompanySpiderChart({ spotlightData, peerData, peerTicker, height = 220 }) {
  const primaryTicker = spotlightData?.ticker || '';
  const chartData = normalizeStockData(spotlightData, peerData);

  return (
    <div style={{ width: '100%', height, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', marginBottom: '2px', padding: '0 4px'
      }}>
        <span style={{
          fontSize: '9px', fontWeight: 800, color: 'var(--ws-text-3)',
          letterSpacing: '1.5px', textTransform: 'uppercase'
        }}>
          FACTOR RADAR SPECTRUM
        </span>
        {peerData && (
          <div style={{ display: 'flex', gap: '10px', fontSize: '9px', fontWeight: 700 }}>
            <span style={{ color: 'var(--ws-accent)' }}>● {primaryTicker}</span>
            <span style={{ color: '#f59e0b' }}>● {peerTicker}</span>
          </div>
        )}
      </div>

      <div style={{ flex: 1, width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="65%" data={chartData}>
            <PolarGrid stroke="var(--ws-border)" />
            <PolarAngleAxis
              dataKey="subject"
              tick={{ fill: 'var(--ws-text-2)', fontSize: 10, fontWeight: 700 }}
            />
            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
            <Radar
              name={primaryTicker || "Primary"}
              dataKey="value"
              stroke="var(--ws-accent)"
              strokeWidth={2}
              fill="var(--ws-accent)"
              fillOpacity={0.2}
              activeDot={{ r: 5, fill: 'var(--ws-bg-1)', stroke: 'var(--ws-accent)', strokeWidth: 2 }}
            />
            {peerData && (
              <Radar
                name={peerTicker || "Peer"}
                dataKey="peerValue"
                stroke="#f59e0b"
                strokeWidth={2}
                fill="#f59e0b"
                fillOpacity={0.15}
                activeDot={{ r: 5, fill: 'var(--ws-bg-1)', stroke: '#f59e0b', strokeWidth: 2 }}
              />
            )}
            <Tooltip content={<CustomTooltip primaryTicker={primaryTicker} peerTicker={peerTicker} />} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
