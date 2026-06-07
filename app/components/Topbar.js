'use client';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { SignInButton, UserButton, useUser } from '@clerk/nextjs';
import { usePathname, useRouter } from 'next/navigation';

function ProBadge() {
  const [isPro, setIsPro] = useState(false);
  useEffect(() => {
    fetch('/api/subscription')
      .then(r => r.json())
      .then(d => setIsPro(d.isPro))
      .catch(() => {});
  }, []);

  if (!isPro) return null;
  return (
    <span style={{ background: 'var(--accent)', color: '#000', fontSize: '9px', fontWeight: 700, padding: '2px 6px', letterSpacing: '1px' }}>PRO</span>
  );
}

export default function Topbar() {
  const path = usePathname();

  const navItem = (href, label) => {
    const active = path === href || path.startsWith(href + '/');
    return (
      <a href={href}
        style={{ color: active ? 'var(--accent)' : 'var(--text-3)', textDecoration: 'none', letterSpacing: '1px', fontSize: '11px' }}
        onMouseEnter={e => e.target.style.color = 'var(--accent)'}
        onMouseLeave={e => e.target.style.color = active ? 'var(--accent)' : 'var(--text-3)'}>
        {label}
      </a>
    );
  };

  const [menuOpen, setMenuOpen] = useState(false);
  const { isSignedIn } = useUser();
  const [searchQ, setSearchQ] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (searchQ.length < 1) { setSuggestions([]); return; }
    const timeout = setTimeout(() => {
      fetch(`/api/search?q=${searchQ}`)
        .then(r => r.json())
        .then(d => setSuggestions(d.results || []))
        .catch(() => {});
    }, 200);
    return () => clearTimeout(timeout);
  }, [searchQ]);

  return (
    <>
      <div style={{ borderBottom: '1px solid var(--border)', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 10 }}>
        <a href="/" style={{ textDecoration: 'none' }}>
          <img src="/logo.png" alt="Traqcker" style={{ height: '20px', objectFit: 'contain' }} />
        </a>

        {/* Desktop nav */}
        <div className="desktop-nav" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          {navItem('/', 'HOME')}
          {navItem('/screener', 'SCREENER')}
          {navItem('/compare', 'COMPARE')}
          {navItem('/pricing', 'PRICING')}
          {navItem('/watchlist', 'WATCHLIST')}
          {navItem('/about', 'ABOUT')}
          {isSignedIn ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ProBadge />
              <UserButton afterSignOutUrl="/" />
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ color: 'var(--text-3)', fontSize: '10px', letterSpacing: '1px', borderRight: '1px solid var(--border)', paddingRight: '12px' }}>🔒 SIGN IN TO SEE FULL DATA</span>
              <SignInButton mode="modal">
                <button style={{ background: 'var(--accent)', color: '#000', border: 'none', padding: '4px 12px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', fontWeight: 700, cursor: 'pointer', letterSpacing: '1px' }}>
                  SIGN IN
                </button>
              </SignInButton>
            </div>
          )}
        </div>

        {/* Mobile menu button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="mobile-menu-btn"
            onClick={() => setMenuOpen(!menuOpen)}
            style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text)', padding: '4px 8px', cursor: 'pointer', fontFamily: 'IBM Plex Mono, monospace', fontSize: '16px' }}>
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div className="mobile-menu" style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg-1)', borderBottom: '1px solid var(--border)', position: 'sticky', top: '41px', zIndex: 9 }}>
          {['/', '/screener', '/compare', '/pricing', '/watchlist', '/about'].map((href, i) => {
            const labels = ['HOME', 'SCREENER', 'COMPARE', 'PRICING', 'WATCHLIST', 'ABOUT'];
            const active = path === href || path.startsWith(href + '/');
            return (
              <a key={href} href={href} onClick={() => setMenuOpen(false)}
                style={{ padding: '12px 16px', color: active ? 'var(--accent)' : 'var(--text-3)', textDecoration: 'none', fontSize: '12px', letterSpacing: '1px', borderBottom: '1px solid var(--border)' }}>
                {labels[i]}
              </a>
            );
          })}
          {!isSignedIn ? (
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
              <SignInButton mode="modal">
                <button style={{ width: '100%', background: 'var(--accent)', color: '#000', border: 'none', padding: '8px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', fontWeight: 700, cursor: 'pointer', letterSpacing: '1px' }}>
                  SIGN IN
                </button>
              </SignInButton>
            </div>
          ) : null}
        </div>
      )}
    </>
  );
}