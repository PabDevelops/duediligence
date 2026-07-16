'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '../../components/AuthProvider';
import NewsletterForm from '../../components/NewsletterForm';
import { WindowChrome, Shot } from '../../components/WindowChrome';
import { localizeHref } from '../../../lib/i18n/locale';

// Switching away from Spanish must explicitly clear the cookie — the
// middleware treats NEXT_LOCALE as authoritative, so without this a bare
// link back would just get redirected straight back to /es.
function useLangToggle(locale) {
  const otherLocaleHref = locale === 'es' ? '/' : '/es';
  const label = locale === 'es' ? 'EN' : 'ES';
  const onClick = () => {
    if (locale === 'es') document.cookie = 'NEXT_LOCALE=en; path=/; max-age=31536000';
  };
  return { otherLocaleHref, label, onClick };
}

const MONO = "'JetBrains Mono', monospace";
const CONTAINER = { maxWidth: '1160px', margin: '0 auto', padding: '0 clamp(16px, 5vw, 24px)' };

// Screenshot metadata describes actual English-language product UI, so it
// stays in English regardless of page locale — only the surrounding prose
// (from dict) is translated.
const VALUE_PROP_SHOTS = [
  { windowTitle: 'terminal.traqcker.com/watchlist — Live Ticker Headlines', src: '/screenshots/watchlist.png', alt: 'Live ticker headlines and real-time prices feed' },
  { windowTitle: 'terminal.traqcker.com/stock/AAPL — SEC Source Reference', src: '/screenshots/stock.png', alt: 'Stock fundamental analysis verified with SEC files' },
  { windowTitle: 'terminal.traqcker.com/screener — Quantitative Universe Filter', src: '/screenshots/screener.png', alt: 'Quantitative stock screener grid' },
];

// Product Tour no longer shows screenshots — each step links straight into
// the real, now-anonymous-accessible route instead of a static image of it.
// windowTitle stays as the WindowChrome "browser bar" label so the fake-URL
// framing (and the implicit "this is a real page" cue) is preserved.
const PRODUCT_TOUR_STOPS = [
  { route: '/home', windowTitle: 'terminal.traqcker.com/home — Market Overview Dashboard' },
  { route: '/portfolio', windowTitle: 'terminal.traqcker.com/portfolio — Multi-Currency Portfolio' },
  { route: '/stock/AAPL', windowTitle: 'terminal.traqcker.com/stock/AAPL — SEC Source Reference' },
  { route: '/screener', windowTitle: 'terminal.traqcker.com/screener — Quantitative Universe Filter' },
  { route: '/radar', windowTitle: 'terminal.traqcker.com/radar — Market Radar' },
  { route: '/calendar', windowTitle: 'terminal.traqcker.com/calendar — Earnings & Filings Calendar' },
];

function PrimaryButton({ href: to, children, style, ...rest }) {
  return (
    <a href={to} style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '46px',
      padding: '0 24px',
      fontSize: '14px',
      fontWeight: 700,
      background: 'var(--accent)',
      color: '#ffffff',
      borderRadius: '10px',
      textDecoration: 'none',
      boxShadow: '0 4px 14px rgba(15, 118, 110, 0.25)',
      transition: 'opacity 0.15s',
      whiteSpace: 'nowrap',
      ...style,
    }}
      onMouseEnter={e => e.currentTarget.style.opacity = 0.92}
      onMouseLeave={e => e.currentTarget.style.opacity = 1}
      {...rest}
    >
      {children}
    </a>
  );
}

function SecondaryButton({ href: to, children, style, ...rest }) {
  return (
    <a href={to} style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '46px',
      padding: '0 24px',
      fontSize: '14px',
      fontWeight: 600,
      background: 'transparent',
      color: 'var(--text)',
      border: '1px solid var(--border)',
      borderRadius: '10px',
      textDecoration: 'none',
      transition: 'background 0.15s, border-color 0.15s',
      whiteSpace: 'nowrap',
      ...style,
    }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-dim)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--border)'; }}
      {...rest}
    >
      {children}
    </a>
  );
}

export default function HomeView({ dict, locale }) {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useUser();
  const [activePropTab, setActivePropTab] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const t = dict.home;
  const href = (path) => localizeHref(path, locale);

  useEffect(() => {
    if (isLoaded && isSignedIn) router.replace('/home');
  }, [isLoaded, isSignedIn, router]);

  const valueProps = t.valueProps.items.map((item, i) => ({ ...item, shot: VALUE_PROP_SHOTS[i] }));
  const langToggle = useLangToggle(locale);
  const closeMenu = () => setMenuOpen(false);

  const navLink = { textDecoration: 'none', color: 'var(--text-2)', fontSize: '13px', fontWeight: 600 };
  const mobileNavLink = { ...navLink, color: 'var(--text)', fontSize: '15px', padding: '12px 4px', display: 'block' };

  return (
    <div style={{ background: '#ffffff', minHeight: '100vh', color: 'var(--text)', fontFamily: 'Inter, sans-serif' }}>

      {/* HEADER */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(10px)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ ...CONTAINER, padding: '18px clamp(16px, 5vw, 24px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <a href={href('/')} style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', flexShrink: 0 }}>
            <img src="/logo-traqcker-new.png" alt="Traqcker" style={{ height: '18px', width: 'auto' }} />
          </a>

          <nav className="desktop-only" style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
            <a href={href('/about')} style={navLink}>{t.nav.product}</a>
            <a href={href('/pricing')} style={navLink}>{t.nav.pricing}</a>
            <a href="#product-tour" style={navLink}>{t.nav.useCases}</a>
          </nav>

          <div className="desktop-only" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <a href={langToggle.otherLocaleHref} onClick={langToggle.onClick} style={{ textDecoration: 'none', color: 'var(--text-3)', fontSize: '13px', fontWeight: 700 }}>{langToggle.label}</a>
            {/* Plain <a>, not <Link> — this crosses from the apex marketing
                domain to terminal.traqcker.com in production, which needs a
                real navigation so middleware.js's host redirect fires. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/home" style={navLink}>{t.openApp}</a>
            <PrimaryButton href={href('/pricing')} style={{ height: '38px', padding: '0 16px', borderRadius: '0', boxShadow: 'none' }}>{t.startFreeTrial}</PrimaryButton>
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
              background: '#ffffff',
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
          maxHeight: menuOpen ? '420px' : '0px',
          overflow: 'hidden',
          transition: 'max-height 0.25s ease',
          borderTop: menuOpen ? '1px solid var(--border)' : 'none',
          background: '#ffffff',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', padding: '8px clamp(16px, 5vw, 24px) 20px' }}>
            <a href={href('/about')} onClick={closeMenu} style={mobileNavLink}>{t.nav.product}</a>
            <a href={href('/pricing')} onClick={closeMenu} style={mobileNavLink}>{t.nav.pricing}</a>
            <a href="#product-tour" onClick={closeMenu} style={mobileNavLink}>{t.nav.useCases}</a>
            <div style={{ height: '1px', background: 'var(--border)', margin: '8px 0 16px' }} />
            <SecondaryButton href="/home" onClick={closeMenu} style={{ width: '100%', marginBottom: '10px' }}>{t.openApp}</SecondaryButton>
            <PrimaryButton href={href('/pricing')} onClick={closeMenu} style={{ width: '100%', marginBottom: '16px' }}>{t.startFreeTrial}</PrimaryButton>
            <a href={langToggle.otherLocaleHref} onClick={() => { langToggle.onClick(); closeMenu(); }} style={{ textDecoration: 'none', color: 'var(--text-3)', fontSize: '13px', fontWeight: 700 }}>
              {locale === 'es' ? 'Switch to English' : 'Cambiar a Español'}
            </a>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section style={{ ...CONTAINER, padding: 'clamp(48px, 9vw, 84px) clamp(16px, 5vw, 24px) clamp(40px, 6vw, 60px)', textAlign: 'center', position: 'relative' }}>
        <h1 style={{
          fontSize: 'clamp(32px, 6.4vw, 56px)',
          fontWeight: 900,
          letterSpacing: '-1.2px',
          lineHeight: 1.1,
          maxWidth: '820px',
          margin: '0 auto clamp(16px, 3vw, 24px)',
          color: 'var(--text)',
        }}>
          {t.hero.title}
        </h1>
        <p style={{
          fontSize: 'clamp(15px, 2vw, 18px)',
          color: 'var(--text-2)',
          lineHeight: 1.6,
          maxWidth: '640px',
          margin: '0 auto clamp(28px, 5vw, 40px)',
        }}>
          {t.hero.subtitle}
        </p>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: 'clamp(40px, 8vw, 64px)', flexWrap: 'wrap' }}>
          <PrimaryButton href={href('/pricing')}>{t.hero.ctaPrimary}</PrimaryButton>
          <SecondaryButton href="/home">{t.hero.ctaSecondary}</SecondaryButton>
        </div>

        {/* HERO MOCKUP */}
        <div style={{ position: 'relative', maxWidth: '960px', margin: '0 auto' }}>
          <div style={{
            position: 'absolute',
            top: '10%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '80%',
            height: '80%',
            background: 'radial-gradient(circle, var(--accent) 0%, transparent 70%)',
            opacity: 0.08,
            filter: 'blur(40px)',
            pointerEvents: 'none',
            zIndex: 0
          }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <WindowChrome title="terminal.traqcker.com/home — Market Overview Dashboard" maxWidth="920px">
              <Shot src="/screenshots/stock.png" alt="Traqcker Terminal Stock Analysis Screen" />
            </WindowChrome>
          </div>
        </div>
      </section>

      {/* CORE CAPABILITIES */}
      <section style={{ ...CONTAINER, padding: 'clamp(56px, 9vw, 100px) clamp(16px, 5vw, 24px) clamp(40px, 6vw, 60px)' }}>
        <div style={{ textAlign: 'center', marginBottom: 'clamp(36px, 6vw, 56px)' }}>
          <span style={{ fontFamily: MONO, fontSize: '11px', color: 'var(--accent)', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>{t.capabilities.eyebrow}</span>
          <h2 style={{ fontSize: 'clamp(24px, 4vw, 32px)', fontWeight: 800, letterSpacing: '-0.8px', color: 'var(--text)', marginTop: '8px' }}>{t.capabilities.title}</h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>

          {/* CAPABILITY 1: PRO TERMINAL */}
          <div className="landing-card" style={{
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: 'clamp(24px, 4vw, 36px)',
            background: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            transition: 'border-color 0.2s, box-shadow 0.2s',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = '0 10px 30px rgba(15,118,110,0.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
          >
            <div>
              <div style={{ display: 'inline-flex', background: 'var(--accent-dim)', color: 'var(--accent)', fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '20px', marginBottom: '20px' }}>
                {t.capabilities.terminal.badge}
              </div>
              <h3 style={{ fontSize: 'clamp(19px, 2.5vw, 24px)', fontWeight: 800, color: 'var(--text)', marginBottom: '8px' }}>{t.capabilities.terminal.title}</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-3)', fontFamily: MONO, marginBottom: '20px' }}>{t.capabilities.terminal.tagline}</p>
              <p style={{ fontSize: '14px', color: 'var(--text-2)', lineHeight: 1.6, marginBottom: '24px' }}>
                {t.capabilities.terminal.desc}
              </p>
            </div>
            <SecondaryButton href="/screener" style={{ width: '100%', height: '44px', borderRadius: '10px' }}>
              {t.capabilities.terminal.cta}
            </SecondaryButton>
          </div>

          {/* CAPABILITY 2: PORTFOLIO & WATCHLIST */}
          <div className="landing-card" style={{
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: 'clamp(24px, 4vw, 36px)',
            background: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            transition: 'border-color 0.2s, box-shadow 0.2s',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--blue)'; e.currentTarget.style.boxShadow = '0 10px 30px rgba(37,99,235,0.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
          >
            <div>
              <div style={{ display: 'inline-flex', background: 'rgba(37, 99, 235, 0.08)', color: 'var(--blue)', fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '20px', marginBottom: '20px' }}>
                {t.capabilities.portfolio.badge}
              </div>
              <h3 style={{ fontSize: 'clamp(19px, 2.5vw, 24px)', fontWeight: 800, color: 'var(--text)', marginBottom: '8px' }}>{t.capabilities.portfolio.title}</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-3)', fontFamily: MONO, marginBottom: '20px' }}>{t.capabilities.portfolio.tagline}</p>
              <p style={{ fontSize: '14px', color: 'var(--text-2)', lineHeight: 1.6, marginBottom: '24px' }}>
                {t.capabilities.portfolio.desc}
              </p>
            </div>
            <SecondaryButton href={href('/pricing')} style={{ width: '100%', height: '44px', borderRadius: '10px' }}>
              {t.capabilities.portfolio.cta}
            </SecondaryButton>
          </div>

        </div>
      </section>

      {/* VALUE PROPOSITION TABS */}
      <section style={{ background: '#fafafa', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: 'clamp(56px, 9vw, 100px) 0' }}>
        <div style={CONTAINER}>

          <div style={{ textAlign: 'center', marginBottom: 'clamp(36px, 6vw, 56px)' }}>
            <span style={{ fontFamily: MONO, fontSize: '11px', color: 'var(--accent)', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>{t.valueProps.eyebrow}</span>
            <h2 style={{ fontSize: 'clamp(24px, 4.5vw, 36px)', fontWeight: 900, letterSpacing: '-1px', color: 'var(--text)', marginTop: '8px', marginBottom: '14px' }}>
              {t.valueProps.title}
            </h2>
            <p style={{ fontSize: '15px', color: 'var(--text-2)', maxWidth: '580px', margin: '0 auto' }}>
              {t.valueProps.subtitle}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', alignItems: 'start' }}>

            {/* TABS MENU */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {valueProps.map((prop, idx) => {
                const isActive = activePropTab === idx;
                return (
                  <button key={prop.title} onClick={() => setActivePropTab(idx)} style={{
                    textAlign: 'left',
                    width: '100%',
                    background: isActive ? '#ffffff' : 'transparent',
                    border: isActive ? '1px solid var(--border)' : '1px solid transparent',
                    borderRadius: '10px',
                    padding: '14px 16px',
                    cursor: 'pointer',
                    outline: 'none',
                    transition: 'all 0.15s'
                  }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: isActive ? 'var(--text)' : 'var(--text-2)' }}>{prop.title}</div>
                    <div style={{ fontSize: '11px', color: isActive ? 'var(--accent)' : 'var(--text-3)', fontFamily: MONO, marginTop: '4px' }}>{prop.tagline}</div>
                  </button>
                );
              })}
            </div>

            {/* TAB CONTENT (MOCKUP + TEXT) */}
            <div style={{ background: '#ffffff', border: '1px solid var(--border)', borderRadius: '16px', padding: 'clamp(20px, 4vw, 36px)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gridColumn: '1 / -1' }}>
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: 'clamp(17px, 2.5vw, 20px)', fontWeight: 800, color: 'var(--text)', marginBottom: '8px' }}>{valueProps[activePropTab].tagline}</h3>
                <p style={{ fontSize: '14px', color: 'var(--text-2)', lineHeight: 1.6 }}>{valueProps[activePropTab].desc}</p>
              </div>
              <div style={{ zIndex: 1 }}>
                <WindowChrome title={valueProps[activePropTab].shot.windowTitle}>
                  <Shot src={valueProps[activePropTab].shot.src} alt={valueProps[activePropTab].shot.alt} />
                </WindowChrome>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* PRODUCT TOUR */}
      <section id="product-tour" style={{ background: '#ffffff', padding: 'clamp(56px, 9vw, 100px) 0', borderBottom: '1px solid var(--border)', scrollMarginTop: '80px' }}>
        <div style={CONTAINER}>
          <div style={{ textAlign: 'center', marginBottom: 'clamp(36px, 6vw, 56px)' }}>
            <span style={{ fontFamily: MONO, fontSize: '11px', color: 'var(--accent)', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>{t.productTour.eyebrow}</span>
            <h2 style={{ fontSize: 'clamp(24px, 4vw, 32px)', fontWeight: 800, color: 'var(--text)', marginTop: '8px' }}>{t.productTour.title}</h2>
            <p style={{ fontSize: '15px', color: 'var(--text-2)', maxWidth: '620px', margin: '14px auto 0' }}>
              {t.productTour.subtitle}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(48px, 8vw, 80px)' }}>
            {t.productTour.steps.map((s, idx) => (
              <div key={idx} style={{
                display: 'flex',
                flexDirection: idx % 2 === 1 ? 'row-reverse' : 'row',
                gap: '40px',
                alignItems: 'center',
                flexWrap: 'wrap'
              }} className="product-tour-row">
                <div style={{ flex: '1 1 280px' }}>
                  <div style={{ fontFamily: MONO, fontSize: '12px', color: 'var(--accent)', fontWeight: 700, marginBottom: '12px' }}>{String(idx + 1).padStart(2, '0')}</div>
                  <h3 style={{ fontSize: 'clamp(19px, 3vw, 24px)', fontWeight: 800, color: 'var(--text)', marginBottom: '12px' }}>{s.title}</h3>
                  <p style={{ fontSize: '14px', color: 'var(--text-2)', lineHeight: 1.7 }}>{s.desc}</p>
                </div>
                <div style={{ flex: '1.4 1 320px' }}>
                  <WindowChrome title={PRODUCT_TOUR_STOPS[idx].windowTitle}>
                    <div style={{ padding: 'clamp(40px, 8vw, 64px) 24px', textAlign: 'center' }}>
                      <div style={{ fontSize: '12px', color: 'var(--text-3)', marginBottom: '18px' }}>
                        {t.productTour.liveNote}
                      </div>
                      <PrimaryButton href={PRODUCT_TOUR_STOPS[idx].route} style={{ boxShadow: 'none' }}>
                        {t.productTour.liveCta}
                      </PrimaryButton>
                    </div>
                  </WindowChrome>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CALL TO ACTION (CTA) */}
      <section style={{ ...CONTAINER, padding: 'clamp(56px, 9vw, 100px) clamp(16px, 5vw, 24px) clamp(64px, 10vw, 120px)', textAlign: 'center' }}>
        <div style={{
          background: 'linear-gradient(135deg, #0b0d13 0%, #0f766e 100%)',
          borderRadius: '24px',
          padding: 'clamp(48px, 8vw, 80px) clamp(24px, 5vw, 40px)',
          color: '#ffffff',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ position: 'relative', zIndex: 1, maxWidth: '640px', margin: '0 auto' }}>
            <h2 style={{ fontSize: 'clamp(26px, 5.5vw, 42px)', fontWeight: 900, letterSpacing: '-1.2px', marginBottom: '18px' }}>
              {t.finalCta.title}
            </h2>
            <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.8)', lineHeight: 1.6, marginBottom: '36px' }}>
              {t.finalCta.subtitle}
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '48px', flexWrap: 'wrap' }}>
              <PrimaryButton href={href('/pricing')} style={{ background: '#ffffff', color: '#0b0d13', boxShadow: '0 4px 14px rgba(0,0,0,0.15)' }}>
                {t.finalCta.ctaPrimary}
              </PrimaryButton>
              <SecondaryButton href={href('/pricing')} style={{ color: '#ffffff', border: '1px solid rgba(255,255,255,0.3)' }}>
                {t.finalCta.ctaSecondary}
              </SecondaryButton>
            </div>

            <div style={{ maxWidth: '440px', margin: '0 auto' }}>
              <NewsletterForm dict={dict.newsletter} />
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid var(--border)', background: '#fafafa', padding: 'clamp(40px, 6vw, 60px) clamp(16px, 5vw, 24px) clamp(56px, 8vw, 80px)' }}>
        <div style={{ ...CONTAINER, padding: 0, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '40px' }}>
          <div style={{ maxWidth: '280px' }}>
            <img src="/logo-traqcker-new.png" alt="Traqcker" style={{ height: '16px', width: 'auto', marginBottom: '16px' }} />
            <p style={{ fontSize: '12px', color: 'var(--text-3)', lineHeight: 1.5 }}>
              {t.footer.tagline}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 'clamp(32px, 8vw, 64px)', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>{t.footer.product}</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                <li><a href={href('/pricing')} style={{ textDecoration: 'none', color: 'var(--text-2)' }}>{t.footer.pricingLink}</a></li>
                <li><a href={href('/about')} style={{ textDecoration: 'none', color: 'var(--text-2)' }}>{t.footer.proFeatures}</a></li>
              </ul>
            </div>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>{t.footer.company}</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                <li><a href={href('/about')} style={{ textDecoration: 'none', color: 'var(--text-2)' }}>{t.footer.aboutUs}</a></li>
                <li><a href={href('/privacy')} style={{ textDecoration: 'none', color: 'var(--text-2)' }}>{t.footer.privacyPolicy}</a></li>
                <li><a href={href('/terms')} style={{ textDecoration: 'none', color: 'var(--text-2)' }}>{t.footer.termsOfService}</a></li>
              </ul>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
