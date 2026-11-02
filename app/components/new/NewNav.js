'use client';
import Link from 'next/link';
import { useUser } from '../AuthProvider';
import { NEW_COLORS as C } from './theme';

// Shared top nav for the /new redesign — ported from the Design canvas mockup's repeated
// header block. "Seguidos" and "Calendario" point at the existing real (dark-theme) pages
// for now since their /new equivalents don't exist yet; repoint once they're built.
const NAV_ITEMS = [
  { key: 'inicio', label: 'Inicio', href: '/new' },
  { key: 'seguidos', label: 'Seguidos', href: '/watchlist' },
  { key: 'calendario', label: 'Calendario', href: '/calendar' },
  { key: 'aprende', label: 'Aprende', href: '/blog' },
];

export default function NewNav({ active }) {
  const { isSignedIn } = useUser();

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
      <Link href="/new" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
        <div aria-hidden="true" style={{ width: '32px', height: '32px', borderRadius: '9px', background: C.lime, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: '5px', boxSizing: 'border-box' }}>
          <img src="/bulltrace-logos/bull-icon-black.png" alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
        <span style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.02em', color: C.ink }}>Bulltrace</span>
      </Link>

      <nav aria-label="Principal" style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
        {NAV_ITEMS.map(item => (
          <Link key={item.key} href={item.href} style={{
            padding: '7px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 700, textDecoration: 'none',
            background: active === item.key ? C.lime : 'transparent',
            color: active === item.key ? C.ink : C.text2,
          }}>
            {item.label}
          </Link>
        ))}
      </nav>

      <Link href={isSignedIn ? '/profile' : '/sign-in'} aria-label={isSignedIn ? 'Tu perfil' : 'Iniciar sesión'}
        style={{ width: '36px', height: '36px', borderRadius: '50%', background: C.avatarBg, border: `1px solid ${C.border}`, flexShrink: 0 }} />
    </div>
  );
}
