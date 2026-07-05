'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '../../components/AuthProvider';
import { createClient } from '../../../lib/supabase/client';

export default function WorkspaceSettings() {
  const router = useRouter();
  const { user, isLoaded, isSignedIn } = useUser();
  const [loading, setLoading] = useState(true);
  const [isPro, setIsPro] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { router.push('/sign-in'); return; }
    loadSettingsData();
  }, [isSignedIn, isLoaded]);

  const loadSettingsData = async () => {
    try {
      setLoading(true);
      const subRes = await fetch('/api/subscription');
      setIsPro((await subRes.json()).isPro || false);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
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

  if (!isLoaded || loading) return (
    <div style={{ padding: '40px', color: 'var(--ws-text-3)', fontSize: '13px' }}>Loading…</div>
  );

  const card = { border: '1px solid var(--ws-border)' };

  return (
    <div style={{ padding: '24px', maxWidth: '600px', margin: '0 auto' }}>

      <div style={{ border: '1px solid var(--ws-border)', background: 'var(--ws-bg-1)', marginBottom: '20px', overflow: 'hidden' }}>
        <div style={{ background: 'var(--ws-bg-2)', borderBottom: '1px solid var(--ws-border)', padding: '7px 16px' }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: 'var(--ws-accent)', fontWeight: 700, letterSpacing: '1px' }}>
            $ traq settings
          </span>
        </div>
        <div style={{ padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--ws-text)', marginBottom: '4px', letterSpacing: '-0.5px' }}>SETTINGS</h1>
            <p style={{ color: 'var(--ws-text-3)', fontSize: '11px' }}>{user?.email || 'User'} • Member since {user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}</p>
          </div>
          <button onClick={signOut}
            style={{ padding: '8px 16px', border: '1px solid var(--ws-border)', background: 'none', color: 'var(--ws-red)', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
            Sign out
          </button>
        </div>
      </div>

      <div style={{ ...card, padding: '18px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ color: 'var(--ws-text-3)', fontSize: '10px', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1.5px', fontWeight: 700, marginBottom: '4px' }}>PLAN</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '17px', fontWeight: 700, color: 'var(--ws-text)' }}>{isPro ? 'Pro' : 'Free'}</span>
            {isPro && <span style={{ background: 'var(--ws-accent-dim)', color: 'var(--ws-accent)', fontSize: '10px', fontWeight: 700, padding: '2px 8px' }}>ACTIVE</span>}
          </div>
          {!isPro && <div style={{ color: 'var(--ws-text-3)', fontSize: '12px', marginTop: '3px' }}>Upgrade to unlock Financials, DCF, Screener and Compare</div>}
        </div>
        {isPro ? (
          <button onClick={goToPortal} disabled={portalLoading}
            style={{ padding: '8px 16px', fontSize: '12px', fontWeight: 600, border: '1px solid var(--ws-border)', background: 'var(--ws-bg-1)', color: 'var(--ws-text)', cursor: portalLoading ? 'default' : 'pointer', opacity: portalLoading ? 0.5 : 1 }}>
            {portalLoading ? 'Loading…' : 'Manage subscription →'}
          </button>
        ) : (
          <a href="/pricing" style={{ padding: '8px 16px', fontSize: '12px', fontWeight: 600, background: 'var(--ws-text)', color: 'var(--ws-bg)', textDecoration: 'none' }}>Upgrade →</a>
        )}
      </div>

      <div style={{ ...card, padding: '18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ color: 'var(--ws-text-3)', fontSize: '10px', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1.5px', fontWeight: 700 }}>TERMINAL PREFERENCES</div>
        <div style={{ fontSize: '13px', color: 'var(--ws-text-2)' }}>No preferences to configure. Appearance theme can be toggled in the sidebar.</div>
      </div>

    </div>
  );
}
