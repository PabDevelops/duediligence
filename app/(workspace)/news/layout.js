export const metadata = {
  title: 'Market News | Traqcker',
  description: 'Stock & ETF headlines from across the market, plus personalized news for your portfolio and watchlist.',
  openGraph: {
    title: 'Market News | Traqcker',
    description: 'Stock & ETF headlines from across the market, plus personalized news for your portfolio and watchlist.',
    url: 'https://traqcker.com/news',
    siteName: 'Traqcker',
    images: [{ url: '/og-screenshot.png', width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Market News | Traqcker',
    description: 'Stock & ETF headlines from across the market, plus personalized news for your portfolio and watchlist.',
    images: ['/og-screenshot.png'],
  },
  alternates: { canonical: 'https://traqcker.com/news' },
};

export default function NewsLayout({ children }) {
  return children;
}
