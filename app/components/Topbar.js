'use client';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useUser } from './AuthProvider';
import UserMenu from './workspace/UserMenu';
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
  const t = getDictionary().topbar;

  const navItem = (target, label) => {
    const active = path === target || path.startsWith(target + '/');
    return (
      <a href={target} className={`topbar-nav-link${active ? ' active' : ''}`}>{label}</a>
    );
  };

  return (
    <>
      <div className="topbar">
        {/* Logo */}
        <a href="/" className="topbar-logo" style={{ display: 'flex', alignItems: 'center' }}>
          <img src="/logo-traqcker-new.png" alt="Traqcker" style={{ height: '18px', width: 'auto' }} />
        </a>

        {/* Desktop nav — informational only; the terminal itself is behind sign-up + subscription */}
        <div className="desktop-nav" style={{ display: 'flex', alignItems: 'center', gap: '20px', flex: 1, justifyContent: 'flex-end' }}>
          {navItem('/about', t.about)}
          {navItem('/pricing', t.pricing)}
          {navItem('/faq', t.faq)}

          {isSignedIn ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ProBadge />
              <UserMenu />
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <a href="/sign-in" style={{ color: 'var(--text-3)', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}>{t.signIn}</a>
              <a href="/sign-up" className="btn-primary" style={{ padding: '6px 16px', fontSize: '13px', background: 'var(--accent)', borderRadius: 0 }}>{t.startFreeTrial}</a>
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
          {[['/', t.home], ['/about', t.about], ['/pricing', t.pricing], ['/faq', t.faq]].map(([target, label]) => (
            <a key={target} href={target} onClick={() => setMenuOpen(false)}
              className={`topbar-mobile-link${path === target ? ' active' : ''}`}>
              {label}
            </a>
          ))}
          {!isSignedIn && (
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <a href="/sign-up" className="btn-primary" style={{ display: 'block', width: '100%', padding: '10px', textAlign: 'center', boxSizing: 'border-box', background: 'var(--accent)', borderRadius: 0 }}>{t.startFreeTrial}</a>
              <a href="/sign-in" style={{ display: 'block', width: '100%', padding: '10px', textAlign: 'center', boxSizing: 'border-box', border: '1px solid var(--border)', color: 'var(--text)', textDecoration: 'none', fontSize: '13px', fontWeight: 600 }}>{t.signIn}</a>
            </div>
          )}
        </div>
      )}
    </>
  );
}
