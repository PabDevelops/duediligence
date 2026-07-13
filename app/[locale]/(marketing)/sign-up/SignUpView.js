'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../../../lib/supabase/client';
import Link from 'next/link';
import { localizeHref } from '../../../../lib/i18n/locale';

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" style={{ marginRight: '10px', flexShrink: 0 }}>
    <path fill="#EA4335" d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.68 1.54 14.98 1 12 1 7.35 1 3.37 3.68 1.48 7.58l3.86 3C6.26 7.58 8.92 5.04 12 5.04z" />
    <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.46c-.28 1.48-1.12 2.74-2.38 3.58l3.7 2.87c2.16-1.99 3.41-4.91 3.41-8.6z" />
    <path fill="#FBBC05" d="M5.34 14.29c-.24-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29L1.48 6.7C.53 8.6 0 10.74 0 13s.53 4.4 1.48 6.3l3.86-3.01z" />
    <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.7-2.87c-1.03.69-2.35 1.1-4.26 1.1-3.08 0-5.74-2.54-6.66-5.54l-3.86 3C3.37 20.32 7.35 23 12 23z" />
  </svg>
);

export default function SignUpView({ dict, locale }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const t = dict.signUp;

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
    if (data.session) { router.push(localizeHref('/', locale)); router.refresh(); return; }
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
    <div className="workspace" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: '20px', boxSizing: 'border-box' }}>
      <div style={{ border: '1px solid var(--ws-border)', background: 'var(--ws-bg-1)', width: '100%', maxWidth: '400px', borderRadius: '4px', overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,0.12)' }}>

        {/* Terminal Header */}
        <div style={{ background: 'var(--ws-bg-2)', borderBottom: '1px solid var(--ws-border)', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: 'var(--ws-accent)', fontWeight: 700, letterSpacing: '1px' }}>
            {t.windowTitle}
          </span>
          <div style={{ display: 'flex', gap: '6px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--ws-border)' }} />
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--ws-border)' }} />
          </div>
        </div>

        <div style={{ padding: '32px 24px' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <h1 style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.5px', marginBottom: '6px', color: 'var(--ws-text)' }}>{t.title}</h1>
            <p style={{ color: 'var(--ws-text-3)', fontSize: '12px' }}>{t.subtitle}</p>
          </div>

          {sent ? (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <div style={{ fontSize: '28px', marginBottom: '12px' }}>✉️</div>
              <p style={{ color: 'var(--ws-text-2)', fontSize: '13px', lineHeight: 1.5, marginBottom: '20px' }}>
                {t.checkInbox} <strong>{email}</strong> {t.checkInboxSuffix}
              </p>
              <Link href={localizeHref('/sign-in', locale)}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '10px',
                  borderRadius: '4px',
                  fontSize: '13px',
                  fontWeight: 700,
                  textDecoration: 'none',
                  textAlign: 'center',
                  boxSizing: 'border-box',
                  background: 'var(--ws-accent)',
                  color: 'var(--ws-bg-1)'
                }}>
                {t.goToSignIn}
              </Link>
            </div>
          ) : (
            <>
              {/* Google Sign In */}
              <button onClick={signUpWithGoogle} type="button"
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '4px',
                  border: '1px solid var(--ws-border)',
                  background: 'var(--ws-bg-2)',
                  color: 'var(--ws-text)',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background-color 0.15s ease'
                }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--ws-border)'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--ws-bg-2)'; }}
              >
                <GoogleIcon />
                {t.google}
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', color: 'var(--ws-text-3)', fontSize: '11px', fontWeight: 500 }}>
                <div style={{ flex: 1, height: '1px', background: 'var(--ws-border)' }} />
                <span>{t.or}</span>
                <div style={{ flex: 1, height: '1px', background: 'var(--ws-border)' }} />
              </div>

              {/* Form */}
              <form onSubmit={signUp} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label htmlFor="email" style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ws-text-2)' }}>{t.emailLabel}</label>
                  <input
                    id="email"
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '4px',
                      border: '1px solid var(--ws-border)',
                      background: 'var(--ws-bg-2)',
                      color: 'var(--ws-text)',
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '13px',
                      outline: 'none',
                      transition: 'border-color 0.15s ease',
                    }}
                    onFocus={e => {
                      e.target.style.borderColor = 'var(--ws-accent)';
                    }}
                    onBlur={e => {
                      e.target.style.borderColor = 'var(--ws-border)';
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label htmlFor="password" style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ws-text-2)' }}>{t.passwordLabel}</label>
                  <input
                    id="password"
                    type="password"
                    required
                    minLength={6}
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '4px',
                      border: '1px solid var(--ws-border)',
                      background: 'var(--ws-bg-2)',
                      color: 'var(--ws-text)',
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '13px',
                      outline: 'none',
                      transition: 'border-color 0.15s ease',
                    }}
                    onFocus={e => {
                      e.target.style.borderColor = 'var(--ws-accent)';
                    }}
                    onBlur={e => {
                      e.target.style.borderColor = 'var(--ws-border)';
                    }}
                  />
                </div>

                {error && (
                  <div style={{
                    color: 'var(--ws-red)',
                    fontSize: '12px',
                    background: 'rgba(239, 68, 68, 0.05)',
                    border: '1px solid var(--ws-border)',
                    padding: '10px 12px',
                    borderRadius: '4px',
                    lineHeight: 1.4
                  }}>
                    {error}
                  </div>
                )}

                <button type="submit" disabled={loading}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '4px',
                    fontSize: '13px',
                    fontWeight: 700,
                    background: 'var(--ws-accent)',
                    color: 'var(--ws-bg-1)',
                    border: 'none',
                    cursor: 'pointer',
                    marginTop: '4px'
                  }}>
                  {loading ? t.submitLoading : t.submit}
                </button>
              </form>

              <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '13px', color: 'var(--ws-text-3)' }}>
                {t.hasAccount} <Link href={localizeHref('/sign-in', locale)} style={{ color: 'var(--ws-accent)', fontWeight: 600, textDecoration: 'none' }}
                  onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                  onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}>{t.signInLink}</Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
