'use client';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useUser } from './AuthProvider';
import UserMenu from './workspace/UserMenu';
import { stripLocale, localizeHref } from '../../lib/i18n/locale';
import { useLocale } from '../../lib/i18n/useLocale';
import { getDictionary } from '../../lib/i18n/getDictionary';

function ProBadge() {
  const [isPro, setIsPro] = useState(false);
  useEffect(() => {
    fetch('/api/subscription').then(r => r.json()).then(d => setIsPro(d.isPro)).catch(() => {});
  }, []);
  if (!isPro) return null;
  return <span className="pro-badge">PRO</span>;
}

export default function Topbar() {
  const path = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const { isSignedIn } = useUser();
  const locale = useLocale();
  const t = getDictionary(locale).topbar;
  const bare = stripLocale(path);
  const href = (p) => localizeHref(p, locale);

  // Switching away from Spanish must explicitly clear the cookie — the
  // middleware treats NEXT_LOCALE as authoritative, so without this a bare
  // link back would just get redirected straight back to /es/...
  const otherLocaleHref = locale === 'es' ? bare : `/es${bare === '/' ? '' : bare}`;
  const switchLocale = () => {
    if (locale === 'es') document.cookie = 'NEXT_LOCALE=en; path=/; max-age=31536000';
  };

  const navItem = (targetPath, label) => {
    const target = href(targetPath);
    const active = path === target || path.startsWith(target + '/');
    return (
      <a href={target} className={`topbar-nav-link${active ? ' active' : ''}`}>{label}</a>
    );
  };

  return (
    <>
      <div className="topbar">
        {/* Logo */}
        <a href={href('/')} className="topbar-logo" style={{ display: 'flex', alignItems: 'center' }}>
          <img src="/logo-traqcker-new.png" alt="Traqcker" style={{ height: '18px', width: 'auto' }} />
        </a>

        {/* Desktop nav — informational only; the terminal itself is behind sign-up + subscription */}
        <div className="desktop-nav" style={{ display: 'flex', alignItems: 'center', gap: '20px', flex: 1, justifyContent: 'flex-end' }}>
          {navItem('/about', t.about)}
          {navItem('/pricing', t.pricing)}
          <a href={otherLocaleHref} onClick={switchLocale} style={{ color: 'var(--text-3)', fontSize: '13px', fontWeight: 700, textDecoration: 'none' }}>{t.langToggle}</a>

          {isSignedIn ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ProBadge />
              <UserMenu />
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <a href={href('/sign-in')} style={{ color: 'var(--text-3)', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}>{t.signIn}</a>
              <a href={href('/sign-up')} className="btn-primary" style={{ padding: '6px 16px', fontSize: '13px', background: 'var(--accent)', borderRadius: 0 }}>{t.startFreeTrial}</a>
            </div>
          )}
        </div>

        {/* Mobile menu button */}
        <button className="mobile-menu-btn"
          onClick={() => setMenuOpen(!menuOpen)}
          style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', padding: '5px 10px', cursor: 'pointer', fontSize: '16px', flexShrink: 0 }}>
          {menuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div className="topbar-mobile-menu mobile-menu">
          {[['/', t.home], ['/about', t.about], ['/pricing', t.pricing]].map(([p, label]) => {
            const target = href(p);
            return (
              <a key={p} href={target} onClick={() => setMenuOpen(false)}
                className={`topbar-mobile-link${path === target ? ' active' : ''}`}>
                {label}
              </a>
            );
          })}
          <a href={otherLocaleHref} onClick={() => { switchLocale(); setMenuOpen(false); }} className="topbar-mobile-link">
            {t.langToggle}
          </a>
          {!isSignedIn && (
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <a href={href('/sign-up')} className="btn-primary" style={{ display: 'block', width: '100%', padding: '10px', textAlign: 'center', boxSizing: 'border-box', background: 'var(--accent)', borderRadius: 0 }}>{t.startFreeTrial}</a>
              <a href={href('/sign-in')} style={{ display: 'block', width: '100%', padding: '10px', textAlign: 'center', boxSizing: 'border-box', border: '1px solid var(--border)', color: 'var(--text)', textDecoration: 'none', fontSize: '13px', fontWeight: 600 }}>{t.signIn}</a>
            </div>
          )}
        </div>
      )}
    </>
  );
}
