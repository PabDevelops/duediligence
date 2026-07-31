export const metadata = {
  title: 'Market Radar | Bulltrace',
  description: 'Institutional-grade market intelligence dashboard. Real-time market pulse, top movers, sector heatmaps and fundamental ratings.',
  openGraph: {
    title: 'Market Radar | Bulltrace',
    description: 'Track sector momentum, top stock movers, and high-quality fundamental ratings in real time.',
    url: 'https://bulltrace.app/radar',
    siteName: 'Bulltrace',
    images: [{ url: '/og-screenshot.png', width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Market Radar | Bulltrace',
    description: 'Institutional-grade market intelligence dashboard in real-time.',
    images: ['/og-screenshot.png'],
  },
  alternates: { canonical: 'https://bulltrace.app/radar' },
};

export default function RadarLayout({ children }) {
  return children;
}

