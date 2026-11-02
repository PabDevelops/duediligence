export async function generateMetadata({ params }) {
  const { ticker } = await params;
  const t = ticker.toUpperCase();

  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/etfs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker: t }),
      next: { revalidate: 3600 },
    });
    const data = await res.json();

    if (data.error) {
      return {
        title: `${t} ETF Analysis — Bulltrace`,
        description: `Track and analyze the ${t} ETF, including expense ratio, AUM, dividend yield, holdings, and sector weightings.`,
      };
    }

    const descSnippet = `${data.name} (${t}) ETF analysis: expense ratio ${data.expenseRatio}, AUM ${data.aum}, dividend yield ${data.yield}, top holdings, and sector allocation.`;

    return {
      title: `${data.name} (${t}) ETF Analysis — Bulltrace`,
      description: descSnippet,
      openGraph: {
        title: `${data.name} (${t}) — ETF Analysis | Bulltrace`,
        description: descSnippet,
        url: `https://bulltrace.app/etfs/${t}`,
        siteName: 'Bulltrace',
        images: [{ url: 'https://bulltrace.app/og-image.png', width: 1200, height: 630, alt: `${data.name} ETF analysis` }],
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title: `${data.name} (${t}) — ETF Analysis | Bulltrace`,
        description: descSnippet,
        images: ['https://bulltrace.app/og-image.png'],
      },
      alternates: {
        canonical: `https://bulltrace.app/etfs/${t}`,
      },
    };
  } catch {
    return {
      title: `${t} ETF Analysis — Bulltrace`,
      description: `Track and analyze the ${t} ETF, including expense ratio, AUM, dividend yield, holdings, and sector weightings.`,
    };
  }
}

export default function ETFTickerLayout({ children }) {
  return children;
}
