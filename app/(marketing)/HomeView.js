'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '../components/AuthProvider';
import NewMarketingNav from '../components/new/NewMarketingNav';
import NewMarketingFooter from '../components/new/NewMarketingFooter';
import { NEW_COLORS as C, VERDICT_BADGE } from '../components/new/theme';

const CONTAINER = { maxWidth: 'min(1200px, 92vw)', margin: '0 auto', padding: '0 24px', boxSizing: 'border-box' };

// Mini preview of a real stock card — built from the same cream/lime tokens the actual
// stock page uses, not a screenshot, so it can't go stale the way the old dark "Terminal"
// mock (a literal fake terminal window) would once that product no longer looks like this.
function StockCardPreview() {
  const badge = VERDICT_BADGE.good;
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '24px', boxSizing: 'border-box', boxShadow: '0 30px 60px -24px rgba(28,27,24,0.18)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div aria-hidden="true" style={{ width: '34px', height: '34px', borderRadius: '9px', background: C.ink, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: '14px', fontWeight: 800 }}>Apple Inc.</div>
            <div style={{ fontSize: '11px', color: C.text3 }}>AAPL · NASDAQ</div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '16px', fontWeight: 800 }}>$227.50</div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: C.green }}>+1.23%</div>
        </div>
      </div>

      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '20px', background: badge.bg, marginBottom: '16px' }}>
        <span aria-hidden="true" style={{ width: '6px', height: '6px', borderRadius: '50%', background: badge.dot }} />
        <span style={{ fontSize: '12px', fontWeight: 700, color: badge.text }}>Pinta bien</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: C.text3, letterSpacing: '0.04em' }}>NOTA DE CALIDAD</span>
        <span style={{ fontSize: '15px', fontWeight: 800 }}>83</span>
      </div>
      <div aria-hidden="true" style={{ width: '100%', height: '8px', borderRadius: '20px', background: C.borderSoft, overflow: 'hidden', marginBottom: '20px' }}>
        <div style={{ width: '83%', height: '100%', borderRadius: '20px', background: C.lime }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', paddingTop: '16px', borderTop: `1px solid ${C.borderSoft}` }}>
        {[['ROIC', '32%'], ['Margen bruto', '46%'], ['Deuda/capital', '1.2x']].map(([l, v]) => (
          <div key={l}>
            <div style={{ fontSize: '10px', color: C.text3, marginBottom: '3px' }}>{l}</div>
            <div style={{ fontSize: '13px', fontWeight: 800 }}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const STATS = [
  { value: '260+', label: 'empresas cubiertas, puntuadas igual cada vez' },
  { value: 'SEC EDGAR + Finnhub', label: 'datos directos de la fuente, no notas de prensa con retraso' },
  { value: '0 €', label: 'para empezar — pasa a Pro solo si el valor lo justifica' },
];

const FEATURES = [
  { title: 'Veredictos con datos reales', desc: 'Calidad, valoración y riesgos de cada empresa, siempre citando el número real detrás — nunca una afirmación sin apoyo.' },
  { title: 'Cartera multi-divisa', desc: 'Posiciones, ganancia/pérdida y reparto en tu propia divisa, en cualquier mercado.' },
  { title: 'Explorador sin límite', desc: 'Filtra miles de acciones por margen, rentabilidad por caja libre, deuda y dilución en segundos.' },
  { title: 'Cobertura en vivo', desc: 'Tu lista de seguimiento sincroniza precios y tipo de cambio continuamente, sin recargar nada.' },
];

const METHOD_STEPS = [
  { title: '1. Valor base por caja libre', capsule: 'El punto de partida: una valoración construida directamente desde la caja libre que reporta la empresa, antes de cualquier ajuste.' },
  { title: '2. Multiplicador de calidad', capsule: 'Sube o baja ese valor base según márgenes, rentabilidad y consistencia del negocio.' },
  { title: '3. Ajuste por balance', capsule: 'Premia una deuda baja y penaliza un apalancamiento alto.' },
  { title: '4. Penalización por riesgos', capsule: 'Resta puntos cuando aparecen señales de alerta concretas, para no confundir "barato" con "sano".' },
];

export default function HomeView() {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useUser();

  useEffect(() => {
    if (isLoaded && isSignedIn) router.replace('/home');
  }, [isLoaded, isSignedIn, router]);

  return (
    <div style={{ width: '100%', minHeight: '100vh', boxSizing: 'border-box', background: C.bg, color: C.ink, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <div style={{ ...CONTAINER, padding: '24px 24px 0' }}>
        <NewMarketingNav />
      </div>

      {/* HERO */}
      <section style={{ ...CONTAINER, padding: 'clamp(40px, 7vw, 80px) 24px clamp(48px, 7vw, 64px)' }}>
        <div className="hero-grid" style={{ display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: '48px', alignItems: 'center' }}>
          <div>
            <h1 className="hero-title" style={{ fontSize: 'clamp(30px, 4.4vw, 52px)', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.05, margin: 0 }}>
              Entiende cualquier acción antes de invertir en ella.
            </h1>
            <p style={{ fontSize: '16px', color: C.text2, lineHeight: 1.6, maxWidth: '46ch', margin: '18px 0 0' }}>
              Datos directos de la SEC, una nota de calidad clara y una proyección a 5 años — sin jerga, sin recomendaciones de compra/venta. Gratis para empezar, sin tarjeta.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '18px', marginTop: '28px', flexWrap: 'wrap' }}>
              <Link href="/home" style={{ display: 'inline-flex', alignItems: 'center', height: '48px', padding: '0 26px', borderRadius: '12px', fontSize: '14px', fontWeight: 700, textDecoration: 'none', background: C.lime, color: C.ink }}>
                Empieza gratis →
              </Link>
              <Link href="/pricing" style={{ fontSize: '13px', fontWeight: 700, color: C.text2, textDecoration: 'none', borderBottom: `1px solid ${C.border}`, paddingBottom: '2px' }}>
                Ver precios
              </Link>
            </div>
          </div>

          <StockCardPreview />
        </div>
      </section>

      {/* STATS */}
      <section style={{ borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
        <div className="home-stats-grid" style={{ ...CONTAINER, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {STATS.map((s, i) => (
            <div key={s.value} style={{ padding: '26px 20px', borderLeft: i === 0 ? 'none' : `1px solid ${C.border}` }}>
              <div style={{ fontSize: '21px', fontWeight: 800, letterSpacing: '-0.02em' }}>{s.value}</div>
              <div style={{ fontSize: '13px', color: C.text2, marginTop: '4px', lineHeight: 1.4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section style={{ ...CONTAINER, padding: 'clamp(48px, 7vw, 80px) 24px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: C.text3, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Qué incluye</div>
        <h2 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.02em', marginTop: '8px', maxWidth: '20ch' }}>Cuatro herramientas, sin relleno.</h2>

        <div className="home-features-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: C.border, border: `1px solid ${C.border}`, borderRadius: '16px', overflow: 'hidden', marginTop: '32px' }}>
          {FEATURES.map((f, i) => (
            <div key={f.title} style={{ background: C.surface, padding: '22px 20px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: C.text3 }}>{String(i + 1).padStart(2, '0')}</div>
              <h3 style={{ fontSize: '14px', fontWeight: 800, marginTop: '28px', marginBottom: '8px' }}>{f.title}</h3>
              <p style={{ fontSize: '12.5px', color: C.text2, lineHeight: 1.5, margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* METHODOLOGY TEASER */}
      <section style={{ background: C.surface, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ ...CONTAINER, padding: 'clamp(48px, 7vw, 80px) 24px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: C.text3, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Cómo se calcula la nota</div>
          <h2 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.02em', marginTop: '8px', maxWidth: '26ch' }}>La nota de calidad, paso a paso</h2>
          <p style={{ fontSize: '14px', color: C.text2, lineHeight: 1.6, marginTop: '12px', maxWidth: '56ch' }}>
            Convertimos la caja libre de cada empresa en una única nota ajustada por calidad, en cuatro pasos encadenados.
          </p>

          <div className="method-teaser-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '22px', marginTop: '32px' }}>
            {METHOD_STEPS.map(step => (
              <div key={step.title}>
                <h3 style={{ fontSize: '13.5px', fontWeight: 800, margin: 0 }}>{step.title}</h3>
                <p style={{ fontSize: '12.5px', color: C.text2, lineHeight: 1.55, marginTop: '7px' }}>{step.capsule}</p>
              </div>
            ))}
          </div>

          <Link href="/about" style={{ display: 'inline-block', marginTop: '26px', fontSize: '13px', fontWeight: 700, color: C.ink, textDecoration: 'none' }}>
            Ver la metodología completa →
          </Link>
        </div>
      </section>

      {/* PRICING TEASER */}
      <section style={{ ...CONTAINER, padding: 'clamp(48px, 7vw, 80px) 24px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: C.text3, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Precios</div>
        <h2 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.02em', marginTop: '8px', maxWidth: '22ch' }}>Gratis para empezar. Pro cuando lo necesites.</h2>

        <div className="home-pricing-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '32px' }}>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '16px', padding: '28px', boxSizing: 'border-box' }}>
            <div style={{ fontSize: '14px', fontWeight: 700 }}>Gratis</div>
            <div style={{ fontSize: '34px', fontWeight: 800, letterSpacing: '-0.02em', marginTop: '12px' }}>0 €</div>
            <div style={{ fontSize: '13px', color: C.text2, marginTop: '4px' }}>sin tarjeta</div>
            <ul style={{ listStyle: 'none', margin: '20px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {['Veredictos y proyección a 5 años', 'Nota de calidad en cada acción', 'Explorador sin límite'].map(f => (
                <li key={f} style={{ fontSize: '13px', color: C.text2, display: 'flex', gap: '8px' }}>
                  <span style={{ color: C.text3, fontWeight: 700 }}>+</span>{f}
                </li>
              ))}
            </ul>
          </div>

          <div style={{ background: '#F6FFDE', border: `1.5px solid ${C.lime}`, borderRadius: '16px', padding: '28px', position: 'relative', boxSizing: 'border-box' }}>
            <div style={{ position: 'absolute', top: '-12px', left: '24px', background: C.lime, color: C.ink, fontSize: '10px', fontWeight: 800, letterSpacing: '0.04em', padding: '4px 10px', borderRadius: '20px' }}>MÁS POPULAR</div>
            <div style={{ fontSize: '14px', fontWeight: 700 }}>Bulltrace Pro</div>
            <div style={{ fontSize: '34px', fontWeight: 800, letterSpacing: '-0.02em', marginTop: '12px' }}>
              9,99 €<small style={{ fontSize: '13px', fontWeight: 600, color: C.text3 }}>/mes</small>
            </div>
            <div style={{ fontSize: '13px', color: C.text2, marginTop: '4px' }}>facturado 119,99 €/año</div>
            <ul style={{ listStyle: 'none', margin: '20px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {['Todo lo de Gratis', 'Cartera multi-divisa', 'Cobertura completa de ETFs'].map(f => (
                <li key={f} style={{ fontSize: '13px', color: C.text2, display: 'flex', gap: '8px' }}>
                  <span style={{ color: C.text3, fontWeight: 700 }}>+</span>{f}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <Link href="/pricing" style={{ display: 'inline-block', marginTop: '24px', fontSize: '13px', fontWeight: 700, color: C.ink, textDecoration: 'none' }}>
          Ver precios completos →
        </Link>
      </section>

      {/* FINAL CTA */}
      <section style={{ ...CONTAINER, padding: 'clamp(48px, 8vw, 88px) 24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 'clamp(24px, 3.2vw, 36px)', fontWeight: 800, letterSpacing: '-0.02em', maxWidth: '24ch', margin: '0 auto' }}>
          Abre una ficha. Mira la nota. Decide tú.
        </h2>
        <p style={{ fontSize: '14px', color: C.text2, marginTop: '12px' }}>Sin muro de registro entre tú y los datos.</p>
        <div style={{ marginTop: '24px' }}>
          <Link href="/home" style={{ display: 'inline-flex', alignItems: 'center', height: '48px', padding: '0 26px', borderRadius: '12px', fontSize: '14px', fontWeight: 700, textDecoration: 'none', background: C.lime, color: C.ink }}>
            Empieza gratis →
          </Link>
        </div>
      </section>

      <NewMarketingFooter />
    </div>
  );
}
