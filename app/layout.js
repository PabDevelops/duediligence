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
  title: "Bulltrace — Entiende cualquier acción antes de invertir",
  description: "Análisis fundamental de acciones con datos directos de la SEC. Nota de calidad, proyección a 5 años y veredictos claros — sin jerga, sin recomendaciones de compra o venta.",
  icons: {
    icon: '/favicon.png',
    apple: '/apple-touch-icon.png',
    other: [{ rel: 'icon', url: '/icon-512.png', sizes: '512x512' }],
  },
  // iOS doesn't read the Web App Manifest's display:'standalone' the way Android/Chrome does —
  // this is what actually gets Safari's "Add to Home Screen" to open without the browser chrome
  // there. appleWebApp.title is deliberately short: iOS truncates the home-screen label hard.
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Bulltrace',
  },
  openGraph: {
    title: "Bulltrace — Entiende cualquier acción antes de invertir",
    description: "Análisis fundamental de acciones con datos directos de la SEC. Nota de calidad, proyección a 5 años y veredictos claros — sin jerga, sin recomendaciones de compra o venta.",
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
    title: "Bulltrace — Entiende cualquier acción antes de invertir",
    description: "Análisis fundamental de acciones con datos directos de la SEC. Nota de calidad, proyección a 5 años y veredictos claros — sin jerga, sin recomendaciones de compra o venta.",
    images: ["https://bulltrace.app/og-screenshot.png"],
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1C1B18',
};

export default function RootLayout({ children }) {
  return (
    <AuthProvider>
      <html lang="es" suppressHydrationWarning>
        <head suppressHydrationWarning>
          {/* Next's appleWebApp metadata (above) only emits the newer "mobile-web-app-capable"
              tag in this Next.js version — iOS Safari still specifically needs the apple-
              prefixed one to open "Add to Home Screen" without browser chrome. */}
          <meta name="apple-mobile-web-app-capable" content="yes" />
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
