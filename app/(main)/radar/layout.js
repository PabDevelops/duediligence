export const metadata = {
  title: 'Radar | Bulltrace',
  description: 'Qué se mueve hoy en el mercado, las acciones mejor puntuadas por calidad fundamental, y cestas temáticas para explorar.',
  openGraph: {
    title: 'Radar | Bulltrace',
    description: 'Qué se mueve hoy en el mercado, las acciones mejor puntuadas por calidad fundamental, y cestas temáticas para explorar.',
    url: 'https://bulltrace.app/radar',
    siteName: 'Bulltrace',
    images: [{ url: '/og-screenshot.png', width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Radar | Bulltrace',
    description: 'Qué se mueve hoy en el mercado y las acciones mejor puntuadas por calidad fundamental.',
    images: ['/og-screenshot.png'],
  },
  alternates: { canonical: 'https://bulltrace.app/radar' },
};

export default function RadarLayout({ children }) {
  return children;
}
