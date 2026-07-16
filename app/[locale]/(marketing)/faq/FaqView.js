'use client';
import Topbar from '../../../components/Topbar';
import Footer from '../../../components/marketing/Footer';

export default function FaqView({ dict, locale }) {
  const t = dict.faq;
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', fontFamily: 'Inter, sans-serif' }}>
      <Topbar />
      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '60px 24px 100px' }}>
        <div style={{ color: 'var(--accent)', fontSize: '11px', letterSpacing: '2px', marginBottom: '12px', fontWeight: 700 }}>{t.eyebrow}</div>
        <h1 style={{ fontSize: '36px', fontWeight: 800, letterSpacing: '-1px', marginBottom: '12px' }}>{t.title}</h1>
        <p style={{ color: 'var(--text-2)', fontSize: '14px', lineHeight: 1.7, marginBottom: '48px' }}>{t.subtitle}</p>

        {t.items.map(item => (
          <div key={item.q} style={{ marginBottom: '28px', paddingBottom: '28px', borderBottom: '1px solid var(--border)' }}>
            <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text)', marginBottom: '10px' }}>{item.q}</h2>
            <p style={{ color: 'var(--text-2)', fontSize: '14px', lineHeight: 1.8 }}>{item.a}</p>
          </div>
        ))}
      </div>
      <Footer dict={dict.home.footer} locale={locale} />
    </div>
  );
}
