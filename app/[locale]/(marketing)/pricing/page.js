import { getDictionary } from '../../../../lib/i18n/getDictionary';
import PricingView from './PricingView';

const META = {
  en: {
    title: 'Pricing & Plans — Traqcker',
    description: 'Create a free Traqcker account for full DCF valuation, projections, Fair Value, and an uncapped stock screener. No credit card. Upgrade to Pro for Portfolio, ETFs, and unlimited discovery.',
    ogTitle: 'Pricing & Plans | Traqcker',
    ogDescription: 'Free to start, no credit card. Upgrade to Pro for multi-currency Portfolio tracking, full ETF coverage, and unlimited daily stock discovery.',
  },
  es: {
    title: 'Precios y planes — Traqcker',
    description: 'Crea una cuenta gratuita de Traqcker para la valoración DCF completa, proyecciones, Fair Value y un screener sin límite. Sin tarjeta. Mejora a Pro para Cartera, ETFs y descubrimiento sin límite.',
    ogTitle: 'Precios y planes | Traqcker',
    ogDescription: 'Gratis para empezar, sin tarjeta. Mejora a Pro para seguimiento de cartera multidivisa, cobertura completa de ETFs y descubrimiento diario sin límite.',
  },
};

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const m = META[locale] || META.en;
  const path = locale === 'es' ? '/es/pricing' : '/pricing';
  return {
    title: m.title,
    description: m.description,
    openGraph: {
      title: m.ogTitle,
      description: m.ogDescription,
      url: `https://traqcker.com${path}`,
      siteName: 'Traqcker',
      images: [{ url: '/og-screenshot.png', width: 1200, height: 630 }],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: m.ogTitle,
      description: m.ogDescription,
      images: ['/og-screenshot.png'],
    },
    alternates: {
      canonical: `https://traqcker.com${path}`,
      languages: { en: '/pricing', es: '/es/pricing' },
    },
  };
}

export default async function Pricing({ params }) {
  const { locale } = await params;
  const dict = getDictionary(locale);
  return <PricingView dict={dict} locale={locale} />;
}
