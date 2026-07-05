'use client';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useUser } from './AuthProvider';
import UserMenu from './workspace/UserMenu';

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

  const navItem = (href, label) => {
    const active = path === href || path.startsWith(href + '/');
    return (
      <a href={href} className={`topbar-nav-link${active ? ' active' : ''}`}>{label}</a>
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
          {navItem('/about', 'About')}
          {navItem('/pricing', 'Pricing')}

          {isSignedIn ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ProBadge />
              <UserMenu />
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <a href="/sign-in" style={{ color: 'var(--text-3)', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}>Sign in</a>
              <a href="/pricing" className="btn-primary" style={{ padding: '6px 16px', fontSize: '13px' }}>Start free trial</a>
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
          {[['/', 'Home'], ['/about', 'About'], ['/pricing', 'Pricing']].map(([href, label]) => (
            <a key={href} href={href} onClick={() => setMenuOpen(false)}
              className={`topbar-mobile-link${path === href ? ' active' : ''}`}>
              {label}
            </a>
          ))}
          {!isSignedIn && (
            <div style={{ padding: '12px 16px' }}>
              <a href="/sign-in" className="btn-primary" style={{ display: 'block', width: '100%', padding: '10px', textAlign: 'center', boxSizing: 'border-box' }}>Sign in</a>
            </div>
          )}
        </div>
      )}
    </>
  );
}
