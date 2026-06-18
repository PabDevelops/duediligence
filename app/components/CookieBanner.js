'use client';
import { useState, useEffect } from 'react';

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const accepted = localStorage.getItem('cookie_consent');
    if (!accepted) setVisible(true);
  }, []);

  const accept = () => { localStorage.setItem('cookie_consent', 'accepted'); setVisible(false); };
  const decline = () => { localStorage.setItem('cookie_consent', 'declined'); setVisible(false); };

  if (!visible) return null;

  return (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'rgba(15,17,25,0.95)', backdropFilter: 'blur(20px)', borderTop: '1px solid var(--border)', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 100, gap: '24px', fontFamily: 'Nunito, sans-serif' }}>
      <div style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.6, maxWidth: '700px' }}>
        We use cookies to improve your experience and analyse site usage. By continuing you agree to our{' '}
        <a href="/privacy" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>Privacy Policy</a>
        {' '}and{' '}
        <a href="/terms" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>Terms of Service</a>.
      </div>
      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
        <button onClick={decline} className="btn-secondary" style={{ padding: '8px 20px' }}>Decline</button>
        <button onClick={accept} className="btn-primary" style={{ padding: '8px 20px' }}>Accept</button>
      </div>
    </div>
  );
}
