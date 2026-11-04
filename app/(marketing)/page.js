import HomeView from './HomeView';

export const metadata = {
  title: 'Bulltrace — Entiende cualquier acción antes de invertir',
  description: 'Datos directos de la SEC, una nota de calidad clara y una proyección a 5 años para cualquier acción — sin jerga, sin recomendaciones de compra/venta. Gratis para empezar.',
  alternates: {
    canonical: '/',
  },
};

const softwareAppJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Bulltrace',
  applicationCategory: 'FinanceApplication',
  operatingSystem: 'Web',
  description: 'Investment research and portfolio tracking platform for retail investors. Analyzes any stock across five independent dimensions (quality, momentum, valuation, risk, potential) plus a 5-year discounted-cash-flow scenario model, using data sourced directly from SEC EDGAR, Yahoo Finance and Finnhub — covering 260+ companies.',
  offers: [
    {
      '@type': 'Offer',
      name: 'Free',
      price: '0',
      priceCurrency: 'EUR',
      description: 'Quality verdicts and 5-year projection on every stock, quality notes on stocks and ETFs, a watchlist of up to 20 stocks, and unlimited stock/ETF search.',
      url: 'https://bulltrace.app/pricing',
    },
    {
      '@type': 'Offer',
      name: 'Pro',
      price: '14.99',
      priceCurrency: 'EUR',
      priceValidUntil: '2027-12-31',
      description: 'Everything in Free plus multi-currency portfolio tracking, an unlimited watchlist, and unlimited daily discovery. 14-day free trial, no credit card required.',
      url: 'https://bulltrace.app/pricing',
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
  name: 'Bulltrace',
  url: 'https://bulltrace.app',
  logo: 'https://bulltrace.app/icon-512.png',
  sameAs: ['https://twitter.com/pabloinvesting_'],
};

const authorJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: 'Pablo',
  url: 'https://bulltrace.app/about',
  sameAs: ['https://twitter.com/pabloinvesting_'],
  jobTitle: 'Founder',
  worksFor: {
    '@type': 'Organization',
    name: 'Bulltrace',
    url: 'https://bulltrace.app',
  },
  description: 'Independent investor and indie developer. Builder of Bulltrace and publisher of equity research through Hawthorne & Fletcher Research using the Invest Data Score framework and the Physical Wall thesis.',
};

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareAppJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(authorJsonLd) }} />
      <HomeView />
    </>
  );
}
