export const metadata = {
  title: 'Stock Screener — Filter by P/E, ROIC, Growth | Traqcker',
  description: 'Screen thousands of global equities by fundamental quality scores, P/E ratio, ROIC, revenue growth, and custom financial indicators.',
  openGraph: {
    title: 'Stock Screener | Traqcker',
    description: 'Filter thousands of global equities by institutional-grade fundamentals: quality scores, P/E, ROIC, free cash flow yield, and more.',
    url: 'https://traqcker.com/screener',
    siteName: 'Traqcker',
    images: [{ url: '/og-screenshot.png', width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Stock Screener | Traqcker',
    description: 'Filter thousands of global equities by quality scores, valuation multiples, and key financial metrics.',
    images: ['/og-screenshot.png'],
  },
  alternates: { canonical: 'https://traqcker.com/screener' },
};

export default function ScreenerLayout({ children }) {
  return children;
}
