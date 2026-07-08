export async function generateMetadata({ params }) {
  const { ticker } = await params;
  const t = ticker.toUpperCase();

  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/stock?ticker=${t}`, { next: { revalidate: 3600 } });
    const data = await res.json();

    if (data.error) {
      return {
        title: `${t} Stock Analysis — Traqcker`,
        description: `Professional investment analysis for ${t}, powered by direct company filings. SEC EDGAR source verification, intrinsic valuation, and financial metrics.`,
      };
    }

    const descSnippet = `Professional fundamental analysis for ${data.name} (${t}). Verified SEC EDGAR financial statements, intrinsic valuation modeling, and quality scores.`;

    const ogDesc = [
      data.pe ? `P/E ${data.pe.toFixed(1)}` : null,
      data.roic ? `ROIC ${data.roic}%` : null,
      data.sector || null,
    ].filter(Boolean).join(' · ');

    return {
      title: `${data.name} (${t}) Stock Analysis & SEC Filings — Traqcker`,
      description: descSnippet,
      openGraph: {
        title: `${data.name} (${t}) — Stock Analysis & SEC Filings | Traqcker`,
        description: ogDesc ? `${ogDesc} · ${descSnippet}` : descSnippet,
        url: `https://traqcker.com/stock/${t}`,
        siteName: 'Traqcker',
        images: [{ url: 'https://traqcker.com/og-image.png', width: 1200, height: 630, alt: `${data.name} stock analysis` }],
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title: `${data.name} (${t}) — Stock Analysis & SEC Filings | Traqcker`,
        description: ogDesc ? `${ogDesc} · ${descSnippet}` : descSnippet,
        images: ['https://traqcker.com/og-image.png'],
      },
      alternates: {
        canonical: `https://traqcker.com/stock/${t}`,
      },
    };
  } catch {
    return {
      title: `${t} Stock Analysis — Traqcker`,
      description: `Professional investment analysis for ${t}, powered by direct company filings. SEC EDGAR source verification, intrinsic valuation, and financial metrics.`,
    };
  }
}

export default function StockLayout({ children }) {
  return children;
}
