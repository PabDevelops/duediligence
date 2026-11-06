export async function generateMetadata({ params }) {
  const { ticker } = await params;
  const t = ticker.toUpperCase();

  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/stock?ticker=${t}`, { next: { revalidate: 3600 } });
    const data = await res.json();

    if (data.error) {
      return {
        title: `${t} — Análisis de la acción | Bulltrace`,
        description: `Análisis de inversión para ${t}, con datos directos de la SEC: verificación de presentaciones, valoración intrínseca y métricas financieras.`,
      };
    }

    const descSnippet = `Análisis fundamental de ${data.name} (${t}). Datos de proveedores y cifras provisionales identificadas. Valoración y nota de calidad.`;

    const ogDesc = [
      data.pe ? `P/E ${data.pe.toFixed(1)}` : null,
      data.roic ? `ROIC ${data.roic}%` : null,
      data.sector || null,
    ].filter(Boolean).join(' · ');

    return {
      title: `${data.name} (${t}) — Análisis fundamental | Bulltrace`,
      description: descSnippet,
      openGraph: {
        title: `${data.name} (${t}) — Análisis fundamental | Bulltrace`,
        description: ogDesc ? `${ogDesc} · ${descSnippet}` : descSnippet,
        url: `https://bulltrace.app/stock/${t}`,
        siteName: 'Bulltrace',
        images: [{ url: 'https://bulltrace.app/og-image.png', width: 1200, height: 630, alt: `Análisis de ${data.name}` }],
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title: `${data.name} (${t}) — Análisis fundamental | Bulltrace`,
        description: ogDesc ? `${ogDesc} · ${descSnippet}` : descSnippet,
        images: ['https://bulltrace.app/og-image.png'],
      },
      alternates: {
        canonical: `https://bulltrace.app/stock/${t}`,
      },
    };
  } catch {
    return {
      title: `${t} — Análisis de la acción | Bulltrace`,
      description: `Análisis de inversión para ${t}, con datos directos de la SEC: verificación de presentaciones, valoración intrínseca y métricas financieras.`,
    };
  }
}

export default function StockLayout({ children }) {
  return children;
}
