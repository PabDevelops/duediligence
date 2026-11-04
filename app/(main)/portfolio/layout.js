export const metadata = {
  title: 'Portfolio | Bulltrace',
  description: 'Sigue tus posiciones, coste medio y rendimiento en un solo sitio.',
  openGraph: {
    title: 'Portfolio | Bulltrace',
    description: 'Sigue tus posiciones, coste medio y rendimiento en un solo sitio.',
    url: 'https://bulltrace.app/portfolio',
    siteName: 'Bulltrace',
    images: [{ url: '/og-screenshot.png', width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Portfolio | Bulltrace',
    description: 'Sigue tus posiciones, coste medio y rendimiento en un solo sitio.',
    images: ['/og-screenshot.png'],
  },
  alternates: { canonical: 'https://bulltrace.app/portfolio' },
};

export default function PortfolioLayout({ children }) {
  return children;
}
