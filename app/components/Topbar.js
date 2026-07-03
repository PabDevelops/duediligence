'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useUser } from './AuthProvider';
import { createClient } from '../../lib/supabase/client';

function UserMenu() {
  const { user } = useUser();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setOpen(false);
    router.push('/');
    router.refresh();
  };

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)}
        style={{ width: '30px', height: '30px', borderRadius: '50%', border: 'none', background: 'linear-gradient(135deg, #a78bfa, #60a5fa)', color: '#000', fontWeight: 800, fontSize: '13px', cursor: 'pointer' }}>
        {user?.email?.[0]?.toUpperCase() || '?'}
      </button>
      {open && (
        <div className="glass" style={{ position: 'absolute', top: '38px', right: 0, minWidth: '160px', padding: '6px', zIndex: 100 }}>
          <a href="/profile" onClick={() => setOpen(false)}
            style={{ display: 'block', padding: '8px 12px', borderRadius: '8px', color: 'var(--text)', fontSize: '13px', textDecoration: 'none' }}>
            Profile
          </a>
          <button onClick={signOut}
            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', borderRadius: '8px', color: 'var(--red)', fontSize: '13px', background: 'none', border: 'none', cursor: 'pointer' }}>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

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
      <a href={href} className={`topbar-nav-link${active ? ' active' : ''}`}>{label}</a>
    );
  };

  const onSelect = (ticker) => { router.push(`/stock/${ticker}`); setSearchQ(''); setShowSuggestions(false); };

  const SuggestionDropdown = () => suggestions.length > 0 && showSuggestions ? (
    <div className="suggestion-dropdown">
      {suggestions.map(s => (
        <div key={s.ticker} className="suggestion-item" onMouseDown={() => onSelect(s.ticker)}>
          <span className="suggestion-ticker">{s.ticker}</span>
          <span className="suggestion-name">{s.name}</span>
          <span className="suggestion-exchange">{s.exchange}</span>
        </div>
      ))}
    </div>
  ) : null;

  const searchHandlers = {
    value: searchQ,
    onChange: e => { setSearchQ(e.target.value); setShowSuggestions(true); },
    onKeyDown: e => {
      if (e.key === 'Enter' && searchQ) { router.push(`/stock/${searchQ.toUpperCase()}`); setSearchQ(''); setShowSuggestions(false); }
      if (e.key === 'Escape') setShowSuggestions(false);
    },
    onBlur: () => setTimeout(() => setShowSuggestions(false), 200),
    onFocus: () => searchQ && setShowSuggestions(true),
  };

  return (
    <>
      <div className="topbar">
        {/* Logo */}
        <a href="/" className="topbar-logo">
          Traq<span style={{ color: 'var(--accent)' }}>●</span>cker
        </a>

        {/* Mobile search */}
        <div className="mobile-search" style={{ flex: 1, minWidth: 0, position: 'relative', display: 'none' }}>
          <input {...searchHandlers} className="topbar-search topbar-search-mobile" placeholder="Search company..." />
          <SuggestionDropdown />
        </div>

        {/* Desktop nav */}
        <div className="desktop-nav" style={{ display: 'flex', alignItems: 'center', gap: '20px', flex: 1, justifyContent: 'flex-end' }}>
          <div style={{ position: 'relative' }}>
            <input {...searchHandlers} className="topbar-search" placeholder="Search ticker..." />
            <SuggestionDropdown />
          </div>

          <button className="topbar-discover" onClick={async () => {
            const res = await fetch('/api/random');
            if (res.status === 429) {
              const d = await res.json();
              alert(d.isAnon ? 'Sign in to get 3 daily discovers. Pro gets unlimited.' : 'Daily limit reached. Upgrade to Pro for unlimited discovers.');
              return;
            }
            const { ticker } = await res.json();
            window.location.href = `/stock/${ticker}`;
          }}>
            ⚡ Discover
          </button>

          {navItem('/screener', 'Screener')}
          {navItem('/compare', 'Compare')}
          {navItem('/pricing', 'Pricing')}
          {navItem('/watchlist', 'Watchlist')}
          {navItem('/about', 'About')}
          {navItem('/blog', 'Blog')}
          {isSignedIn && navItem('/profile', 'Profile')}

          {isSignedIn ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ProBadge />
              <UserMenu />
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ color: 'var(--text-3)', fontSize: '12px', borderRight: '1px solid var(--border)', paddingRight: '12px' }}>
                🔒 Sign in for full data
              </span>
              <a href="/sign-in" className="btn-primary" style={{ padding: '6px 16px', fontSize: '13px' }}>Sign in</a>
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
          {[['/', 'Home'], ['/screener', 'Screener'], ['/compare', 'Compare'], ['/pricing', 'Pricing'], ['/watchlist', 'Watchlist'], ['/about', 'About'], ['/blog', 'Blog']].map(([href, label]) => (
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
