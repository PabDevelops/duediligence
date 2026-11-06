import {publicStockData} from '../../../../lib/publicStockData';
import {publicStockSummary} from '../../../../lib/publicStockSummary';
export async function generateMetadata({ params }) {
  const { ticker } = await params;
  const t = ticker.toUpperCase();

  try {
    const data = await publicStockData(t);

    if (!data || data.error) {
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

export default async function StockLayout({ children, params }) {
  const {ticker}=await params;
  const summary=publicStockSummary(await publicStockData(ticker.toUpperCase()),ticker.toUpperCase());
  return <>{children}{summary&&<details style={{maxWidth:1100,margin:'24px auto',padding:'16px 24px',fontSize:13,lineHeight:1.6}}>
    <summary>Resumen financiero y fuentes de {summary.name} ({summary.ticker})</summary>
    <h2>{summary.name} ({summary.ticker}): resumen financiero</h2>
    <p>Instantánea de datos públicos. Los importes conservan la moneda y el periodo de cada partida; N/D indica un dato no disponible. Las correcciones manuales y los datos provisionales no equivalen a cuentas verificadas.</p>
    <dl>{summary.rows.map(row=><div key={row.label}><dt><strong>{row.label}</strong></dt><dd>{row.value} · {row.period} · {row.source} · {row.manual?'Corrección manual':row.status==='verified'?'Dato verificado':'Dato provisional'}</dd></div>)}</dl>
    {summary.asOf&&<p>Fecha de actualización de la instantánea: {summary.asOf}</p>}
    <a href={`/stock/${encodeURIComponent(summary.ticker)}/analisis`}>Consultar análisis completo y advertencias</a>
  </details>}</>;
}
