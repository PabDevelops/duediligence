export async function generateMetadata({ params }) {
  const { ticker } = await params;
  const t = ticker.toUpperCase();

  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/stock?ticker=${t}`, { next: { revalidate: 3600 } });
    const data = await res.json();

    if (data.error) {
      return {
        title: `${t} Stock Analysis — Traqcker`,
        description: `Free fundamental analysis for ${t}. Quality score, fair value, and financial statements from SEC EDGAR.`,
      };
    }

    const descSnippet = data.description
      ? data.description.slice(0, 155).replace(/\s\S*$/, '') + '…'
      : `Quality score, fair value estimate, and financial statements for ${data.name}. Data from SEC EDGAR.`;

    const ogDesc = [
      data.pe ? `P/E ${data.pe.toFixed(1)}` : null,
      data.roic ? `ROIC ${data.roic}%` : null,
      data.sector || null,
    ].filter(Boolean).join(' · ');

    return {
      title: `${data.name} (${t}) Stock Analysis — Traqcker`,
      description: descSnippet,
      openGraph: {
        title: `${data.name} (${t}) — Free Stock Analysis | Traqcker`,
        description: ogDesc || descSnippet,
        url: `https://traqcker.com/stock/${t}`,
        siteName: 'Traqcker',
        images: [{ url: 'https://traqcker.com/og-image.png', width: 1200, height: 630, alt: `${data.name} stock analysis` }],
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title: `${data.name} (${t}) — Traqcker`,
        description: ogDesc || descSnippet,
        images: ['https://traqcker.com/og-image.png'],
      },
      alternates: {
        canonical: `https://traqcker.com/stock/${t}`,
      },
    };
  } catch {
    return {
      title: `${t} Stock Analysis — Traqcker`,
      description: `Free fundamental analysis for ${t}. Quality score, fair value, and financial statements from SEC EDGAR.`,
    };
  }
}

export default function StockLayout({ children }) {
  return children;
}
