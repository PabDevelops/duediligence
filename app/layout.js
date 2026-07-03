import "./globals.css";
import Script from 'next/script';
import { ClerkProvider } from '@clerk/nextjs';
import CookieBanner from './components/CookieBanner';
import WatchlistWidget from './components/WatchlistWidget';
import BottomNav from './components/BottomNav';
import TrialGate from './components/TrialGate';
import { Analytics } from '@vercel/analytics/react';

export const metadata = {
  metadataBase: new URL('https://traqcker.com'),
  title: "Traqcker — Stock Analysis in Seconds",
  description: "Know if a stock is worth it in seconds. Easy score, fair value, and community votes for 8,000+ US stocks. Free.",
  icons: {
    icon: '/favicon.png',
    apple: '/apple-touch-icon.png',
    other: [{ rel: 'icon', url: '/icon-512.png', sizes: '512x512' }],
  },
  openGraph: {
    title: "Traqcker — Know if a stock is worth it. In seconds.",
    description: "Easy score, fair value check, and community Buy/Hold/Sell votes for 8,000+ US stocks. Free forever.",
    url: "https://traqcker.com",
    siteName: "Traqcker",
    images: [
      {
        url: "https://traqcker.com/og-screenshot.png",
        width: 1200,
        height: 630,
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Traqcker — Know if a stock is worth it. In seconds.",
    description: "Easy score, fair value check, and community votes for 8,000+ US stocks. Free.",
    images: ["https://traqcker.com/og-screenshot.png"],
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <ClerkProvider publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}>
      <html lang="en">
        <body suppressHydrationWarning>
          <TrialGate />
          {children}
          <BottomNav />
          <WatchlistWidget />
          <CookieBanner />
          <Analytics />
          <Script
            src="https://datafa.st/js/script.js"
            data-website-id="dfid_WAIi12RsesdbDTvKjxaVj"
            data-domain="traqcker.com"
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
    </ClerkProvider>
  );
}
