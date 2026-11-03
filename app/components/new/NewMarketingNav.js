'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useUser } from '../AuthProvider';
import { NEW_COLORS as C } from './theme';

// Cream/lime nav for the pre-signup marketing pages (landing, about, pricing, start-trial,
// success, faq, privacy, terms) — a sibling to NewNav (the signed-in app's own nav), not a
// reskin of it: a logged-out visitor has no use for Inicio/Seguidos/ETFs/etc., so this carries
// marketing links instead, same cream/lime visual language as the rest of the new theme.
const NAV_ITEMS = [
  { key: 'about', label: 'Sobre nosotros', href: '/about' },
  { key: 'precios', label: 'Precios', href: '/pricing' },
  { key: 'faq', label: 'FAQ', href: '/faq' },
];

export default function NewMarketingNav({ active }) {
  const { isSignedIn } = useUser();
  const [open, setOpen] = useState(false);

  return (
    <div className="new-nav-wrap">
      <div className="new-nav-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', flexShrink: 0 }}>
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
          <div className="new-nav-cta" style={{ alignItems: 'center', gap: '10px' }}>
            {isSignedIn ? (
              <Link href="/home" style={{ padding: '9px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: 700, textDecoration: 'none', background: C.lime, color: C.ink, whiteSpace: 'nowrap' }}>
                Ir a la app →
              </Link>
            ) : (
              <>
                <Link href="/sign-in" style={{ fontSize: '13px', fontWeight: 700, color: C.text2, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                  Iniciar sesión
                </Link>
                <Link href="/home" style={{ padding: '9px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: 700, textDecoration: 'none', background: C.lime, color: C.ink, whiteSpace: 'nowrap' }}>
                  Empieza gratis
                </Link>
              </>
            )}
          </div>

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
        {isSignedIn ? (
          <Link href="/home" onClick={() => setOpen(false)} style={{ padding: '12px 14px', borderRadius: '12px', fontSize: '14px', fontWeight: 700, textDecoration: 'none', background: C.lime, color: C.ink }}>
            Ir a la app →
          </Link>
        ) : (
          <>
            <Link href="/sign-in" onClick={() => setOpen(false)} style={{ padding: '12px 14px', borderRadius: '12px', fontSize: '14px', fontWeight: 700, textDecoration: 'none', color: C.text2 }}>
              Iniciar sesión
            </Link>
            <Link href="/home" onClick={() => setOpen(false)} style={{ padding: '12px 14px', borderRadius: '12px', fontSize: '14px', fontWeight: 700, textDecoration: 'none', background: C.lime, color: C.ink }}>
              Empieza gratis
            </Link>
          </>
        )}
      </nav>
    </div>
  );
}
