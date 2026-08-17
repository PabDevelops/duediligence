export const metadata = {
  title: 'Blog — Investing Concepts Explained Simply | Bulltrace',
  description: 'ROIC, DCF valuation, P/E ratios and other fundamentals explained without jargon or spreadsheets.',
  openGraph: {
    title: 'Bulltrace Blog — Investing Concepts Explained Simply',
    description: 'ROIC, DCF valuation, P/E ratios and other fundamentals explained without jargon or spreadsheets.',
    url: 'https://bulltrace.app/blog',
    siteName: 'Bulltrace',
    images: [{ url: '/og-screenshot.png', width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Bulltrace Blog',
    description: 'ROIC, DCF valuation, P/E ratios and other fundamentals explained without jargon or spreadsheets.',
    images: ['/og-screenshot.png'],
  },
  alternates: { canonical: 'https://bulltrace.app/blog' },
};

export default function BlogLayout({ children }) {
  return children;
}
