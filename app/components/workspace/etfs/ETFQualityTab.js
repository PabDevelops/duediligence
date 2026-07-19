'use client';
import { computeETFQualityScore } from '../../../../lib/etfQuality';

const scoreColor = (s) => s == null ? 'var(--ws-text-3)' : s >= 70 ? 'var(--ws-accent)' : s >= 40 ? 'var(--ws-text)' : 'var(--ws-red)';

const ScoreBar = ({ score }) => (
  <div style={{ height: '3px', background: 'var(--ws-border)', marginTop: '8px', borderRadius: '2px' }}>
    <div style={{ width: `${score ?? 0}%`, height: '100%', background: scoreColor(score), borderRadius: '2px' }} />
  </div>
);

export default function ETFQualityTab({ etf }) {
  if (!etf) return null;
  const result = computeETFQualityScore(etf);
  const { composite, factors } = result;

  const heroCells = [
    { key: 'cost', label: 'COST', factor: factors.cost },
    { key: 'liquidity', label: 'LIQUIDITY', factor: factors.liquidity },
    { key: 'diversification', label: 'DIVERSIFICATION', factor: factors.diversification },
    { key: 'composite', label: 'COMPOSITE SCORE', score: composite, highlight: true, desc: 'Weighted average of available factors' },
  ];

  return (
    <div>
      <div style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', padding: '24px', overflow: 'hidden', marginBottom: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1px', background: 'var(--ws-border)' }}>
          {heroCells.map((c) => {
            const score = c.factor ? c.factor.score : c.score;
            const available = c.factor ? c.factor.available : score != null;
            const desc = c.factor ? c.factor.desc : c.desc;
            return (
              <div key={c.key} style={{ background: c.highlight ? 'var(--ws-bg-2)' : 'var(--ws-bg-1)', padding: '12px 8px', textAlign: 'center' }}>
                <div style={{ color: 'var(--ws-text-3)', fontSize: '8px', letterSpacing: '1px', marginBottom: '8px', lineHeight: 1.3 }}>{c.label}</div>
                <div style={{ fontSize: c.highlight ? '36px' : '30px', fontWeight: 700, color: scoreColor(score), letterSpacing: '-1px', lineHeight: 1 }}>
                  {available && score != null ? Math.round(score) : 'N/A'}
                </div>
                <div style={{ color: 'var(--ws-text-3)', fontSize: '8px', marginTop: '4px', lineHeight: 1.3 }}>
                  {available ? desc : (c.factor?.reason || 'Not enough data')}
                </div>
                {available && <ScoreBar score={score} />}
              </div>
            );
          })}
        </div>
        <div style={{ color: 'var(--ws-text-3)', fontSize: '10px', letterSpacing: '1px', marginTop: '12px', textAlign: 'center' }}>
          AUTOMATED SCORE · BASED ON EXPENSE RATIO, AUM &amp; VOLUME, HOLDINGS CONCENTRATION · NOT A RECOMMENDATION
        </div>
      </div>

      <div style={{ color: 'var(--ws-text-3)', fontSize: '10px', letterSpacing: '2px', borderBottom: '1px solid var(--ws-border)', paddingBottom: '6px', marginBottom: '12px' }}>FACTOR BREAKDOWN</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: 'var(--ws-border)' }}>
        {Object.values(factors).map((f) => (
          <div key={f.label} style={{ background: 'var(--ws-bg-1)', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: 'var(--ws-text-3)', fontSize: '10px', letterSpacing: '1px' }}>{f.label.toUpperCase()}</span>
              {f.available && <span style={{ color: scoreColor(f.score), fontSize: '10px' }}>{Math.round(f.score)}/100</span>}
            </div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: f.available ? 'var(--ws-text)' : 'var(--ws-text-3)', marginBottom: '4px' }}>
              {f.available ? f.raw : (f.reason || 'N/A')}
            </div>
            <div style={{ color: 'var(--ws-text-3)', fontSize: '10px' }}>{f.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
