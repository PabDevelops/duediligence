'use client';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';

export default function Header() {
  const router = useRouter();
  const { user } = useUser();

  return (
    <header style={{
      display: 'none', // Hidden on mobile via CSS
      padding: '16px 24px',
      borderBottom: '1px solid var(--border)',
      background: 'var(--bg)',
      position: 'sticky',
      top: 0,
      zIndex: 40,
      width: '100%',
      boxSizing: 'border-box',
      '@media (min-width: 1024px)': {
        display: 'flex'
      }
    }}
    className="desktop-header">
      {/* Logo */}
      <div onClick={() => router.push('/')} style={{
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        fontFamily: 'Space Grotesk, sans-serif',
        fontSize: '18px',
        fontWeight: 700,
        color: 'var(--text)',
        flex: 1
      }}>
        Traq
        <span style={{ color: 'var(--accent)', display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--accent)' }} />
        cker
      </div>

      {/* Right side — Profile link */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {user ? (
          <>
            <span style={{ color: 'var(--text-2)', fontSize: '13px' }}>
              {user.firstName || user.emailAddresses?.[0]?.emailAddress || 'Account'}
            </span>
            <button onClick={() => router.push('/profile')}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--bg-2)',
                color: 'var(--text)',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600,
                fontFamily: 'Space Grotesk, sans-serif',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => {
                e.target.style.background = 'var(--accent)';
                e.target.style.color = '#0B0E14';
                e.target.style.borderColor = 'var(--accent)';
              }}
              onMouseLeave={e => {
                e.target.style.background = 'var(--bg-2)';
                e.target.style.color = 'var(--text)';
                e.target.style.borderColor = 'var(--border)';
              }}>
              Profile
            </button>
          </>
        ) : (
          <>
            <button onClick={() => router.push('/sign-in')}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text)',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600,
                fontFamily: 'Space Grotesk, sans-serif'
              }}>
              Sign in
            </button>
            <button onClick={() => router.push('/sign-up')}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                background: 'var(--accent)',
                color: '#0B0E14',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600,
                fontFamily: 'Space Grotesk, sans-serif'
              }}>
              Sign up
            </button>
          </>
        )}
      </div>

      <style>{`
        @media (max-width: 1023px) {
          .desktop-header {
            display: none !important;
          }
        }
        @media (min-width: 1024px) {
          .desktop-header {
            display: flex !important;
          }
        }
      `}</style>
    </header>
  );
}
