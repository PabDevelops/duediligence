'use client';
import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '../../../lib/supabase/client';
import { NEW_COLORS as C } from '../../components/new/theme';

const inputStyle = {
  padding: '11px 14px', borderRadius: '10px', border: `1px solid ${C.border}`, background: '#FDFBF6',
  color: C.ink, fontFamily: 'inherit', fontSize: '14px', outline: 'none', boxSizing: 'border-box', width: '100%',
};

export default function NewForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleReset = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setSent(true);
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
          <h1 style={{ margin: '0 0 6px', fontSize: '21px', fontWeight: 800, letterSpacing: '-0.02em' }}>Recupera tu contraseña</h1>
          <p style={{ margin: 0, fontSize: '13px', color: C.text2 }}>Te enviamos un enlace para crear una nueva</p>
        </div>

        {sent ? (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ fontSize: '28px', marginBottom: '12px' }}>✉️</div>
            <p style={{ color: C.text2, fontSize: '13px', lineHeight: 1.6, marginBottom: '20px' }}>
              Te hemos enviado las instrucciones a <strong>{email}</strong>.
            </p>
            <Link href="/sign-in" style={{
              display: 'block', width: '100%', padding: '11px', borderRadius: '10px', fontSize: '14px', fontWeight: 700,
              textDecoration: 'none', textAlign: 'center', boxSizing: 'border-box', background: C.lime, color: C.ink,
            }}>
              Volver a iniciar sesión
            </Link>
          </div>
        ) : (
          <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label htmlFor="email" style={{ fontSize: '12px', fontWeight: 700, color: C.text2 }}>Correo electrónico</label>
              <input id="email" type="email" required placeholder="tucorreo@ejemplo.com" value={email}
                onChange={e => setEmail(e.target.value)} style={inputStyle} />
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
              {loading ? 'Enviando…' : 'Enviar enlace'}
            </button>

            <div style={{ textAlign: 'center', marginTop: '8px' }}>
              <Link href="/sign-in" style={{ color: C.text2, fontSize: '13px', textDecoration: 'none' }}>← Volver a iniciar sesión</Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
