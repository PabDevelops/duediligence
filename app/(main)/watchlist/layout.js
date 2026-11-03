export const metadata = {
  title: 'Lo que sigues | Bulltrace',
  description: 'Sigue tus acciones favoritas. Nota de calidad, valor razonable y datos clave de cada una en tu lista de seguimiento.',
  openGraph: {
    title: 'Lo que sigues | Bulltrace',
    description: 'Sigue tus acciones favoritas con nota de calidad y valor razonable.',
    url: 'https://bulltrace.app/watchlist',
    siteName: 'Bulltrace',
    images: [{ url: '/og-screenshot.png', width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Lo que sigues | Bulltrace',
    description: 'Sigue tus acciones favoritas con nota de calidad y valor razonable.',
    images: ['/og-screenshot.png'],
  },
  alternates: { canonical: 'https://bulltrace.app/watchlist' },
};

export default function WatchlistLayout({ children }) {
  return children;
}
