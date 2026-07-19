'use client';
import { useEffect, useRef, useState } from 'react';
import { useUser } from './AuthProvider';

const ADSENSE_CLIENT_ID = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;

// Renders one AdSense ad unit — only for signed-out visitors (subscribers never see ads)
// and only once a slot ID has been configured. `slot` is the numeric ad unit ID from the
// AdSense dashboard (Ads > By ad unit), passed as a prop rather than hardcoded so each
// placement (home, stock detail, ...) can use its own unit.
export default function AdSlot({ slot, format = 'auto', style }) {
  const { isSignedIn, isLoaded } = useUser();
  const [consented, setConsented] = useState(false);
  const insRef = useRef(null);
  const pushed = useRef(false);

  useEffect(() => {
    const check = () => setConsented(localStorage.getItem('cookie_consent') === 'accepted');
    check();
    window.addEventListener('cookieConsentChanged', check);
    return () => window.removeEventListener('cookieConsentChanged', check);
  }, []);

  const shouldRender = isLoaded && !isSignedIn && consented && ADSENSE_CLIENT_ID && slot;

  useEffect(() => {
    if (!shouldRender || pushed.current) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch (e) {}
  }, [shouldRender]);

  if (!shouldRender) return null;

  return (
    <ins
      ref={insRef}
      className="adsbygoogle"
      style={{ display: 'block', ...style }}
      data-ad-client={ADSENSE_CLIENT_ID}
      data-ad-slot={slot}
      data-ad-format={format}
      data-full-width-responsive="true"
    />
  );
}
