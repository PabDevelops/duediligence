import "./globals.css";
import { ClerkProvider } from '@clerk/nextjs';
import CookieBanner from './components/CookieBanner';
import WatchlistWidget from './components/WatchlistWidget';
import BottomNav from './components/BottomNav';
import Header from './components/Header';
import { Analytics } from '@vercel/analytics/react';

export const metadata = {
  title: "Traqcker — Fundamental Stock Analysis",
  description: "Deep fundamental analysis for serious investors. SEC filings, proprietary scoring, Graham DCF.",
  icons: {
    icon: '/favicon.png',
    apple: '/apple-touch-icon.png',
    other: [{ rel: 'icon', url: '/icon-512.png', sizes: '512x512' }],
  },
  openGraph: {
    title: "Traqcker — Fundamental Stock Analysis",
    description: "No opinions. No noise. Just data from SEC EDGAR filings.",
    url: "https://traqcker.com",
    siteName: "Traqcker",
    images: [
      {
        url: "https://traqcker.com/og-image.png",
        width: 1200,
        height: 630,
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Traqcker — Fundamental Stock Analysis",
    description: "No opinions. No noise. Just data from SEC EDGAR filings.",
    images: ["https://traqcker.com/og-image.png"],
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <ClerkProvider publishableKey="pk_live_Y2xlcmsudHJhcWNrZXIuY29tJA">
      <html lang="en">
        <body>
          <Header />
          {children}
          <BottomNav />
          <WatchlistWidget />
          <CookieBanner />
          <Analytics />
        </body>
      </html>
    </ClerkProvider>
  );
}