'use client';
import Topbar from '../../../components/Topbar';
import { useRouter } from 'next/navigation';
import { WindowChrome, Shot } from '../../../components/WindowChrome';
import { localizeHref } from '../../../../lib/i18n/locale';

const MONO = "'JetBrains Mono', monospace";

// Screenshot metadata describes actual English-language product UI, kept in
// English regardless of page locale.
const BENTO_SHOTS = [
  { src: '/screenshots/stock.png', alt: 'Stock analysis page sourced directly from SEC filings', span: 2 },
  { src: '/screenshots/portfolio.png', alt: 'Multi-currency portfolio tracker', span: 1 },
  { src: '/screenshots/screener.png', alt: 'Quantitative stock screener', span: 1 },
  { src: '/screenshots/watchlist.png', alt: 'Live ticker headlines and real-time prices feed', span: 2 },
];

export default function AboutView({ dict, locale }) {
  const router = useRouter();
  const t = dict.about;
  const href = (path) => localizeHref(path, locale);
  const bentoTiles = t.bento.tiles.map((tile, i) => ({ ...tile, ...BENTO_SHOTS[i] }));

  return (
    <div style={{ background: '#ffffff', minHeight: '100vh', color: 'var(--text)', fontFamily: 'Inter, sans-serif' }}>
      <Topbar />

      {/* HERO — dark, Quartr-inspired */}
      <section style={{
        background: 'linear-gradient(180deg, #0b0d13 0%, #0d1017 100%)',
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
          opacity: 0.18,
          filter: 'blur(60px)',
          pointerEvents: 'none'
        }} />

        <div style={{ maxWidth: '820px', margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(20,184,166,0.12)', border: '1px solid rgba(20,184,166,0.35)', padding: '4px 14px', borderRadius: '20px', marginBottom: '24px' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#14b8a6', display: 'inline-block' }} />
            <span style={{ color: '#5eead4', fontSize: '11px', letterSpacing: '2px', fontWeight: 700 }}>{t.hero.eyebrow}</span>
          </div>
          <h1 style={{ fontSize: '48px', fontWeight: 900, letterSpacing: '-1.5px', lineHeight: 1.1, marginBottom: '20px', color: '#ffffff' }}>
            {t.hero.title}
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '16px', lineHeight: 1.8, maxWidth: '640px', margin: '0 auto 36px' }}>
            {t.hero.subtitle}
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn-primary" onClick={() => router.push(href('/pricing'))} style={{ padding: '14px 28px', fontSize: '14px' }}>
              {t.hero.ctaPrimary}
            </button>
            <a href={`${href('/')}#product-tour`} style={{
              padding: '14px 28px',
              fontSize: '14px',
              fontWeight: 600,
              background: 'transparent',
              color: '#ffffff',
              border: '1px solid rgba(255,255,255,0.25)',
              borderRadius: '12px',
              textDecoration: 'none',
              transition: 'background 0.15s'
            }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {t.hero.ctaSecondary}
            </a>
          </div>
        </div>

        <div style={{ maxWidth: '900px', margin: '56px auto 0', position: 'relative', zIndex: 1 }}>
          <WindowChrome title="terminal.traqcker.com/home — Market Overview Dashboard" maxWidth="900px">
            <Shot src="/screenshots/home.png" alt="Traqcker home dashboard" />
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
              background: '#fafafa',
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
              <WindowChrome title={tile.alt}>
                <Shot src={tile.src} alt={tile.alt} />
              </WindowChrome>
            </div>
          ))}
        </div>
      </section>

      {/* FOUNDER'S LETTER / MISSION */}
      <section style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: '#fafafa', padding: '80px 24px' }}>
        <div style={{ maxWidth: '820px', margin: '0 auto' }}>
          <div style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-1px', color: 'var(--text)', marginBottom: '32px', borderLeft: '3px solid var(--accent)', paddingLeft: '24px', lineHeight: 1.3 }}>
            "{t.letter.quote}"
          </div>

          <div style={{ color: 'var(--text-2)', fontSize: '15px', lineHeight: 1.8, display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {t.letter.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
          </div>
        </div>
      </section>

      {/* WHY TRAQCKER EXISTS */}
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

      {/* TEAM SECTION */}
      <section style={{ borderTop: '1px solid var(--border)', background: '#fafafa', padding: '80px 24px' }}>
        <div style={{ maxWidth: '820px', margin: '0 auto' }}>
          <div style={{ color: 'var(--text-3)', fontSize: '11px', letterSpacing: '2px', fontWeight: 700, marginBottom: '28px' }}>{t.team.eyebrow}</div>
          <div style={{ border: '1px solid var(--border)', borderRadius: '16px', padding: '32px', display: 'flex', alignItems: 'center', gap: '28px', background: '#ffffff' }}>
            <img src="/pablo2.jpg" alt={t.team.name} style={{ width: '88px', height: '88px', objectFit: 'cover', borderRadius: '50%', flexShrink: 0, border: '2px solid var(--border)' }} />
            <div>
              <div style={{ fontSize: '20px', fontWeight: 800, marginBottom: '4px', color: 'var(--text)' }}>{t.team.name}</div>
              <div className="gradient-text" style={{ fontSize: '13px', fontWeight: 700, marginBottom: '10px' }}>{t.team.role}</div>
              <p style={{ color: 'var(--text-2)', fontSize: '13px', lineHeight: 1.7, marginBottom: '12px', maxWidth: '440px' }}>
                {t.team.bio}
              </p>
              <a href="https://twitter.com/PabloDevelops" target="_blank" rel="noopener noreferrer"
                style={{ color: 'var(--accent)', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}>
                @PabloDevelops ↗
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section style={{ maxWidth: '820px', margin: '0 auto', padding: '80px 24px 100px' }}>
        <div style={{ border: '1px solid var(--border)', borderRadius: '24px', padding: '48px 40px', textAlign: 'center', background: '#ffffff' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '-0.5px', marginBottom: '12px', color: 'var(--text)' }}>
            {t.finalCta.title}
          </h2>
          <p style={{ color: 'var(--text-2)', fontSize: '14px', marginBottom: '28px' }}>
            {t.finalCta.subtitle}
          </p>
          <button className="btn-primary" onClick={() => router.push(href('/pricing'))} style={{ padding: '14px 36px', fontSize: '15px' }}>
            {t.finalCta.cta}
          </button>
        </div>

        {/* Footer note */}
        <div style={{ marginTop: '48px', paddingTop: '24px', borderTop: '1px solid var(--border)', color: 'var(--text-3)', fontSize: '12px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <span>{t.footerNote.disclaimer}</span>
          <span>{t.footerNote.copyright}</span>
        </div>
      </section>

    </div>
  );
}
