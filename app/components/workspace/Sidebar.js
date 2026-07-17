'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import UserMenu from './UserMenu';

const NAV_ITEMS = [
  { id: 'home', href: '/home', label: 'Home', icon: (active) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--ws-accent)' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  )},
  { id: 'calendar', href: '/calendar', label: 'Calendar', icon: (active) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--ws-accent)' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
      <line x1="16" x2="16" y1="2" y2="6"/>
      <line x1="8" x2="8" y1="2" y2="6"/>
      <line x1="3" x2="21" y1="10" y2="10"/>
    </svg>
  )},
  { id: 'screener', href: '/screener', label: 'Screener', icon: (active) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--ws-accent)' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
    </svg>
  )},
  { id: 'etfs', href: '/etfs', label: 'ETFs', icon: (active) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--ws-accent)' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
    </svg>
  )},
  { id: 'radar', href: '/radar', label: 'Radar', icon: (active) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--ws-accent)' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
      <path d="M12 2v20" />
      <path d="M2 12h20" />
      <path d="m19.07 4.93-14.14 14.14" />
    </svg>
  )},
  { id: 'portfolio', href: '/portfolio', label: 'Portfolio', icon: (active) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--ws-accent)' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>
    </svg>
  )},
  { id: 'watchlist', href: '/watchlist', label: 'Watchlist', icon: (active) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={active ? 'var(--ws-accent)' : 'none'} stroke={active ? 'var(--ws-accent)' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )},
];

const DEFAULT_NAV_ORDER = NAV_ITEMS.map(item => item.id);
const NAV_ORDER_KEY = 'traqcker_sidebar_order';

export default function Sidebar({ theme, onToggleTheme, collapsed = false, onToggleCollapse }) {
  const path = usePathname();
  const router = useRouter();
  const [plan, setPlan] = useState(null);
  const [navOrder, setNavOrder] = useState(DEFAULT_NAV_ORDER);
  const [draggedId, setDraggedId] = useState(null);

  useEffect(() => {
    fetch('/api/subscription').then(r => r.json()).then(setPlan).catch(() => {});
  }, []);

  // Load saved nav order
  useEffect(() => {
    const saved = localStorage.getItem(NAV_ORDER_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const validSaved = parsed.filter(id => DEFAULT_NAV_ORDER.includes(id));
        const missing = DEFAULT_NAV_ORDER.filter(id => !validSaved.includes(id));
        setNavOrder([...validSaved, ...missing]);
      }
    } catch (e) {}
  }, []);

  // Keyboard shortcut: / to go to search page
  useEffect(() => {
    const handler = (e) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        e.preventDefault();
        router.push('/search');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [router]);

  const runDiscover = async () => {
    const res = await fetch('/api/random');
    if (res.status === 429) {
      const d = await res.json();
      alert(d.isAnon ? 'Sign in to get 3 daily discovers. Pro gets unlimited.' : 'Daily limit reached. Upgrade to Pro for unlimited discovers.');
      return;
    }
    const { ticker } = await res.json();
    router.push(`/stock/${ticker}`);
  };

  const orderedNav = navOrder.map(id => NAV_ITEMS.find(item => item.id === id)).filter(Boolean);

  const handleDragStart = (e, id) => { setDraggedId(id); e.dataTransfer.effectAllowed = 'move'; };
  const handleDragEnd = () => { localStorage.setItem(NAV_ORDER_KEY, JSON.stringify(navOrder)); setDraggedId(null); };
  const handleDragOver = (e, targetId) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;
    const current = [...navOrder];
    const draggedIdx = current.indexOf(draggedId);
    const targetIdx = current.indexOf(targetId);
    if (draggedIdx === -1 || targetIdx === -1) return;
    current.splice(draggedIdx, 1);
    current.splice(targetIdx, 0, draggedId);
    setNavOrder(current);
  };

  return (
    <aside style={{
      width: 'var(--ws-sidebar-width)', flexShrink: 0, borderRight: '1px solid var(--ws-border)',
      background: 'var(--ws-bg-1)', display: 'flex', flexDirection: 'column',
      position: 'sticky', top: 0, height: '100vh', overflow: 'hidden',
      transition: 'width 0.2s ease',
    }}>

      {/* Logo */}
      <div style={{ padding: collapsed ? '16px 8px 0' : '16px 16px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Link href="/home" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', padding: '4px 8px', marginBottom: '14px' }}>
          {collapsed ? (
            <img
              src={theme === 'dark' ? '/logo-icon-new-w.png' : '/logo-icon-new.png'}
              alt="Traqcker"
              style={{ height: '22px', width: 'auto' }}
            />
          ) : (
            <img
              src={theme === 'dark' ? '/logo-traqcker-new-w.png' : '/logo-traqcker-new.png'}
              alt="Traqcker"
              style={{ height: '16px', width: 'auto' }}
            />
          )}
        </Link>

        {/* Random button */}
        <button
          onClick={runDiscover}
          title="Random Stock Discover"
          style={{
            width: collapsed ? '34px' : '100%',
            height: collapsed ? '34px' : '26px',
            fontSize: '10px',
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 700,
            letterSpacing: collapsed ? '0' : '1.5px',
            color: 'var(--ws-text-3)',
            background: 'transparent',
            border: '1px solid var(--ws-border)',
            borderRadius: '6px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'var(--ws-accent)';
            e.currentTarget.style.color = 'var(--ws-accent)';
            e.currentTarget.style.background = 'var(--ws-accent-dim)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'var(--ws-border)';
            e.currentTarget.style.color = 'var(--ws-text-3)';
            e.currentTarget.style.background = 'transparent';
          }}
        >
          {collapsed ? '?' : 'RANDOM'}
        </button>

      </div>

      {/* Nav items */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: collapsed ? '0 8px' : '0 16px', flex: 1, overflowY: 'auto' }}>
        {/* Search — fixed entry, navigates to the dedicated search page */}
        {(() => {
          const searchActive = path === '/search';
          return (
            <Link href="/search"
              title={collapsed ? "Search" : undefined}
              style={{
                fontSize: '13px',
                padding: collapsed ? '8px' : '8px 12px',
                borderRadius: 'var(--ws-radius)',
                textDecoration: 'none',
                color: searchActive ? 'var(--ws-text)' : 'var(--ws-text-2)',
                background: searchActive ? 'var(--ws-bg-2)' : 'transparent',
                fontWeight: searchActive ? 600 : 400,
                display: 'flex',
                alignItems: 'center',
                justifyContent: collapsed ? 'center' : 'flex-start',
                gap: collapsed ? '0' : '10px',
                width: '100%',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => { if (!searchActive) { e.currentTarget.style.background = 'var(--ws-bg-2)'; e.currentTarget.style.color = 'var(--ws-text)'; } }}
              onMouseLeave={(e) => { if (!searchActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ws-text-2)'; } }}
            >
              <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0, opacity: searchActive ? 1 : 0.75 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={searchActive ? 'var(--ws-accent)' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              </span>
              {!collapsed && <span style={{ flex: 1, minWidth: 0 }}>Search</span>}
              {!collapsed && (
                <kbd style={{
                  fontSize: '9px', color: 'var(--ws-text-3)', background: 'var(--ws-bg-2)',
                  border: '1px solid var(--ws-border)', borderRadius: '3px', padding: '1px 5px',
                  fontFamily: "'JetBrains Mono', monospace", flexShrink: 0,
                }}>/</kbd>
              )}
            </Link>
          );
        })()}

        <div style={{ height: '1px', background: 'var(--ws-border)', margin: '4px 0' }} />

        {orderedNav.map(({ id, href, label, icon }) => {
          const active = path === href || path.startsWith(href + '/');
          return (
            <div key={id}
              draggable={!collapsed}
              onDragStart={(e) => handleDragStart(e, id)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleDragOver(e, id)}
              style={{ opacity: draggedId === id ? 0.4 : 1, transition: 'opacity 0.15s ease' }}
            >
              <Link href={href}
                title={collapsed ? label : undefined}
                style={{
                  fontSize: '13px',
                  padding: collapsed ? '8px' : '8px 12px',
                  borderRadius: 'var(--ws-radius)',
                  textDecoration: 'none',
                  color: active ? 'var(--ws-text)' : 'var(--ws-text-2)',
                  background: active ? 'var(--ws-bg-2)' : 'transparent',
                  fontWeight: active ? 600 : 400,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  gap: collapsed ? '0' : '10px',
                  cursor: collapsed ? 'pointer' : 'grab',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = 'var(--ws-bg-2)'; e.currentTarget.style.color = 'var(--ws-text)'; } }}
                onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ws-text-2)'; } }}
              >
                <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0, opacity: active ? 1 : 0.75 }}>{icon(active)}</span>
                {!collapsed && <span style={{ flex: 1, minWidth: 0 }}>{label}</span>}
                {!collapsed && <span style={{ color: 'var(--ws-text-3)', fontSize: '12px', flexShrink: 0 }}>⋮⋮</span>}
              </Link>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: collapsed ? '12px 8px' : '16px', borderTop: '1px solid var(--ws-border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>

        {/* Legal links */}
        {!collapsed && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px' }}>
            <Link href="/terms" style={{ fontSize: '10px', color: 'var(--ws-text-3)', textDecoration: 'none' }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--ws-text-2)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--ws-text-3)'}>Terms</Link>
            <Link href="/privacy" style={{ fontSize: '10px', color: 'var(--ws-text-3)', textDecoration: 'none' }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--ws-text-2)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--ws-text-3)'}>Privacy</Link>
            <a href="mailto:support@traqcker.com" style={{ fontSize: '10px', color: 'var(--ws-text-3)', textDecoration: 'none' }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--ws-text-2)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--ws-text-3)'}>Support</a>
          </div>
        )}

        {/* Settings */}
        <Link href="/profile"
          title={collapsed ? "Profile & Settings" : undefined}
          style={{
            padding: collapsed ? '8px' : '8px 12px', borderRadius: 'var(--ws-radius)', textDecoration: 'none',
            fontSize: '13px', color: path === '/profile' ? 'var(--ws-text)' : 'var(--ws-text-2)',
            background: path === '/profile' ? 'var(--ws-bg-2)' : 'transparent',
            fontWeight: path === '/profile' ? 600 : 400,
            display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: collapsed ? '0' : '10px', cursor: 'pointer', transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => { if (path !== '/profile') { e.currentTarget.style.background = 'var(--ws-bg-2)'; e.currentTarget.style.color = 'var(--ws-text)'; } }}
          onMouseLeave={(e) => { if (path !== '/profile') { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ws-text-2)'; } }}
        >
          <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0, opacity: path === '/profile' ? 1 : 0.75 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={path === '/profile' ? 'var(--ws-accent)' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </span>
          {!collapsed && <span style={{ flex: 1, minWidth: 0 }}>Profile & Settings</span>}
        </Link>

        {/* User + Theme row */}
        <div style={{ display: 'flex', flexDirection: collapsed ? 'column' : 'row', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between', borderTop: '1px solid var(--ws-border)', paddingTop: '12px', gap: '8px' }}>
          <UserMenu variant="light" dropUp collapsed={collapsed} />
          <button
            onClick={onToggleTheme}
            id="theme-toggle-btn"
            title={collapsed ? (theme === 'dark' ? 'Switch to Light' : 'Switch to Dark') : undefined}
            style={{
              background: 'var(--ws-bg-2)', border: '1px solid var(--ws-border)', borderRadius: '20px',
              padding: collapsed ? '0' : '4px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              color: 'var(--ws-text)', transition: 'all 0.15s ease', outline: 'none',
              width: collapsed ? '32px' : 'auto',
              height: collapsed ? '32px' : 'auto',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--ws-accent)'; e.currentTarget.style.background = 'var(--ws-bg-1)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--ws-border)'; e.currentTarget.style.background = 'var(--ws-bg-2)'; }}
          >
            {theme === 'dark' ? (
              <>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
                {!collapsed && <span style={{ fontSize: '10px', fontWeight: 700 }}>Dark</span>}
              </>
            ) : (
              <>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
                {!collapsed && <span style={{ fontSize: '10px', fontWeight: 700 }}>Light</span>}
              </>
            )}
          </button>
        </div>

        {/* Collapse Sidebar Button */}
        <button
          onClick={onToggleCollapse}
          title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--ws-text-3)',
            cursor: 'pointer',
            padding: '8px',
            fontSize: '11px',
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: '8px',
            width: '100%',
            outline: 'none',
            borderTop: '1px solid var(--ws-border)',
            paddingTop: '12px',
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--ws-accent)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--ws-text-3)'}
        >
          <span style={{ fontSize: '14px' }}>{collapsed ? '→' : '←'}</span>
          {!collapsed && <span>Collapse Sidebar</span>}
        </button>

      </div>
    </aside>
  );
}
