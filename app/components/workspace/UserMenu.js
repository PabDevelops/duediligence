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

export default function UserMenu({ variant = 'dark', dropUp = false }) {
  const theme = THEMES[variant];
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
