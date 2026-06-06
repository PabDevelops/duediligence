'use client';
import { usePathname } from 'next/navigation';
import { SignInButton, UserButton, useUser } from '@clerk/nextjs';

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

  return (
    <div style={{ borderBottom: '1px solid var(--border)', padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <a href="/" style={{ textDecoration: 'none' }}>
          <img src="/logo.png" alt="Traqcker" style={{ height: '20px', objectFit: 'contain' }} />
        </a>
        <span style={{ color: 'var(--border-2)' }}>|</span>
        <span style={{ color: 'var(--text-3)', fontSize: '11px' }}>FUNDAMENTAL ANALYSIS SYSTEM v1.0</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        {navItem('/', 'HOME')}
        {navItem('/screener', 'SCREENER')}
        {navItem('/compare', 'COMPARE')}
        <span style={{ color: 'var(--text-3)', fontSize: '11px' }}>{new Date().toISOString().slice(0, 10)} · SEC EDGAR · FINNHUB</span>
        {useUser().isSignedIn ? (
          <UserButton afterSignOutUrl="/" />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ color: 'var(--text-3)', fontSize: '10px', letterSpacing: '1px', borderRight: '1px solid var(--border)', paddingRight: '12px' }}>
              🔒 SIGN IN TO SEE FULL DATA
            </span>
            <SignInButton mode="modal">
              <button style={{ background: 'var(--accent)', color: '#000', border: 'none', padding: '4px 12px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', fontWeight: 700, cursor: 'pointer', letterSpacing: '1px' }}>
                SIGN IN
              </button>
            </SignInButton>
          </div>
        )}
      </div>
    </div>
  );
}