'use client';
import Topbar from '../../components/Topbar';

export default function TermsView({ dict }) {
  const t = dict.terms;
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', fontFamily: 'Inter, sans-serif' }}>
      <Topbar />
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '60px 24px' }}>
        <div style={{ color: 'var(--accent)', fontSize: '11px', letterSpacing: '2px', marginBottom: '12px', fontWeight: 700 }}>{t.eyebrow}</div>
        <h1 style={{ fontSize: '36px', fontWeight: 800, letterSpacing: '-1px', marginBottom: '8px' }}>{t.title}</h1>
        <div style={{ color: 'var(--text-3)', fontSize: '13px', marginBottom: '40px' }}>{t.lastUpdated}</div>

        {t.sections.map(s => (
          <div key={s.title} style={{ marginBottom: '32px', paddingBottom: '32px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ color: 'var(--accent)', fontSize: '13px', fontWeight: 700, marginBottom: '12px' }}>{s.title}</div>
            <div style={{ color: 'var(--text-2)', fontSize: '14px', lineHeight: 1.9, whiteSpace: 'pre-line' }}>{s.content}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
