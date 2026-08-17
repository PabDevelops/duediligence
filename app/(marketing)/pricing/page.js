import { getDictionary } from '../../../lib/i18n/getDictionary';
import PricingView from './PricingView';

export const metadata = {
  title: 'Pricing & Plans — Bulltrace',
  description: 'Create a free Bulltrace account for full DCF valuation, projections, Fair Value, and an uncapped stock screener. No credit card. Upgrade to Pro for Portfolio, ETFs, and unlimited discovery.',
  openGraph: {
    title: 'Pricing & Plans | Bulltrace',
    description: 'Free to start, no credit card. Upgrade to Pro for multi-currency Portfolio tracking, full ETF coverage, and unlimited daily stock discovery.',
    url: 'https://bulltrace.app/pricing',
    siteName: 'Bulltrace',
    images: [{ url: '/og-screenshot.png', width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pricing & Plans | Bulltrace',
    description: 'Free to start, no credit card. Upgrade to Pro for multi-currency Portfolio tracking, full ETF coverage, and unlimited daily stock discovery.',
    images: ['/og-screenshot.png'],
  },
  alternates: {
    canonical: '/pricing',
  },
};

export default function Pricing() {
  const dict = getDictionary();
  return <PricingView dict={dict} />;
}
