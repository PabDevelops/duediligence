'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '../AuthProvider';
import { createClient } from '../../../lib/supabase/client';

const THEMES = {
  dark: {
    avatarBg: 'linear-gradient(135deg, #a78bfa, #60a5fa)',
    avatarColor: '#000',
    menuClass: 'glass',
    text: 'var(--text)',
    danger: 'var(--red)',
  },
  light: {
    avatarBg: 'var(--ws-accent)',
    avatarColor: '#fff',
    menuClass: '',
    text: 'var(--ws-text)',
    danger: 'var(--ws-red)',
  },
};

export default function UserMenu({ variant = 'dark', dropUp = false, collapsed = false }) {
  const theme = THEMES[variant];
  const { user, isSignedIn } = useUser();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setOpen(false);
    router.push('/');
    router.refresh();
  };

  if (!isSignedIn) {
    return (
      <Link href="/sign-in"
        title="Sign in"
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: collapsed ? '30px' : 'auto',
          height: '30px', padding: collapsed ? '0' : '0 12px',
          borderRadius: '20px', fontSize: '13px', fontWeight: 600, textDecoration: 'none',
          color: variant === 'light' ? 'var(--ws-accent)' : theme.text,
          border: `1px solid ${variant === 'light' ? 'var(--ws-accent)' : 'currentColor'}`,
        }}>
        {collapsed ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
            <polyline points="10 17 15 12 10 7" />
            <line x1="15" y1="12" x2="3" y2="12" />
          </svg>
        ) : 'Sign in'}
      </Link>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)}
        style={{ width: '30px', height: '30px', borderRadius: '50%', border: 'none', background: theme.avatarBg, color: theme.avatarColor, fontWeight: 800, fontSize: '13px', cursor: 'pointer' }}>
        {user?.email?.[0]?.toUpperCase() || '?'}
      </button>
      {open && (
        <div className={theme.menuClass}
          style={{
            position: 'absolute',
            ...(dropUp ? { bottom: '38px' } : { top: '38px' }),
            right: dropUp ? 'auto' : 0,
            left: dropUp ? 0 : 'auto',
            minWidth: '160px', padding: '6px', zIndex: 100,
            background: variant === 'light' ? 'var(--ws-bg)' : undefined,
            border: variant === 'light' ? '1px solid var(--ws-border)' : undefined,
            borderRadius: variant === 'light' ? 'var(--ws-radius)' : undefined,
            boxShadow: variant === 'light' ? '0 4px 16px rgba(0,0,0,0.08)' : undefined,
          }}>
          <Link href="/profile" onClick={() => setOpen(false)}
            style={{ display: 'block', padding: '8px 12px', borderRadius: '6px', color: theme.text, fontSize: '13px', textDecoration: 'none' }}>
            Profile
          </Link>
          <button onClick={signOut}
            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', borderRadius: '6px', color: theme.danger, fontSize: '13px', background: 'none', border: 'none', cursor: 'pointer' }}>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
