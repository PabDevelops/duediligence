'use client';
import Topbar from '../../components/Topbar';
import Footer from '../../components/marketing/Footer';
import { PrimaryButton, SecondaryButton } from '../../components/marketing/Buttons';
import { WindowChrome } from '../../components/WindowChrome';

const MONO = "'Inter', sans-serif";
const PANEL = '#1f1f1f';
const PBORDER = '#2e2e2e';
const DIM = '#8b8d82';
const LIME = 'var(--accent)';

function Metric({ label, value, sub }) {
  return (
    <div style={{ background: PANEL, border: `1px solid ${PBORDER}`, borderRadius: '8px', padding: '10px 12px' }}>
      <div style={{ fontSize: '9.5px', letterSpacing: '0.06em', textTransform: 'uppercase', color: DIM }}>{label}</div>
      <div style={{ fontSize: '15px', fontWeight: 800, color: '#F5F7F2', marginTop: '4px', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub && <div style={{ fontSize: '10px', color: DIM, marginTop: '2px' }}>{sub}</div>}
    </div>
  );
}

// Hero mockup — compact echo of the real /home dashboard: KPI row, sparkline, holdings.
function HeroMockup() {
  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
        <div>
          <div style={{ fontSize: '10px', letterSpacing: '0.06em', textTransform: 'uppercase', color: DIM }}>Portfolio value</div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#F5F7F2', marginTop: '4px', fontVariantNumeric: 'tabular-nums' }}>$184,220</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '10px', letterSpacing: '0.06em', textTransform: 'uppercase', color: DIM }}>Since inception</div>
          <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--green)', marginTop: '4px', fontVariantNumeric: 'tabular-nums' }}>+18.4%</div>
        </div>
      </div>
      <svg viewBox="0 0 600 100" preserveAspectRatio="none" width="100%" height="100" style={{ display: 'block', marginBottom: '18px' }}>
        <polyline points="0,80 40,74 80,78 120,64 160,68 200,52 240,58 280,40 320,46 360,28 400,34 440,18 480,24 520,10 560,16 600,4" fill="none" stroke={LIME} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px' }}>
        <Metric label="Quality score" value="81" sub="Portfolio-weighted" />
        <Metric label="FCF yield" value="4.6%" sub="Weighted avg" />
        <Metric label="Positions" value="14" sub="3 currencies" />
      </div>
      <div style={{ border: `1px solid ${PBORDER}`, borderRadius: '8px', overflow: 'hidden' }}>
        {[
          { t: 'AAPL', n: 'Apple Inc.', p: '$308.91', c: '+2.14%', up: true },
          { t: 'ASML', n: 'ASML Holding', p: '€612.40', c: '+0.87%', up: true },
          { t: 'MELI', n: 'MercadoLibre', p: '$1,842.10', c: '-1.32%', up: false },
        ].map((row, i) => (
          <div key={row.t} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', background: PANEL, borderTop: i ? `1px solid ${PBORDER}` : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              <span style={{ color: '#F5F7F2', fontSize: '12px', fontWeight: 700, width: '44px', flexShrink: 0 }}>{row.t}</span>
              <span style={{ color: DIM, fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.n}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
              <span style={{ color: '#F5F7F2', fontSize: '12px', fontVariantNumeric: 'tabular-nums' }}>{row.p}</span>
              <span style={{ color: row.up ? 'var(--green)' : '#f87171', fontSize: '11px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', width: '52px', textAlign: 'right' }}>{row.c}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Direct SEC Financials — a metric traced back to its exact source filing row.
function SecFilingMockup() {
  return (
    <div style={{ padding: '18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div>
          <div style={{ fontSize: '9.5px', letterSpacing: '0.06em', textTransform: 'uppercase', color: DIM }}>Gross margin</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#F5F7F2', marginTop: '4px', fontVariantNumeric: 'tabular-nums' }}>43.2%</div>
        </div>
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--green)' }}>+1.4pp YoY</div>
      </div>
      <div style={{ background: PANEL, border: `1px solid ${PBORDER}`, borderRadius: '8px', padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: LIME, flexShrink: 0 }} />
          <span style={{ fontSize: '11px', color: DIM, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>SEC 10-K · Item 8 · Income Statement</span>
        </div>
        <span style={{ fontSize: '10px', fontWeight: 700, color: LIME, flexShrink: 0 }}>View source →</span>
      </div>
    </div>
  );
}

// Multi-Currency Tracker — positions and P/L normalized across exchanges.
function CurrencyTrackerMockup() {
  const rows = [
    { t: 'AAPL', cur: 'USD', v: '$42,180', c: '+8.2%', up: true },
    { t: 'ASML', cur: 'EUR', v: '€18,940', c: '+3.1%', up: true },
    { t: 'RIO',  cur: 'GBP', v: '£9,410',  c: '-2.4%', up: false },
  ];
  return (
    <div style={{ padding: '18px' }}>
      <div style={{ fontSize: '9.5px', letterSpacing: '0.06em', textTransform: 'uppercase', color: DIM, marginBottom: '10px' }}>Positions · reporting currency USD</div>
      <div style={{ border: `1px solid ${PBORDER}`, borderRadius: '8px', overflow: 'hidden' }}>
        {rows.map((row, i) => (
          <div key={row.t} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: PANEL, borderTop: i ? `1px solid ${PBORDER}` : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#F5F7F2', fontSize: '12px', fontWeight: 700 }}>{row.t}</span>
              <span style={{ fontSize: '9px', fontWeight: 700, color: DIM, background: 'rgba(245,247,242,0.06)', borderRadius: '4px', padding: '2px 5px' }}>{row.cur}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: '#F5F7F2', fontSize: '12px', fontVariantNumeric: 'tabular-nums' }}>{row.v}</span>
              <span style={{ color: row.up ? 'var(--green)' : '#f87171', fontSize: '11px', fontWeight: 700, width: '46px', textAlign: 'right' }}>{row.c}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Quantitative Universe Filter — filter chips driving a ranked result set.
function ScreenerMockup() {
  return (
    <div style={{ padding: '18px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
        {['FCF yield > 5%', 'Debt/Equity < 1', 'Margin > 20%'].map(chip => (
          <span key={chip} style={{ fontSize: '10px', fontWeight: 600, color: LIME, background: 'rgba(199,255,56,0.1)', border: '1px solid rgba(199,255,56,0.25)', borderRadius: '20px', padding: '4px 10px' }}>{chip}</span>
        ))}
      </div>
      <div style={{ border: `1px solid ${PBORDER}`, borderRadius: '8px', overflow: 'hidden' }}>
        {[
          { t: 'NVR', s: 92 },
          { t: 'FICO', s: 89 },
          { t: 'MOAT', s: 85 },
        ].map((row, i) => (
          <div key={row.t} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', background: PANEL, borderTop: i ? `1px solid ${PBORDER}` : 'none' }}>
            <span style={{ color: '#F5F7F2', fontSize: '12px', fontWeight: 700 }}>{row.t}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '2px' }}>
                {Array.from({ length: 10 }, (_, j) => (
                  <span key={j} style={{ width: '8px', height: '5px', borderRadius: '1px', background: j < row.s / 10 ? LIME : PBORDER, display: 'inline-block' }} />
                ))}
              </div>
              <span style={{ color: LIME, fontSize: '12px', fontWeight: 800, fontVariantNumeric: 'tabular-nums', width: '20px', textAlign: 'right' }}>{row.s}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Global Filing & Price Feed — live alerts the moment filings land.
function LiveFeedMockup() {
  const rows = [
    { t: 'TSM', label: '8-K filed', ago: '2m ago' },
    { t: 'NOVO-B', label: 'Price alert · -3.1%', ago: '11m ago' },
    { t: 'ASML', label: '10-Q filed', ago: '38m ago' },
  ];
  return (
    <div style={{ padding: '18px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', border: `1px solid ${PBORDER}`, borderRadius: '8px', overflow: 'hidden' }}>
        {rows.map((row, i) => (
          <div key={row.t + i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: PANEL, borderTop: i ? `1px solid ${PBORDER}` : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: LIME, flexShrink: 0 }} />
              <span style={{ color: '#F5F7F2', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>{row.t}</span>
              <span style={{ color: DIM, fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.label}</span>
            </div>
            <span style={{ color: DIM, fontSize: '10px', flexShrink: 0 }}>{row.ago}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const BENTO_MOCKUPS = [
  { Mockup: SecFilingMockup, title: 'terminal.bulltrace.app/stock/AAPL — Financials', span: 2 },
  { Mockup: CurrencyTrackerMockup, title: 'terminal.bulltrace.app/portfolio', span: 1 },
  { Mockup: ScreenerMockup, title: 'terminal.bulltrace.app/screener', span: 1 },
  { Mockup: LiveFeedMockup, title: 'terminal.bulltrace.app/watchlist — Live feed', span: 2 },
];

export default function AboutView({ dict }) {
  const t = dict.about;
  const bentoTiles = t.bento.tiles.map((tile, i) => ({ ...tile, ...BENTO_MOCKUPS[i] }));

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', fontFamily: 'Inter, sans-serif' }}>
      <Topbar />

      {/* HERO */}
      <section style={{
        background: 'var(--bg)',
        borderBottom: '1px solid var(--border)',
        padding: '90px 24px 100px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute',
          top: '-10%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '70%',
          height: '60%',
          background: 'radial-gradient(circle, var(--accent) 0%, transparent 70%)',
          opacity: 0.1,
          filter: 'blur(60px)',
          pointerEvents: 'none'
        }} />

        <div style={{ maxWidth: '820px', margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'var(--accent-dim)', border: '1px solid rgba(199,255,56,0.3)', padding: '4px 14px', borderRadius: '20px', marginBottom: '24px' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
            <span style={{ color: 'var(--accent)', fontSize: '11px', letterSpacing: '2px', fontWeight: 700 }}>{t.hero.eyebrow}</span>
          </div>
          <h1 style={{ fontSize: '48px', fontWeight: 900, letterSpacing: '-1.5px', lineHeight: 1.1, marginBottom: '20px', color: 'var(--text)' }}>
            {t.hero.title}
          </h1>
          <p style={{ color: 'var(--text-2)', fontSize: '16px', lineHeight: 1.8, maxWidth: '640px', margin: '0 auto 36px' }}>
            {t.hero.subtitle}
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <PrimaryButton href="/sign-up" style={{ padding: '0 28px', height: '48px' }}>
              {t.hero.ctaPrimary}
            </PrimaryButton>
            <SecondaryButton href="/home" style={{ padding: '0 28px', height: '48px' }}>
              {t.hero.ctaSecondary}
            </SecondaryButton>
          </div>
        </div>

        <div style={{ maxWidth: '900px', margin: '56px auto 0', position: 'relative', zIndex: 1 }}>
          <WindowChrome title="terminal.bulltrace.app/home — Market Overview Dashboard" maxWidth="900px">
            <HeroMockup />
          </WindowChrome>
        </div>
      </section>

      {/* BENTO PRODUCT GRID */}
      <section style={{ maxWidth: '1200px', margin: '0 auto', padding: '100px 24px 40px' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <span style={{ fontFamily: MONO, fontSize: '11px', color: 'var(--accent)', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>{t.bento.eyebrow}</span>
          <h2 style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-0.8px', color: 'var(--text)', marginTop: '8px' }}>{t.bento.title}</h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }} className="about-bento-grid">
          {bentoTiles.map((tile) => (
            <div key={tile.title} style={{
              gridColumn: `span ${tile.span}`,
              border: '1px solid var(--border)',
              borderRadius: '16px',
              padding: '28px',
              background: 'var(--bg-1)',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              transition: 'border-color 0.2s'
            }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <div>
                <div style={{ display: 'inline-flex', background: 'var(--accent-dim)', color: 'var(--accent)', fontSize: '10px', fontWeight: 700, padding: '4px 10px', borderRadius: '20px', marginBottom: '14px', letterSpacing: '0.5px' }}>
                  {tile.badge}
                </div>
                <h3 style={{ fontSize: '19px', fontWeight: 800, color: 'var(--text)', marginBottom: '8px' }}>{tile.title}</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.6 }}>{tile.desc}</p>
              </div>
              <WindowChrome title={tile.title}>
                <tile.Mockup />
              </WindowChrome>
            </div>
          ))}
        </div>
      </section>

      {/* FOUNDER'S LETTER / MISSION */}
      <section style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: 'var(--bg-1)', padding: '80px 24px' }}>
        <div style={{ maxWidth: '820px', margin: '0 auto' }}>
          <div style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-1px', color: 'var(--text)', marginBottom: '32px', borderLeft: '3px solid var(--accent)', paddingLeft: '24px', lineHeight: 1.3 }}>
            &ldquo;{t.letter.quote}&rdquo;
          </div>

          <div style={{ color: 'var(--text-2)', fontSize: '15px', lineHeight: 1.8, display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {t.letter.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
          </div>
        </div>
      </section>

      {/* WHY BULLTRACE EXISTS */}
      <section style={{ maxWidth: '820px', margin: '0 auto', padding: '80px 24px' }}>
        <div style={{ color: 'var(--text-3)', fontSize: '11px', letterSpacing: '2px', fontWeight: 700, marginBottom: '36px' }}>{t.why.eyebrow}</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }} className="quality-score-grid">
          {t.why.items.map((item, i) => (
            <div key={i}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)', marginBottom: '10px' }}>{item.title}</h3>
              <p style={{ color: 'var(--text-2)', fontSize: '13px', lineHeight: 1.7 }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* METHODOLOGY / SCORING */}
      <section style={{ borderTop: '1px solid var(--border)', maxWidth: '820px', margin: '0 auto', padding: '80px 24px' }}>
        <div style={{ color: 'var(--text-3)', fontSize: '11px', letterSpacing: '2px', fontWeight: 700, marginBottom: '12px' }}>{t.methodology.eyebrow}</div>
        <h2 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.8px', color: 'var(--text)', marginBottom: '10px' }}>{t.methodology.title}</h2>
        <p style={{ color: 'var(--text-2)', fontSize: '15px', lineHeight: 1.7, marginBottom: '40px' }}>{t.methodology.capsule}</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', marginBottom: '40px' }}>
          {t.methodology.steps.map(step => (
            <div key={step.title}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)', marginBottom: '8px' }}>{step.title}</h3>
              <p style={{ color: 'var(--text)', fontSize: '13px', lineHeight: 1.7, marginBottom: '6px', fontWeight: 500 }}>{step.capsule}</p>
              <p style={{ color: 'var(--text-2)', fontSize: '13px', lineHeight: 1.7 }}>{step.desc}</p>
            </div>
          ))}
        </div>

        <div style={{ marginBottom: '32px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)', marginBottom: '8px' }}>{t.methodology.survival.title}</h3>
          <p style={{ color: 'var(--text)', fontSize: '13px', lineHeight: 1.7, marginBottom: '6px', fontWeight: 500 }}>{t.methodology.survival.capsule}</p>
          <p style={{ color: 'var(--text-2)', fontSize: '13px', lineHeight: 1.7 }}>{t.methodology.survival.desc}</p>
        </div>

        <div>
          <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)', marginBottom: '8px' }}>{t.methodology.sources.title}</h3>
          <p style={{ color: 'var(--text)', fontSize: '13px', lineHeight: 1.7, marginBottom: '6px', fontWeight: 500 }}>{t.methodology.sources.capsule}</p>
          <p style={{ color: 'var(--text-2)', fontSize: '13px', lineHeight: 1.7 }}>{t.methodology.sources.desc}</p>
        </div>
      </section>

      {/* TL;DR — short, citable, self-contained summary */}
      <section style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-1)', padding: '56px 24px' }}>
        <div style={{ maxWidth: '820px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '1.5px', color: 'var(--accent)', marginBottom: '18px', textTransform: 'uppercase' }}>{t.tldr.title}</h2>
          <ul style={{ margin: 0, padding: '0 0 0 20px', color: 'var(--text-2)', fontSize: '14px', lineHeight: 1.9 }}>
            {t.tldr.items.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </div>
      </section>

      {/* TEAM SECTION */}
      <section style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-1)', padding: '80px 24px' }}>
        <div style={{ maxWidth: '820px', margin: '0 auto' }}>
          <div style={{ color: 'var(--text-3)', fontSize: '11px', letterSpacing: '2px', fontWeight: 700, marginBottom: '28px' }}>{t.team.eyebrow}</div>
          <div style={{ border: '1px solid var(--border)', borderRadius: '16px', padding: '32px', display: 'flex', alignItems: 'center', gap: '28px', background: 'var(--bg)' }}>
            <img src="/pablo2.jpg" alt={t.team.name} style={{ width: '88px', height: '88px', objectFit: 'cover', borderRadius: '50%', flexShrink: 0, border: '2px solid var(--border)' }} />
            <div>
              <div style={{ fontSize: '20px', fontWeight: 800, marginBottom: '4px', color: 'var(--text)' }}>{t.team.name}</div>
              <div className="gradient-text" style={{ fontSize: '13px', fontWeight: 700, marginBottom: '10px' }}>{t.team.role}</div>
              <p style={{ color: 'var(--text-2)', fontSize: '13px', lineHeight: 1.7, marginBottom: '12px', maxWidth: '440px' }}>
                {t.team.bio}
              </p>
              <a href="https://twitter.com/pabloinvesting_" target="_blank" rel="noopener noreferrer"
                style={{ color: 'var(--accent)', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}>
                @pabloinvesting_ ↗
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section style={{ maxWidth: '820px', margin: '0 auto', padding: '80px 24px 100px' }}>
        <div style={{ border: '1px solid var(--border)', borderRadius: '24px', padding: '48px 40px', textAlign: 'center', background: 'var(--bg-1)' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '-0.5px', marginBottom: '12px', color: 'var(--text)' }}>
            {t.finalCta.title}
          </h2>
          <p style={{ color: 'var(--text-2)', fontSize: '14px', marginBottom: '28px' }}>
            {t.finalCta.subtitle}
          </p>
          <PrimaryButton href="/sign-up" style={{ padding: '0 36px', height: '48px' }}>
            {t.finalCta.cta}
          </PrimaryButton>
        </div>

        {/* Footer note */}
        <div style={{ marginTop: '48px', paddingTop: '24px', borderTop: '1px solid var(--border)', color: 'var(--text-3)', fontSize: '12px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <span>{t.footerNote.disclaimer}</span>
          <span>{t.footerNote.copyright}</span>
        </div>
      </section>

      <Footer dict={dict.home.footer} />

    </div>
  );
}
