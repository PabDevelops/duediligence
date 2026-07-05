export const metadata = {
  title: 'Portfolio | Traqcker',
  description: 'Track your holdings, cost basis, and performance across your portfolio.',
  openGraph: {
    title: 'Portfolio | Traqcker',
    description: 'Track your holdings, cost basis, and performance across your portfolio.',
    url: 'https://traqcker.com/portfolio',
    siteName: 'Traqcker',
    images: [{ url: '/og-screenshot.png', width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Portfolio | Traqcker',
    description: 'Track your holdings, cost basis, and performance across your portfolio.',
    images: ['/og-screenshot.png'],
  },
  alternates: { canonical: 'https://traqcker.com/portfolio' },
};

export default function PortfolioLayout({ children }) {
  return children;
}
