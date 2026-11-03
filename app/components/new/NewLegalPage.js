'use client';
import NewMarketingNav from './NewMarketingNav';
import NewMarketingFooter from './NewMarketingFooter';
import { NEW_COLORS as C } from './theme';

// Shared shell for Privacy and Terms — identical structure (eyebrow/title/last-updated,
// then a flat list of numbered sections), only the content differs.
export default function NewLegalPage({ title, lastUpdated, sections }) {
  return (
    <div style={{ width: '100%', minHeight: '100vh', boxSizing: 'border-box', background: C.bg, color: C.ink, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 'min(1200px, 92vw)', margin: '0 auto', padding: '32px 24px 0', boxSizing: 'border-box' }}>
        <NewMarketingNav />
      </div>

      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '40px 24px 96px', boxSizing: 'border-box' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: C.text3, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>LEGAL</div>
        <h1 style={{ margin: '0 0 8px', fontSize: '30px', fontWeight: 800, letterSpacing: '-0.02em' }}>{title}</h1>
        <div style={{ color: C.text3, fontSize: '13px', marginBottom: '36px' }}>{lastUpdated}</div>

        {sections.map(s => (
          <div key={s.title} style={{ marginBottom: '28px', paddingBottom: '28px', borderBottom: `1px solid ${C.borderSoft}` }}>
            <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '10px' }}>{s.title}</div>
            <div style={{ color: C.text2, fontSize: '13.5px', lineHeight: 1.75, whiteSpace: 'pre-line' }}>{s.content}</div>
          </div>
        ))}
      </div>

      <NewMarketingFooter />
    </div>
  );
}
