'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useUser } from '../../components/AuthProvider';
import { NEW_COLORS as C, VERDICT_BADGE } from '../../components/new/theme';

const REASON_LABEL = {
  manual: 'Pro a mano', manual_trial: 'Prueba a mano', active: 'Suscripción activa', trialing: 'Suscripción en trial (Stripe)',
  trial: 'Periodo de prueba', grandfathered: 'Gratis (anterior al trial)', none: 'Sin acceso Pro',
};

function Shell({ children }) {
  return (
    <div style={{ width: '100%', minHeight: '100vh', boxSizing: 'border-box', background: C.bg, color: C.ink, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <div style={{ maxWidth: '820px', margin: '0 auto', padding: '32px 24px 96px', display: 'flex', flexDirection: 'column', gap: '24px', boxSizing: 'border-box' }}>
        <Link href="/admin" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: C.text2, textDecoration: 'none', width: 'fit-content' }}>
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
          Admin
        </Link>
        {children}
      </div>
    </div>
  );
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' });
}

// Module-level, not inside the component — Date.now() is impure, and the React Compiler lint
// (react-hooks/purity) flags any impure call syntactically reachable from a component's render
// body, even one only ever invoked from a click handler. Same reasoning as trading212/page.js's
// module-level statusFor(), which calls Date.now() internally without tripping the same rule.
function daysFromNow(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

export default function AdminUsersPage() {
  const { isLoaded, isSignedIn } = useUser();
  const [isAdmin, setIsAdmin] = useState(null);
  const [q, setQ] = useState('');
  const [users, setUsers] = useState([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingId, setPendingId] = useState(null);

  useEffect(() => {
    if (!isLoaded) return;
    fetch('/api/admin/check').then(r => r.json()).then(d => setIsAdmin(d.isAdmin)).catch(() => setIsAdmin(false));
  }, [isLoaded]);

  const search = async (e) => {
    e?.preventDefault();
    if (!q.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/users?q=${encodeURIComponent(q.trim())}`);
      const d = await res.json();
      if (d.error) { setError(d.error); setUsers([]); } else { setUsers(d.users || []); }
    } catch {
      setError('Error al buscar.');
    } finally {
      setSearched(true);
      setLoading(false);
    }
  };

  // manual_override_until: omit/null for a permanent comp, an ISO date for a timed trial that
  // expires on its own (app/api/admin/users/route.js's GET lazily clears it once it's past).
  const setOverride = async (user, manual_override, manual_override_until = null) => {
    setPendingId(user.id);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, manual_override, manual_override_until }),
      });
      const d = await res.json();
      if (d.error) { setError(d.error); return; }
      // Re-run the same search instead of patching local state by hand, so the displayed
      // reason/isPro reflects the server's own effectiveStatus() logic, not a guess here.
      await search();
    } finally {
      setPendingId(null);
    }
  };
  const give30DayTrial = (user) => setOverride(user, true, daysFromNow(30));

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
      <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em' }}>Usuarios</h1>

      <form onSubmit={search} style={{ display: 'flex', gap: '10px' }}>
        <input
          type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por email…"
          style={{ flex: 1, padding: '11px 14px', borderRadius: '10px', border: `1px solid ${C.border}`, background: '#FDFBF6', color: C.ink, fontFamily: 'inherit', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
        />
        <button type="submit" disabled={loading} style={{ height: '42px', padding: '0 20px', borderRadius: '10px', border: 'none', background: C.lime, color: C.ink, fontWeight: 700, fontSize: '14px', fontFamily: 'inherit', cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1 }}>
          {loading ? 'Buscando…' : 'Buscar'}
        </button>
      </form>

      {error && <div style={{ fontSize: '13px', color: C.red }}>{error}</div>}

      {searched && !loading && users.length === 0 && !error && (
        <div style={{ fontSize: '13px', color: C.text3 }}>Sin resultados para &quot;{q}&quot;.</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {users.map(u => {
          const badge = VERDICT_BADGE[u.isPro ? 'good' : 'bad'];
          // Derived from `reason` (the server's effectiveStatus()), not the raw
          // subscription.manual_override — a lapsed timed trial still has manual_override=true
          // in the row until the lazy cleanup catches up, but reason already reflects reality.
          const overridden = u.reason === 'manual' || u.reason === 'manual_trial';
          return (
            <div key={u.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '16px', padding: '18px 20px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 800 }}>{u.email}</div>
                  <div style={{ fontSize: '12px', color: C.text3, marginTop: '2px' }}>
                    Alta {formatDate(u.created_at)} · Última visita {formatDate(u.last_sign_in_at)}
                  </div>
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 12px', borderRadius: '20px', background: badge.bg, flexShrink: 0 }}>
                  <span aria-hidden="true" style={{ width: '7px', height: '7px', borderRadius: '50%', background: badge.dot }} />
                  <span style={{ fontSize: '12px', fontWeight: 700, color: badge.text }}>{REASON_LABEL[u.reason] ?? u.reason}</span>
                </div>
              </div>

              <div style={{ fontSize: '12px', color: C.text2, display: 'flex', flexWrap: 'wrap', gap: '14px' }}>
                {u.subscription?.status && <span>Stripe: {u.subscription.status}</span>}
                {u.subscription?.stripe_customer_id && (
                  <a href={`https://dashboard.stripe.com/customers/${u.subscription.stripe_customer_id}`} target="_blank" rel="noreferrer" style={{ color: C.ink, fontWeight: 700 }}>
                    Ver en Stripe ↗
                  </a>
                )}
                {!u.subscription?.status && !u.subscription?.stripe_customer_id && <span>Sin historial de Stripe.</span>}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                {overridden ? (
                  <>
                    <button
                      type="button" onClick={() => setOverride(u, false)} disabled={pendingId === u.id}
                      style={{
                        height: '34px', padding: '0 16px', borderRadius: '10px', fontWeight: 700, fontSize: '12px', fontFamily: 'inherit',
                        cursor: pendingId === u.id ? 'default' : 'pointer', opacity: pendingId === u.id ? 0.6 : 1,
                        border: 'none', background: C.red, color: '#fff',
                      }}
                    >
                      {pendingId === u.id ? '…' : 'Quitar Pro a mano'}
                    </button>
                    <span style={{ fontSize: '12px', color: C.text3 }}>
                      {u.subscription?.manual_override_until ? `Hasta ${formatDate(u.subscription.manual_override_until)}` : 'Permanente'}
                    </span>
                  </>
                ) : (
                  <>
                    <button
                      type="button" onClick={() => give30DayTrial(u)} disabled={pendingId === u.id}
                      style={{
                        height: '34px', padding: '0 16px', borderRadius: '10px', fontWeight: 700, fontSize: '12px', fontFamily: 'inherit',
                        cursor: pendingId === u.id ? 'default' : 'pointer', opacity: pendingId === u.id ? 0.6 : 1,
                        border: 'none', background: C.lime, color: C.ink,
                      }}
                    >
                      {pendingId === u.id ? '…' : 'Dar prueba 30 días'}
                    </button>
                    <button
                      type="button" onClick={() => setOverride(u, true)} disabled={pendingId === u.id}
                      style={{
                        height: '34px', padding: '0 16px', borderRadius: '10px', fontWeight: 700, fontSize: '12px', fontFamily: 'inherit',
                        cursor: pendingId === u.id ? 'default' : 'pointer', opacity: pendingId === u.id ? 0.6 : 1,
                        border: `1px solid ${C.ink}`, background: 'transparent', color: C.ink,
                      }}
                    >
                      {pendingId === u.id ? '…' : 'Dar Pro permanente'}
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Shell>
  );
}
