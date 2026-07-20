export const metadata = {
  title: 'Small & Micro Cap Screener | Traqcker',
  description: 'A dedicated screener for small-cap and micro-cap equities, scored with quality benchmarks calibrated to their size instead of mega-cap thresholds.',
  openGraph: {
    title: 'Small & Micro Cap Screener | Traqcker',
    description: 'Classify and analyze small-cap ($300M–$2B) and micro-cap (<$300M) stocks with size-calibrated quality scoring.',
    url: 'https://traqcker.com/small-caps',
    siteName: 'Traqcker',
    images: [{ url: '/og-screenshot.png', width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Small & Micro Cap Screener | Traqcker',
    description: 'A dedicated screener for small and micro caps, scored with size-calibrated benchmarks.',
    images: ['/og-screenshot.png'],
  },
  alternates: { canonical: 'https://traqcker.com/small-caps' },
};

export default function SmallCapsLayout({ children }) {
  return children;
}
