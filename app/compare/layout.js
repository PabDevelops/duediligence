export const metadata = {
  title: 'Compare Stocks Side by Side | Traqcker',
  description: 'Compare two stocks side by side — revenue, earnings, valuation, quality score and more. Free fundamental comparison tool.',
  openGraph: {
    title: 'Compare Stocks | Traqcker',
    description: 'Compare any two stocks head-to-head. Revenue, P/E, ROIC, FCF and more. Free.',
    url: 'https://traqcker.com/compare',
    siteName: 'Traqcker',
    images: [{ url: '/og-screenshot.png', width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Compare Stocks | Traqcker',
    description: 'Compare any two stocks head-to-head. Free.',
    images: ['/og-screenshot.png'],
  },
  alternates: { canonical: 'https://traqcker.com/compare' },
};

export default function CompareLayout({ children }) {
  return children;
}
