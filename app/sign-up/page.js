'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabase/client';

export default function SignUpPage() {
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
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setLoading(false);
    if (error) { setError(error.message); return; }
    if (data.session) { router.push('/'); router.refresh(); return; }
    setSent(true);
  };

  const signUpWithGoogle = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Nunito, sans-serif', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '20%', left: '30%', width: '500px', height: '400px', background: 'radial-gradient(ellipse, rgba(167,139,250,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '20%', right: '25%', width: '350px', height: '300px', background: 'radial-gradient(ellipse, rgba(96,165,250,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div className="glass" style={{ width: '360px', padding: '32px', position: 'relative', zIndex: 1, color: 'var(--text)' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '20px', textAlign: 'center' }}>Create account</h1>

        {sent ? (
          <div style={{ textAlign: 'center', color: 'var(--text-2)', fontSize: '14px', lineHeight: 1.6 }}>
            Check your inbox at <strong>{email}</strong> to confirm your account.
          </div>
        ) : (
          <>
            <button onClick={signUpWithGoogle} type="button"
              style={{ width: '100%', padding: '11px', borderRadius: '10px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontFamily: 'Nunito, sans-serif', fontSize: '14px', fontWeight: 600, cursor: 'pointer', marginBottom: '16px' }}>
              Continue with Google
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '16px 0', color: 'var(--text-3)', fontSize: '12px' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
              or
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
            </div>

            <form onSubmit={signUp} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input type="email" required placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
                style={{ padding: '11px 14px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--text)', fontFamily: 'Nunito, sans-serif', fontSize: '14px' }} />
              <input type="password" required minLength={6} placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
                style={{ padding: '11px 14px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--text)', fontFamily: 'Nunito, sans-serif', fontSize: '14px' }} />

              {error && <div style={{ color: 'var(--red)', fontSize: '13px' }}>{error}</div>}

              <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', padding: '12px', borderRadius: '10px', marginTop: '4px' }}>
                {loading ? 'Creating account...' : 'Sign up'}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: '18px', fontSize: '13px', color: 'var(--text-3)' }}>
              Already have an account? <a href="/sign-in" style={{ color: 'var(--accent)' }}>Sign in</a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
