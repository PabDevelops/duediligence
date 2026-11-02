'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '../../components/AuthProvider';
import { createClient } from '../../../lib/supabase/client';
import NewNav from '../../components/new/NewNav';
import { NEW_COLORS as C } from '../../components/new/theme';

const inputStyle = {
  padding: '11px 14px', borderRadius: '10px', border: `1px solid ${C.border}`, background: '#FDFBF6',
  color: C.ink, fontFamily: 'inherit', fontSize: '14px', outline: 'none', boxSizing: 'border-box', width: '100%',
};
const labelStyle = { fontSize: '12px', fontWeight: 700, color: C.text2, display: 'block', marginBottom: '6px' };
const cardStyle = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '24px 26px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '14px' };
const btnStyle = { padding: '10px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit' };

// A deliberately smaller version of the old /profile — drops Terminal Preferences (accent
// color, font size, CRT scanlines, all old-terminal-only cosmetics) and Developer API Keys,
// neither of which mean anything in /new's fixed cream/lime theme. Keeps what's actually
// relevant here: identity, password, subscription, and clearing your watchlist.
export default function NewProfilePage() {
  const router = useRouter();
  const { user, isLoaded, isSignedIn } = useUser();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [isPro, setIsPro] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileMsg, setProfileMsg] = useState({ type: '', text: '' });
  const [securityMsg, setSecurityMsg] = useState({ type: '', text: '' });
  const [watchlistCount, setWatchlistCount] = useState(0);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { router.push('/sign-in'); return; }

    setDisplayName(user.user_metadata?.full_name || localStorage.getItem('traq_user_fullname') || '');

    fetch('/api/subscription').then(r => r.json()).then(d => setIsPro(d?.isPro || false)).catch(() => {});
    fetch('/api/watchlist').then(r => r.json()).then(d => setWatchlistCount((d?.tickers || []).length))
      .catch(() => {}).finally(() => setLoading(false));
  }, [isSignedIn, isLoaded]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileMsg({ type: '', text: '' });
    try {
      const { error } = await supabase.auth.updateUser({ data: { full_name: displayName } });
      if (error) throw error;
      localStorage.setItem('traq_user_fullname', displayName);
      setProfileMsg({ type: 'success', text: 'Nombre actualizado.' });
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.message || 'No se pudo actualizar el nombre.' });
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setSecurityMsg({ type: '', text: '' });
    if (password !== confirmPassword) { setSecurityMsg({ type: 'error', text: 'Las contraseñas no coinciden.' }); return; }
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSecurityMsg({ type: 'success', text: 'Contraseña actualizada.' });
      setPassword(''); setConfirmPassword('');
    } catch (err) {
      setSecurityMsg({ type: 'error', text: err.message || 'No se pudo actualizar la contraseña.' });
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push('/home');
    router.refresh();
  };

  const goToPortal = async () => {
    setPortalLoading(true);
    try {
      const { url } = await fetch('/api/stripe/portal', { method: 'POST' }).then(r => r.json());
      if (url) window.location.href = url;
    } finally {
      setPortalLoading(false);
    }
  };

  const clearWatchlist = async () => {
    if (!confirm('¿Seguro que quieres borrar toda tu lista de seguimiento? Esto no se puede deshacer.')) return;
    try {
      const { error } = await supabase.from('watchlists').delete().eq('user_id', user.id);
      if (error) throw error;
      setWatchlistCount(0);
      alert('Lista de seguimiento vaciada.');
    } catch (err) {
      alert('No se pudo vaciar la lista: ' + err.message);
    }
  };

  if (!isLoaded || loading) {
    return (
      <Shell>
        <div style={{ fontSize: '13px', color: C.text3 }}>Cargando…</div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div style={{ ...cardStyle, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px', minWidth: 0 }}>
          <div aria-hidden="true" style={{ width: '56px', height: '56px', borderRadius: '50%', background: C.lime, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: 800, color: C.ink, flexShrink: 0 }}>
            {(displayName || user?.email || '?').charAt(0).toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: '19px', fontWeight: 800 }}>{displayName || user?.email?.split('@')[0]}</h1>
              <span style={{
                fontSize: '10px', fontWeight: 800, letterSpacing: '0.04em', borderRadius: '20px', padding: '3px 10px',
                background: isPro ? C.lime : C.avatarBg, color: C.ink,
              }}>
                {isPro ? 'CUENTA PRO' : 'CUENTA GRATIS'}
              </span>
            </div>
            <div style={{ fontSize: '12px', color: C.text2, marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.email} · Miembro desde {user?.created_at ? new Date(user.created_at).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
            </div>
          </div>
        </div>
        <button onClick={signOut} style={{ ...btnStyle, background: C.surface, border: `1px solid ${C.border}`, color: C.red }}>
          Cerrar sesión
        </button>
      </div>

      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700 }}>{isPro ? 'Plan Pro de Bulltrace' : 'Plan gratuito de Bulltrace'}</div>
            <div style={{ fontSize: '12px', color: C.text2, marginTop: '2px' }}>
              {isPro ? 'Tienes acceso completo.' : 'Sigues 1 lista de seguimiento con lo esencial — mejora para desbloquear más.'}
            </div>
          </div>
          {isPro ? (
            <button onClick={goToPortal} disabled={portalLoading} style={{ ...btnStyle, background: C.surface, border: `1px solid ${C.border}`, color: C.ink, opacity: portalLoading ? 0.6 : 1 }}>
              {portalLoading ? 'Cargando…' : 'Gestionar suscripción →'}
            </button>
          ) : (
            <a href="/pricing" style={{ ...btnStyle, background: C.lime, color: C.ink, textDecoration: 'none', display: 'inline-block' }}>Mejorar a Pro →</a>
          )}
        </div>
      </div>

      <div className="new-dash-2col" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '14px' }}>
        <form onSubmit={handleUpdateProfile} style={{ ...cardStyle, minWidth: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: 800 }}>Datos de la cuenta</div>
          {profileMsg.text && (
            <div style={{ fontSize: '12px', borderRadius: '10px', padding: '10px 12px', background: profileMsg.type === 'success' ? '#E4F3DE' : '#F8DFDA', color: profileMsg.type === 'success' ? '#2E6B3A' : C.red }}>
              {profileMsg.text}
            </div>
          )}
          <div>
            <label htmlFor="displayName" style={labelStyle}>Nombre</label>
            <input id="displayName" type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Tu nombre" required style={inputStyle} />
          </div>
          <div>
            <label htmlFor="emailRo" style={labelStyle}>Correo electrónico</label>
            <input id="emailRo" type="text" value={user?.email || ''} readOnly style={{ ...inputStyle, opacity: 0.6, cursor: 'not-allowed' }} />
          </div>
          <button type="submit" style={{ ...btnStyle, background: C.lime, color: C.ink, alignSelf: 'flex-start' }}>Guardar</button>
        </form>

        <form onSubmit={handleUpdatePassword} style={{ ...cardStyle, minWidth: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: 800 }}>Contraseña</div>
          {securityMsg.text && (
            <div style={{ fontSize: '12px', borderRadius: '10px', padding: '10px 12px', background: securityMsg.type === 'success' ? '#E4F3DE' : '#F8DFDA', color: securityMsg.type === 'success' ? '#2E6B3A' : C.red }}>
              {securityMsg.text}
            </div>
          )}
          <div>
            <label htmlFor="newPassword" style={labelStyle}>Nueva contraseña</label>
            <input id="newPassword" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" required style={inputStyle} />
          </div>
          <div>
            <label htmlFor="confirmPassword" style={labelStyle}>Repite la contraseña</label>
            <input id="confirmPassword" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repite la contraseña" required style={inputStyle} />
          </div>
          <button type="submit" style={{ ...btnStyle, background: C.lime, color: C.ink, alignSelf: 'flex-start' }}>Cambiar contraseña</button>
        </form>
      </div>

      <div style={{ ...cardStyle, border: '1px solid #F2C9BE', background: '#FDF5F2' }}>
        <div style={{ fontSize: '14px', fontWeight: 800, color: C.red }}>Zona de riesgo</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '14px', padding: '14px 16px' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700 }}>Vaciar lista de seguimiento</div>
            <div style={{ fontSize: '11px', color: C.text2, marginTop: '2px' }}>Quita las {watchlistCount} acciones que sigues ahora mismo. No se puede deshacer.</div>
          </div>
          <button onClick={clearWatchlist} style={{ ...btnStyle, background: C.surface, border: `1px solid ${C.red}`, color: C.red }}>Vaciar</button>
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div style={{ width: '100%', minHeight: '100vh', boxSizing: 'border-box', background: C.bg, color: C.ink, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 'min(1200px, 92vw)', margin: '0 auto', padding: '32px 24px 96px', display: 'flex', flexDirection: 'column', gap: '18px', boxSizing: 'border-box' }}>
        <NewNav />
        <h1 style={{ margin: '4px 0 0', fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em' }}>Tu cuenta</h1>
        {children}
      </div>
    </div>
  );
}
