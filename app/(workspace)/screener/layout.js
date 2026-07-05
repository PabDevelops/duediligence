export const metadata = {
  title: 'Stock Screener — Filter by P/E, ROIC, Growth | Traqcker',
  description: 'Screen 8,000+ US stocks by quality score, P/E ratio, ROIC, revenue growth and more. Find undervalued stocks for free.',
  openGraph: {
    title: 'Stock Screener | Traqcker',
    description: 'Filter 8,000+ US stocks by fundamentals. Quality score, P/E, ROIC, FCF yield and more. Free.',
    url: 'https://traqcker.com/screener',
    siteName: 'Traqcker',
    images: [{ url: '/og-screenshot.png', width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Stock Screener | Traqcker',
    description: 'Filter 8,000+ US stocks by fundamentals. Free.',
    images: ['/og-screenshot.png'],
  },
  alternates: { canonical: 'https://traqcker.com/screener' },
};

export default function ScreenerLayout({ children }) {
  return children;
}
