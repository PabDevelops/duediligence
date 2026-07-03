'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '../components/AuthProvider';
import { createClient } from '../../lib/supabase/client';
import Topbar from '../components/Topbar';

export default function ProfilePage() {
  const router = useRouter();
  const { user, isLoaded, isSignedIn } = useUser();
  const [watchlist, setWatchlist] = useState([]);
  const [sotwVotes, setSotwVotes] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isPro, setIsPro] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { router.push('/sign-in'); return; }
    loadProfileData();
  }, [isSignedIn, isLoaded]);

  const loadProfileData = async () => {
    try {
      setLoading(true);
      const [wlRes, votesRes, achievRes, subRes] = await Promise.all([
        fetch('/api/watchlist'), fetch('/api/votes'),
        fetch(`/api/achievements?userId=${user.id}`), fetch('/api/subscription'),
      ]);
      setWatchlist((await wlRes.json()).tickers || []);
      setSotwVotes((await votesRes.json()).votes || []);
      setAchievements((await achievRes.json()).achievements || []);
      setIsPro((await subRes.json()).isPro || false);
    } catch (e) { console.error(e); } finally { setLoading(false); }
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
    } finally { setPortalLoading(false); }
  };

  if (!isLoaded || loading) return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)', fontFamily: 'Nunito, sans-serif' }}>
      <Topbar />
      <div style={{ color: 'var(--text-3)', fontSize: '14px' }}>Loading...</div>
    </div>
  );

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', fontFamily: 'Nunito, sans-serif' }}>
      <Topbar />
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 16px', paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}>

        {/* Header */}
        <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--accent)', letterSpacing: '2px', marginBottom: '8px', fontWeight: 700 }}>YOUR PROFILE</div>
            <h1 style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-0.5px', marginBottom: '6px' }}>
              {user?.email || 'User'}
            </h1>
            <p style={{ color: 'var(--text-3)', fontSize: '13px' }}>
              Member since {user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
            </p>
          </div>
          {isSignedIn && (
            <button onClick={signOut}
              style={{ padding: '10px 18px', borderRadius: '10px', border: '1px solid rgba(248,113,113,0.4)', background: 'transparent', color: 'var(--red)', cursor: 'pointer', fontSize: '13px', fontWeight: 600, fontFamily: 'Nunito, sans-serif', transition: 'all 0.2s', flexShrink: 0 }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--red-dim)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              Sign out
            </button>
          )}
        </div>

        {/* Subscription */}
        <div className="glass" style={{ padding: '24px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', borderColor: isPro ? 'rgba(167,139,250,0.4)' : undefined }}>
          <div>
            <div style={{ color: 'var(--text-3)', fontSize: '11px', letterSpacing: '1px', marginBottom: '6px', fontWeight: 700 }}>PLAN</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '22px', fontWeight: 800 }}>{isPro ? 'Pro' : 'Free'}</span>
              {isPro && <span style={{ background: 'linear-gradient(135deg, #a78bfa, #60a5fa)', color: '#000', fontSize: '10px', fontWeight: 800, padding: '2px 10px', borderRadius: '20px' }}>ACTIVE</span>}
            </div>
            {!isPro && <div style={{ color: 'var(--text-3)', fontSize: '13px', marginTop: '4px' }}>Upgrade to unlock Financials, DCF, Screener and Compare</div>}
          </div>
          {isPro ? (
            <button onClick={goToPortal} disabled={portalLoading} className="btn-secondary"
              style={{ opacity: portalLoading ? 0.5 : 1, cursor: portalLoading ? 'default' : 'pointer' }}>
              {portalLoading ? 'Loading...' : 'Manage subscription →'}
            </button>
          ) : (
            <a href="/pricing" className="btn-primary">Upgrade →</a>
          )}
        </div>

        {/* Stats grid */}
        <div className="profile-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
          {[
            { label: 'WATCHLIST', val: watchlist.length },
            { label: 'VOTES', val: sotwVotes.length },
            { label: 'ACHIEVEMENTS', val: achievements.length },
          ].map(s => (
            <div key={s.label} className="glass" style={{ padding: '20px' }}>
              <div style={{ color: 'var(--text-3)', fontSize: '10px', letterSpacing: '1px', marginBottom: '8px', fontWeight: 700 }}>{s.label}</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--accent)' }}>{s.val}</div>
            </div>
          ))}
        </div>

        {/* Watchlist section */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-3)', letterSpacing: '2px', marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid var(--border)', fontWeight: 700 }}>
            WATCHLIST ({watchlist.length})
          </div>
          {watchlist.length === 0 ? (
            <div className="glass" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-3)', fontSize: '14px' }}>
              No stocks in your watchlist yet
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '10px' }}>
              {watchlist.map(item => (
                <button key={item.ticker} onClick={() => router.push(`/stock/${item.ticker}`)}
                  className="glass"
                  style={{ padding: '16px', textAlign: 'center', cursor: 'pointer', color: 'var(--accent)', fontWeight: 800, fontSize: '15px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)', borderRadius: '12px' }}>
                  {item.ticker}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* SOTW Votes */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-3)', letterSpacing: '2px', marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid var(--border)', fontWeight: 700 }}>
            STOCK OF THE WEEK VOTES ({sotwVotes.length})
          </div>
          {sotwVotes.length === 0 ? (
            <div className="glass" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-3)', fontSize: '14px' }}>No SOTW votes yet</div>
          ) : (
            <div className="glass" style={{ overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr', borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.03)' }}>
                {['TICKER', 'VOTE', 'DATE'].map(h => (
                  <div key={h} style={{ padding: '12px 16px', fontSize: '10px', color: 'var(--text-3)', fontWeight: 700, letterSpacing: '1px' }}>{h}</div>
                ))}
              </div>
              {sotwVotes.map((vote, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr', borderBottom: i < sotwVotes.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--accent)', fontWeight: 700 }}>{vote.ticker}</div>
                  <div style={{ padding: '12px 16px', fontSize: '13px', color: vote.vote === 'BUY' ? 'var(--green)' : vote.vote === 'SELL' ? 'var(--red)' : 'var(--amber)', fontWeight: 600 }}>{vote.vote}</div>
                  <div style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-3)' }}>{vote.created_at ? new Date(vote.created_at).toLocaleDateString() : '—'}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Achievements */}
        <div>
          <div style={{ fontSize: '11px', color: 'var(--text-3)', letterSpacing: '2px', marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid var(--border)', fontWeight: 700 }}>
            ACHIEVEMENTS ({achievements.length})
          </div>
          {achievements.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
              {achievements.map(ach => (
                <div key={ach.id} className="glass" style={{ padding: '20px', textAlign: 'center', cursor: 'default' }}>
                  <div style={{ fontSize: '36px', marginBottom: '10px' }}>{ach.icon}</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', marginBottom: '4px' }}>{ach.title}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-3)', lineHeight: 1.5 }}>{ach.description}</div>
                  {ach.rarity === 'uncommon' && (
                    <div style={{ fontSize: '10px', color: 'var(--accent)', marginTop: '8px', fontWeight: 700 }}>⚡ RARE</div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="glass" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-3)', fontSize: '14px' }}>
              🎯 Vote on stocks to unlock achievements
            </div>
          )}
        </div>
      </div>

      <style>{`@media (max-width: 767px) { .profile-stats-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}
