'use client';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from '../components/workspace/Sidebar';
import { useUser } from '../components/AuthProvider';

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

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { setAccess('denied'); return; }
    let cancelled = false;
    fetch('/api/subscription')
      .then(r => r.json())
      .then(d => { if (!cancelled) setAccess(d.isPro ? 'granted' : 'denied'); })
      .catch(() => { if (!cancelled) setAccess('denied'); });
    return () => { cancelled = true; };
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    const savedTheme = localStorage.getItem('ws_theme');
    let activeTheme = 'light';
    if (savedTheme) {
      activeTheme = savedTheme;
    } else {
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      activeTheme = systemPrefersDark ? 'dark' : 'light';
    }
    setTheme(activeTheme);
    document.documentElement.setAttribute('data-ws-theme', activeTheme);

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = (e) => {
      if (!localStorage.getItem('ws_theme')) {
        const nextTheme = e.matches ? 'dark' : 'light';
        setTheme(nextTheme);
        document.documentElement.setAttribute('data-ws-theme', nextTheme);
      }
    };
    mediaQuery.addEventListener('change', handleSystemThemeChange);
    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
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
    <div className={`workspace ${theme}`} style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative' }}>
      
      {/* MOBILE TOP BAR (only visible < 1024px) */}
      <div className="ws-mobile-header" style={{
        height: '48px',
        background: 'var(--ws-bg-1)',
        borderBottom: '1px solid var(--ws-border)',
        display: 'none', // overridden by media query
        alignItems: 'center',
        padding: '0 16px',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 1000
      }}>
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
          <Sidebar theme={theme} onToggleTheme={toggleTheme} />
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

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <main style={{ flex: 1 }}>{children}</main>
        </div>
      </div>

      <style>{`
        @media (max-width: 1023px) {
          .ws-mobile-header {
            display: flex !important;
          }
          .ws-sidebar-slot {
            position: fixed !important;
            left: -240px !important;
            top: 0 !important;
            bottom: 0 !important;
            height: 100vh !important;
            z-index: 9999 !important;
            transition: left 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
            display: block !important;
          }
          .ws-sidebar-slot.open {
            left: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
