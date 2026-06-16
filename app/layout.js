import "./globals.css";
import { ClerkProvider } from '@clerk/nextjs';
import CookieBanner from './components/CookieBanner';
import WatchlistWidget from './components/WatchlistWidget';
import BottomNav from './components/BottomNav';
import Header from './components/Header';
import { Analytics } from '@vercel/analytics/react';

export const metadata = {
  title: "Traqcker — Fundamental Stock Analysis",
  description: "Easy Mode score and plain-English verdict for any stock. Free access to 260+ companies with SEC data.",
  icons: {
    icon: '/favicon.png',
    apple: '/apple-touch-icon.png',
    other: [{ rel: 'icon', url: '/icon-512.png', sizes: '512x512' }],
  },
  openGraph: {
    title: "Traqcker — Easy Mode Stock Analysis",
    description: "Stock scores in seconds. Community votes. Free. Easy mode for everyday investors.",
    url: "https://traqcker.com",
    siteName: "Traqcker",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Traqcker — Easy Mode Stock Analysis",
    description: "Stock scores in seconds. Community votes. Free. Easy mode for everyday investors.",
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