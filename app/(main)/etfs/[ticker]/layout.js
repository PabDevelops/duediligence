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
        title: `${t} — Análisis del ETF | Bulltrace`,
        description: `Sigue y analiza el ETF ${t}: gastos, patrimonio gestionado, rentabilidad por dividendo, posiciones y reparto sectorial.`,
      };
    }

    const descSnippet = `Análisis de ${data.name} (${t}): gastos ${data.expenseRatio}, patrimonio ${data.aum}, rentabilidad por dividendo ${data.yield}, principales posiciones y reparto sectorial.`;

    return {
      title: `${data.name} (${t}) — Análisis del ETF | Bulltrace`,
      description: descSnippet,
      openGraph: {
        title: `${data.name} (${t}) — Análisis del ETF | Bulltrace`,
        description: descSnippet,
        url: `https://bulltrace.app/etfs/${t}`,
        siteName: 'Bulltrace',
        images: [{ url: 'https://bulltrace.app/og-image.png', width: 1200, height: 630, alt: `Análisis de ${data.name}` }],
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title: `${data.name} (${t}) — Análisis del ETF | Bulltrace`,
        description: descSnippet,
        images: ['https://bulltrace.app/og-image.png'],
      },
      alternates: {
        canonical: `https://bulltrace.app/etfs/${t}`,
      },
    };
  } catch {
    return {
      title: `${t} — Análisis del ETF | Bulltrace`,
      description: `Sigue y analiza el ETF ${t}: gastos, patrimonio gestionado, rentabilidad por dividendo, posiciones y reparto sectorial.`,
    };
  }
}

export default function ETFTickerLayout({ children }) {
  return children;
}
