'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useUser } from '../components/AuthProvider';
import { NEW_COLORS as C } from '../components/new/theme';

const SECTIONS = [
  { href: '/admin/users', title: 'Usuarios', desc: 'Buscar por email, ver su estado de Pro/trial y activar o desactivar el acceso a mano.' },
  { href: '/admin/trading212', title: 'Trading 212', desc: 'Cuentas conectadas, última sincronización y errores de sync, sin entrar a la base de datos.' },
  { href: '/admin/blog', title: 'Blog', desc: 'Crear y editar artículos de Aprende.' },
  { href: '/admin/data-anomalies', title: 'Anomalías de datos', desc: 'Tickers cuyas fuentes (Finnhub/Yahoo/SEC) no coinciden, pendientes de revisar.' },
];

function Shell({ children }) {
  return (
    <div style={{ width: '100%', minHeight: '100vh', boxSizing: 'border-box', background: C.bg, color: C.ink, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <div style={{ maxWidth: '820px', margin: '0 auto', padding: '32px 24px 96px', display: 'flex', flexDirection: 'column', gap: '24px', boxSizing: 'border-box' }}>
        {children}
      </div>
    </div>
  );
}

export default function AdminHubPage() {
  const { isLoaded, isSignedIn } = useUser();
  const [isAdmin, setIsAdmin] = useState(null);

  useEffect(() => {
    if (!isLoaded) return;
    fetch('/api/admin/check').then(r => r.json()).then(d => setIsAdmin(d.isAdmin)).catch(() => setIsAdmin(false));
  }, [isLoaded]);

  if (!isLoaded || isAdmin === null) {
    return <Shell><div style={{ fontSize: '13px', color: C.text3 }}>Cargando…</div></Shell>;
  }

  if (!isSignedIn || !isAdmin) {
    return (
      <Shell>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '28px', textAlign: 'center' }}>
          <div style={{ fontSize: '17px', fontWeight: 800, marginBottom: '6px' }}>No autorizado</div>
          <div style={{ color: C.text2, fontSize: '13px' }}>Esta página está restringida al equipo de Bulltrace.</div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em' }}>Admin</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {SECTIONS.map(s => (
          <Link key={s.href} href={s.href} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '16px', padding: '18px 20px', display: 'block', textDecoration: 'none', color: C.ink, boxSizing: 'border-box' }}>
            <div style={{ fontSize: '15px', fontWeight: 800, marginBottom: '4px' }}>{s.title}</div>
            <div style={{ fontSize: '13px', color: C.text2, lineHeight: 1.5 }}>{s.desc}</div>
          </Link>
        ))}
      </div>
    </Shell>
  );
}
