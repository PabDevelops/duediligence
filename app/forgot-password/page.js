'use client';
import { useState } from 'react';
import { createClient } from '../../lib/supabase/client';
import Link from 'next/link';

export default function ForgotPasswordPage() {
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
    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
  };

  return (
    <div className="workspace" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: '20px', boxSizing: 'border-box' }}>
      <div style={{ border: '1px solid var(--ws-border)', background: 'var(--ws-bg-1)', width: '100%', maxWidth: '400px', borderRadius: '4px', overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,0.12)' }}>
        
        {/* Terminal Header */}
        <div style={{ background: 'var(--ws-bg-2)', borderBottom: '1px solid var(--ws-border)', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: 'var(--ws-accent)', fontWeight: 700, letterSpacing: '1px' }}>
            $ traq recover-password
          </span>
          <div style={{ display: 'flex', gap: '6px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--ws-border)' }} />
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--ws-border)' }} />
          </div>
        </div>

        <div style={{ padding: '32px 24px' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <h1 style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.5px', marginBottom: '6px', color: 'var(--ws-text)' }}>Reset Password</h1>
            <p style={{ color: 'var(--ws-text-3)', fontSize: '12px' }}>Enter your email to receive a recovery link</p>
          </div>

          {sent ? (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <div style={{ fontSize: '28px', marginBottom: '12px' }}>✉️</div>
              <p style={{ color: 'var(--ws-text-2)', fontSize: '13px', lineHeight: 1.5, marginBottom: '20px' }}>
                Instructions have been sent to <strong>{email}</strong>.
              </p>
              <Link href="/sign-in" 
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
                Back to Sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label htmlFor="email" style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ws-text-2)' }}>EMAIL ADDRESS</label>
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
                {loading ? 'Sending link...' : 'Send reset link'}
              </button>

              <div style={{ textAlign: 'center', marginTop: '12px' }}>
                <Link href="/sign-in" style={{ color: 'var(--ws-text-3)', fontSize: '12px', textDecoration: 'none' }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--ws-text)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--ws-text-3)'}>
                  ← Back to sign in
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
