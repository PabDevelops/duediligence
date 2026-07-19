import Script from 'next/script';

const ADSENSE_CLIENT_ID = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;

// Loaded unconditionally (no consent gate) — Google's site-verification crawler
// fetches the page without executing a cookie-consent flow, so if this were
// gated behind `cookie_consent === 'accepted'` (like GoogleAnalytics.js) it
// would never see the tag and site verification would stay stuck pending.
// Actual ad requests are still consent-gated: AdSlot.js only pushes an ad unit
// once the visitor has accepted cookies, so this script alone doesn't serve
// anything by itself.
export default function AdSense() {
  if (!ADSENSE_CLIENT_ID) return null;

  return (
    <Script
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`}
      crossOrigin="anonymous"
      strategy="afterInteractive"
    />
  );
}
