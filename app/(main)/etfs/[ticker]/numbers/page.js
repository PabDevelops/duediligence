'use client';
import { use, Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import NewNav from '../../../../components/new/NewNav';
import { computeETFQualityScore } from '../../../../../lib/etfQuality';
import { NEW_COLORS as C } from '../../../../components/new/theme';

const dateLabel = (d) => {
  if (!d || d === 'N/A') return null;
  const parsed = new Date(d);
  if (Number.isNaN(parsed.getTime())) return d;
  return parsed.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
};

// Same 0-70/40 breakpoints QualityBreakdown below already colors the cost/liquidity/
// diversification pillars with — reused here so a stat's color always means the same thing it
// means in the headline quality note. Only wired to stats that genuinely have one of
// computeETFQualityScore's existing factor scores behind them (expense ratio -> cost, AUM/
// volume -> liquidity); yield/PE/beta have no equivalent scoring for funds, so they stay plain
// black rather than getting a color backed by nothing — same rule the stock Numbers page uses.
const scoreColor = (s) => s == null ? C.ink : s >= 70 ? C.green : s >= 40 ? C.ink : C.red;

const FACTOR_META = {
  cost: { label: 'COSTE', explain: 'Cuánto te cobra el fondo al año por gestionarlo — más bajo es mejor, es dinero que no sale de tu bolsillo aunque no vendas nada.' },
  liquidity: { label: 'LIQUIDEZ', explain: 'Qué tan fácil es comprar y vender sin mover el precio — fondos grandes y con mucho volumen son más líquidos.' },
  diversification: { label: 'DIVERSIFICACIÓN', explain: 'Qué tan repartido está entre distintas empresas — menos concentrado en pocas posiciones es más diversificado.' },
};

function QualityBreakdown({ composite, factors }) {
  // Null here means "this factor has no data for this fund" (shows N/D) — kept visually muted
  // (C.text3) rather than scoreColor's plain-black default below, which means something
  // different: "this stat has no quality judgment behind it at all."
  const pillarColor = (s) => s == null ? C.text3 : s >= 70 ? C.green : s >= 40 ? C.ink : C.red;
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '24px 26px', boxSizing: 'border-box' }}>
      <h2 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 800 }}>De qué se compone la nota de calidad</h2>
      <div style={{ fontSize: '12px', color: C.text2, lineHeight: 1.5, marginBottom: '18px' }}>
        La nota de 0 a 100 de la cabecera es la media de estas tres piezas (solo las que el fondo reporta).
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {Object.entries(factors).map(([key, f]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 800, color: pillarColor(f.score), flexShrink: 0 }}>
              {f.available && f.score != null ? Math.round(f.score) : 'N/D'}
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700 }}>{FACTOR_META[key].label}</div>
              <div style={{ fontSize: '12px', color: C.text2, lineHeight: 1.5 }}>{f.available ? FACTOR_META[key].explain : f.reason}</div>
            </div>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', paddingTop: '4px', borderTop: `1px solid ${C.borderSoft}` }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: C.lime, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 800, color: C.ink, flexShrink: 0 }}>
            {composite != null ? Math.round(composite) : 'N/D'}
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700 }}>NOTA FINAL</div>
            <div style={{ fontSize: '12px', color: C.text2, lineHeight: 1.5 }}>La media de los factores que el fondo sí reporta — no es una recomendación de inversión.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatSection({ title, intro, stats }) {
  const visible = stats.filter(s => s.value != null && s.value !== 'N/A' && s.value !== 'See Prospectus');
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
            <div style={{ fontSize: '16px', fontWeight: 800, whiteSpace: 'nowrap', flexShrink: 0, color: s.color ?? C.ink }}>{s.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Shell({ children }) {
  return (
    <div style={{ width: '100%', minHeight: '100vh', boxSizing: 'border-box', background: C.bg, color: C.ink, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 'min(1200px, 92vw)', margin: '0 auto', padding: '32px 24px 96px', display: 'flex', flexDirection: 'column', gap: '24px', boxSizing: 'border-box' }}>
        <NewNav active="etfs" />
        {children}
      </div>
    </div>
  );
}

export default function NewEtfNumbersPage({ params }) {
  return (
    <Suspense fallback={null}>
      <NewEtfNumbersContent params={params} />
    </Suspense>
  );
}

function NewEtfNumbersContent({ params }) {
  const { ticker: rawTicker } = use(params);
  const ticker = rawTicker.toUpperCase();
  const [etf, setEtf] = useState(undefined);

  useEffect(() => {
    let active = true;
    setEtf(undefined);
    fetch('/api/etfs').then(r => r.json()).then(async (d) => {
      if (!active) return;
      const list = d.etfs || [];
      const found = list.find(e => e.ticker === ticker);
      if (found) { setEtf(found); return; }
      const res = await fetch('/api/etfs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ticker }) });
      const added = await res.json();
      if (!active) return;
      setEtf(added.error ? null : added);
    }).catch(() => { if (active) setEtf(null); });
    return () => { active = false; };
  }, [ticker]);

  if (etf === undefined) {
    return <Shell><div style={{ fontSize: '13px', color: C.text3 }}>Cargando…</div></Shell>;
  }
  if (etf === null) {
    return (
      <Shell>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '28px', textAlign: 'center', fontSize: '13px', color: C.text2 }}>
          No encontramos {ticker} — comprueba el ticker e inténtalo de nuevo.
        </div>
      </Shell>
    );
  }

  const quality = computeETFQualityScore(etf);

  return (
    <Shell>
      <Link href={`/etfs/${ticker}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: C.text2, textDecoration: 'none', width: 'fit-content' }}>
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
        Volver
      </Link>

      <div>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em' }}>Todos los números</h1>
        <div style={{ fontSize: '13px', color: C.text2, marginTop: '4px' }}>{etf.name} · {ticker}</div>
        <div style={{ fontSize: '12px', color: C.text3, marginTop: '8px' }}>
          Los números en <span style={{ color: C.green, fontWeight: 700 }}>verde</span> van bien, en <span style={{ color: C.red, fontWeight: 700 }}>rojo</span> conviene vigilarlos — comparados con otros fondos. Rentabilidad por dividendo, PER y Beta todavía no tienen un umbral propio.
        </div>
      </div>

      <StatSection
        title="Coste y tamaño — ¿cuánto cuesta y cuán grande es?"
        intro="Un fondo más barato y más grande suele ser más fácil de mantener a largo plazo."
        stats={[
          { label: 'Gastos al año (TER)', value: etf.expenseRatio, explain: 'Lo que te cobra el fondo cada año por gestionarlo, como % de tu inversión. Sale de tu bolsillo aunque no vendas nada — más bajo es mejor.', color: scoreColor(quality?.factors.cost.score) },
          { label: 'Patrimonio gestionado (AUM)', value: etf.aum, explain: 'El dinero total que los inversores tienen metido en este fondo. Más grande suele significar más estabilidad.', color: scoreColor(quality?.factors.liquidity.score) },
          { label: 'Volumen medio diario', value: etf.volume, explain: 'Cuántas participaciones se compran y venden cada día de media. Más volumen facilita comprar o vender sin mover el precio.', color: scoreColor(quality?.factors.liquidity.score) },
        ]}
      />

      <StatSection
        title="Rendimiento y riesgo — ¿qué puedes esperar?"
        intro="Ninguno de estos números garantiza el futuro, pero dan una idea de cómo se ha comportado el fondo."
        stats={[
          { label: 'Rentabilidad por dividendo', value: etf.yield, explain: 'Cuánto te paga el fondo en dividendos al año, como porcentaje del precio de hoy.' },
          { label: 'PER promedio', value: etf.pe, explain: 'La media del ratio precio/beneficio de las empresas que tiene el fondo — cuántos años de beneficio pagas por ellas, de media.' },
          { label: 'Beta', value: etf.beta, explain: 'Cuánto se mueve el fondo comparado con el mercado en general. Por encima de 1 significa que suele moverse más fuerte, para bien y para mal.' },
        ]}
      />

      <StatSection
        title="Sobre el fondo"
        stats={[
          { label: 'Gestora', value: etf.issuer, explain: 'La empresa que crea y gestiona este fondo.' },
          { label: 'Fecha de creación', value: dateLabel(etf.inception), explain: 'Desde cuándo existe este fondo — más años de historial es más información sobre cómo se comporta.' },
          { label: 'Qué sigue', value: etf.indexTracked, explain: 'El índice o grupo de activos que este fondo intenta replicar.' },
        ]}
      />

      <QualityBreakdown composite={quality.composite} factors={quality.factors} />
    </Shell>
  );
}
