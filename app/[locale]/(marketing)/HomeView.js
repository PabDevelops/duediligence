'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '../../components/AuthProvider';
import { WindowChrome, Shot } from '../../components/WindowChrome';
import { PrimaryButton } from '../../components/marketing/Buttons';
import Footer from '../../components/marketing/Footer';
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

const CONTAINER = { maxWidth: '1160px', margin: '0 auto', padding: '0 clamp(16px, 5vw, 24px)' };

export default function HomeView({ dict, locale }) {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const t = dict.home;
  const href = (path) => localizeHref(path, locale);

  useEffect(() => {
    if (isLoaded && isSignedIn) router.replace('/home');
  }, [isLoaded, isSignedIn, router]);

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
          </nav>

          <div className="desktop-only" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <a href={langToggle.otherLocaleHref} onClick={langToggle.onClick} style={{ textDecoration: 'none', color: 'var(--text-3)', fontSize: '13px', fontWeight: 700 }}>{langToggle.label}</a>
            <a href={href('/sign-in')} style={navLink}>{t.signIn}</a>
            {/* PrimaryButton renders a plain <a>, not <Link> — this crosses
                from the apex marketing domain to terminal.traqcker.com in
                production, which needs a real navigation so middleware.js's
                host redirect fires. */}
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
          maxHeight: menuOpen ? '320px' : '0px',
          overflow: 'hidden',
          transition: 'max-height 0.25s ease',
          borderTop: menuOpen ? '1px solid var(--border)' : 'none',
          background: '#ffffff',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', padding: '8px clamp(16px, 5vw, 24px) 20px' }}>
            <a href={href('/about')} onClick={closeMenu} style={mobileNavLink}>{t.nav.product}</a>
            <a href={href('/pricing')} onClick={closeMenu} style={mobileNavLink}>{t.nav.pricing}</a>
            <a href={href('/sign-in')} onClick={closeMenu} style={mobileNavLink}>{t.signIn}</a>
            <div style={{ height: '1px', background: 'var(--border)', margin: '8px 0 16px' }} />
            <PrimaryButton href="/home" onClick={closeMenu} style={{ width: '100%' }}>{t.cta}</PrimaryButton>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section style={{ ...CONTAINER, padding: 'clamp(40px, 8vw, 72px) clamp(16px, 5vw, 24px) clamp(32px, 5vw, 48px)', textAlign: 'center', position: 'relative' }}>
        <h1 style={{
          fontSize: 'clamp(28px, 5.6vw, 48px)',
          fontWeight: 900,
          letterSpacing: '-1.1px',
          lineHeight: 1.1,
          maxWidth: '760px',
          margin: '0 auto clamp(14px, 2.5vw, 20px)',
          color: 'var(--text)',
        }}>
          {t.hero.title}
        </h1>
        <p style={{
          fontSize: 'clamp(14px, 1.8vw, 17px)',
          color: 'var(--text-2)',
          lineHeight: 1.6,
          maxWidth: '580px',
          margin: '0 auto clamp(24px, 4vw, 32px)',
        }}>
          {t.hero.subtitle}
        </p>

        <div style={{ marginBottom: 'clamp(32px, 6vw, 48px)' }}>
          <PrimaryButton href="/home" style={{ height: '50px', padding: '0 32px', fontSize: '15px' }}>{t.cta}</PrimaryButton>
        </div>

        {/* HERO MOCKUP */}
        <div style={{ position: 'relative', maxWidth: '900px', margin: '0 auto' }}>
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
            <WindowChrome title="terminal.traqcker.com/home — Market Overview Dashboard" maxWidth="880px">
              <Shot src="/screenshots/stock.png" alt="Traqcker Terminal Stock Analysis Screen" />
            </WindowChrome>
          </div>
        </div>
      </section>

      <Footer dict={t.footer} locale={locale} />

    </div>
  );
}
