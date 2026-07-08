'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '../../components/AuthProvider';
import { createClient } from '../../../lib/supabase/client';

const ACCENT_COLORS = [
  { name: 'Classic Mint', hex: '#0f766e' },
  { name: 'Cyber Teal', hex: '#14b8a6' },
  { name: 'Emerald Green', hex: '#10b981' },
  { name: 'Amber Gold', hex: '#f59e0b' },
  { name: 'Retro Indigo', hex: '#6366f1' },
  { name: 'Rose Red', hex: '#f43f5e' },
];

export default function WorkspaceProfile() {
  const router = useRouter();
  const { user, isLoaded, isSignedIn } = useUser();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [isPro, setIsPro] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  // Profile forms state
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileMsg, setProfileMsg] = useState({ type: '', text: '' });
  const [securityMsg, setSecurityMsg] = useState({ type: '', text: '' });

  // Customization state
  const [accentColor, setAccentColor] = useState('#0f766e');
  const [fontSize, setFontSize] = useState('normal');
  const [scanlines, setScanlines] = useState(false);

  // API Token state
  const [apiToken, setApiToken] = useState('');
  const [copiedToken, setCopiedToken] = useState(false);

  // Stats
  const [holdingsCount, setHoldingsCount] = useState(0);
  const [watchlistCount, setWatchlistCount] = useState(0);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.push('/sign-in');
      return;
    }

    // Load initial values
    setDisplayName(user.user_metadata?.full_name || localStorage.getItem('traq_user_fullname') || '');
    
    // Load saved preferences
    setAccentColor(localStorage.getItem('ws_accent_color') || '#0f766e');
    setFontSize(localStorage.getItem('ws_font_size') || 'normal');
    setScanlines(localStorage.getItem('ws_scanlines') === 'true');

    // Load saved fake API token or generate one if missing
    let token = localStorage.getItem('traq_api_token');
    if (!token) {
      token = 'traq_live_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('traq_api_token', token);
    }
    setApiToken(token);

    // Fetch subscription status
    fetch('/api/subscription')
      .then(r => r.json())
      .then(data => {
        setIsPro(data?.isPro || false);
      })
      .catch(err => console.error('Error fetching subscription status:', err));

    // Fetch portfolio holdings
    fetch('/api/portfolio')
      .then(r => r.json())
      .then(data => {
        setHoldingsCount((data?.holdings || []).length);
      })
      .catch(err => console.error('Error fetching portfolio holdings:', err));

    // Fetch watchlist tickers
    fetch('/api/watchlist')
      .then(r => r.json())
      .then(data => {
        setWatchlistCount((data?.tickers || []).length);
      })
      .catch(err => console.error('Error fetching watchlist:', err))
      .finally(() => setLoading(false));

  }, [isSignedIn, isLoaded]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileMsg({ type: '', text: '' });
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: displayName }
      });
      if (error) throw error;
      localStorage.setItem('traq_user_fullname', displayName);
      setProfileMsg({ type: 'success', text: 'Display name updated successfully!' });
      window.dispatchEvent(new Event('ws-settings-changed'));
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.message || 'Failed to update profile.' });
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setSecurityMsg({ type: '', text: '' });
    if (password !== confirmPassword) {
      setSecurityMsg({ type: 'error', text: 'Passwords do not match.' });
      return;
    }
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSecurityMsg({ type: 'success', text: 'Password updated successfully!' });
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      setSecurityMsg({ type: 'error', text: err.message || 'Failed to update password.' });
    }
  };

  const signOut = async () => {
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

  // Live styling updates for customization
  const changeAccent = (color) => {
    setAccentColor(color);
    localStorage.setItem('ws_accent_color', color);
    document.documentElement.style.setProperty('--ws-accent', color);
    const dim = color.startsWith('#')
      ? `rgba(${parseInt(color.slice(1,3),16)}, ${parseInt(color.slice(3,5),16)}, ${parseInt(color.slice(5,7),16)}, 0.12)`
      : color;
    document.documentElement.style.setProperty('--ws-accent-dim', dim);
    window.dispatchEvent(new Event('ws-settings-changed'));
  };

  const changeFontSize = (size) => {
    setFontSize(size);
    localStorage.setItem('ws_font_size', size);
    const fs = size === 'compact' ? '12px' : size === 'large' ? '16px' : '14px';
    document.documentElement.style.fontSize = fs;
    window.dispatchEvent(new Event('ws-settings-changed'));
  };

  const toggleScanlines = () => {
    const nextVal = !scanlines;
    setScanlines(nextVal);
    localStorage.setItem('ws_scanlines', String(nextVal));
    window.dispatchEvent(new Event('ws-settings-changed'));
  };

  const rotateApiToken = () => {
    const token = 'traq_live_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('traq_api_token', token);
    setApiToken(token);
  };

  const copyTokenToClipboard = () => {
    navigator.clipboard.writeText(apiToken);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  // Danger Zone Wipes
  const clearPortfolio = async () => {
    if (!confirm('WARNING: Are you sure you want to delete all portfolio holdings? This action is permanent.')) return;
    try {
      const { error } = await supabase.from('portfolio_holdings').delete().eq('user_id', user.id);
      if (error) throw error;
      setHoldingsCount(0);
      alert('Portfolio holdings cleared successfully.');
    } catch (err) {
      alert('Failed to clear portfolio holdings: ' + err.message);
    }
  };

  const clearWatchlist = async () => {
    if (!confirm('WARNING: Are you sure you want to delete all tickers from your watchlist? This action is permanent.')) return;
    try {
      const { error } = await supabase.from('watchlists').delete().eq('user_id', user.id);
      if (error) throw error;
      setWatchlistCount(0);
      alert('Watchlist cleared successfully.');
    } catch (err) {
      alert('Failed to clear watchlist: ' + err.message);
    }
  };

  if (!isLoaded || loading) return (
    <div style={{ padding: '24px', fontFamily: "'JetBrains Mono', monospace" }}>
      <div style={{ border: '1px solid var(--ws-border)', background: 'var(--ws-bg-1)', overflow: 'hidden' }}>
        <div style={{ background: 'var(--ws-bg-2)', borderBottom: '1px solid var(--ws-border)', padding: '7px 16px' }}>
          <span style={{ fontSize: '11px', color: 'var(--ws-accent)', fontWeight: 700, letterSpacing: '1px' }}>$ loading profile...</span>
        </div>
        <div style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: 'var(--ws-accent)', fontSize: '11px' }}>▶</span>
            <span style={{ color: 'var(--ws-text-3)', fontSize: '11px', letterSpacing: '1px' }}>INITIALIZING PROFILE WORKSPACE...</span>
          </div>
        </div>
      </div>
    </div>
  );



  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', boxSizing: 'border-box' }}>
      
      {/* 1. Header Card */}
      <div style={{
        background: 'var(--ws-bg-1)',
        border: '1px solid var(--ws-border)',
        padding: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '24px',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.01)'
      }}>
        {/* Background Glow */}
        <div style={{
          position: 'absolute',
          top: '-10%',
          right: '-5%',
          width: '300px',
          height: '300px',
          background: 'radial-gradient(circle, var(--ws-accent-dim) 0%, transparent 70%)',
          pointerEvents: 'none',
          opacity: 0.3
        }} />

        {/* User identity details */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', zIndex: 1 }}>
          <div style={{
            width: '64px',
            height: '64px',
            background: 'linear-gradient(135deg, #a78bfa, #60a5fa)',
            color: '#fff',
            fontSize: '26px',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid var(--ws-bg-1)'
          }}>
            {user?.email?.[0]?.toUpperCase() || '?'}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--ws-text)', margin: 0 }}>
                {displayName || user?.email?.split('@')[0]}
              </h1>
              <span style={{
                background: isPro ? 'var(--ws-accent-dim)' : 'var(--ws-bg-2)',
                color: isPro ? 'var(--ws-accent)' : 'var(--ws-text-3)',
                border: `1px solid ${isPro ? 'var(--ws-accent)' : 'var(--ws-border)'}`,
                fontSize: '9px',
                fontWeight: 800,
                padding: '2px 8px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                {isPro ? '★ Pro Member' : 'Free Account'}
              </span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--ws-text-2)', marginTop: '4px' }}>
              {user?.email} • Member since {user?.created_at ? new Date(user.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
            </div>
          </div>
        </div>

        {/* Global Stats info */}
        <div style={{ display: 'flex', gap: '16px', zIndex: 1, flexWrap: 'wrap' }}>
          {[
            { label: 'Portfolio Assets', count: holdingsCount, color: 'var(--ws-accent)' },
            { label: 'Watchlist Tickers', count: watchlistCount, color: '#a78bfa' }
          ].map((stat, i) => (
            <div key={i} style={{
              background: 'var(--ws-bg-2)',
              border: '1px solid var(--ws-border)',
              padding: '10px 18px',
              minWidth: '120px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '8px', fontWeight: 700, color: 'var(--ws-text-3)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' }}>
                {stat.label}
              </div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: stat.color, fontFamily: "'JetBrains Mono', monospace" }}>
                {stat.count}
              </div>
            </div>
          ))}
          <button onClick={signOut}
            style={{ padding: '0 16px', height: '44px', alignSelf: 'center', border: '1px solid var(--ws-border)', background: 'var(--ws-bg-1)', color: 'var(--ws-red)', cursor: 'pointer', fontSize: '12px', fontWeight: 700, transition: 'all 0.15s ease' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--ws-red)'; e.currentTarget.style.background = 'rgba(239, 68, 68, 0.05)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--ws-border)'; e.currentTarget.style.background = 'var(--ws-bg-1)'; }}>
            Sign Out
          </button>
        </div>
      </div>

      {/* 2. Main Two-Column Settings Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', alignItems: 'start' }}>
        
        {/* Left Column: Account, Security, Plan */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Plan / Subscription Details */}
          <div className="ws-card">
            <div style={{ borderBottom: '1px solid var(--ws-border)', paddingBottom: '10px' }}>
              <div className="ws-label">Subscription & Billing</div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--ws-text)' }}>
                  {isPro ? 'Traqcker Pro Plan' : 'Traqcker Free Tier'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--ws-text-3)', marginTop: '2px' }}>
                  {isPro ? 'You have full institutional terminal access.' : 'Upgrade to unlock global screening, financials, DCF models, and backtesting.'}
                </div>
              </div>
              {isPro ? (
                <button onClick={goToPortal} disabled={portalLoading}
                  className="ws-btn-secondary" style={{ opacity: portalLoading ? 0.5 : 1 }}>
                  {portalLoading ? 'Loading...' : 'Manage Subscription →'}
                </button>
              ) : (
                <a href="/pricing" className="ws-btn">Upgrade to Pro →</a>
              )}
            </div>
          </div>

          {/* Account Profile Form */}
          <form onSubmit={handleUpdateProfile} className="ws-card">
            <div style={{ borderBottom: '1px solid var(--ws-border)', paddingBottom: '10px' }}>
              <div className="ws-label">General Account</div>
            </div>

            {profileMsg.text && (
              <div style={{
                padding: '10px 12px',
                fontSize: '12px',
                border: `1px solid ${profileMsg.type === 'success' ? 'var(--ws-accent)' : 'var(--ws-red)'}`,
                background: profileMsg.type === 'success' ? 'var(--ws-accent-dim)' : 'rgba(239, 68, 68, 0.05)',
                color: profileMsg.type === 'success' ? 'var(--ws-accent)' : 'var(--ws-red)',
              }}>
                {profileMsg.text}
              </div>
            )}

            <div>
              <label style={{ fontSize: '11px', color: 'var(--ws-text-2)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>Display Name</label>
              <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your name" required className="ws-input" />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--ws-text-3)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>Email Address (Non-changeable)</label>
              <input type="text" value={user?.email || ''} readOnly className="ws-input" style={{ opacity: 0.6, cursor: 'not-allowed' }} />
            </div>

            <button type="submit" className="ws-btn" style={{ alignSelf: 'flex-start' }}>Save Profile</button>
          </form>

          {/* Security / Password Form */}
          <form onSubmit={handleUpdatePassword} className="ws-card">
            <div style={{ borderBottom: '1px solid var(--ws-border)', paddingBottom: '10px' }}>
              <div className="ws-label">Security & Password</div>
            </div>

            {securityMsg.text && (
              <div style={{
                padding: '10px 12px',
                fontSize: '12px',
                border: `1px solid ${securityMsg.type === 'success' ? 'var(--ws-accent)' : 'var(--ws-red)'}`,
                background: securityMsg.type === 'success' ? 'var(--ws-accent-dim)' : 'rgba(239, 68, 68, 0.05)',
                color: securityMsg.type === 'success' ? 'var(--ws-accent)' : 'var(--ws-red)',
              }}>
                {securityMsg.text}
              </div>
            )}

            <div>
              <label style={{ fontSize: '11px', color: 'var(--ws-text-2)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>New Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimum 6 characters" required className="ws-input" />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--ws-text-2)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>Confirm New Password</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repeat password" required className="ws-input" />
            </div>

            <button type="submit" className="ws-btn" style={{ alignSelf: 'flex-start' }}>Change Password</button>
          </form>

        </div>

        {/* Right Column: Preferences, Developer Keys, Maintenance */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Customization Preferences */}
          <div className="ws-card">
            <div style={{ borderBottom: '1px solid var(--ws-border)', paddingBottom: '10px' }}>
              <div className="ws-label">Terminal Preferences</div>
            </div>

            {/* Accent color picker */}
            <div>
              <div style={{ fontSize: '11px', color: 'var(--ws-text-2)', fontWeight: 600, marginBottom: '8px' }}>Terminal Color Accent</div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {ACCENT_COLORS.map((color) => {
                  const isActive = accentColor.toLowerCase() === color.hex.toLowerCase();
                  return (
                    <button
                      key={color.name}
                      onClick={() => changeAccent(color.hex)}
                      title={color.name}
                      style={{
                        width: '28px',
                        height: '28px',
                        background: color.hex,
                        border: `2px solid ${isActive ? 'var(--ws-text)' : 'transparent'}`,
                        cursor: 'pointer',
                        transform: isActive ? 'scale(1.1)' : 'scale(1)',
                        transition: 'transform 0.15s ease',
                        boxShadow: isActive ? '0 0 10px rgba(0,0,0,0.15)' : 'none',
                      }}
                      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
                      onMouseLeave={e => { if (!isActive) e.currentTarget.style.transform = 'scale(1)'; }}
                    />
                  );
                })}
              </div>
            </div>

            {/* Font size picker */}
            <div style={{ marginTop: '6px' }}>
              <div style={{ fontSize: '11px', color: 'var(--ws-text-2)', fontWeight: 600, marginBottom: '8px' }}>Base Font Size</div>
              <div style={{ display: 'flex', border: '1px solid var(--ws-border)', overflow: 'hidden', width: 'fit-content' }}>
                {[
                  { id: 'compact', label: 'Compact' },
                  { id: 'normal', label: 'Default' },
                  { id: 'large', label: 'Large' }
                ].map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => changeFontSize(opt.id)}
                    style={{
                      border: 'none',
                      padding: '6px 14px',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: fontSize === opt.id ? 'var(--ws-accent)' : 'var(--ws-bg-2)',
                      color: fontSize === opt.id ? '#fff' : 'var(--ws-text-2)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Scanlines visual toggler */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px', padding: '10px 12px', background: 'var(--ws-bg-2)', border: '1px solid var(--ws-border)' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ws-text)' }}>CRT Scanline Overlay</div>
                <div style={{ fontSize: '10px', color: 'var(--ws-text-3)', marginTop: '2px' }}>Render retro CRT monitor lines across interface</div>
              </div>
              <button 
                onClick={toggleScanlines}
                style={{
                  padding: '6px 14px',
                  fontSize: '11px',
                  fontWeight: 700,
                  border: '1px solid var(--ws-border)',
                  background: scanlines ? 'var(--ws-accent)' : 'var(--ws-bg-1)',
                  color: scanlines ? '#fff' : 'var(--ws-text-2)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {scanlines ? '[X] ENABLED' : '[ ] DISABLED'}
              </button>
            </div>
          </div>

          {/* API Developer Keys */}
          <div className="ws-card">
            <div style={{ borderBottom: '1px solid var(--ws-border)', paddingBottom: '10px' }}>
              <div className="ws-label">Developer API Keys</div>
            </div>

            <div style={{ fontSize: '11px', color: 'var(--ws-text-3)' }}>
              Use your API token to programmatically fetch cache information and integrate with external analysis tooling.
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <input type="text" readOnly value={apiToken}
                className="ws-input" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', background: 'var(--ws-bg-2)' }} />
              
              <button onClick={copyTokenToClipboard} className="ws-btn" style={{ padding: '8px 12px', flexShrink: 0 }}>
                {copiedToken ? 'Copied' : 'Copy'}
              </button>
            </div>

            <button onClick={rotateApiToken}
              className="ws-btn-secondary" style={{ alignSelf: 'flex-start' }}>
              Regenerate API Token
            </button>
          </div>

          {/* Danger Zone */}
          <div className="ws-card" style={{ border: '1px solid rgba(239, 68, 68, 0.25)', background: 'rgba(239, 68, 68, 0.02)' }}>
            <div style={{ borderBottom: '1px solid rgba(239, 68, 68, 0.15)', paddingBottom: '10px' }}>
              <div className="ws-label" style={{ color: 'var(--ws-red)' }}>Danger Zone</div>
            </div>

            <div style={{ fontSize: '11px', color: 'var(--ws-text-2)' }}>
              Actions performed in this area are absolute and cannot be undone. Exercise extreme caution.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', padding: '10px 12px', background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)' }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ws-text)' }}>Clear Portfolio Data</div>
                  <div style={{ fontSize: '10px', color: 'var(--ws-text-3)', marginTop: '2px' }}>Wipe all manual and uploaded holdings</div>
                </div>
                <button onClick={clearPortfolio} className="ws-btn-danger">Clear</button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', padding: '10px 12px', background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)' }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ws-text)' }}>Clear Watchlist Data</div>
                  <div style={{ fontSize: '10px', color: 'var(--ws-text-3)', marginTop: '2px' }}>Wipe all watchlisted assets</div>
                </div>
                <button onClick={clearWatchlist} className="ws-btn-danger">Clear</button>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
