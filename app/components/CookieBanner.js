'use client';
import { useState, useEffect } from 'react';
import { localizeHref } from '../../lib/i18n/locale';
import { useLocale } from '../../lib/i18n/useLocale';
import { getDictionary } from '../../lib/i18n/getDictionary';

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const locale = useLocale();
  const t = getDictionary(locale).cookieBanner;

  useEffect(() => {
    const accepted = localStorage.getItem('cookie_consent');
    if (!accepted) setVisible(true);
  }, []);

  const accept = () => { localStorage.setItem('cookie_consent', 'accepted'); setVisible(false); };
  const decline = () => { localStorage.setItem('cookie_consent', 'declined'); setVisible(false); };

  if (!visible) return null;

  return (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'rgba(15,17,25,0.95)', backdropFilter: 'blur(20px)', borderTop: '1px solid var(--border)', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 100, gap: '24px', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.6, maxWidth: '700px' }}>
        {t.message}{' '}
        <a href={localizeHref('/privacy', locale)} style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>{t.privacyPolicy}</a>
        {' '}{t.and}{' '}
        <a href={localizeHref('/terms', locale)} style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>{t.termsOfService}</a>.
      </div>
      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
        <button onClick={decline} className="btn-secondary" style={{ padding: '8px 20px' }}>{t.decline}</button>
        <button onClick={accept} className="btn-primary" style={{ padding: '8px 20px' }}>{t.accept}</button>
      </div>
    </div>
  );
}
