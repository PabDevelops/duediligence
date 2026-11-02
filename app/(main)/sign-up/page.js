'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '../../../lib/supabase/client';
import { NEW_COLORS as C } from '../../components/new/theme';

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" style={{ marginRight: '10px', flexShrink: 0 }}>
    <path fill="#EA4335" d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.68 1.54 14.98 1 12 1 7.35 1 3.37 3.68 1.48 7.58l3.86 3C6.26 7.58 8.92 5.04 12 5.04z" />
    <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.46c-.28 1.48-1.12 2.74-2.38 3.58l3.7 2.87c2.16-1.99 3.41-4.91 3.41-8.6z" />
    <path fill="#FBBC05" d="M5.34 14.29c-.24-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29L1.48 6.7C.53 8.6 0 10.74 0 13s.53 4.4 1.48 6.3l3.86-3.01z" />
    <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.7-2.87c-1.03.69-2.35 1.1-4.26 1.1-3.08 0-5.74-2.54-6.66-5.54l-3.86 3C3.37 20.32 7.35 23 12 23z" />
  </svg>
);

const inputStyle = {
  padding: '11px 14px', borderRadius: '10px', border: `1px solid ${C.border}`, background: '#FDFBF6',
  color: C.ink, fontFamily: 'inherit', fontSize: '14px', outline: 'none', boxSizing: 'border-box', width: '100%',
};

export default function NewSignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const signUp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/home` },
    });
    setLoading(false);
    if (error) { setError(error.message); return; }
    if (data.session) { router.push('/home'); router.refresh(); return; }
    setSent(true);
  };

  const signUpWithGoogle = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/home` },
    });
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
          <h1 style={{ margin: '0 0 6px', fontSize: '21px', fontWeight: 800, letterSpacing: '-0.02em' }}>Crea tu cuenta</h1>
          <p style={{ margin: 0, fontSize: '13px', color: C.text2 }}>Gratis, sin necesidad de tarjeta</p>
        </div>

        {sent ? (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ fontSize: '28px', marginBottom: '12px' }}>✉️</div>
            <p style={{ color: C.text2, fontSize: '13px', lineHeight: 1.6, marginBottom: '20px' }}>
              Te hemos enviado un enlace de confirmación a <strong>{email}</strong>. Revisa tu bandeja de entrada para activar la cuenta.
            </p>
            <Link href="/sign-in" style={{
              display: 'block', width: '100%', padding: '11px', borderRadius: '10px', fontSize: '14px', fontWeight: 700,
              textDecoration: 'none', textAlign: 'center', boxSizing: 'border-box', background: C.lime, color: C.ink,
            }}>
              Ir a iniciar sesión
            </Link>
          </div>
        ) : (
          <>
            <button onClick={signUpWithGoogle} type="button" style={{
              width: '100%', padding: '11px', borderRadius: '10px', border: `1px solid ${C.border}`, background: '#FDFBF6',
              color: C.ink, fontFamily: 'inherit', fontSize: '13px', fontWeight: 700, cursor: 'pointer', marginBottom: '16px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <GoogleIcon />
              Continuar con Google
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', color: C.text3, fontSize: '11px', fontWeight: 700 }}>
              <div style={{ flex: 1, height: '1px', background: C.border }} />
              <span>O</span>
              <div style={{ flex: 1, height: '1px', background: C.border }} />
            </div>

            <form onSubmit={signUp} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label htmlFor="email" style={{ fontSize: '12px', fontWeight: 700, color: C.text2 }}>Correo electrónico</label>
                <input id="email" type="email" required placeholder="tucorreo@ejemplo.com" value={email}
                  onChange={e => setEmail(e.target.value)} style={inputStyle} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label htmlFor="password" style={{ fontSize: '12px', fontWeight: 700, color: C.text2 }}>Contraseña</label>
                <input id="password" type="password" required minLength={6} placeholder="••••••••" value={password}
                  onChange={e => setPassword(e.target.value)} style={inputStyle} />
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
                {loading ? 'Creando cuenta…' : 'Crear cuenta'}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: '22px', fontSize: '13px', color: C.text2 }}>
              ¿Ya tienes cuenta? <Link href="/sign-in" style={{ color: C.ink, fontWeight: 700, textDecoration: 'none' }}>Inicia sesión</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
