export const metadata = {
  title: 'Pricing & Plans — Traqcker Pro',
  description: 'Try Traqcker Pro free for 14 days. Access institutional-grade stock screeners, full financial statement histories, and advanced valuation tools.',
  openGraph: {
    title: 'Pricing & Plans | Traqcker',
    description: 'Start your 14-day free trial of Traqcker Pro. Unlock advanced screeners, full financial history, and comprehensive intrinsic valuation modeling.',
    url: 'https://traqcker.com/pricing',
    siteName: 'Traqcker',
    images: [{ url: '/og-screenshot.png', width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pricing & Plans | Traqcker',
    description: 'Start your 14-day free trial of Traqcker Pro. Unlock advanced screeners and full financial statement histories.',
    images: ['/og-screenshot.png'],
  },
  alternates: { canonical: 'https://traqcker.com/pricing' },
};

export default function PricingLayout({ children }) {
  return children;
}
