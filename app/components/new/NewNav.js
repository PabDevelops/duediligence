'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useUser } from '../AuthProvider';
import { NEW_COLORS as C } from './theme';

// Shared top nav for the /new redesign — ported from the Design canvas mockup's repeated
// header block. On mobile, .new-nav-links (the inline pill row) is hidden by CSS and this
// animated burger drives a slide-down menu instead — see the .new-nav-burger/.new-nav-mobile-menu
// rules in app/globals.css.
const NAV_ITEMS = [
  { key: 'inicio', label: 'Inicio', href: '/home' },
  { key: 'seguidos', label: 'Seguidos', href: '/watchlist' },
  { key: 'calendario', label: 'Calendario', href: '/calendar' },
  { key: 'aprende', label: 'Aprende', href: '/aprende' },
];

export default function NewNav({ active }) {
  const { isSignedIn } = useUser();
  const [open, setOpen] = useState(false);

  return (
    <div className="new-nav-wrap">
      <div className="new-nav-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <Link href="/home" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', flexShrink: 0 }}>
          <div aria-hidden="true" style={{ width: '32px', height: '32px', borderRadius: '9px', background: C.lime, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: '5px', boxSizing: 'border-box' }}>
            <img src="/bulltrace-logos/bull-icon-black.png" alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <span style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.02em', color: C.ink }}>Bulltrace</span>
        </Link>

        <nav aria-label="Principal" className="new-nav-links" style={{ alignItems: 'center', gap: '4px' }}>
          {NAV_ITEMS.map(item => (
            <Link key={item.key} href={item.href} style={{
              padding: '7px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 700, textDecoration: 'none',
              background: active === item.key ? C.lime : 'transparent',
              color: active === item.key ? C.ink : C.text2,
              whiteSpace: 'nowrap', flexShrink: 0,
            }}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          <Link href={isSignedIn ? '/profile' : '/sign-in'} aria-label={isSignedIn ? 'Tu perfil' : 'Iniciar sesión'}
            style={{ width: '36px', height: '36px', borderRadius: '50%', background: C.avatarBg, border: `1px solid ${C.border}`, flexShrink: 0 }} />

          <button
            type="button"
            className={`new-nav-burger${open ? ' is-open' : ''}`}
            aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={open}
            onClick={() => setOpen(o => !o)}
          >
            <span /><span /><span />
          </button>
        </div>
      </div>

      <nav aria-label="Principal (móvil)" className={`new-nav-mobile-menu${open ? ' is-open' : ''}`}>
        {NAV_ITEMS.map(item => (
          <Link key={item.key} href={item.href} onClick={() => setOpen(false)} style={{
            padding: '12px 14px', borderRadius: '12px', fontSize: '14px', fontWeight: 700, textDecoration: 'none',
            background: active === item.key ? C.lime : 'transparent',
            color: active === item.key ? C.ink : C.text2,
          }}>
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
