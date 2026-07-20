import { getDictionary } from '../../../lib/i18n/getDictionary';
import AboutView from './AboutView';

export const metadata = {
  title: 'About Traqcker — How It Works',
  description: 'Traqcker analyses stocks from SEC EDGAR filings and gives you a simple quality score and fair value estimate. No finance degree needed.',
  openGraph: {
    title: 'About Traqcker — How It Works',
    description: 'Real data from company filings. Simple quality score and fair value. No jargon.',
    url: 'https://traqcker.com/about',
    siteName: 'Traqcker',
    images: [{ url: '/og-screenshot.png', width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'About Traqcker — How It Works',
    description: 'Real data from company filings. Simple quality score and fair value. No jargon.',
    images: ['/og-screenshot.png'],
  },
  alternates: {
    canonical: '/about',
  },
};

export default function About() {
  const dict = getDictionary();
  return <AboutView dict={dict} />;
}
