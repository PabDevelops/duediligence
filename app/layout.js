import "./globals.css";
import { ClerkProvider } from '@clerk/nextjs';
import CookieBanner from './components/CookieBanner';
import WatchlistWidget from './components/WatchlistWidget';

export const metadata = {
  title: "Traqcker — Fundamental Stock Analysis",
  description: "Deep fundamental analysis for serious investors. SEC filings, proprietary scoring, Graham DCF.",
  icons: { icon: '/favicon.png' },
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
          {children}
          <WatchlistWidget />
          <CookieBanner />
        </body>
      </html>
    </ClerkProvider>
  );
}