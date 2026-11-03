'use client';
import Link from 'next/link';
import NewMarketingNav from '../../components/new/NewMarketingNav';
import NewMarketingFooter from '../../components/new/NewMarketingFooter';
import StockCardPreview from '../../components/new/StockCardPreview';
import { NEW_COLORS as C } from '../../components/new/theme';

const CONTAINER = { maxWidth: 'min(1200px, 92vw)', margin: '0 auto', padding: '0 24px', boxSizing: 'border-box' };
const NARROW = { maxWidth: '760px', margin: '0 auto', padding: '0 24px', boxSizing: 'border-box' };

const BENTO_TILES = [
  { badge: 'EXPLORADOR', title: 'Datos directos de la SEC', desc: 'Cada margen, cifra de conversión de caja y valor razonable se calcula directamente desde la presentación oficial, no desde un resumen de terceros.' },
  { badge: 'CARTERA', title: 'Seguimiento multi-divisa', desc: 'Posiciones, ganancia/pérdida y reparto en tu propia divisa de referencia, en cualquier mercado.' },
  { badge: 'EXPLORADOR', title: 'Filtro cuantitativo del universo', desc: 'Ordena miles de acciones globales por margen, rentabilidad por caja libre, perfil de deuda y dilución en segundos.' },
  { badge: 'COBERTURA EN VIVO', title: 'Datos y presentaciones en tiempo real', desc: 'Alertas en cuanto una presentación llega a SEC EDGAR, con listas de seguimiento que sincronizan precios y tipos de cambio continuamente.' },
];

const LETTER_PARAGRAPHS = [
  'La mayoría de las herramientas de inversión están diseñadas para abrumarte con jerga compleja o empujarte hacia operaciones que generan comisiones. Te dan números, pero no te ayudan a entender la calidad del negocio.',
  'Creemos que los analistas independientes no deberían tener que gastar miles de euros al año para acceder a datos financieros limpios y directos. En Bulltrace vamos directamente a la fuente primaria: obtenemos los archivos de los organismos reguladores, calculamos los márgenes de forma transparente y los mapeamos a modelos visuales históricos.',
  'Cuando evalúas una acción en Bulltrace, no ves solo una nota de calidad. Puedes hacer clic en cualquier métrica para inspeccionar la línea exacta en los informes financieros de la empresa. Creemos en la transparencia total, los hechos frente a las predicciones, y la claridad absoluta.',
];

const WHY_ITEMS = [
  { title: 'Sin sesgo de analista', desc: 'No publicamos precios objetivo especulativos ni recomendaciones de compra/venta. Te damos los datos históricos, la nota de calidad y los cálculos para que decidas tú.' },
  { title: 'Transparencia de la fuente', desc: 'Cada cálculo de la plataforma es abierto y verificable. Al hacer clic en cualquier número se abre una referencia directa a la fila de la presentación en SEC EDGAR.' },
  { title: 'Estándar multi-divisa', desc: 'Normalizamos activos globales bajo una única interfaz, convirtiendo divisas y tickers automáticamente para comparar posiciones nacionales y extranjeras.' },
  { title: 'Velocidad sin ruido', desc: 'Un sistema de caché de alto rendimiento carga listas de seguimiento y carteras al instante, actualizando precios en segundo plano sin bloquear nada.' },
];

const METHOD_STEPS = [
  { title: '1. Valor base por caja libre', capsule: 'El Valor Base por Caja Libre es la valoración de partida de una empresa, calculada directamente a partir de su caja libre reportada, antes de cualquier ajuste.', desc: 'Es la base de la nota: una cifra de valoración construida directamente desde la caja libre, antes de aplicar cualquier ajuste de calidad, balance o riesgo.' },
  { title: '2. Multiplicador de calidad', capsule: 'El Multiplicador de Calidad sube o baja ese valor base usando métricas de calidad del negocio como márgenes, rentabilidad y consistencia.', desc: 'Los negocios con una economía más sólida y duradera reciben un multiplicador más alto sobre su valor base; los de peor calidad se descuentan.' },
  { title: '3. Ajuste por balance', capsule: 'El Ajuste por Balance tiene en cuenta la solidez o el riesgo del balance, premiando la deuda baja y penalizando el apalancamiento elevado.', desc: 'Una empresa con un balance conservador se ajusta más favorablemente que una que carga con mucha deuda u otro riesgo estructural.' },
  { title: '4. Penalización por riesgos', capsule: 'La Penalización por Riesgos reduce la nota cuando aparecen debilidades fundamentales, para protegerse de las clásicas trampas de valor.', desc: 'El último paso resta puntos cuando hay señales de alerta concretas, para que una nota que parece barata no se confunda con un negocio sano.' },
];

const TLDR_ITEMS = [
  'Bulltrace puntúa más de 260 empresas cotizadas con un marco propio basado en metodología GARP y centrado en la caja libre.',
  'La puntuación sigue 4 pasos: Valor base por caja libre, Multiplicador de calidad, Ajuste por balance, Penalización por riesgos.',
  'Las empresas con caja libre negativa reciben una Nota de Supervivencia Pre-FCF independiente, en vez de quedar excluidas.',
  'Todos los datos proceden directamente de presentaciones de SEC EDGAR y de Finnhub.',
  'El acceso completo cuesta 14,99 €/mes o 119,99 €/año, con una prueba gratuita de 14 días y sin tarjeta.',
];

function SectionLabel({ children }) {
  return <div style={{ fontSize: '11px', fontWeight: 700, color: C.text3, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>{children}</div>;
}

export default function AboutView() {
  return (
    <div style={{ width: '100%', minHeight: '100vh', boxSizing: 'border-box', background: C.bg, color: C.ink, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <div style={{ ...CONTAINER, padding: '24px 24px 0' }}>
        <NewMarketingNav />
      </div>

      {/* HERO */}
      <section style={{ ...CONTAINER, padding: 'clamp(40px, 7vw, 80px) 24px clamp(48px, 7vw, 64px)' }}>
        <div className="hero-grid" style={{ display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: '48px', alignItems: 'center' }}>
          <div>
            <SectionLabel>NUESTRA HISTORIA</SectionLabel>
            <h1 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1, margin: 0 }}>
              Infraestructura de análisis de inversión, construida sobre fuentes primarias.
            </h1>
            <p style={{ fontSize: '15px', color: C.text2, lineHeight: 1.6, maxWidth: '48ch', margin: '18px 0 0' }}>
              Bulltrace da a analistas independientes e inversores particulares acceso directo y sin filtros a datos limpios de empresas cotizadas, notas de calidad y análisis de cartera.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '26px', flexWrap: 'wrap' }}>
              <Link href="/home" style={{ display: 'inline-flex', alignItems: 'center', height: '46px', padding: '0 24px', borderRadius: '12px', fontSize: '14px', fontWeight: 700, textDecoration: 'none', background: C.lime, color: C.ink }}>
                Empieza gratis →
              </Link>
              <Link href="/pricing" style={{ display: 'inline-flex', alignItems: 'center', height: '46px', padding: '0 24px', borderRadius: '12px', fontSize: '14px', fontWeight: 700, textDecoration: 'none', border: `1px solid ${C.border}`, color: C.ink }}>
                Ver precios
              </Link>
            </div>
          </div>

          <StockCardPreview />
        </div>
      </section>

      {/* BENTO PRODUCT GRID */}
      <section style={{ ...CONTAINER, padding: 'clamp(48px, 7vw, 80px) 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: C.text3, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Lo que hemos construido</div>
          <h2 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.02em', marginTop: '8px' }}>Un solo espacio de trabajo, directo de la fuente</h2>
        </div>

        <div className="home-features-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
          {BENTO_TILES.map(tile => (
            <div key={tile.title} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '16px', padding: '22px 20px' }}>
              <div style={{ display: 'inline-flex', background: '#F6FFDE', color: '#4A6B12', fontSize: '10px', fontWeight: 700, padding: '4px 10px', borderRadius: '20px', marginBottom: '14px', letterSpacing: '0.04em' }}>
                {tile.badge}
              </div>
              <h3 style={{ fontSize: '14.5px', fontWeight: 800, marginBottom: '8px' }}>{tile.title}</h3>
              <p style={{ fontSize: '12.5px', color: C.text2, lineHeight: 1.55, margin: 0 }}>{tile.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FOUNDER'S LETTER */}
      <section style={{ background: C.surface, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ ...NARROW, padding: 'clamp(48px, 7vw, 72px) 24px' }}>
          <div style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '28px', borderLeft: `3px solid ${C.lime}`, paddingLeft: '20px', lineHeight: 1.35 }}>
            &ldquo;En el análisis de inversión, los datos verificados son la única moneda que importa.&rdquo;
          </div>
          <div style={{ color: C.text2, fontSize: '14px', lineHeight: 1.75, display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {LETTER_PARAGRAPHS.map((p, i) => <p key={i} style={{ margin: 0 }}>{p}</p>)}
          </div>
        </div>
      </section>

      {/* WHY BULLTRACE EXISTS */}
      <section style={{ ...NARROW, padding: 'clamp(48px, 7vw, 72px) 24px' }}>
        <SectionLabel>POR QUÉ EXISTE BULLTRACE</SectionLabel>
        <div className="quality-score-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px', marginTop: '20px' }}>
          {WHY_ITEMS.map(item => (
            <div key={item.title}>
              <h3 style={{ fontSize: '15px', fontWeight: 800, marginBottom: '8px' }}>{item.title}</h3>
              <p style={{ color: C.text2, fontSize: '13px', lineHeight: 1.65, margin: 0 }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* METHODOLOGY */}
      <section style={{ borderTop: `1px solid ${C.border}` }}>
        <div style={{ ...NARROW, padding: 'clamp(48px, 7vw, 72px) 24px' }}>
          <SectionLabel>CÓMO FUNCIONA LA NOTA</SectionLabel>
          <h2 style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '10px', marginTop: 0 }}>La Nota Bulltrace, paso a paso</h2>
          <p style={{ color: C.text2, fontSize: '14px', lineHeight: 1.65, marginBottom: '36px' }}>
            Bulltrace convierte la caja libre en una única nota ajustada por calidad para más de 260 empresas, a través de cuatro pasos de cálculo encadenados.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '26px', marginBottom: '36px' }}>
            {METHOD_STEPS.map(step => (
              <div key={step.title}>
                <h3 style={{ fontSize: '15px', fontWeight: 800, marginBottom: '7px' }}>{step.title}</h3>
                <p style={{ color: C.ink, fontSize: '13px', lineHeight: 1.65, marginBottom: '5px', fontWeight: 600 }}>{step.capsule}</p>
                <p style={{ color: C.text2, fontSize: '13px', lineHeight: 1.65, margin: 0 }}>{step.desc}</p>
              </div>
            ))}
          </div>

          <div style={{ marginBottom: '28px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 800, marginBottom: '7px' }}>¿Y si la caja libre es negativa?</h3>
            <p style={{ color: C.ink, fontSize: '13px', lineHeight: 1.65, marginBottom: '5px', fontWeight: 600 }}>
              Las empresas con caja libre negativa se saltan por completo la nota de cuatro pasos y reciben en su lugar una Nota de Supervivencia Pre-FCF independiente.
            </p>
            <p style={{ color: C.text2, fontSize: '13px', lineHeight: 1.65, margin: 0 }}>
              En lugar de excluir del explorador a las empresas no rentables o en fase inicial, Bulltrace aplica una Nota de Supervivencia Pre-FCF diseñada para evaluar su viabilidad con sus propios criterios.
            </p>
          </div>

          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 800, marginBottom: '7px' }}>Fuentes de datos: SEC EDGAR y Finnhub</h3>
            <p style={{ color: C.ink, fontSize: '13px', lineHeight: 1.65, marginBottom: '5px', fontWeight: 600 }}>
              Cada nota de Bulltrace se basa en estados financieros primarios obtenidos directamente de presentaciones de SEC EDGAR y de Finnhub, nunca en estimaciones.
            </p>
            <p style={{ color: C.text2, fontSize: '13px', lineHeight: 1.65, margin: 0 }}>
              Las notas se calculan a partir de datos de fuente primaria, no de resúmenes de terceros, así que cada cifra se puede rastrear hasta la presentación original.
            </p>
          </div>
        </div>
      </section>

      {/* TL;DR */}
      <section style={{ background: C.surface, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ ...NARROW, padding: '40px 24px' }}>
          <h2 style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.1em', color: C.ink, marginBottom: '16px', textTransform: 'uppercase' }}>Resumen rápido</h2>
          <ul style={{ margin: 0, padding: '0 0 0 20px', color: C.text2, fontSize: '13.5px', lineHeight: 1.85 }}>
            {TLDR_ITEMS.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </div>
      </section>

      {/* TEAM */}
      <section style={{ ...NARROW, padding: 'clamp(48px, 7vw, 72px) 24px' }}>
        <SectionLabel>EL EQUIPO</SectionLabel>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '28px', display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap', boxSizing: 'border-box' }}>
          <img src="/pablo2.jpg" alt="Pablo Rodriguez" style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '50%', flexShrink: 0, border: `2px solid ${C.border}` }} />
          <div>
            <div style={{ fontSize: '18px', fontWeight: 800, marginBottom: '4px' }}>Pablo Rodriguez</div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#4A6B12', marginBottom: '10px' }}>Fundador</div>
            <p style={{ color: C.text2, fontSize: '13px', lineHeight: 1.65, marginBottom: '10px', maxWidth: '440px' }}>
              Creó Bulltrace por la frustración de usar herramientas que eran demasiado caras o demasiado complejas. Quería algo honesto, simple y realmente útil para inversores normales.
            </p>
            <a href="https://twitter.com/pabloinvesting_" target="_blank" rel="noopener noreferrer" style={{ color: C.ink, fontSize: '13px', fontWeight: 700, textDecoration: 'none' }}>
              @pabloinvesting_ ↗
            </a>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section style={{ ...NARROW, padding: '0 24px clamp(48px, 7vw, 80px)' }}>
        <div style={{ background: '#F6FFDE', border: `1.5px solid ${C.lime}`, borderRadius: '20px', padding: '40px 32px', textAlign: 'center', boxSizing: 'border-box' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 10px' }}>Empieza a investigar hoy.</h2>
          <p style={{ color: C.text2, fontSize: '13.5px', margin: '0 0 24px' }}>Crea una cuenta gratis para ver veredictos completos y explorar sin límite. Sin tarjeta.</p>
          <Link href="/home" style={{ display: 'inline-flex', alignItems: 'center', height: '46px', padding: '0 28px', borderRadius: '12px', fontSize: '14px', fontWeight: 700, textDecoration: 'none', background: C.lime, color: C.ink }}>
            Empieza gratis →
          </Link>
        </div>

        <div style={{ marginTop: '32px', paddingTop: '20px', borderTop: `1px solid ${C.borderSoft}`, color: C.text3, fontSize: '12px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <span>No es asesoramiento de inversión · Datos de fuentes públicas</span>
          <span>© 2026 Bulltrace</span>
        </div>
      </section>

      <NewMarketingFooter />
    </div>
  );
}
