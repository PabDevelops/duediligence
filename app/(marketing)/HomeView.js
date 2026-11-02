'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '../components/AuthProvider';
import { PrimaryButton } from '../components/marketing/Buttons';
import Footer from '../components/marketing/Footer';

const CONTAINER = { maxWidth: '1160px', margin: '0 auto', padding: '0 clamp(16px, 5vw, 24px)' };
const SECTION = { ...CONTAINER, padding: '0 clamp(16px, 5vw, 24px)' };

// Mini live-preview of the Terminal — built from the same tokens as the app's own dark
// workspace theme (Graphite/Acid Lime), not a screenshot, so it never goes stale.
function TerminalPreview() {
  const bg = '#171717';
  const panel = '#1f1f1f';
  const border = '#2e2e2e';
  const dim = '#8b8d82';
  const lime = 'var(--accent)';

  return (
    <div style={{ background: bg, borderRadius: '14px', border: `1px solid ${border}`, overflow: 'hidden', boxShadow: '0 30px 60px -20px rgba(23,23,23,0.35)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', borderBottom: `1px solid ${border}` }}>
        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: border, display: 'inline-block' }} />
        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: border, display: 'inline-block' }} />
        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: border, display: 'inline-block' }} />
        <span style={{ marginLeft: '10px', fontSize: '11px', color: dim, background: panel, border: `1px solid ${border}`, borderRadius: '6px', padding: '4px 10px' }}>AAPL</span>
      </div>
      <div style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '30px', height: '30px', borderRadius: '7px', background: '#fff' }} />
            <div>
              <div style={{ color: '#F5F7F2', fontSize: '15px', fontWeight: 700 }}>Apple Inc.</div>
              <div style={{ color: dim, fontSize: '11px', marginTop: '1px' }}>NASDAQ · Technology</div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#F5F7F2', fontSize: '17px', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>$308.91</div>
            <div style={{ color: 'var(--green)', fontSize: '12px', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>+2.14%</div>
          </div>
        </div>
        <svg viewBox="0 0 400 84" preserveAspectRatio="none" width="100%" height="84" style={{ margin: '4px 0 18px', display: 'block' }}>
          <polyline points="0,58 20,55 40,60 60,50 80,52 100,44 120,47 140,38 160,41 180,32 200,35 220,26 240,29 260,20 280,24 300,15 320,18 340,10 360,13 380,6 400,9" fill="none" stroke="#C7FF38" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: border, border: `1px solid ${border}`, borderRadius: '8px', overflow: 'hidden' }}>
          {[['FCF yield', '3.8%'], ['ROIC', '41.2%'], ['Net debt', '−$42B']].map(([l, v]) => (
            <div key={l} style={{ background: panel, padding: '10px 12px' }}>
              <div style={{ fontSize: '9.5px', letterSpacing: '0.06em', textTransform: 'uppercase', color: dim }}>{l}</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#F5F7F2', marginTop: '4px', fontVariantNumeric: 'tabular-nums' }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: panel, border: `1px solid ${border}`, borderRadius: '8px', padding: '12px 14px' }}>
          <div>
            <div style={{ fontSize: '10px', letterSpacing: '0.06em', textTransform: 'uppercase', color: dim }}>Bulltrace score</div>
            <div style={{ display: 'flex', gap: '3px', marginTop: '7px' }}>
              {Array.from({ length: 10 }, (_, i) => (
                <span key={i} style={{ width: '12px', height: '6px', borderRadius: '1px', background: i < 8 ? lime : border, display: 'inline-block' }} />
              ))}
            </div>
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: lime, fontVariantNumeric: 'tabular-nums' }}>84</div>
        </div>
      </div>
    </div>
  );
}

export default function HomeView({ dict }) {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const t = dict.home;
  const about = dict.about;
  const pricing = dict.pricing;

  useEffect(() => {
    if (isLoaded && isSignedIn) router.replace('/home');
  }, [isLoaded, isSignedIn, router]);

  const closeMenu = () => setMenuOpen(false);

  const navLink = { textDecoration: 'none', color: 'var(--text-2)', fontSize: '13px', fontWeight: 600 };
  const mobileNavLink = { ...navLink, color: 'var(--text)', fontSize: '15px', padding: '12px 4px', display: 'block' };
  const eyebrow = { fontSize: '12px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-3)' };

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', fontFamily: 'Inter, sans-serif' }}>

      {/* HEADER */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(17,17,17,0.85)', backdropFilter: 'blur(10px)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ ...CONTAINER, padding: '18px clamp(16px, 5vw, 24px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', flexShrink: 0 }}>
            <img src="/bulltrace-logos/lockup-cream.png" alt="Bulltrace" style={{ height: '18px', width: 'auto' }} />
          </a>

          <nav className="desktop-only" style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
            <a href="/about" style={navLink}>{t.nav.product}</a>
            <a href="/pricing" style={navLink}>{t.nav.pricing}</a>
            <a href="/faq" style={navLink}>{t.nav.faq}</a>
          </nav>

          <div className="desktop-only" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <a href="/sign-in" style={navLink}>{t.signIn}</a>
            <PrimaryButton href="/home" style={{ height: '38px', padding: '0 16px', borderRadius: '0', boxShadow: 'none' }}>{t.cta}</PrimaryButton>
          </div>

          <button
            className="mobile-only"
            onClick={() => setMenuOpen(o => !o)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            style={{
              width: '38px',
              height: '38px',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              background: 'var(--bg)',
              color: 'var(--text)',
              fontSize: '16px',
              lineHeight: '36px',
              textAlign: 'center',
              padding: 0,
              cursor: 'pointer',
            }}
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>

        {/* MOBILE MENU PANEL */}
        <div className="mobile-only" style={{
          maxHeight: menuOpen ? '320px' : '0px',
          overflow: 'hidden',
          transition: 'max-height 0.25s ease',
          borderTop: menuOpen ? '1px solid var(--border)' : 'none',
          background: 'var(--bg)',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', padding: '8px clamp(16px, 5vw, 24px) 20px' }}>
            <a href="/about" onClick={closeMenu} style={mobileNavLink}>{t.nav.product}</a>
            <a href="/pricing" onClick={closeMenu} style={mobileNavLink}>{t.nav.pricing}</a>
            <a href="/faq" onClick={closeMenu} style={mobileNavLink}>{t.nav.faq}</a>
            <a href="/sign-in" onClick={closeMenu} style={mobileNavLink}>{t.signIn}</a>
            <div style={{ height: '1px', background: 'var(--border)', margin: '8px 0 16px' }} />
            <PrimaryButton href="/home" onClick={closeMenu} style={{ width: '100%' }}>{t.cta}</PrimaryButton>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section style={{ ...SECTION, padding: 'clamp(48px, 8vw, 88px) clamp(16px, 5vw, 24px) clamp(56px, 8vw, 72px)' }}>
        <div className="hero-grid" style={{ display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: '56px', alignItems: 'center' }}>
          <div>
            <h1 className="hero-title" style={{
              fontSize: 'clamp(32px, 4.6vw, 58px)',
              fontWeight: 900,
              letterSpacing: '-1.4px',
              lineHeight: 0.98,
              color: 'var(--text)',
            }}>
              {t.hero.title}
            </h1>
            <p style={{
              fontSize: '17px',
              color: 'var(--text-2)',
              lineHeight: 1.55,
              maxWidth: '46ch',
              margin: '20px 0 0',
            }}>
              {t.hero.subtitle}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '18px', marginTop: '30px', flexWrap: 'wrap' }}>
              <PrimaryButton href="/home" style={{ height: '50px', padding: '0 28px', fontSize: '15px' }}>{t.cta}</PrimaryButton>
              <a href="/pricing" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-2)', borderBottom: '1px solid var(--border-2)', paddingBottom: '2px' }}>{t.pricingLink}</a>
            </div>
          </div>

          <TerminalPreview />
        </div>
      </section>

      {/* STATS */}
      <section style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div className="home-stats-grid" style={{ ...CONTAINER, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {t.stats.map((s, i) => (
            <div key={s.value} style={{ padding: '30px 24px', borderLeft: i === 0 ? 'none' : '1px solid var(--border)' }}>
              <div style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
              <div style={{ fontSize: '13.5px', color: 'var(--text-2)', marginTop: '4px' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section style={{ ...SECTION, padding: 'clamp(56px, 8vw, 96px) clamp(16px, 5vw, 24px)' }}>
        <div style={eyebrow}>{t.featuresEyebrow}</div>
        <h2 style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text)', marginTop: '10px', maxWidth: '20ch' }}>{t.featuresTitle}</h2>

        <div className="home-features-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: 'var(--border)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden', marginTop: '40px' }}>
          {about.bento.tiles.map((tile, i) => (
            <div key={tile.title} style={{ background: 'var(--bg-1)', padding: '26px 22px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-3)' }}>{String(i + 1).padStart(2, '0')}</div>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)', marginTop: '36px' }}>{tile.title}</h3>
              <p style={{ fontSize: '13.5px', color: 'var(--text-2)', lineHeight: 1.55, marginTop: '8px' }}>{tile.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* METHODOLOGY TEASER */}
      <section style={{ background: 'var(--bg-1)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ ...SECTION, padding: 'clamp(56px, 8vw, 96px) clamp(16px, 5vw, 24px)' }}>
          <div style={eyebrow}>{t.methodologyEyebrow}</div>
          <h2 style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text)', marginTop: '10px', maxWidth: '26ch' }}>{about.methodology.title}</h2>
          <p style={{ fontSize: '15px', color: 'var(--text-2)', lineHeight: 1.6, marginTop: '14px', maxWidth: '56ch' }}>{about.methodology.capsule}</p>

          <div className="method-teaser-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', marginTop: '40px' }}>
            {about.methodology.steps.map(step => (
              <div key={step.title}>
                <h3 style={{ fontSize: '14.5px', fontWeight: 800, color: 'var(--text)' }}>{step.title}</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.6, marginTop: '8px' }}>{step.capsule}</p>
              </div>
            ))}
          </div>

          <a href="/about" style={{ display: 'inline-block', marginTop: '32px', fontSize: '14px', fontWeight: 700, color: 'var(--accent)' }}>{t.methodologyLink}</a>
        </div>
      </section>

      {/* PRICING TEASER */}
      <section style={{ ...SECTION, padding: 'clamp(56px, 8vw, 96px) clamp(16px, 5vw, 24px)' }}>
        <div style={eyebrow}>{t.pricingEyebrow}</div>
        <h2 style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text)', marginTop: '10px', maxWidth: '24ch' }}>{t.pricingTitle}</h2>

        <div className="home-pricing-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '40px' }}>
          <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: '14px', padding: '32px' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>{pricing.free.label}</div>
            <div style={{ fontSize: '38px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text)', marginTop: '14px' }}>{pricing.free.price}</div>
            <div style={{ fontSize: '13.5px', color: 'var(--text-2)', marginTop: '6px' }}>{pricing.free.suffix}</div>
            <ul style={{ listStyle: 'none', margin: '22px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: '11px' }}>
              {pricing.free.features.map(f => (
                <li key={f} style={{ fontSize: '13.5px', color: 'var(--text-2)', display: 'flex', gap: '9px' }}>
                  <span style={{ color: 'var(--text-3)', fontWeight: 700 }}>+</span>{f}
                </li>
              ))}
            </ul>
          </div>

          <div style={{ background: 'var(--bg-1)', border: '1.5px solid var(--text)', borderRadius: '14px', padding: '32px', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '-12px', left: '28px', background: 'var(--accent)', color: 'var(--accent-text)', fontSize: '10.5px', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: '5px' }}>{pricing.badge}</div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>{pricing.planName}</div>
            <div style={{ fontSize: '38px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text)', marginTop: '14px' }}>
              $9.99<small style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-3)' }}>{pricing.priceSuffixAnnual}</small>
            </div>
            <div style={{ fontSize: '13.5px', color: 'var(--text-2)', marginTop: '6px' }}>{pricing.footNote}</div>
            <ul style={{ listStyle: 'none', margin: '22px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: '11px' }}>
              {pricing.proFeatures.map(f => (
                <li key={f} style={{ fontSize: '13.5px', color: 'var(--text-2)', display: 'flex', gap: '9px' }}>
                  <span style={{ color: 'var(--text-3)', fontWeight: 700 }}>+</span>{f}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <a href="/pricing" style={{ display: 'inline-block', marginTop: '28px', fontSize: '14px', fontWeight: 700, color: 'var(--accent)' }}>{t.pricingLink}</a>
      </section>

      {/* FINAL CTA */}
      <section style={{ ...SECTION, padding: 'clamp(56px, 8vw, 100px) clamp(16px, 5vw, 24px)', textAlign: 'center' }}>
        <h2 style={{ fontSize: 'clamp(26px, 3.4vw, 40px)', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text)', maxWidth: '26ch', margin: '0 auto' }}>{t.finalCta.title}</h2>
        <p style={{ fontSize: '15px', color: 'var(--text-2)', marginTop: '14px' }}>{t.finalCta.subtitle}</p>
        <div style={{ marginTop: '28px' }}>
          <PrimaryButton href="/home" style={{ height: '50px', padding: '0 28px', fontSize: '15px' }}>{t.cta}</PrimaryButton>
        </div>
      </section>

      <Footer dict={t.footer} />

    </div>
  );
}
