import { getDictionary } from '../../../lib/i18n/getDictionary';
import HomeView from './HomeView';

export async function generateMetadata({ params }) {
  const { locale } = await params;
  return {
    alternates: {
      canonical: locale === 'es' ? '/es' : '/',
      languages: { en: '/', es: '/es' },
    },
  };
}

const softwareAppJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Traqcker',
  applicationCategory: 'FinanceApplication',
  operatingSystem: 'Web',
  description: 'Terminal-style investment research and portfolio tracking platform using a proprietary GARP-based scoring system built on free cash flow analysis, covering 50,000+ companies with data from SEC EDGAR and Finnhub.',
  offers: [
    {
      '@type': 'Offer',
      name: 'Free',
      price: '0',
      priceCurrency: 'USD',
      description: 'Capped screener with some categories hidden; no data for non-US stocks without a free account.',
      url: 'https://traqcker.com/pricing',
    },
    {
      '@type': 'Offer',
      name: 'Full access',
      price: '14.99',
      priceCurrency: 'USD',
      priceValidUntil: '2027-12-31',
      description: 'Uncapped screener, all categories, and full international data. 14-day free trial, no credit card required.',
      url: 'https://traqcker.com/pricing',
    },
  ],
  author: {
    '@type': 'Person',
    name: 'Pablo',
    sameAs: 'https://twitter.com/pabloinvesting_',
  },
};

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Traqcker',
  url: 'https://traqcker.com',
  logo: 'https://traqcker.com/icon-512.png',
  sameAs: ['https://twitter.com/pabloinvesting_'],
};

const authorJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: 'Pablo',
  url: 'https://traqcker.com/about',
  sameAs: ['https://twitter.com/pabloinvesting_'],
  jobTitle: 'Founder',
  worksFor: {
    '@type': 'Organization',
    name: 'Traqcker',
    url: 'https://traqcker.com',
  },
  description: 'Independent investor and indie developer. Builder of Traqcker and publisher of equity research through Hawthorne & Fletcher Research using the Invest Data Score framework and the Physical Wall thesis.',
};

export default async function Home({ params }) {
  const { locale } = await params;
  const dict = getDictionary(locale);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareAppJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(authorJsonLd) }} />
      <HomeView dict={dict} locale={locale} />
    </>
  );
}
