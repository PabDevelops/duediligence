'use client';
import { localizeHref } from '../../../lib/i18n/locale';

const CONTAINER = { maxWidth: '1160px', margin: '0 auto', padding: '0 clamp(16px, 5vw, 24px)' };

export default function Footer({ dict, locale }) {
  const href = (path) => localizeHref(path, locale);

  return (
    <footer style={{ borderTop: '1px solid var(--border)', background: '#fafafa', padding: 'clamp(40px, 6vw, 60px) clamp(16px, 5vw, 24px) clamp(56px, 8vw, 80px)' }}>
      <div style={{ ...CONTAINER, padding: 0, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '40px' }}>
        <div style={{ maxWidth: '280px' }}>
          <img src="/logo-traqcker-new.png" alt="Traqcker" style={{ height: '16px', width: 'auto', marginBottom: '16px' }} />
          <p style={{ fontSize: '12px', color: 'var(--text-3)', lineHeight: 1.5 }}>
            {dict.tagline}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 'clamp(32px, 8vw, 64px)', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>{dict.product}</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
              <li><a href={href('/pricing')} style={{ textDecoration: 'none', color: 'var(--text-2)' }}>{dict.pricingLink}</a></li>
              <li><a href={href('/about')} style={{ textDecoration: 'none', color: 'var(--text-2)' }}>{dict.proFeatures}</a></li>
            </ul>
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>{dict.company}</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
              <li><a href={href('/about')} style={{ textDecoration: 'none', color: 'var(--text-2)' }}>{dict.aboutUs}</a></li>
              <li><a href={href('/faq')} style={{ textDecoration: 'none', color: 'var(--text-2)' }}>{dict.faqLink}</a></li>
              <li><a href={href('/privacy')} style={{ textDecoration: 'none', color: 'var(--text-2)' }}>{dict.privacyPolicy}</a></li>
              <li><a href={href('/terms')} style={{ textDecoration: 'none', color: 'var(--text-2)' }}>{dict.termsOfService}</a></li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
