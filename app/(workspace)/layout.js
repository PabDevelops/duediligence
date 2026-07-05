'use client';
import { useState, useEffect } from 'react';
import Sidebar from '../components/workspace/Sidebar';
import { useUser } from '../components/AuthProvider';

// TrialGate, BottomNav, and WatchlistWidget are already mounted in the root
// layout — not duplicated here. TrialGate nudges signed-in-but-unsubscribed
// users to /start-trial from anywhere in the app; the check below is the hard
// stop that actually blocks the terminal itself (including guests hitting a
// workspace URL directly) until there's an active/trialing subscription.
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
  const [access, setAccess] = useState('checking'); // checking | denied | granted
  const [theme, setTheme] = useState('light');

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

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('ws_theme', nextTheme);
    document.documentElement.setAttribute('data-ws-theme', nextTheme);
  };

  if (access === 'checking') return <LoadingScreen />;
  if (access === 'denied') return <PaywallGate />;

  return (
    <div className={`workspace ${theme}`} style={{ display: 'flex' }}>
      <div className="ws-sidebar-slot">
        <Sidebar theme={theme} onToggleTheme={toggleTheme} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <main>{children}</main>
      </div>
      <style>{`
        @media (max-width: 768px) {
          .ws-sidebar-slot { display: none; }
        }
      `}</style>
    </div>
  );
}
