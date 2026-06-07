'use client';
import { useState, useEffect } from 'react';

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const accepted = localStorage.getItem('cookie_consent');
    if (!accepted) setVisible(true);
  }, []);

  const accept = () => {
    localStorage.setItem('cookie_consent', 'accepted');
    setVisible(false);
  };

  const decline = () => {
    localStorage.setItem('cookie_consent', 'declined');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--bg-1)', borderTop: '1px solid var(--border)', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 100, gap: '24px', fontFamily: 'IBM Plex Mono, monospace' }}>
      <div style={{ fontSize: '11px', color: 'var(--text-2)', lineHeight: 1.6, maxWidth: '700px' }}>
        We use cookies to improve your experience and analyse site usage. By continuing you agree to our{' '}
        <a href="/privacy" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Privacy Policy</a>
        {' '}and{' '}
        <a href="/terms" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Terms of Service</a>.
      </div>
      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
        <button onClick={decline}
          style={{ padding: '6px 16px', background: 'none', border: '1px solid var(--border)', color: 'var(--text-3)', fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', cursor: 'pointer', letterSpacing: '1px' }}>
          DECLINE
        </button>
        <button onClick={accept}
          style={{ padding: '6px 16px', background: 'var(--accent)', border: 'none', color: '#000', fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', fontWeight: 700, cursor: 'pointer', letterSpacing: '1px' }}>
          ACCEPT
        </button>
      </div>
    </div>
  );
}