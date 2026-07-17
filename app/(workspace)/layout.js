'use client';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from '../components/workspace/Sidebar';
import { useUser } from '../components/AuthProvider';

// Routes reachable without an account (and without a Pro subscription) as
// part of the anonymous-access exploration flow. Watchlist is included here
// too — signed-out users get a session-only watchlist there, gated inside
// the page itself, not at this layout level.
const PUBLIC_ROUTES = ['/home', '/search', '/stock', '/screener', '/radar', '/calendar', '/watchlist'];

function isPublicPath(path) {
  return PUBLIC_ROUTES.some(r => path === r || path.startsWith(r + '/'));
}

function PaywallGate() {
  const card = { padding: '12px 0', borderRadius: '10px', fontWeight: 700, fontSize: '14px', textDecoration: 'none', textAlign: 'center' };
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f9fa', padding: '24px', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: '420px', width: '100%', textAlign: 'center', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '16px', padding: '40px 32px', boxSizing: 'border-box' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1.5px', color: '#0f766e', marginBottom: '10px' }}>TRAQCKER TERMINAL</div>
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#1f2937', marginBottom: '10px' }}>Subscribe to unlock the terminal</h1>
        <p style={{ fontSize: '14px', color: '#4b5563', lineHeight: 1.6, marginBottom: '24px' }}>
          The screener, portfolio tracker, full financials and the rest of the terminal are available with Traqcker Pro — 14 days free to start.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <a href="/pricing" style={{ ...card, background: '#0f766e', color: '#fff' }}>Start 14-day free trial</a>
          <a href="/" style={{ ...card, border: '1px solid #e5e7eb', color: '#4b5563', fontWeight: 600, fontSize: '13px' }}>← Back to traqcker.com</a>
        </div>
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f9fa', color: '#9ca3af', fontFamily: 'Inter, sans-serif', fontSize: '13px' }}>
      Loading terminal…
    </div>
  );
}

export default function WorkspaceLayout({ children }) {
  const { isSignedIn, isLoaded } = useUser();
  const path = usePathname();
  const [access, setAccess] = useState('checking'); // checking | denied | granted
  const [theme, setTheme] = useState('light');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [scanlines, setScanlines] = useState(false);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('traqcker_sidebar_collapsed') === 'true';
    setSidebarCollapsed(saved);
  }, []);

  const toggleSidebarCollapse = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('traqcker_sidebar_collapsed', String(next));
      return next;
    });
  };

  useEffect(() => {
    if (!isLoaded) return;
    if (isPublicPath(path)) { setAccess('granted'); return; }
    setAccess('checking');
    if (!isSignedIn) { setAccess('denied'); return; }
    let cancelled = false;
    fetch('/api/subscription')
      .then(r => r.json())
      .then(d => { if (!cancelled) setAccess(d.isPro ? 'granted' : 'denied'); })
      .catch(() => { if (!cancelled) setAccess('denied'); });
    return () => { cancelled = true; };
  }, [isLoaded, isSignedIn, path]);

  useEffect(() => {
    const handleSettingsChanged = () => {
      const savedTheme = localStorage.getItem('ws_theme') || 'light';
      setTheme(savedTheme);
      document.documentElement.setAttribute('data-ws-theme', savedTheme);

      const savedAccent = localStorage.getItem('ws_accent_color');
      if (savedAccent) {
        document.documentElement.style.setProperty('--ws-accent', savedAccent);
        const dim = savedAccent.startsWith('#')
          ? `rgba(${parseInt(savedAccent.slice(1,3),16)}, ${parseInt(savedAccent.slice(3,5),16)}, ${parseInt(savedAccent.slice(5,7),16)}, 0.12)`
          : savedAccent;
        document.documentElement.style.setProperty('--ws-accent-dim', dim);
      }

      const savedSize = localStorage.getItem('ws_font_size') || 'normal';
      const fs = savedSize === 'compact' ? '12px' : savedSize === 'large' ? '16px' : '14px';
      document.documentElement.style.fontSize = fs;

      const savedScan = localStorage.getItem('ws_scanlines') === 'true';
      setScanlines(savedScan);
    };

    handleSettingsChanged();
    window.addEventListener('ws-settings-changed', handleSettingsChanged);
    return () => window.removeEventListener('ws-settings-changed', handleSettingsChanged);
  }, []);

  // Auto-close sidebar drawer when navigating
  useEffect(() => {
    setSidebarOpen(false);
  }, [path]);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('ws_theme', nextTheme);
    document.documentElement.setAttribute('data-ws-theme', nextTheme);
  };

  if (access === 'checking') return <LoadingScreen />;
  if (access === 'denied') return <PaywallGate />;

  const isDark = theme === 'dark';

  return (
    <div className={`workspace ${theme}`} style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative', '--ws-sidebar-width': sidebarCollapsed ? '68px' : '240px' }}>
      {scanlines && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.12) 50%)',
          backgroundSize: '100% 4px',
          zIndex: 999999,
          pointerEvents: 'none',
          opacity: 0.85
        }} />
      )}
      
      {/* MOBILE TOP BAR (only visible < 1024px) */}
      <div className="ws-mobile-header">
        <button onClick={() => setSidebarOpen(true)} style={{
          background: 'none',
          border: 'none',
          color: 'var(--ws-text)',
          fontSize: '20px',
          cursor: 'pointer',
          padding: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          outline: 'none'
        }}>
          ☰
        </button>
        <img
          src={isDark ? '/logo-traqcker-new-w.png' : '/logo-traqcker-new.png'}
          alt="Traqcker"
          style={{ height: '14px', width: 'auto' }}
        />
        <div style={{ width: '28px' }} /> {/* spacer to balance layout */}
      </div>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* SIDEBAR SLOT */}
        <div className={`ws-sidebar-slot ${sidebarOpen ? 'open' : ''}`}>
          <Sidebar theme={theme} onToggleTheme={toggleTheme} collapsed={sidebarCollapsed} onToggleCollapse={toggleSidebarCollapse} />
        </div>

        {/* SIDEBAR BACKDROP */}
        {sidebarOpen && (
          <div onClick={() => setSidebarOpen(false)} style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(2px)',
            zIndex: 9998
          }} />
        )}

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', maxWidth: '100%', overflowX: 'hidden' }}>
          <main style={{ flex: 1, maxWidth: '100%', overflowX: 'hidden' }}>{children}</main>
        </div>
      </div>
    </div>
  );
}
