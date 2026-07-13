'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Topbar from '../../../components/Topbar';
import { localizeHref } from '../../../../lib/i18n/locale';

export default function SuccessView({ dict, locale }) {
  const router = useRouter();
  const t = dict.success;
  const homeHref = localizeHref('/', locale);

  useEffect(() => {
    setTimeout(() => router.push(homeHref), 5000);
  }, []);

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', fontFamily: 'Inter, sans-serif' }}>
      <Topbar />
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '100px 24px', textAlign: 'center' }}>
        <div className="glass" style={{ padding: '48px 40px' }}>
          <div style={{ fontSize: '56px', marginBottom: '24px' }}>🎉</div>
          <div style={{ color: 'var(--accent)', fontSize: '11px', letterSpacing: '2px', marginBottom: '12px', fontWeight: 700 }}>{t.badge}</div>
          <h1 style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-0.5px', marginBottom: '12px' }}>{t.title}</h1>
          <p style={{ color: 'var(--text-2)', fontSize: '15px', lineHeight: 1.7, marginBottom: '32px' }}>
            {t.subtitle}
          </p>
          <a href={homeHref} className="btn-primary" style={{ display: 'inline-block' }}>{t.cta}</a>
          <div style={{ color: 'var(--text-3)', fontSize: '12px', marginTop: '20px' }}>
            {t.redirecting}
          </div>
        </div>
      </div>
    </div>
  );
}
