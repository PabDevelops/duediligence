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

export default function HomeView({ dict, locale }) {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useUser();
  const [activePropTab, setActivePropTab] = useState(0);
  const t = dict.home;
  const href = (path) => localizeHref(path, locale);

  useEffect(() => {
    if (isLoaded && isSignedIn) router.replace('/home');
  }, [isLoaded, isSignedIn, router]);

  const valueProps = t.valueProps.items.map((item, i) => ({ ...item, shot: VALUE_PROP_SHOTS[i] }));
  const langToggle = useLangToggle(locale);

  return (
    <div style={{ background: '#ffffff', minHeight: '100vh', color: 'var(--text)', fontFamily: 'Inter, sans-serif', overflow: 'hidden' }}>

      {/* HEADER */}
      <header style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--border)'
      }}>
        <a href={href('/')} style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
          <img src="/logo-traqcker-new.png" alt="Traqcker" style={{ height: '18px', width: 'auto' }} />
        </a>

        <nav className="desktop-only" style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
          <a href={href('/about')} style={{ textDecoration: 'none', color: 'var(--text-2)', fontSize: '13px', fontWeight: 600 }}>{t.nav.product}</a>
          <a href={href('/pricing')} style={{ textDecoration: 'none', color: 'var(--text-2)', fontSize: '13px', fontWeight: 600 }}>{t.nav.pricing}</a>
          <a href="#product-tour" style={{ textDecoration: 'none', color: 'var(--text-2)', fontSize: '13px', fontWeight: 600 }}>{t.nav.useCases}</a>
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <a href={langToggle.otherLocaleHref} onClick={langToggle.onClick} style={{ textDecoration: 'none', color: 'var(--text-3)', fontSize: '13px', fontWeight: 700 }}>{langToggle.label}</a>
          <a href="/home" style={{ textDecoration: 'none', color: 'var(--text-2)', fontSize: '13px', fontWeight: 600 }}>{t.openApp}</a>
          <a href={href('/pricing')} style={{
            height: '38px',
            padding: '0 16px',
            background: 'var(--text)',
            color: '#ffffff',
            fontSize: '13px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textDecoration: 'none',
            transition: 'opacity 0.15s'
          }}
            onMouseEnter={e => e.currentTarget.style.opacity = 0.9}
            onMouseLeave={e => e.currentTarget.style.opacity = 1}
          >
            {t.startFreeTrial}
          </a>
        </div>
      </header>

      {/* HERO SECTION */}
      <section style={{ maxWidth: '1200px', margin: '0 auto', padding: '80px 24px 60px', textAlign: 'center', position: 'relative' }}>
        <h1 style={{
          fontSize: '56px',
          fontWeight: 900,
          letterSpacing: '-1.5px',
          lineHeight: 1.08,
          maxWidth: '820px',
          margin: '0 auto 24px',
          color: 'var(--text)',
        }}>
          {t.hero.title}
        </h1>
        <p style={{
          fontSize: '18px',
          color: 'var(--text-2)',
          lineHeight: 1.6,
          maxWidth: '680px',
          margin: '0 auto 40px',
        }}>
          {t.hero.subtitle}
        </p>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '64px', flexWrap: 'wrap' }}>
          <a href={href('/pricing')} style={{
            padding: '14px 28px',
            fontSize: '14px',
            fontWeight: 700,
            background: 'var(--accent)',
            color: '#ffffff',
            textDecoration: 'none',
            boxShadow: '0 4px 14px rgba(15, 118, 110, 0.25)',
            transition: 'opacity 0.15s'
          }}
            onMouseEnter={e => e.currentTarget.style.opacity = 0.95}
            onMouseLeave={e => e.currentTarget.style.opacity = 1}
          >
            {t.hero.ctaPrimary}
          </a>
          <a href="/home" style={{
            padding: '14px 28px',
            fontSize: '14px',
            fontWeight: 600,
            background: 'transparent',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            textDecoration: 'none',
            transition: 'background 0.15s'
          }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.02)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            {t.hero.ctaSecondary}
          </a>
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
      <section style={{ maxWidth: '1200px', margin: '0 auto', padding: '100px 24px 60px' }}>
        <div style={{ textAlign: 'center', marginBottom: '56px' }}>
          <span style={{ fontFamily: MONO, fontSize: '11px', color: 'var(--accent)', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>{t.capabilities.eyebrow}</span>
          <h2 style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-0.8px', color: 'var(--text)', marginTop: '8px' }}>{t.capabilities.title}</h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>

          {/* CAPABILITY 1: PRO TERMINAL */}
          <div style={{
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '36px',
            background: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            transition: 'border-color 0.2s',
          }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            <div>
              <div style={{ display: 'inline-flex', background: 'var(--accent-dim)', color: 'var(--accent)', fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '20px', marginBottom: '20px' }}>
                {t.capabilities.terminal.badge}
              </div>
              <h3 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text)', marginBottom: '8px' }}>{t.capabilities.terminal.title}</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-3)', fontFamily: MONO, marginBottom: '20px' }}>{t.capabilities.terminal.tagline}</p>
              <p style={{ fontSize: '14px', color: 'var(--text-2)', lineHeight: 1.6, marginBottom: '24px' }}>
                {t.capabilities.terminal.desc}
              </p>
            </div>
            <a href="/screener" style={{
              height: '44px',
              border: '1px solid var(--text)',
                display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '13px',
              fontWeight: 700,
              color: 'var(--text)',
              textDecoration: 'none',
              transition: 'background 0.15s'
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--text)'; e.currentTarget.style.color = '#ffffff'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text)'; }}
            >
              {t.capabilities.terminal.cta}
            </a>
          </div>

          {/* CAPABILITY 2: PORTFOLIO & WATCHLIST */}
          <div style={{
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '36px',
            background: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            transition: 'border-color 0.2s',
          }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            <div>
              <div style={{ display: 'inline-flex', background: 'rgba(37, 99, 235, 0.08)', color: 'var(--blue)', fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '20px', marginBottom: '20px' }}>
                {t.capabilities.portfolio.badge}
              </div>
              <h3 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text)', marginBottom: '8px' }}>{t.capabilities.portfolio.title}</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-3)', fontFamily: MONO, marginBottom: '20px' }}>{t.capabilities.portfolio.tagline}</p>
              <p style={{ fontSize: '14px', color: 'var(--text-2)', lineHeight: 1.6, marginBottom: '24px' }}>
                {t.capabilities.portfolio.desc}
              </p>
            </div>
            <a href={href('/pricing')} style={{
              height: '44px',
              border: '1px solid var(--text)',
                display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '13px',
              fontWeight: 700,
              color: 'var(--text)',
              textDecoration: 'none',
              transition: 'background 0.15s'
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--text)'; e.currentTarget.style.color = '#ffffff'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text)'; }}
            >
              {t.capabilities.portfolio.cta}
            </a>
          </div>

        </div>
      </section>

      {/* VALUE PROPOSITION TABS */}
      <section style={{ background: '#fafafa', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: '100px 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

          <div style={{ textAlign: 'center', marginBottom: '56px' }}>
            <span style={{ fontFamily: MONO, fontSize: '11px', color: 'var(--accent)', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>{t.valueProps.eyebrow}</span>
            <h2 style={{ fontSize: '36px', fontWeight: 900, letterSpacing: '-1px', color: 'var(--text)', marginTop: '8px', marginBottom: '14px' }}>
              {t.valueProps.title}
            </h2>
            <p style={{ fontSize: '15px', color: 'var(--text-2)', maxWidth: '580px', margin: '0 auto' }}>
              {t.valueProps.subtitle}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '56px', alignItems: 'center' }}>

            {/* TABS MENU */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {valueProps.map((prop, idx) => {
                const isActive = activePropTab === idx;
                return (
                  <button key={prop.title} onClick={() => setActivePropTab(idx)} style={{
                    textAlign: 'left',
                    background: isActive ? '#ffffff' : 'transparent',
                    border: isActive ? '1px solid var(--border)' : '1px solid transparent',
                    borderRadius: '10px',
                    padding: '16px 20px',
                    cursor: 'pointer',
                    outline: 'none',
                    transition: 'all 0.15s'
                  }}>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: isActive ? 'var(--text)' : 'var(--text-2)' }}>{prop.title}</div>
                    <div style={{ fontSize: '11px', color: isActive ? 'var(--accent)' : 'var(--text-3)', fontFamily: MONO, marginTop: '4px' }}>{prop.tagline}</div>
                  </button>
                );
              })}
            </div>

            {/* TAB CONTENT (MOCKUP + TEXT) */}
            <div style={{ background: '#ffffff', border: '1px solid var(--border)', borderRadius: '16px', padding: '36px', minHeight: '440px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text)', marginBottom: '8px' }}>{valueProps[activePropTab].tagline}</h3>
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
      <section id="product-tour" style={{ background: '#ffffff', padding: '100px 24px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '56px' }}>
            <span style={{ fontFamily: MONO, fontSize: '11px', color: 'var(--accent)', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>{t.productTour.eyebrow}</span>
            <h2 style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text)', marginTop: '8px' }}>{t.productTour.title}</h2>
            <p style={{ fontSize: '15px', color: 'var(--text-2)', maxWidth: '620px', margin: '14px auto 0' }}>
              {t.productTour.subtitle}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '80px' }}>
            {t.productTour.steps.map((s, idx) => (
              <div key={idx} style={{
                display: 'flex',
                flexDirection: idx % 2 === 1 ? 'row-reverse' : 'row',
                gap: '48px',
                alignItems: 'center',
                flexWrap: 'wrap'
              }} className="product-tour-row">
                <div style={{ flex: '1 1 320px' }}>
                  <div style={{ fontFamily: MONO, fontSize: '12px', color: 'var(--accent)', fontWeight: 700, marginBottom: '12px' }}>{String(idx + 1).padStart(2, '0')}</div>
                  <h3 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text)', marginBottom: '12px' }}>{s.title}</h3>
                  <p style={{ fontSize: '14px', color: 'var(--text-2)', lineHeight: 1.7 }}>{s.desc}</p>
                </div>
                <div style={{ flex: '1.4 1 420px' }}>
                  <WindowChrome title={PRODUCT_TOUR_STOPS[idx].windowTitle}>
                    <div style={{ padding: '64px 32px', textAlign: 'center' }}>
                      <div style={{ fontSize: '12px', color: 'var(--text-3)', marginBottom: '18px' }}>
                        {t.productTour.liveNote}
                      </div>
                      <a href={PRODUCT_TOUR_STOPS[idx].route} style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '12px 24px',
                        background: 'var(--accent)',
                        color: '#ffffff',
                        fontSize: '13px',
                        fontWeight: 700,
                        borderRadius: '8px',
                        textDecoration: 'none',
                        transition: 'opacity 0.15s'
                      }}
                        onMouseEnter={e => e.currentTarget.style.opacity = 0.9}
                        onMouseLeave={e => e.currentTarget.style.opacity = 1}
                      >
                        {t.productTour.liveCta}
                      </a>
                    </div>
                  </WindowChrome>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CALL TO ACTION (CTA) */}
      <section style={{ maxWidth: '1200px', margin: '0 auto', padding: '100px 24px 120px', textAlign: 'center' }}>
        <div style={{
          background: 'linear-gradient(135deg, #0b0d13 0%, #0f766e 100%)',
          borderRadius: '24px',
          padding: '80px 40px',
          color: '#ffffff',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ position: 'relative', zIndex: 1, maxWidth: '640px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '42px', fontWeight: 900, letterSpacing: '-1.5px', marginBottom: '18px' }}>
              {t.finalCta.title}
            </h2>
            <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.8)', lineHeight: 1.6, marginBottom: '36px' }}>
              {t.finalCta.subtitle}
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '48px', flexWrap: 'wrap' }}>
              <a href={href('/pricing')} style={{
                padding: '14px 32px',
                fontSize: '14px',
                fontWeight: 700,
                background: '#ffffff',
                color: '#0b0d13',
                    textDecoration: 'none',
                boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
                transition: 'opacity 0.15s'
              }}
                onMouseEnter={e => e.currentTarget.style.opacity = 0.9}
                onMouseLeave={e => e.currentTarget.style.opacity = 1}
              >
                {t.finalCta.ctaPrimary}
              </a>
              <a href={href('/pricing')} style={{
                padding: '14px 32px',
                fontSize: '14px',
                fontWeight: 600,
                background: 'transparent',
                color: '#ffffff',
                border: '1px solid rgba(255,255,255,0.3)',
                    textDecoration: 'none',
                transition: 'background 0.15s'
              }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {t.finalCta.ctaSecondary}
              </a>
            </div>

            <div style={{ maxWidth: '440px', margin: '0 auto' }}>
              <NewsletterForm dict={dict.newsletter} />
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid var(--border)', background: '#fafafa', padding: '60px 24px 80px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '40px' }}>
          <div>
            <img src="/logo-traqcker-new.png" alt="Traqcker" style={{ height: '16px', width: 'auto', marginBottom: '16px' }} />
            <p style={{ fontSize: '12px', color: 'var(--text-3)', maxWidth: '240px', lineHeight: 1.5 }}>
              {t.footer.tagline}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '64px', flexWrap: 'wrap' }}>
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
