import "./globals.css";
import Script from 'next/script';
import { AuthProvider } from './components/AuthProvider';
import CookieBanner from './components/CookieBanner';
import BottomNav from './components/BottomNav';
import TrialGate from './components/TrialGate';
import { Analytics } from '@vercel/analytics/react';
import GoogleAnalytics from './components/GoogleAnalytics';
import AdSense from './components/AdSense';

export const metadata = {
  metadataBase: new URL('https://bulltrace.app'),
  title: "Bulltrace — Professional Investment Analysis",
  description: "Professional fundamental analysis powered by direct company filings. SEC EDGAR source verification, normalized multi-currency portfolios, intrinsic valuation modeling, and community intelligence.",
  icons: {
    icon: '/favicon.png',
    apple: '/apple-touch-icon.png',
    other: [{ rel: 'icon', url: '/icon-512.png', sizes: '512x512' }],
  },
  openGraph: {
    title: "Bulltrace — Professional Investment Analysis",
    description: "Professional investment analysis powered by direct company filings. SEC EDGAR source verification, normalized multi-currency portfolios, intrinsic valuation modeling, and community intelligence.",
    url: "https://bulltrace.app",
    siteName: "Bulltrace",
    images: [
      {
        url: "https://bulltrace.app/og-screenshot.png",
        width: 1200,
        height: 630,
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Bulltrace — Professional Investment Analysis",
    description: "Professional investment analysis powered by direct company filings. SEC EDGAR source verification, normalized multi-currency portfolios, intrinsic valuation modeling, and community intelligence.",
    images: ["https://bulltrace.app/og-screenshot.png"],
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <AuthProvider>
      <html lang="en" suppressHydrationWarning>
        <head suppressHydrationWarning>
          <script dangerouslySetInnerHTML={{ __html: `(function(){try{document.documentElement.setAttribute('data-ws-theme','dark')}catch(e){}})()` }} />
          <AdSense />
        </head>
        <body suppressHydrationWarning>
          <TrialGate />
          {children}
          <BottomNav />
          <CookieBanner />
          <Analytics />
          <GoogleAnalytics />
          <Script
            src="https://datafa.st/js/script.js"
            data-website-id="dfid_WAIi12RsesdbDTvKjxaVj"
            data-domain="bulltrace.app"
            strategy="afterInteractive"
          />
          <script dangerouslySetInnerHTML={{ __html: `
            (function() {
              const obs = new IntersectionObserver((entries) => {
                entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } });
              }, { threshold: 0.1 });
              document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
              const mo = new MutationObserver(() => {
                document.querySelectorAll('.reveal:not(.visible)').forEach(el => obs.observe(el));
              });
              mo.observe(document.body, { childList: true, subtree: true });
            })();
          ` }} />
        </body>
      </html>
    </AuthProvider>
  );
}
