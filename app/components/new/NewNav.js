'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useUser } from '../AuthProvider';
import Avatar from './Avatar';
import { NEW_COLORS as C } from './theme';

// Shared top nav for the /new redesign — ported from the Design canvas mockup's repeated
// header block. On mobile, .new-nav-links (the inline pill row) is hidden by CSS and this
// animated burger drives a slide-down menu instead — see the .new-nav-burger/.new-nav-mobile-menu
// rules in app/globals.css.
const NAV_ITEMS = [
  { key: 'inicio', label: 'Inicio', href: '/home' },
  { key: 'seguidos', label: 'Seguidos', href: '/watchlist' },
  { key: 'portfolio', label: 'Portfolio', href: '/portfolio' },
  { key: 'etfs', label: 'ETFs', href: '/etfs' },
  { key: 'radar', label: 'Radar', href: '/radar' },
  { key: 'calendario', label: 'Calendario', href: '/calendar' },
  { key: 'aprende', label: 'Aprende', href: '/aprende' },
  { key: 'buscar', label: 'Buscar', href: '/search' },
];

export default function NewNav({ active }) {
  const { user, isSignedIn } = useUser();
  const [open, setOpen] = useState(false);

  // Precios only makes sense to pitch at someone who isn't already a customer — once signed
  // in, it's just noise (their plan status already lives on /profile).
  const items = isSignedIn ? NAV_ITEMS : [...NAV_ITEMS, { key: 'precios', label: 'Precios', href: '/pricing' }];

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
          {items.map(item => (
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
          {isSignedIn ? (
            <Link href="/profile" aria-label="Tu perfil">
              <Avatar user={user} size={36} />
            </Link>
          ) : (
            <div className="new-nav-cta" style={{ alignItems: 'center', gap: '10px' }}>
              <Link href="/sign-in" style={{ fontSize: '13px', fontWeight: 700, color: C.text2, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                Iniciar sesión
              </Link>
              <Link href="/sign-up" style={{ padding: '9px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: 700, textDecoration: 'none', background: C.lime, color: C.ink, whiteSpace: 'nowrap' }}>
                Empieza gratis
              </Link>
            </div>
          )}

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
        {items.map(item => (
          <Link key={item.key} href={item.href} onClick={() => setOpen(false)} style={{
            padding: '12px 14px', borderRadius: '12px', fontSize: '14px', fontWeight: 700, textDecoration: 'none',
            background: active === item.key ? C.lime : 'transparent',
            color: active === item.key ? C.ink : C.text2,
          }}>
            {item.label}
          </Link>
        ))}
        {!isSignedIn && (
          <>
            <Link href="/sign-in" onClick={() => setOpen(false)} style={{ padding: '12px 14px', borderRadius: '12px', fontSize: '14px', fontWeight: 700, textDecoration: 'none', color: C.text2 }}>
              Iniciar sesión
            </Link>
            <Link href="/sign-up" onClick={() => setOpen(false)} style={{ padding: '12px 14px', borderRadius: '12px', fontSize: '14px', fontWeight: 700, textDecoration: 'none', background: C.lime, color: C.ink }}>
              Empieza gratis
            </Link>
          </>
        )}
      </nav>
    </div>
  );
}
