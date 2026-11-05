'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useUser } from '../../components/AuthProvider';
import { NEW_COLORS as C, VERDICT_BADGE } from '../../components/new/theme';

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

function formatWhen(iso) {
  if (!iso) return 'nunca';
  return new Date(iso).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// A connected account is "sana" only when it's actually synced recently AND the last attempt
// didn't error — a stale t212_last_synced_at with no t212_sync_error can still mean the sync
// stopped running, not that everything's fine (same distinction that mattered for the MNTN bug:
// t212_sync_error was null even though orders were silently failing before the real fix).
function statusFor(a) {
  if (a.t212_sync_error) return { tier: 'bad', label: 'Error de sync' };
  const debug = a.t212_activity_debug;
  if (debug?.ordersError || debug?.dividendsError) return { tier: 'bad', label: 'Error en actividad' };
  const lastSync = a.t212_last_synced_at ? new Date(a.t212_last_synced_at).getTime() : null;
  if (!lastSync) return { tier: 'caution', label: 'Nunca sincronizada' };
  const hoursSince = (Date.now() - lastSync) / (1000 * 60 * 60);
  if (hoursSince > 24) return { tier: 'caution', label: `Sin sincronizar hace ${Math.round(hoursSince / 24)}d` };
  return { tier: 'good', label: 'OK' };
}

export default function AdminTrading212Page() {
  const { isLoaded, isSignedIn } = useUser();
  const [isAdmin, setIsAdmin] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isLoaded) return;
    fetch('/api/admin/check').then(r => r.json()).then(d => setIsAdmin(d.isAdmin)).catch(() => setIsAdmin(false));
  }, [isLoaded]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/trading212');
      const d = await res.json();
      if (d.error) setError(d.error); else setAccounts(d.accounts || []);
    } catch {
      setError('Error al cargar.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em' }}>Trading 212</h1>
        <button type="button" onClick={load} disabled={loading} style={{ height: '34px', padding: '0 16px', borderRadius: '10px', border: `1px solid ${C.ink}`, background: 'transparent', color: C.ink, fontWeight: 700, fontSize: '12px', fontFamily: 'inherit', cursor: loading ? 'default' : 'pointer' }}>
          {loading ? 'Cargando…' : 'Actualizar'}
        </button>
      </div>

      {error && <div style={{ fontSize: '13px', color: C.red }}>{error}</div>}

      {!loading && accounts.length === 0 && !error && (
        <div style={{ fontSize: '13px', color: C.text3 }}>No hay cuentas conectadas todavía.</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {accounts.map(a => {
          const s = statusFor(a);
          const badge = VERDICT_BADGE[s.tier];
          const debug = a.t212_activity_debug;
          return (
            <div key={a.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '16px', padding: '18px 20px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 800 }}>{a.email ?? a.user_id}</div>
                  <div style={{ fontSize: '12px', color: C.text3, marginTop: '2px' }}>
                    {a.name} · conectada {formatWhen(a.t212_connected_at)} · última sync {formatWhen(a.t212_last_synced_at)}
                  </div>
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 12px', borderRadius: '20px', background: badge.bg, flexShrink: 0 }}>
                  <span aria-hidden="true" style={{ width: '7px', height: '7px', borderRadius: '50%', background: badge.dot }} />
                  <span style={{ fontSize: '12px', fontWeight: 700, color: badge.text }}>{s.label}</span>
                </div>
              </div>

              {a.t212_sync_error && (
                <div style={{ fontSize: '12px', color: C.red, background: VERDICT_BADGE.bad.bg, borderRadius: '10px', padding: '8px 10px' }}>
                  {a.t212_sync_error}
                </div>
              )}

              {debug && (
                <div style={{ fontSize: '12px', color: C.text2, display: 'flex', flexWrap: 'wrap', gap: '14px' }}>
                  <span>Órdenes: {debug.ordersCount ?? '—'}{debug.ordersError ? ` (error: ${debug.ordersError})` : ''}</span>
                  <span>Dividendos: {debug.dividendsCount ?? '—'}{debug.dividendsError ? ` (error: ${debug.dividendsError})` : ''}</span>
                  <span>Último intento: {formatWhen(debug.at)}</span>
                </div>
              )}

              {a.t212_cash != null && (
                <div style={{ fontSize: '12px', color: C.text3 }}>
                  Caja: {a.t212_cash.toLocaleString(undefined, { maximumFractionDigits: 2 })} {a.t212_cash_currency}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Shell>
  );
}
