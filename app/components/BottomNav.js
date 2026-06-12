'use client';
import { usePathname } from 'next/navigation';
import { useUser, SignInButton, UserButton } from '@clerk/nextjs';
import { useState, useEffect, useRef } from 'react';

const ICONS = {
  home: (active) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--accent)' : 'var(--text-3)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1h3a1 1 0 001-1V10" />
    </svg>
  ),
  search: (active) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--accent)' : 'var(--text-3)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  ),
  watchlist: (active) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={active ? 'var(--accent)' : 'none'} stroke={active ? 'var(--accent)' : 'var(--text-3)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
    </svg>
  ),
  profile: (active) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--accent)' : 'var(--text-3)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-1a7 7 0 0114 0v1" />
    </svg>
  ),
};

function NavLink({ href, icon, label, active }) {
  return (
    <a href={href} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
      textDecoration: 'none', flex: 1, padding: '6px 0',
    }}>
      {ICONS[icon](active)}
      <span style={{
        fontFamily: 'JetBrains Mono, monospace', fontSize: '10px',
        color: active ? 'var(--accent)' : 'var(--text-3)',
        fontWeight: active ? 600 : 400,
      }}>
        {label}
      </span>
    </a>
  );
}

export default function BottomNav() {
  const path = usePathname();
  const { isSignedIn } = useUser();
  const [cookieOffset, setCookieOffset] = useState(0);

  useEffect(() => {
    const measure = () => {
      const accepted = localStorage.getItem('cookie_consent');
      if (accepted) { setCookieOffset(0); return; }
      const banners = Array.from(document.querySelectorAll('div')).filter(d =>
        d.textContent?.includes('We use cookies') && d.children.length > 0 && d.children.length < 5
      );
      if (banners.length) {
        setCookieOffset(banners[0].getBoundingClientRect().height);
      }
    };
    measure();
    const interval = setInterval(measure, 300);
    window.addEventListener('resize', measure);
    return () => { clearInterval(interval); window.removeEventListener('resize', measure); };
  }, []);

  const isHome = path === '/';
  const isSearch = path === '/screener' || path === '/compare';
  const isWatchlist = path.startsWith('/watchlist');
  const isProfile = path.startsWith('/sign-in') || path.startsWith('/sign-up');

  const userButtonRef = useRef(null);

  const openUserProfile = () => {
    // UserButton renders its own trigger button; forward our click to it
    // so we can show our own icon/label while still using Clerk's profile UI.
    const btn = userButtonRef.current?.querySelector('button');
    if (btn) btn.click();
  };

  return (
    <nav className="bottom-nav" style={{
      display: 'none',
      position: 'fixed', bottom: `${cookieOffset}px`, left: 0, right: 0,
      background: 'var(--bg-1)', borderTop: '1px solid var(--border)',
      paddingBottom: cookieOffset > 0 ? 0 : 'env(safe-area-inset-bottom, 0px)',
      zIndex: 99,
      transition: 'bottom 0.2s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '6px 8px' }}>
        <NavLink href="/" icon="home" label="Home" active={isHome} />
        <NavLink href="/screener" icon="search" label="Search" active={isSearch} />
        <NavLink href="/watchlist" icon="watchlist" label="Watchlist" active={isWatchlist} />
        <NavLink href="/about" icon="profile" label="About" active={path.startsWith('/about')} />
      </div>
    </nav>
  );
}
