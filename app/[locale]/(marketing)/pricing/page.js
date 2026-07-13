import { getDictionary } from '../../../../lib/i18n/getDictionary';
import PricingView from './PricingView';

const META = {
  en: {
    title: 'Pricing & Plans — Traqcker Pro',
    description: 'Try Traqcker Pro free for 14 days. Access institutional-grade stock screeners, full financial statement histories, and advanced valuation tools.',
    ogTitle: 'Pricing & Plans | Traqcker',
    ogDescription: 'Start your 14-day free trial of Traqcker Pro. Unlock advanced screeners, full financial history, and comprehensive intrinsic valuation modeling.',
  },
  es: {
    title: 'Precios y planes — Traqcker Pro',
    description: 'Prueba Traqcker Pro gratis durante 14 días. Accede a screeners de nivel institucional, historiales de estados financieros completos y herramientas de valoración avanzadas.',
    ogTitle: 'Precios y planes | Traqcker',
    ogDescription: 'Empieza tu prueba gratis de 14 días de Traqcker Pro. Desbloquea screeners avanzados, historial financiero completo y modelización de valor intrínseco.',
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
