'use client';
import { useState, useEffect } from 'react';
import { getDictionary } from '../../lib/i18n/getDictionary';
import { pollGoogleCmp } from '../../lib/googleCmp';

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const t = getDictionary().cookieBanner;

  useEffect(() => {
    const accepted = localStorage.getItem('cookie_consent');
    if (accepted) return;
    // EEA/UK/CH visitors get Google's own certified CMP message (wired through the
    // AdSense script) — showing ours on top would be a confusing double banner.
    pollGoogleCmp((cmpPresent) => { if (!cmpPresent) setVisible(true); });
  }, []);

  const accept = () => { localStorage.setItem('cookie_consent', 'accepted'); window.dispatchEvent(new Event('cookieConsentChanged')); setVisible(false); };
  const decline = () => { localStorage.setItem('cookie_consent', 'declined'); window.dispatchEvent(new Event('cookieConsentChanged')); setVisible(false); };

  if (!visible) return null;

  return (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'rgba(15,17,25,0.95)', backdropFilter: 'blur(20px)', borderTop: '1px solid var(--border)', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 100, gap: '24px', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.6, maxWidth: '700px' }}>
        {t.message}{' '}
        <a href="/privacy" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>{t.privacyPolicy}</a>
        {' '}{t.and}{' '}
        <a href="/terms" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>{t.termsOfService}</a>.
      </div>
      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
        <button onClick={decline} className="btn-secondary" style={{ padding: '8px 20px' }}>{t.decline}</button>
        <button onClick={accept} className="btn-primary" style={{ padding: '8px 20px' }}>{t.accept}</button>
      </div>
    </div>
  );
}
