'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '../../../lib/supabase/client';
import { NEW_COLORS as C } from '../../components/new/theme';

const inputStyle = {
  padding: '11px 14px', borderRadius: '10px', border: `1px solid ${C.border}`, background: '#FDFBF6',
  color: C.ink, fontFamily: 'inherit', fontSize: '14px', outline: 'none', boxSizing: 'border-box', width: '100%',
};

export default function NewResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return; }
    if (password !== confirmPassword) { setError('Las contraseñas no coinciden.'); return; }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setSuccess(true);
    setTimeout(() => { router.push('/'); router.refresh(); }, 2000);
  };

  return (
    <div style={{ width: '100%', minHeight: '100vh', boxSizing: 'border-box', background: C.bg, color: C.ink, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <Link href="/home" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', marginBottom: '28px' }}>
        <div aria-hidden="true" style={{ width: '32px', height: '32px', borderRadius: '9px', background: C.lime, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '5px', boxSizing: 'border-box' }}>
          <img src="/bulltrace-logos/bull-icon-black.png" alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
        <span style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.02em', color: C.ink }}>Bulltrace</span>
      </Link>

      <div style={{ width: '100%', maxWidth: '400px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '32px 28px', boxSizing: 'border-box' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h1 style={{ margin: '0 0 6px', fontSize: '21px', fontWeight: 800, letterSpacing: '-0.02em' }}>Elige una contraseña nueva</h1>
          <p style={{ margin: 0, fontSize: '13px', color: C.text2 }}>Para proteger tu cuenta</p>
        </div>

        {success ? (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ fontSize: '28px', marginBottom: '12px' }}>✅</div>
            <p style={{ color: C.text2, fontSize: '14px', lineHeight: 1.5, marginBottom: '8px', fontWeight: 700 }}>
              Contraseña actualizada
            </p>
            <p style={{ color: C.text3, fontSize: '12px' }}>Te llevamos a tu cuenta…</p>
          </div>
        ) : (
          <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label htmlFor="password" style={{ fontSize: '12px', fontWeight: 700, color: C.text2 }}>Nueva contraseña</label>
              <input id="password" type="password" required minLength={6} placeholder="••••••••" value={password}
                onChange={e => setPassword(e.target.value)} style={inputStyle} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label htmlFor="confirmPassword" style={{ fontSize: '12px', fontWeight: 700, color: C.text2 }}>Repite la contraseña</label>
              <input id="confirmPassword" type="password" required placeholder="••••••••" value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)} style={inputStyle} />
            </div>

            {error && (
              <div style={{ color: C.red, fontSize: '12px', background: '#F8DFDA', borderRadius: '10px', padding: '10px 12px', lineHeight: 1.4 }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '12px', borderRadius: '10px', fontSize: '14px', fontWeight: 700,
              background: C.lime, color: C.ink, border: 'none', cursor: 'pointer', marginTop: '4px',
            }}>
              {loading ? 'Actualizando…' : 'Actualizar contraseña'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
