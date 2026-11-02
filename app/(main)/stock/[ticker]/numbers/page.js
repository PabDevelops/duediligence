'use client';
import { use, Suspense } from 'react';
import Link from 'next/link';
import NewNav from '../../../../components/new/NewNav';
import { useStockData } from '../../../../../lib/hooks/useStockData';
import { computeEasyMode } from '../../../../../lib/stockScoring';
import { isTierAdjusted } from '../../../../../lib/marketCap';
import { formatCurrency } from '../../../../../lib/formatters';
import { NEW_COLORS as C } from '../../../../components/new/theme';

const hasFundamentals = (d) => d.revVal != null || d.niVal != null || d.marketCap != null
  || d.roic != null || d.grossMargin != null || (d.revHistory?.length ?? 0) > 0;

// A P/E or P/FCF past this is almost always a near-zero-denominator artifact (a company right
// at breakeven), not a genuinely priced-in premium — shown as "N/D" rather than a four/five
// digit number that reads as a bug. Same threshold the real stock page uses.
const NM_MULTIPLE = 300;

const pct = (v, forceSign = false) => v == null ? null : `${forceSign && v > 0 ? '+' : ''}${v.toFixed(1)}%`;
const mult = (v) => v == null ? null : v > NM_MULTIPLE ? 'N/M' : v.toFixed(2);
const money = (v, sym) => v == null ? null : formatCurrency(v, sym);
const days = (v) => v == null ? null : `${v} días`;

// Same 0-5 scale and the same >=4/>=3 breakpoints QualityBreakdown below already colors the
// CBS/OPPO/GQS pillars with — reused here so a stat's color always means the same thing it
// means in the headline quality note, instead of a second, invented "good/bad" scale. Only
// wired to stats that genuinely have one of computeEasyMode's existing sector-aware
// sub-scores behind them (see the `color:` entries in `sections` below) — a stat with no
// score stays plain black rather than getting a color backed by nothing.
const scoreColor = (s) => s == null ? C.ink : s >= 4 ? C.green : s >= 3 ? C.ink : C.red;

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

// Every stat gets a plain-language "qué mide esto" line, not just a number — the whole point
// of this page over the dark-theme Financials tab it's replacing for /new is to teach, not
// just report. A stat whose value is unavailable for this ticker doesn't render at all (no
// wall of "N/D"), and a section with nothing available hides entirely.
function StatSection({ title, intro, stats }) {
  const visible = stats.filter(s => s.value != null);
  if (visible.length === 0) return null;
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '24px 26px', boxSizing: 'border-box' }}>
      <h2 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 800 }}>{title}</h2>
      {intro && <div style={{ fontSize: '12px', color: C.text2, lineHeight: 1.5, marginBottom: '18px' }}>{intro}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: intro ? 0 : '18px' }}>
        {visible.map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '16px', paddingBottom: '14px', borderBottom: `1px solid ${C.borderSoft}` }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '3px' }}>{s.label}</div>
              <div style={{ fontSize: '12px', color: C.text2, lineHeight: 1.5 }}>{s.explain}</div>
            </div>
            <div style={{ fontSize: '17px', fontWeight: 800, whiteSpace: 'nowrap', flexShrink: 0, color: s.color ?? C.ink }}>{s.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const QUALITY_PILLARS = [
  { key: 'cbs', label: 'NEGOCIO (CORE)', explain: 'Qué tan sólido es el negocio hoy: rentabilidad, márgenes y si puede pagar sus deudas sin agobios.' },
  { key: 'oppo', label: 'OPORTUNIDAD', explain: 'Qué tan barata o cara está la acción ahora mismo, comparando el precio con el dinero que realmente genera.' },
  { key: 'gqs', label: 'CRECIMIENTO', explain: 'Qué tan rápido — y con qué calidad — está creciendo el negocio.' },
];

function QualityBreakdown({ easyMode }) {
  if (!easyMode) return null;
  const scoreColor = (s) => s >= 4 ? C.green : s >= 3 ? C.ink : C.red;
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '24px 26px', boxSizing: 'border-box' }}>
      <h2 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 800 }}>De qué se compone la nota de calidad</h2>
      <div style={{ fontSize: '12px', color: C.text2, lineHeight: 1.5, marginBottom: '18px' }}>
        La nota de 0 a 100 de la cabecera es la combinación de estas tres piezas, más un ajuste por ventaja competitiva (moat).
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {QUALITY_PILLARS.map(p => (
          <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: 800, color: scoreColor(easyMode[p.key]), flexShrink: 0 }}>
              {Math.round(easyMode[p.key] * 20)}
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700 }}>{p.label}</div>
              <div style={{ fontSize: '12px', color: C.text2, lineHeight: 1.5 }}>{p.explain}</div>
            </div>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 800, color: easyMode.moatColor, flexShrink: 0 }}>
            {easyMode.moat === 'WIDE' ? 'AMPLIO' : easyMode.moat === 'NARROW' ? 'ALGO' : 'NINGUNO'}
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700 }}>MOAT (VENTAJA COMPETITIVA)</div>
            <div style={{ fontSize: '12px', color: C.text2, lineHeight: 1.5 }}>Si tiene algo que la protege de la competencia a largo plazo: marca fuerte, costes más bajos, efecto red...</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RangeBar52W({ data, sym }) {
  if (!data.high52 || !data.low52 || !data.currentPrice) return null;
  const rangePct = Math.max(0, Math.min(100, ((data.currentPrice - data.low52) / (data.high52 - data.low52)) * 100));
  const color = rangePct < 30 ? C.green : rangePct > 75 ? C.red : C.ink;
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '24px 26px', boxSizing: 'border-box' }}>
      <h2 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 800 }}>Rango de 52 semanas</h2>
      <div style={{ fontSize: '12px', color: C.text2, lineHeight: 1.5, marginBottom: '18px' }}>
        Dónde está el precio de hoy comparado con su punto más bajo y más alto del último año.
      </div>
      <div style={{ position: 'relative', height: '6px', background: C.borderSoft, borderRadius: '4px', marginBottom: '8px' }}>
        <div style={{ position: 'absolute', left: `${rangePct}%`, top: '-4px', width: '3px', height: '14px', background: color, borderRadius: '2px', transform: 'translateX(-1.5px)' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: C.text2 }}>
        <span>{formatCurrency(data.low52, sym)} · mínimo</span>
        <span style={{ fontWeight: 700, color }}>
          {rangePct < 30 ? 'Cerca del mínimo' : rangePct > 75 ? 'Cerca del máximo' : 'En medio del rango'}
        </span>
        <span>{formatCurrency(data.high52, sym)} · máximo</span>
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
  const capitalDiscipline = isTierAdjusted(easyMode?.capTier?.id);
  const cashRunway = data.fcfVal != null && data.fcfVal >= 0 ? 'No quema caja' : easyMode?.cashRunwayYears != null ? `${easyMode.cashRunwayYears.toFixed(1)} años` : null;
  // Just the signed money value — it used to carry a trailing "· tiene más caja que deuda"
  // clause baked into the bold, nowrap stat value itself, which on a negative (net-cash)
  // company overflowed its column and visually collided with the label next to it. That
  // distinction now lives in the explain line below (always shown) and the green/red color
  // (via deScore), not crammed into the number.
  const netDebtValue = data.netDebt == null ? null
    : (data.netDebt < 0 ? '-' : '') + formatCurrency(Math.abs(data.netDebt), sym);

  const sections = [
    {
      title: 'Valoración — ¿está cara o barata?',
      intro: 'Compara lo que pagas por la acción con lo que el negocio realmente gana o genera en caja.',
      stats: [
        { label: 'Capitalización bursátil', value: money(data.marketCap, sym), explain: 'Lo que vale la empresa entera en bolsa: precio de la acción × número de acciones.' },
        { label: 'P/E — precio / beneficio', value: mult(data.pe), explain: 'Cuántos años de beneficio actual tardarías en "recuperar" el precio que pagas. Más bajo suele ser más barato.' },
        { label: 'P/FCF — precio / caja libre', value: mult(truePfcf), explain: 'Como el P/E, pero con el dinero que realmente genera el negocio (caja libre) en vez del beneficio contable.', color: scoreColor(easyMode?.pfcfScore) },
        { label: 'EV/EBITDA', value: data.evEbitda != null ? data.evEbitda.toFixed(2) : null, explain: 'El valor de la empresa, incluida su deuda, comparado con su beneficio operativo bruto. Útil para comparar empresas con distinta deuda.' },
        { label: 'P/B — precio / valor contable', value: data.priceToBook != null ? data.priceToBook.toFixed(2) : null, explain: 'Cuánto pagas por cada euro de patrimonio neto que tiene la empresa en el balance.' },
        { label: 'Rentabilidad por FCF', value: pct(trueFcfYield), explain: 'El reverso del P/FCF: cuánta caja libre genera la empresa cada año por cada euro que vale en bolsa.', color: scoreColor(easyMode?.fcfYieldScore) },
        { label: 'Rentabilidad por dividendo', value: data.dividendYield ? pct(+data.dividendYield) : null, explain: 'Cuánto te paga en dividendos al año por cada euro invertido, al precio de hoy.' },
      ],
    },
    {
      title: 'Crecimiento — ¿va a más o a menos?',
      intro: 'Cómo ha evolucionado el negocio, y cuánto reinvierte para seguir creciendo.',
      stats: [
        { label: 'Ingresos (interanual)', value: pct(data.revGrowth, true), explain: 'Cuánto han crecido — o caído — las ventas respecto al año pasado.', color: scoreColor(easyMode?.revGrowthScore) },
        { label: 'Beneficio por acción, crecimiento medio', value: pct(data.epsCagr, true), explain: 'El ritmo medio al que ha crecido el beneficio por acción en los últimos años.' },
        { label: 'I+D sobre ingresos', value: easyMode?.rdToRevenue != null ? pct(easyMode.rdToRevenue * 100) : null, explain: 'Qué parte de cada euro de ventas se reinvierte en investigación y desarrollo — más alto puede significar más innovación futura, pero menos beneficio hoy.' },
        { label: 'Pago en acciones sobre ingresos', value: easyMode?.sbcToRevenue != null ? pct(easyMode.sbcToRevenue * 100) : null, explain: 'Qué parte de los ingresos se destina a pagar a empleados con acciones en vez de dinero — demasiado alto diluye a los accionistas actuales.' },
      ],
    },
    {
      title: 'Rentabilidad — ¿gana dinero de verdad?',
      intro: 'De cada euro que entra, cuánto se queda la empresa en cada etapa — y qué devuelve por lo invertido.',
      stats: [
        { label: 'Margen bruto', value: pct(data.grossMargin), explain: 'De cada euro vendido, lo que queda tras pagar solo el coste directo de producir o comprar lo que vende.', color: scoreColor(easyMode?.gmScore) },
        { label: 'Margen operativo', value: pct(data.opMargin), explain: 'De cada euro vendido, lo que queda tras pagar también los gastos de operar el negocio día a día.', color: scoreColor(easyMode?.omScore) },
        { label: 'Margen neto', value: pct(data.netMargin), explain: 'De cada euro vendido, lo que llega al beneficio final, después de todos los gastos e impuestos.' },
        { label: 'ROE — retorno sobre el capital', value: pct(data.roe), explain: 'Cuánto beneficio genera la empresa por cada euro que han puesto los accionistas.' },
        { label: 'ROA — retorno sobre activos', value: pct(data.roa), explain: 'Cuánto beneficio genera la empresa por cada euro de activos que posee: edificios, maquinaria, caja...' },
        { label: 'ROIC — retorno sobre el capital invertido', value: pct(data.roic), explain: 'Cuánto beneficio genera por cada euro invertido en el negocio, venga de accionistas o de deuda. La métrica favorita de muchos inversores para juzgar si un negocio es realmente bueno.', color: scoreColor(easyMode?.roicScore) },
      ],
    },
    {
      title: 'Balance y salud financiera — ¿aguantaría una mala racha?',
      intro: 'Lo que la empresa tiene, lo que debe, y si podría pagar sus facturas a corto plazo.',
      stats: [
        { label: 'Activos totales', value: money(data.assetsVal, sym), explain: 'Todo lo que posee la empresa: caja, inventario, edificios, maquinaria...' },
        { label: 'Pasivos totales', value: money(data.totalLiabilitiesVal, sym), explain: 'Todo lo que debe la empresa a terceros: deuda, proveedores, impuestos pendientes...' },
        { label: 'Patrimonio neto', value: money(data.equityVal, sym), explain: 'Lo que quedaría para los accionistas si la empresa vendiera todo y pagara todas sus deudas.' },
        { label: 'Deuda neta', value: netDebtValue, explain: 'La deuda de la empresa menos el dinero en caja. Negativa significa que tiene más caja que deuda — una posición cómoda.', color: scoreColor(easyMode?.deScore) },
        { label: 'Caja disponible', value: money(data.cashVal, sym), explain: 'Dinero en efectivo e inversiones a corto plazo que la empresa tiene disponible ya mismo.' },
        { label: 'Deuda a largo plazo', value: money(data.debtVal, sym), explain: 'Préstamos y bonos que la empresa debe devolver a más de un año vista.' },
        { label: 'Deuda / capital (D/E)', value: data.debtToEquity != null ? data.debtToEquity.toFixed(2) : null, explain: 'Cuánta deuda tiene la empresa comparada con el dinero de los accionistas. Más alto significa más riesgo.', color: scoreColor(easyMode?.deScore) },
        { label: 'Ratio corriente', value: currentRatio != null ? currentRatio.toFixed(2) : null, explain: 'Si la empresa podría pagar sus deudas a corto plazo solo con lo que tiene a mano. Por encima de 1 es buena señal.', color: scoreColor(easyMode?.crScore) },
      ],
    },
    {
      title: 'Eficiencia operativa — ¿gestiona bien el día a día?',
      intro: 'Cuánto tarda en cobrar, vender su inventario y pagar a sus proveedores.',
      stats: [
        { label: 'Ciclo de conversión de caja', value: days(data.ccc), explain: 'Cuántos días tarda la empresa en convertir lo que gasta en producir o comprar en dinero cobrado de sus clientes. Menos días es mejor.' },
        { label: 'Rotación de inventario', value: data.inventoryTurnover != null ? `${data.inventoryTurnover.toFixed(1)}× / año` : null, explain: 'Cuántas veces al año la empresa vende y repone todo su inventario. Más alto suele ser más eficiente.' },
        { label: 'Días de cobro (DSO)', value: days(data.dso), explain: 'Cuántos días tarda de media en cobrar a sus clientes después de vender.' },
        { label: 'Días de inventario (DIO)', value: days(data.dio), explain: 'Cuántos días de media está el producto parado en el almacén antes de venderse.' },
        { label: 'Días de pago (DPO)', value: days(data.dpo), explain: 'Cuántos días tarda de media la empresa en pagar a sus propios proveedores.' },
      ],
    },
    {
      title: 'Por acción y mercado',
      intro: 'Lo que le toca a cada acción individual, y cómo se mueve en bolsa.',
      stats: [
        { label: 'Beneficio por acción (BPA)', value: data.eps != null ? formatCurrency(data.eps, sym) : null, explain: 'El beneficio total dividido entre el número de acciones — lo que "gana" cada acción individual.' },
        { label: 'Acciones en circulación', value: data.sharesOutstanding != null ? `${(data.sharesOutstanding / 1e6).toFixed(0)} millones` : null, explain: 'El número total de acciones que existen de esta empresa, repartidas entre todos sus dueños.' },
        { label: 'Beta', value: data.beta != null ? data.beta.toFixed(2) : null, explain: 'Cuánto se mueve la acción comparada con el mercado en general. Por encima de 1 significa que suele moverse más fuerte, para bien y para mal.' },
      ],
    },
  ];

  if (capitalDiscipline) {
    sections.push({
      title: 'Disciplina de capital — empresas pequeñas',
      intro: `${data.name || ticker} es una empresa de capitalización ${easyMode.capTier.label.toLowerCase()} — aquí es donde más importa vigilar si diluye a sus accionistas o se queda sin caja.`,
      stats: [
        { label: 'Dilución histórica', value: easyMode.shareDilution != null ? pct(easyMode.shareDilution, true) : null, explain: 'Cuánto ha aumentado el número de acciones en circulación con el tiempo. Más dilución significa que tu parte de la empresa se hace más pequeña aunque no vendas nada.' },
        { label: 'Colchón de caja', value: cashRunway, explain: 'Si la empresa quema caja, cuántos años le quedan antes de quedarse sin dinero al ritmo actual.' },
        { label: 'Participación de insiders', value: easyMode.insiderOwnershipPct != null ? pct(easyMode.insiderOwnershipPct) : null, explain: 'Qué porcentaje de la empresa es propiedad de sus propios directivos y fundadores. Más alto suele alinear sus intereses con los tuyos.' },
      ],
    });
  }

  return (
    <Shell>
      <Link href={`/stock/${ticker}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: C.text2, textDecoration: 'none', width: 'fit-content' }}>
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
        Volver a {data.name || ticker}
      </Link>

      <div>
        <h1 style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em' }}>Todos los números</h1>
        <div style={{ fontSize: '13px', color: C.text2, fontWeight: 600 }}>{data.name || ticker} · {ticker}</div>
        <div style={{ fontSize: '12px', color: C.text3, marginTop: '8px' }}>
          Los números en <span style={{ color: C.green, fontWeight: 700 }}>verde</span> van bien, en <span style={{ color: C.red, fontWeight: 700 }}>rojo</span> conviene vigilarlos — comparados con lo normal para el tamaño y el sector de la empresa. Los que quedan en negro todavía no tienen un umbral propio.
        </div>
      </div>

      <QualityBreakdown easyMode={easyMode} />
      <RangeBar52W data={data} sym={sym} />

      {sections.map(sec => <StatSection key={sec.title} title={sec.title} intro={sec.intro} stats={sec.stats} />)}

      <div style={{ fontSize: '11px', color: C.text3, textAlign: 'center', paddingTop: '6px' }}>
        Esto no es consejo de inversión, es un punto de partida — investiga más antes de decidir.
      </div>
    </Shell>
  );
}
