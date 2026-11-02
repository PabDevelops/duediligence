'use client';
import { use, Suspense } from 'react';
import Link from 'next/link';
import NewNav from '../../../../components/new/NewNav';
import { useStockData } from '../../../../../lib/hooks/useStockData';
import { computeEasyMode } from '../../../../../lib/stockScoring';
import { formatCurrency } from '../../../../../lib/formatters';
import { NEW_COLORS as C } from '../../../../components/new/theme';

const hasFundamentals = (d) => d.revVal != null || d.niVal != null || d.marketCap != null
  || d.roic != null || d.grossMargin != null || (d.revHistory?.length ?? 0) > 0;

const pct = (v, forceSign = false) => v == null ? 'N/D' : `${forceSign && v > 0 ? '+' : ''}${v.toFixed(1)}%`;
const mult = (v) => v == null ? 'N/D' : v.toFixed(2);
const money = (v, sym) => v == null ? 'N/D' : formatCurrency(v, sym);

function Shell({ children }) {
  return (
    <div style={{ width: '100%', minHeight: '100vh', boxSizing: 'border-box', background: C.bg, color: C.ink, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '32px 24px 96px', display: 'flex', flexDirection: 'column', gap: '24px', boxSizing: 'border-box' }}>
        <NewNav active="inicio" />
        {children}
      </div>
    </div>
  );
}

function StatSection({ title, stats }) {
  const visible = stats.filter(s => s.value !== 'N/D');
  if (visible.length === 0) return null;
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '24px 26px', boxSizing: 'border-box' }}>
      <h2 style={{ margin: '0 0 18px', fontSize: '14px', fontWeight: 800, color: '#45413A' }}>{title}</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '18px 20px' }}>
        {visible.map(s => (
          <div key={s.label}>
            <div style={{ fontSize: '11px', color: C.text3, fontWeight: 700, marginBottom: '3px' }}>{s.label}</div>
            <div style={{ fontSize: '15px', fontWeight: 800 }}>{s.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function NewStockNumbersPage({ params }) {
  return (
    <Suspense fallback={null}>
      <NewStockNumbersContent params={params} />
    </Suspense>
  );
}

function NewStockNumbersContent({ params }) {
  const { ticker: rawTicker } = use(params);
  const ticker = rawTicker.toUpperCase();
  const { data, error, loading } = useStockData(ticker);

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
  const easyMode = computeEasyMode(data, hasFundamentals(data));
  const truePfcf = easyMode?.truePfcf ?? data.pfcf;
  const trueFcfYield = easyMode?.trueFcfYield ?? data.fcfYield;
  const currentRatio = data.currentAssetsVal && data.currentLiabilitiesVal ? data.currentAssetsVal / data.currentLiabilitiesVal : null;

  const sections = [
    {
      title: 'VALORACIÓN',
      stats: [
        { label: 'Precio / beneficio (P/E)', value: mult(data.pe) },
        { label: 'Precio / flujo de caja libre', value: mult(truePfcf) },
        { label: 'Rentabilidad por FCF', value: pct(trueFcfYield) },
        { label: 'Capitalización bursátil', value: money(data.marketCap, sym) },
      ],
    },
    {
      title: 'CRECIMIENTO',
      stats: [
        { label: 'Ingresos (interanual)', value: pct(data.revGrowth, true) },
        { label: 'Beneficio por acción, media de varios años', value: pct(data.epsCagr, true) },
      ],
    },
    {
      title: 'RENTABILIDAD',
      stats: [
        { label: 'Margen operativo', value: pct(data.opMargin) },
        { label: 'Margen neto', value: pct(data.netMargin) },
        { label: 'ROE', value: pct(data.roe) },
        { label: 'ROA', value: pct(data.roa) },
        { label: 'ROIC', value: pct(data.roic) },
      ],
    },
    {
      title: 'SALUD FINANCIERA',
      stats: [
        { label: 'Deuda / capital', value: mult(data.debtToEquity) },
        { label: 'Ratio corriente', value: mult(currentRatio) },
        { label: 'Caja neta', value: data.netDebt == null ? 'N/D' : data.netDebt < 0 ? 'Posición positiva' : `Deuda neta de ${money(data.netDebt, sym)}` },
      ],
    },
    {
      title: 'PROPIEDAD',
      stats: [
        { label: 'Participación de insiders', value: pct(data.insiderOwnershipPct) },
        { label: 'Dilución anual (histórica)', value: pct(data.shareDilution, true) },
      ],
    },
  ];

  return (
    <Shell>
      <Link href={`/new/stock/${ticker}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: C.text2, textDecoration: 'none', width: 'fit-content' }}>
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
        Volver a {data.name || ticker}
      </Link>

      <div>
        <h1 style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em' }}>Todos los números</h1>
        <div style={{ fontSize: '13px', color: C.text2, fontWeight: 600 }}>{data.name || ticker} · {ticker}</div>
      </div>

      {sections.map(sec => <StatSection key={sec.title} title={sec.title} stats={sec.stats} />)}

      <div style={{ fontSize: '11px', color: C.text3, textAlign: 'center', paddingTop: '6px' }}>
        Esto no es consejo de inversión, es un punto de partida — investiga más antes de decidir.
      </div>
    </Shell>
  );
}
