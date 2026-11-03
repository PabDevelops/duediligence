import PricingView from './PricingView';

export const metadata = {
  title: 'Precios y planes — Bulltrace',
  description: 'Crea una cuenta gratis en Bulltrace para ver veredictos completos, proyección a 5 años y explorar sin límite. Sin tarjeta. Hazte Pro para cartera, ETFs y descubrimiento ilimitado.',
  openGraph: {
    title: 'Precios y planes | Bulltrace',
    description: 'Gratis para empezar, sin tarjeta. Hazte Pro para seguimiento de cartera multi-divisa, cobertura completa de ETFs y descubrimiento diario ilimitado.',
    url: 'https://bulltrace.app/pricing',
    siteName: 'Bulltrace',
    images: [{ url: '/og-screenshot.png', width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Precios y planes | Bulltrace',
    description: 'Gratis para empezar, sin tarjeta. Hazte Pro para seguimiento de cartera multi-divisa, cobertura completa de ETFs y descubrimiento diario ilimitado.',
    images: ['/og-screenshot.png'],
  },
  alternates: {
    canonical: '/pricing',
  },
};

export default function Pricing() {
  return <PricingView />;
}
