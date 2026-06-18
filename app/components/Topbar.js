'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { SignInButton, UserButton, useUser } from '@clerk/nextjs';

function ProBadge() {
  const [isPro, setIsPro] = useState(false);
  useEffect(() => {
    fetch('/api/subscription').then(r => r.json()).then(d => setIsPro(d.isPro)).catch(() => {});
  }, []);
  if (!isPro) return null;
  return (
    <span style={{ background: 'linear-gradient(135deg, #a78bfa, #60a5fa)', color: '#000', fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', fontFamily: 'Nunito, sans-serif' }}>PRO</span>
  );
}

export default function Topbar() {
  const path = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const { isSignedIn } = useUser();
  const [searchQ, setSearchQ] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (searchQ.length < 1) { setSuggestions([]); return; }
    const timeout = setTimeout(() => {
      fetch(`/api/search?q=${searchQ}`).then(r => r.json()).then(d => setSuggestions(d.results || [])).catch(() => {});
    }, 200);
    return () => clearTimeout(timeout);
  }, [searchQ]);

  const navItem = (href, label) => {
    const active = path === href || path.startsWith(href + '/');
    return (
      <a href={href}
        style={{ color: active ? 'var(--accent)' : 'var(--text-3)', textDecoration: 'none', fontSize: '13px', fontWeight: active ? 700 : 500, fontFamily: 'Nunito, sans-serif', transition: 'color 0.15s' }}
        onMouseEnter={e => e.target.style.color = 'var(--accent)'}
        onMouseLeave={e => e.target.style.color = active ? 'var(--accent)' : 'var(--text-3)'}>
        {label}
      </a>
    );
  };

  const suggestionDropdown = (suggestions, onSelect) => suggestions.length > 0 && showSuggestions ? (
    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: '12px', maxHeight: '280px', overflowY: 'auto', zIndex: 999, marginTop: '4px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
      {suggestions.map(s => (
        <div key={s.ticker}
          onMouseDown={() => onSelect(s.ticker)}
          style={{ padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border)', fontFamily: 'Nunito, sans-serif' }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-2)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          <span style={{ color: 'var(--accent)', fontSize: '13px', fontWeight: 700, minWidth: '52px', flexShrink: 0 }}>{s.ticker}</span>
          <span style={{ color: 'var(--text-2)', fontSize: '13px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
          <span style={{ color: 'var(--text-3)', fontSize: '11px', flexShrink: 0 }}>{s.exchange}</span>
        </div>
      ))}
    </div>
  ) : null;

  return (
    <>
      <div style={{ borderBottom: '1px solid var(--border)', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'rgba(8,9,15,0.85)', backdropFilter: 'blur(20px)', zIndex: 10, gap: '12px', fontFamily: 'Nunito, sans-serif' }}>
        {/* Logo */}
        <a href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: '20px', letterSpacing: '-0.5px', color: 'var(--text)' }}>
            Traq<span style={{ color: 'var(--accent)' }}>●</span>cker
          </span>
        </a>

        {/* Mobile search bar */}
        <div className="mobile-search" style={{ flex: 1, minWidth: 0, position: 'relative', display: 'none' }}>
          <input
            value={searchQ}
            onChange={e => { setSearchQ(e.target.value); setShowSuggestions(true); }}
            onKeyDown={e => { if (e.key === 'Enter' && searchQ) { router.push(`/stock/${searchQ.toUpperCase()}`); setSearchQ(''); setShowSuggestions(false); } if (e.key === 'Escape') setShowSuggestions(false); }}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            onFocus={() => searchQ && setShowSuggestions(true)}
            style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', borderRadius: '10px', color: 'var(--text)', fontFamily: 'Nunito, sans-serif', fontSize: '14px', padding: '7px 12px', outline: 'none' }}
            placeholder="Search company..."
          />
          {suggestionDropdown(suggestions, (ticker) => { router.push(`/stock/${ticker}`); setSearchQ(''); setShowSuggestions(false); })}
        </div>

        {/* Desktop nav */}
        <div className="desktop-nav" style={{ display: 'flex', alignItems: 'center', gap: '20px', flex: 1, justifyContent: 'flex-end' }}>
          {/* Search input */}
          <div style={{ position: 'relative' }}>
            <input
              value={searchQ}
              onChange={e => { setSearchQ(e.target.value); setShowSuggestions(true); }}
              onKeyDown={e => { if (e.key === 'Enter' && searchQ) { router.push(`/stock/${searchQ.toUpperCase()}`); setSearchQ(''); setShowSuggestions(false); } if (e.key === 'Escape') setShowSuggestions(false); }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              onFocus={() => searchQ && setShowSuggestions(true)}
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', borderRadius: '10px', color: 'var(--text)', fontFamily: 'Nunito, sans-serif', fontSize: '13px', padding: '6px 14px', width: '180px', outline: 'none', transition: 'border-color 0.2s' }}
              placeholder="Search ticker..."
              onFocusCapture={e => e.target.style.borderColor = 'var(--accent)'}
              onBlurCapture={e => e.target.style.borderColor = 'var(--border)'}
            />
            {suggestionDropdown(suggestions, (ticker) => { router.push(`/stock/${ticker}`); setSearchQ(''); setShowSuggestions(false); })}
          </div>

          <button onClick={async () => {
            const res = await fetch('/api/random');
            if (res.status === 429) {
              const d = await res.json();
              alert(d.isAnon ? 'Sign in to get 3 daily discovers. Pro gets unlimited.' : 'Daily limit reached. Upgrade to Pro for unlimited discovers.');
              return;
            }
            const { ticker } = await res.json();
            window.location.href = `/stock/${ticker}`;
          }}
            style={{ background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: '10px', color: 'var(--accent)', fontFamily: 'Nunito, sans-serif', fontSize: '13px', fontWeight: 600, padding: '6px 14px', cursor: 'pointer', transition: 'background 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(167,139,250,0.2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(167,139,250,0.1)'}>
            ⚡ Discover
          </button>

          {navItem('/screener', 'Screener')}
          {navItem('/compare', 'Compare')}
          {navItem('/pricing', 'Pricing')}
          {navItem('/watchlist', 'Watchlist')}
          {navItem('/about', 'About')}
          {isSignedIn && navItem('/profile', 'Profile')}

          {isSignedIn ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ProBadge />
              <UserButton afterSignOutUrl="/" />
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ color: 'var(--text-3)', fontSize: '12px', borderRight: '1px solid var(--border)', paddingRight: '12px' }}>🔒 Sign in for full data</span>
              <SignInButton mode="modal">
                <button className="btn-primary" style={{ padding: '6px 16px', fontSize: '13px' }}>Sign in</button>
              </SignInButton>
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

      <style>{`
        @media (max-width: 768px) { .mobile-search { display: block !important; } .desktop-nav { display: none !important; } }
        @media (min-width: 769px) { .mobile-search { display: none !important; } .desktop-nav { display: flex !important; } }
      `}</style>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div className="mobile-menu" style={{ display: 'flex', flexDirection: 'column', background: 'rgba(8,9,15,0.95)', backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--border)', position: 'sticky', top: '49px', zIndex: 9 }}>
          {['/', '/screener', '/compare', '/pricing', '/watchlist', '/about'].map((href, i) => {
            const labels = ['Home', 'Screener', 'Compare', 'Pricing', 'Watchlist', 'About'];
            const active = path === href;
            return (
              <a key={href} href={href} onClick={() => setMenuOpen(false)}
                style={{ padding: '14px 20px', color: active ? 'var(--accent)' : 'var(--text-2)', textDecoration: 'none', fontSize: '15px', fontWeight: active ? 700 : 500, borderBottom: '1px solid var(--border)', fontFamily: 'Nunito, sans-serif' }}>
                {labels[i]}
              </a>
            );
          })}
          {!isSignedIn && (
            <div style={{ padding: '12px 16px' }}>
              <SignInButton mode="modal">
                <button className="btn-primary" style={{ width: '100%', padding: '10px' }}>Sign in</button>
              </SignInButton>
            </div>
          )}
        </div>
      )}
    </>
  );
}
