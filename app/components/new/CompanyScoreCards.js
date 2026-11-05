import { getCompanyHeaderScores } from '../../../lib/companyHeaderScores';
import { NEW_COLORS as C } from './theme';

// Category colors stay fixed regardless of the tier. The letter carries the grade.
const DIMENSION_STYLE = {
  growth: { color: '#226D3A', background: '#EDF6EA' },
  value: { color: '#245FA6', background: '#EAF2FC' },
  quality: { color: '#7440A1', background: '#F3EBF8' },
};

export default function CompanyScoreCards({ easyMode, data }) {
  const scores = getCompanyHeaderScores(easyMode, data);
  return (
    <section aria-label="Puntuaciones independientes de la empresa" style={{
      display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px',
      flex: '1 1 330px', minWidth: 0,
    }}>
      {scores.map(({ id, name, score100, tier, description }) => (
        <article key={id} aria-label={name} style={{
          minWidth: 0, padding: 'clamp(8px, 1.2vw, 14px)', boxSizing: 'border-box',
          background: DIMENSION_STYLE[id].background, border: `1px solid ${C.border}`,
          borderTop: `3px solid ${DIMENSION_STYLE[id].color}`, borderRadius: '12px',
          display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '5px',
        }}>
          <h2 style={{ margin: 0, fontSize: '10px', fontWeight: 800, letterSpacing: '0.02em', color: DIMENSION_STYLE[id].color }}>{name}</h2>
          <div style={{ fontSize: '32px', fontWeight: 800, lineHeight: 1.1, color: C.ink }}>{tier ?? 'N/D'}</div>
          {score100 != null && <div style={{ fontSize: '12px', fontWeight: 700, color: C.text2 }}>{score100}/100</div>}
          <p style={{ margin: 0, fontSize: '11px', lineHeight: 1.45, color: C.text2, overflowWrap: 'anywhere' }}>{description}</p>
        </article>
      ))}
    </section>
  );
}
