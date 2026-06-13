'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { SignOutButton } from '@clerk/nextjs';
import Topbar from '../components/Topbar';

export default function ProfilePage() {
  const router = useRouter();
  const { user, isLoaded, isSignedIn } = useUser();
  const [watchlist, setWatchlist] = useState([]);
  const [sotwVotes, setSotwVotes] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.push('/sign-in');
      return;
    }
    loadProfileData();
  }, [isSignedIn, isLoaded]);

  const loadProfileData = async () => {
    try {
      setLoading(true);
      // Load watchlist
      const wlRes = await fetch('/api/watchlist');
      const wlData = await wlRes.json();
      setWatchlist(wlData.stocks || []);

      // Load SOTW votes (from votes table - user's votes across all tickers)
      // TODO: Create endpoint /api/user-votes
      
      // Load achievements
      if (user?.id) {
        const achievRes = await fetch(`/api/achievements?userId=${user.id}`);
        const achievData = await achievRes.json();
        setAchievements(achievData.achievements || []);
      }
    } catch (e) {
      console.error('Error loading profile:', e);
    } finally {
      setLoading(false);
    }
  };

  if (!isLoaded || loading) {
    return (
      <div style={{ background: 'var(--bg)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)' }}>
        <Topbar />
        <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', fontFamily: 'JetBrains Mono, monospace' }}>
      <Topbar />
      
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px' }}>
        {/* Header */}
        <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-3)', letterSpacing: '2px', marginBottom: '12px' }}>YOUR PROFILE</div>
            <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>
              {user?.firstName || user?.emailAddresses?.[0]?.emailAddress || 'User'}
            </h1>
            <p style={{ color: 'var(--text-2)', fontSize: '12px' }}>
              Member since {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}
            </p>
          </div>
          {isSignedIn && (
            <SignOutButton redirectUrl="/">
              <button style={{
                padding: '10px 16px',
                borderRadius: '8px',
                border: '1px solid var(--red)',
                background: 'transparent',
                color: 'var(--red)',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600,
                fontFamily: 'Space Grotesk, sans-serif',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'var(--red-dim)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent';
              }}>
                Sign out
              </button>
            </SignOutButton>
          )}
        </div>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile => isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '12px', marginBottom: '32px' }}>
          <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px' }}>
            <div style={{ color: 'var(--text-3)', fontSize: '10px', letterSpacing: '1px', marginBottom: '8px' }}>WATCHLIST STOCKS</div>
            <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '24px', fontWeight: 700, color: 'var(--accent)' }}>
              {watchlist.length}
            </div>
          </div>
          
          <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px' }}>
            <div style={{ color: 'var(--text-3)', fontSize: '10px', letterSpacing: '1px', marginBottom: '8px' }}>SOTW VOTES</div>
            <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '24px', fontWeight: 700, color: 'var(--accent)' }}>
              {sotwVotes.length}
            </div>
          </div>

          <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px' }}>
            <div style={{ color: 'var(--text-3)', fontSize: '10px', letterSpacing: '1px', marginBottom: '8px' }}>ACHIEVEMENTS</div>
            <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '24px', fontWeight: 700, color: 'var(--accent)' }}>
              {achievements.length}
            </div>
          </div>
        </div>

        {/* Watchlist section */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-3)', letterSpacing: '2px', marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
            WATCHLIST ({watchlist.length})
          </div>
          {watchlist.length === 0 ? (
            <div style={{ color: 'var(--text-3)', fontSize: '12px', padding: '20px', textAlign: 'center', background: 'var(--bg-1)', borderRadius: '12px' }}>
              No stocks in your watchlist yet
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px' }}>
              {watchlist.map(ticker => (
                <button key={ticker} onClick={() => router.push(`/stock/${ticker}`)}
                  style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', textAlign: 'center', cursor: 'pointer', color: 'var(--accent)', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '14px' }}>
                  {ticker}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* SOTW Votes section */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-3)', letterSpacing: '2px', marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
            STOCK OF THE WEEK VOTES ({sotwVotes.length})
          </div>
          {sotwVotes.length === 0 ? (
            <div style={{ color: 'var(--text-3)', fontSize: '12px', padding: '20px', textAlign: 'center', background: 'var(--bg-1)', borderRadius: '12px' }}>
              No SOTW votes yet
            </div>
          ) : (
            <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
              {/* Table headers */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr', gap: '0', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)' }}>
                <div style={{ padding: '12px 16px', fontSize: '10px', color: 'var(--text-3)', fontWeight: 600, letterSpacing: '1px' }}>TICKER</div>
                <div style={{ padding: '12px 16px', fontSize: '10px', color: 'var(--text-3)', fontWeight: 600, letterSpacing: '1px' }}>YOUR VOTE</div>
                <div style={{ padding: '12px 16px', fontSize: '10px', color: 'var(--text-3)', fontWeight: 600, letterSpacing: '1px' }}>DATE</div>
              </div>
              {/* Rows */}
              {sotwVotes.map((vote, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr', gap: '0', borderBottom: i < sotwVotes.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--accent)', fontWeight: 600 }}>{vote.ticker}</div>
                  <div style={{ padding: '12px 16px', fontSize: '12px', color: vote.vote === 'BUY' ? 'var(--green)' : vote.vote === 'SELL' ? 'var(--red)' : 'var(--amber)' }}>
                    {vote.vote}
                  </div>
                  <div style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-3)' }}>
                    {vote.date ? new Date(vote.date).toLocaleDateString() : '—'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Achievements section */}
        <div>
          <div style={{ fontSize: '11px', color: 'var(--text-3)', letterSpacing: '2px', marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
            ACHIEVEMENTS ({achievements.length})
          </div>
          {achievements.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
              {achievements.map(ach => (
                <div key={ach.id} style={{ 
                  background: 'var(--bg-1)', 
                  border: '1px solid var(--border)', 
                  borderRadius: '12px', 
                  padding: '16px', 
                  textAlign: 'center',
                  transition: 'all 0.2s'
                }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'var(--accent)';
                    e.currentTarget.style.background = 'rgba(167, 139, 250, 0.05)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.background = 'var(--bg-1)';
                  }}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>{ach.icon}</div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>{ach.title}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-3)', lineHeight: 1.4 }}>{ach.description}</div>
                  {ach.rarity === 'uncommon' && (
                    <div style={{ fontSize: '9px', color: 'var(--accent)', marginTop: '8px', letterSpacing: '1px' }}>⚡ RARE</div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: 'var(--text-3)', fontSize: '12px', padding: '20px', textAlign: 'center', background: 'var(--bg-1)', borderRadius: '12px', border: '1px solid var(--border)' }}>
              🎯 Vote on stocks to unlock achievements
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
