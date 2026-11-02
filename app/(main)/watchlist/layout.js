export const metadata = {
  title: 'My Watchlist | Bulltrace',
  description: 'Track your favourite stocks. Quality scores, fair value estimates and key financials for every stock on your watchlist.',
  openGraph: {
    title: 'My Watchlist | Bulltrace',
    description: 'Track your favourite stocks with quality scores and fair value estimates.',
    url: 'https://bulltrace.app/watchlist',
    siteName: 'Bulltrace',
    images: [{ url: '/og-screenshot.png', width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'My Watchlist | Bulltrace',
    description: 'Track your favourite stocks with quality scores and fair value estimates.',
    images: ['/og-screenshot.png'],
  },
  alternates: { canonical: 'https://bulltrace.app/watchlist' },
};

export default function WatchlistLayout({ children }) {
  return children;
}
