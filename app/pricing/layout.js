export const metadata = {
  title: 'Pricing — Free vs Pro | Traqcker',
  description: 'Start free with unlimited stock analysis. Upgrade to Pro for the advanced screener, full financial history, and unlimited discovers.',
  openGraph: {
    title: 'Pricing | Traqcker',
    description: 'Free forever for stock analysis. Pro unlocks advanced screener, full history, and unlimited discovers.',
    url: 'https://traqcker.com/pricing',
    siteName: 'Traqcker',
    images: [{ url: '/og-screenshot.png', width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pricing | Traqcker',
    description: 'Free forever for stock analysis. Pro unlocks advanced screener and more.',
    images: ['/og-screenshot.png'],
  },
  alternates: { canonical: 'https://traqcker.com/pricing' },
};

export default function PricingLayout({ children }) {
  return children;
}
