export async function generateMetadata({ params }) {
  const { ticker } = await params;
  const t = ticker.toUpperCase();
  
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/stock?ticker=${t}`, { next: { revalidate: 3600 } });
    const data = await res.json();
    
    if (data.error) {
      return {
        title: `${t} Stock Analysis — Traqcker`,
        description: `Fundamental analysis for ${t}. Quality score, DCF valuation, financial statements from SEC EDGAR.`,
      };
    }

    return {
      title: `${data.name} (${t}) Stock Analysis — Traqcker`,
      description: `Fundamental analysis for ${data.name}. Quality score ${data.sector ? `in ${data.sector}` : ''}. DCF valuation, financial statements, screener. Data from SEC EDGAR.`,
      openGraph: {
        title: `${data.name} (${t}) — Traqcker`,
        description: `P/E: ${data.pe?.toFixed(1) || 'N/A'} · FCF Yield: ${data.fcfYield || 'N/A'}% · ROIC: ${data.roic || 'N/A'}% · Sector: ${data.sector || 'N/A'}`,
        url: `https://traqcker.com/stock/${t}`,
        images: [{ url: 'https://traqcker.com/og-image.png', width: 1200, height: 630 }],
      },
      twitter: {
        card: 'summary_large_image',
        title: `${data.name} (${t}) — Traqcker`,
        description: `P/E: ${data.pe?.toFixed(1) || 'N/A'} · FCF Yield: ${data.fcfYield || 'N/A'}% · ROIC: ${data.roic || 'N/A'}%`,
        images: ['https://traqcker.com/og-image.png'],
      },
    };
  } catch {
    return {
      title: `${t} Stock Analysis — Traqcker`,
      description: `Fundamental analysis for ${t}. Quality score, DCF valuation, financial statements from SEC EDGAR.`,
    };
  }
}