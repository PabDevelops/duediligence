'use client';
import { use, Suspense } from 'react';
import Link from 'next/link';
import NewNav from '../../../../components/new/NewNav';
import { useStockData } from '../../../../../lib/hooks/useStockData';
import { useEntryPriceProjection } from '../../../../../lib/hooks/useEntryPriceProjection';
import EngineV2Panel from '../../../../components/workspace/stock/EngineV2Panel';
import { NEW_COLORS as C } from '../../../../components/new/theme';

function Shell({ children }) {
  return (
    <div style={{ width: '100%', minHeight: '100vh', boxSizing: 'border-box', background: C.bg, color: C.ink, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 'min(1200px, 92vw)', margin: '0 auto', padding: '32px 24px 96px', display: 'flex', flexDirection: 'column', gap: '24px', boxSizing: 'border-box' }}>
        <NewNav active="inicio" />
        {children}
      </div>
    </div>
  );
}

export default function NewStockAnalysisPage({ params }) {
  return (
    <Suspense fallback={null}>
      <NewStockAnalysisContent params={params} />
    </Suspense>
  );
}

function NewStockAnalysisContent({ params }) {
  const { ticker: rawTicker } = use(params);
  const ticker = rawTicker.toUpperCase();
  const { data, error, loading } = useStockData(ticker);
  // Same five-dimension engine the stock page's summary card reads — called ahead of the
  // loading/error early returns below since it's a hook, and it tolerates `data` being null.
  const entryProjection = useEntryPriceProjection({ ticker, data });

  if (loading) {
    return <Shell><div style={{ fontSize: '13px', color: C.text3 }}>Cargando…</div></Shell>;
  }
  if (error || !data) {
    return (
      <Shell>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '28px', textAlign: 'center', fontSize: '13px', color: C.text2 }}>
          No encontramos {ticker} — comprueba el ticker e inténtalo de nuevo.
        </div>
      </Shell>
    );
  }

  const sym = data.currency === 'EUR' ? '€' : data.currency === 'GBP' ? '£' : '$';

  return (
    <Shell>
      <Link href={`/stock/${ticker}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: C.text2, textDecoration: 'none', width: 'fit-content' }}>
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
        Volver a {data.name || ticker}
      </Link>

      <div>
        <h1 style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em' }}>Análisis a fondo</h1>
        <div style={{ fontSize: '13px', color: C.text2, fontWeight: 600 }}>{data.name || ticker} · {ticker}</div>
        <div style={{ fontSize: '12px', color: C.text3, marginTop: '8px' }}>
          Esto es el detalle técnico detrás de los 4 números de la ficha: cómo se calculó cada
          dimensión, los supuestos de cada escenario a 5 años y las fuentes. Si solo querías
          saber si vale la pena seguir investigando, ya lo viste en la ficha principal.
        </div>
      </div>

      {entryProjection.engine
        ? <EngineV2Panel engine={entryProjection.engine} sym={sym} />
        : (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '28px', textAlign: 'center', fontSize: '13px', color: C.text2 }}>
            No hay suficientes datos de {data.name || ticker} para este análisis todavía.
          </div>
        )}
    </Shell>
  );
}
