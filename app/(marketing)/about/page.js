import AboutView from './AboutView';

export const metadata = {
  title: 'Sobre Bulltrace — Cómo funciona',
  description: 'Bulltrace analiza acciones a partir de presentaciones de SEC EDGAR y te da una nota de calidad sencilla y una estimación de valor razonable. No hace falta ser economista.',
  openGraph: {
    title: 'Sobre Bulltrace — Cómo funciona',
    description: 'Datos reales de las presentaciones de cada empresa. Nota de calidad sencilla y valor razonable. Sin jerga.',
    url: 'https://bulltrace.app/about',
    siteName: 'Bulltrace',
    images: [{ url: '/og-screenshot.png', width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sobre Bulltrace — Cómo funciona',
    description: 'Datos reales de las presentaciones de cada empresa. Nota de calidad sencilla y valor razonable. Sin jerga.',
    images: ['/og-screenshot.png'],
  },
  alternates: {
    canonical: '/about',
  },
};

export default function About() {
  return <AboutView />;
}
