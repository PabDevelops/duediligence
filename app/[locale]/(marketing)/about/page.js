import { getDictionary } from '../../../../lib/i18n/getDictionary';
import AboutView from './AboutView';

const META = {
  en: {
    title: 'About Traqcker — How It Works',
    description: 'Traqcker analyses stocks from SEC EDGAR filings and gives you a simple quality score and fair value estimate. No finance degree needed.',
    ogDescription: 'Real data from company filings. Simple quality score and fair value. No jargon.',
  },
  es: {
    title: 'Sobre Traqcker — Cómo funciona',
    description: 'Traqcker analiza acciones a partir de los informes de SEC EDGAR y te da un quality score sencillo y una estimación de valor razonable. No hace falta ser experto en finanzas.',
    ogDescription: 'Datos reales de los informes de las empresas. Quality score y valor razonable sencillos. Sin jerga.',
  },
};

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const m = META[locale] || META.en;
  const path = locale === 'es' ? '/es/about' : '/about';
  return {
    title: m.title,
    description: m.description,
    openGraph: {
      title: m.title,
      description: m.ogDescription,
      url: `https://traqcker.com${path}`,
      siteName: 'Traqcker',
      images: [{ url: '/og-screenshot.png', width: 1200, height: 630 }],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: m.title,
      description: m.ogDescription,
      images: ['/og-screenshot.png'],
    },
    alternates: {
      canonical: `https://traqcker.com${path}`,
      languages: { en: '/about', es: '/es/about' },
    },
  };
}

export default async function About({ params }) {
  const { locale } = await params;
  const dict = getDictionary(locale);
  return <AboutView dict={dict} locale={locale} />;
}
