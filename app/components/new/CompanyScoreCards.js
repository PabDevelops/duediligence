import { getCompanyHeaderScores } from '../../../lib/companyHeaderScores';
import { NEW_COLORS as C } from './theme';

// Category colors stay fixed regardless of the tier. The letter carries the grade.
const DIMENSION_COLORS = {
  growth: '#226D3A',
  value: '#245FA6',
  quality: '#7440A1',
};

export default function CompanyScoreCards({ easyMode, data, analysis }) {
  const scores = getCompanyHeaderScores(easyMode, data, analysis);
  return (
    <section aria-label="Puntuaciones independientes de la empresa" style={{
      display: 'flex', gap: '22px', flex: '0 1 auto', minWidth: 0,
    }}>
      {scores.map(({ id, name, tier, description, indicative, coverage }) => (
        <article key={id} aria-label={name} title={indicative ? `${indicative.description} ${description}` : description} style={{
          minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
        }}>
          <h2 style={{ margin: 0, fontSize: '9px', fontWeight: 700, letterSpacing: '0.02em', color: C.text2 }}>{name}</h2>
          <div aria-label={indicative ? `${indicative.tier}, nota orientativa` : undefined} style={{ fontSize: '26px', fontWeight: 800, lineHeight: 1.1, color: DIMENSION_COLORS[id], borderBottom: indicative ? `1px dashed ${DIMENSION_COLORS[id]}` : undefined }}>{tier ?? indicative?.tier ?? 'N/D'}</div>
          {indicative && <span style={{ fontSize: '9px', color: C.text2, textAlign: 'center' }}>Orientativa<br />{Math.round(coverage * 100)}% cobertura</span>}
        </article>
      ))}
    </section>
  );
}
