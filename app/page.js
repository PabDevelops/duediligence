'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import MarketBar from './components/MarketBar';
import Topbar from './components/Topbar';

const fmt = (val) => {
  if (val === null || val === undefined) return '—';
  if (Math.abs(val) >= 1e12) return `$${(val / 1e12).toFixed(1)}T`;
  if (Math.abs(val) >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
  if (Math.abs(val) >= 1e6) return `$${(val / 1e6).toFixed(0)}M`;
  return `$${val.toLocaleString()}`;
};

const logoUrl = (name) => {
  if (!name) return null;
  const domain = name.toLowerCase()
    .replace(/\binc\b|\bcorp\b|\bltd\b|\bplc\b|\bco\b|\bllc\b|\bgroup\b|\bholdings\b|\binternational\b|\bthe\b/g, '')
    .trim().split(/\s+/)[0].replace(/[^a-z0-9]/g, '');
  return `https://img.logo.dev/${domain}.com?token=pk_B4aaLZF6S4G1YbCgqZq2Ug`;
};

const MoverRow = ({ s, router }) => {
  const up = s.priceChangePct >= 0;
  return (
    <div onClick={() => router.push(`/stock/${s.ticker}`)}
      style={{ display: 'grid', gridTemplateColumns: '52px 1fr auto auto', gap: '8px', padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)', alignItems: 'start' }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-2)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', gridColumn: '1' }}>
        <img src={logoUrl(s.name)} alt="" style={{ width: 16, height: 16, objectFit: 'contain', background: 'white', padding: 1, flexShrink: 0 }}
          onError={e => e.target.style.display = 'none'} />
        <span style={{ color: 'var(--accent)', fontSize: '12px', fontWeight: 700 }}>{s.ticker}</span>
      </div>
      <div style={{ overflow: 'hidden', gridColumn: '2' }}>
        <div style={{ color: 'var(--text-3)', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
      </div>
      <span style={{ color: 'var(--text)', fontSize: '12px', flexShrink: 0, gridColumn: '3' }}>${s.currentPrice?.toFixed(2)}</span>
      <span style={{ color: up ? 'var(--green)' : 'var(--red)', fontSize: '12px', fontWeight: 600, width: 68, textAlign: 'right', flexShrink: 0, gridColumn: '4' }}>
        {up ? '+' : ''}{s.priceChangePct?.toFixed(2)}%
      </span>
    </div>
  );
};

const EarningRow = ({ e, router }) => (
  <div onClick={() => router.push(`/stock/${e.ticker}`)}
    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-2)'}
    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
    <span style={{ color: 'var(--accent)', fontSize: '12px', fontWeight: 700, width: 56, flexShrink: 0 }}>{e.ticker}</span>
    <span style={{ color: 'var(--text-3)', fontSize: '11px', flex: 1 }}>{e.date}</span>
    <span style={{ color: 'var(--text-3)', fontSize: '10px', letterSpacing: '1px', flexShrink: 0 }}>
      {e.hour === 'bmo' ? 'PRE' : e.hour === 'amc' ? 'POST' : '—'}
    </span>
    {e.epsEstimate != null && (
      <span style={{ color: 'var(--text-2)', fontSize: '11px', flexShrink: 0 }}>est. ${e.epsEstimate}</span>
    )}
  </div>
);

const RankRow = ({ s, rank, metric, suffix = '', router }) => (
  <div onClick={() => router.push(`/stock/${s.ticker}`)}
    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-2)'}
    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
    <span style={{ color: 'var(--border-2)', fontSize: '9px', width: 18, flexShrink: 0 }}>#{rank}</span>
    <img src={logoUrl(s.name)} alt="" style={{ width: 16, height: 16, objectFit: 'contain', background: 'white', padding: 1, flexShrink: 0 }}
      onError={e => e.target.style.display = 'none'} />
    <span style={{ color: 'var(--accent)', fontSize: '12px', fontWeight: 700, flex: 1 }}>{s.ticker}</span>
    <span style={{ color: 'var(--green)', fontSize: '12px', fontWeight: 600, flexShrink: 0 }}>
      {s[metric]?.toFixed(1)}{suffix}
    </span>
  </div>
);

const TableHeader = ({ title, sub, color }) => (
  <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
    <span style={{ color: color || 'var(--accent)', fontSize: '10px', letterSpacing: '2px', fontWeight: 700 }}>{title}</span>
    {sub && <span style={{ color: 'var(--text-3)', fontSize: '9px' }}>{sub}</span>}
  </div>
);

export default function Home() {
  const [ticker, setTicker] = useState('');
  const [movers, setMovers] = useState(null);
  const [earnings, setEarnings] = useState(null);
  const [blink, setBlink] = useState(true);
  const [searchQ, setSearchQ] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [sotw, setSotw] = useState(null); // { ticker, name } or null
  const [sotwVotes, setSotwVotes] = useState({ BUY: 0, HOLD: 0, SELL: 0, total: 0 });
  const [discoverState, setDiscoverState] = useState('idle'); // idle | spinning | revealed | limited
  const [discoverTicker, setDiscoverTicker] = useState(null);
  const [discoverRemaining, setDiscoverRemaining] = useState(null);
  const [discoverSlot, setDiscoverSlot] = useState('???');
  const [faqOpen, setFaqOpen] = useState(null);
  const [showStickyBar, setShowStickyBar] = useState(false);
  const [userCount, setUserCount] = useState(null);
  const [displayCount, setDisplayCount] = useState(0);
  const router = useRouter();
  const { isSignedIn } = useUser();

  useEffect(() => {
    fetch('/api/stock-of-week')
      .then(r => r.json())
      .then(d => {
        // Check if API returned an error
        if (d.error || !d.ticker) {
          console.error('SOTW error:', d.error || 'No ticker returned');
          return;
        }
        console.log('SOTW source:', d.source, '| ticker:', d.ticker, '| name:', d.name);
        setSotw({ ticker: d.ticker, name: d.name || d.ticker });
        // Load votes for this stock
        fetch(`/api/votes?ticker=${d.ticker}`)
          .then(r => r.json())
          .then(v => setSotwVotes({ ...v.percentages, total: v.total }))
          .catch(() => {});
      })
      .catch(err => console.error('SOTW fetch failed:', err));
  }, []);

  useEffect(() => {
    if (searchQ.length < 1) { setSuggestions([]); return; }
    const timeout = setTimeout(() => {
      fetch(`/api/search?q=${searchQ}`)
        .then(r => r.json())
        .then(d => setSuggestions(d.results || []))
        .catch(() => {});
    }, 200);
    return () => clearTimeout(timeout);
  }, [searchQ]);

  useEffect(() => {
    fetch('/api/user-count')
      .then(r => r.json())
      .then(d => setUserCount(d.count))
      .catch(() => setUserCount(2863));
  }, []);

  useEffect(() => {
    if (!userCount) return;
    const duration = 1800;
    const start = performance.now();
    const from = Math.max(1, userCount - 300);
    const to = userCount;
    const easeOut = t => 1 - Math.pow(1 - t, 3);
    const frame = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      setDisplayCount(Math.floor(from + (to - from) * easeOut(progress)));
      if (progress < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }, [userCount]);

  useEffect(() => {
    const onScroll = () => setShowStickyBar(window.scrollY > 300);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    fetch('/api/movers').then(r => r.json()).then(d => setMovers(d)).catch(() => {});
    fetch('/api/earnings').then(r => r.json()).then(d => setEarnings(d.earnings || [])).catch(() => {});
    const interval = setInterval(() => setBlink(b => !b), 600);
    return () => clearInterval(interval);
  }, []);

  const SLOT_TICKERS = ['AAPL','MSFT','NVDA','TSLA','GOOGL','AMZN','META','V','JPM','NFLX','AMD','INTC','PYPL','SHOP','UBER','COIN','PLTR','SQ','ROKU','SNAP'];

  async function handleDiscover() {
    if (discoverState === 'spinning') return;
    setDiscoverState('spinning');
    setDiscoverTicker(null);

    // Slot machine animation
    let i = 0;
    const interval = setInterval(() => {
      setDiscoverSlot(SLOT_TICKERS[i % SLOT_TICKERS.length]);
      i++;
    }, 80);

    const res = await fetch('/api/random');
    const data = await res.json();

    // Keep spinning at least 1.5s
    await new Promise(r => setTimeout(r, 1500));
    clearInterval(interval);

    if (res.status === 429) {
      setDiscoverSlot('???');
      setDiscoverState('limited');
      setDiscoverRemaining(0);
    } else {
      setDiscoverSlot(data.ticker);
      setDiscoverTicker(data.ticker);
      setDiscoverRemaining(data.remaining);
      setDiscoverState('revealed');
    }
  }

  function go(t) {
    const tk = (t || ticker).toUpperCase().trim();
    if (!tk) return;
    router.push(`/stock/${tk}`);
  }

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', fontFamily: 'Nunito, sans-serif' }}>
      <Topbar />
      <div className="mobile-only" style={{ padding: '20px 16px', overflowX: 'hidden' }}>

          {/* Hero */}
          <div style={{ marginBottom: '24px', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '-40px', left: '-20px', width: '300px', height: '300px', background: 'radial-gradient(ellipse, rgba(167,139,250,0.15) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'var(--accent-dim)', border: '1px solid var(--accent)', padding: '4px 12px', borderRadius: '20px', marginBottom: '16px' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
                <span style={{ color: 'var(--accent)', fontSize: '10px', letterSpacing: '2px', fontWeight: 700 }}>DATA FROM COMPANY FILINGS</span>
              </div>
              <h1 style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-1px', lineHeight: 1.1, marginBottom: '12px', fontFamily: 'Nunito, sans-serif' }}>
                Know if a company is worth it.<span style={{ color: 'var(--accent)' }}> In seconds.</span>
              </h1>
              <p style={{ color: 'var(--text-2)', fontSize: '15px', lineHeight: 1.6, marginBottom: '16px', fontFamily: 'Nunito, sans-serif' }}>
                Real data from company filings. No finance degree needed. Free to start.
              </p>
              {displayCount > 0 && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: '50px', padding: '6px 14px', marginBottom: '20px' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)', display: 'inline-block', flexShrink: 0 }} />
                  <span style={{ color: 'var(--accent)', fontWeight: 800, fontSize: '13px' }}>{displayCount.toLocaleString()}</span>
                  <span style={{ color: 'var(--text-3)', fontSize: '13px', fontWeight: 600 }}>investors already using Traqcker</span>
                </div>
              )}
              <div style={{ display: 'flex', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 0 0 1px rgba(255,255,255,0.1)', marginBottom: '12px' }}>
                <input
                  style={{ flex: 1, background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(20px)', border: 'none', color: 'var(--text)', fontFamily: 'Nunito, sans-serif', fontSize: '16px', fontWeight: 500, padding: '14px 16px', outline: 'none' }}
                  placeholder="Search a company, e.g. Apple"
                  value={ticker}
                  onChange={e => setTicker(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && go()}
                  maxLength={10}
                />
                <button onClick={() => go()} className="btn-primary" style={{ borderRadius: '0 12px 12px 0', whiteSpace: 'nowrap', padding: '14px 20px' }}>
                  Analyze →
                </button>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {['AAPL', 'MSFT', 'NVDA', 'V', 'GOOGL'].map(t => (
                  <button key={t} onClick={() => go(t)}
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text-3)', padding: '4px 12px', fontFamily: 'Nunito, sans-serif', fontSize: '11px', fontWeight: 500, cursor: 'pointer', borderRadius: '8px' }}
                    onMouseEnter={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.color = 'var(--accent)'; }}
                    onMouseLeave={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.color = 'var(--text-3)'; }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* SOTW + Spin stacked */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
            {/* SOTW */}
            {sotw ? (
              <div className="glass" style={{ padding: '20px' }}>
                <a href={`/stock/${sotw.ticker}`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '14px' }}>🔥</span>
                  <span style={{ color: 'var(--accent)', fontSize: '10px', fontWeight: 700, letterSpacing: '1px' }}>STOCK OF THE WEEK</span>
                  <span style={{ color: 'var(--text)', fontSize: '13px', fontWeight: 700 }}>{sotw.ticker}</span>
                  <span style={{ color: 'var(--text-3)', fontSize: '11px' }}>– {sotw.name}</span>
                </a>
                <div style={{ display: 'flex', height: '6px', borderRadius: '4px', overflow: 'hidden', marginBottom: '6px' }}>
                  <div style={{ background: 'var(--green)', width: `${sotwVotes.BUY}%`, transition: 'width 0.4s' }} />
                  <div style={{ background: 'var(--amber)', width: `${sotwVotes.HOLD}%`, transition: 'width 0.4s' }} />
                  <div style={{ background: 'var(--red)', width: `${sotwVotes.SELL}%`, transition: 'width 0.4s' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '12px' }}>
                  <span style={{ color: 'var(--green)' }}>● {sotwVotes.BUY}% Buy</span>
                  <span style={{ color: 'var(--text-3)' }}>{sotwVotes.total} votes</span>
                  <span style={{ color: 'var(--red)' }}>{sotwVotes.SELL}% Sell ●</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  {['BUY', 'HOLD', 'SELL'].map((v) => (
                    <button key={v}
                      onClick={async (e) => { e.preventDefault(); if (!isSignedIn) { router.push('/sign-in'); return; } await fetch('/api/votes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ticker: sotw.ticker, vote: v }) }); fetch(`/api/votes?ticker=${sotw.ticker}`).then(r => r.json()).then(d => setSotwVotes({ ...d.percentages, total: d.total })); }}
                      style={{ padding: '10px 6px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${v === 'BUY' ? 'rgba(52,211,153,0.3)' : v === 'SELL' ? 'rgba(248,113,113,0.3)' : 'rgba(251,191,36,0.3)'}`, borderRadius: '10px', color: v === 'BUY' ? 'var(--green)' : v === 'SELL' ? 'var(--red)' : 'var(--amber)', fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="glass" style={{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: 'var(--text-3)', fontSize: '12px' }}>Loading...</span>
              </div>
            )}

            {/* Stats */}
            <div className="glass" style={{ padding: '16px 20px', display: 'flex', gap: '0', alignItems: 'center', justifyContent: 'space-around' }}>
              {[{ val: '8,000+', label: 'US COMPANIES' }, { val: '100%', label: 'ACCURATE DATA' }, { val: 'FREE', label: 'TO START' }].map(s => (
                <div key={s.label} style={{ textAlign: 'center' }}>
                  <div style={{ color: 'var(--accent)', fontSize: '18px', fontWeight: 700 }}>{s.val}</div>
                  <div style={{ color: 'var(--text-3)', fontSize: '9px', letterSpacing: '1.5px', marginTop: '2px' }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Spin */}
            <div className="glass" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: 'var(--accent)', fontSize: '16px', fontWeight: 700, marginBottom: '4px' }}>⚡ SPIN THE MARKET</div>
                <div style={{ color: 'var(--text-2)', fontSize: '12px' }}>Discover a random stock from 8,000+</div>
                {discoverRemaining !== null && discoverRemaining !== 'unlimited' && discoverState !== 'limited' && (
                  <span style={{ color: 'var(--text-3)', fontSize: '10px', background: 'var(--bg-2)', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: '20px', display: 'inline-block', marginTop: '6px' }}>{discoverRemaining} LEFT</span>
                )}
              </div>
              <div style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(10px)', border: `1.5px solid ${discoverState === 'revealed' ? 'var(--accent)' : discoverState === 'limited' ? 'var(--red)' : 'rgba(255,255,255,0.08)'}`, borderRadius: '12px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'border-color 0.3s', boxShadow: discoverState === 'revealed' ? '0 0 24px rgba(167,139,250,0.2)' : 'none' }}>
                <span className={discoverState === 'spinning' ? 'slot-spinning' : ''}
                  style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '28px', fontWeight: 700, letterSpacing: '6px', color: discoverState === 'revealed' ? 'var(--accent)' : discoverState === 'limited' ? 'var(--red)' : 'var(--text-3)' }}>
                  {discoverState === 'idle' ? '? ? ?' : discoverSlot}
                </span>
              </div>
              {discoverState !== 'limited' ? (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={handleDiscover} disabled={discoverState === 'spinning'}
                    className={discoverState === 'spinning' ? '' : 'btn-primary'}
                    style={{ flex: 1, ...(discoverState === 'spinning' ? { background: 'var(--bg-2)', color: 'var(--text-3)', border: 'none', padding: '11px', borderRadius: '10px', cursor: 'default', fontFamily: 'Nunito, sans-serif', fontSize: '13px', fontWeight: 600 } : { borderRadius: '10px', padding: '11px 10px' }) }}>
                    {discoverState === 'spinning' ? 'Spinning...' : discoverState === 'revealed' ? '⚡ Spin Again' : '⚡ Spin'}
                  </button>
                  {discoverState === 'revealed' && discoverTicker && (
                    <button onClick={() => router.push(`/stock/${discoverTicker}`)}
                      style={{ flex: 1, background: 'none', border: '1px solid var(--accent)', color: 'var(--accent)', padding: '11px', cursor: 'pointer', fontFamily: 'Nunito, sans-serif', fontSize: '13px', fontWeight: 600, borderRadius: '10px' }}>
                      Analyze →
                    </button>
                  )}
                </div>
              ) : (
                <div>
                  <div style={{ color: 'var(--red)', fontSize: '11px', marginBottom: '8px', textAlign: 'center' }}>{isSignedIn ? 'Daily limit reached' : 'Sign in for more spins'}</div>
                  <a href={isSignedIn ? '/pricing' : '/sign-up'} className="btn-primary" style={{ display: 'block', textAlign: 'center', borderRadius: '10px' }}>
                    {isSignedIn ? 'Upgrade to Pro →' : 'Sign up free →'}
                  </a>
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px', fontSize: '10px', color: 'var(--text-3)' }}>
                <span>👤 1/day</span><span style={{ color: 'var(--border)' }}>·</span>
                <span>🆓 Free: 3/day</span><span style={{ color: 'var(--border)' }}>·</span>
                <span style={{ color: 'var(--accent)' }}>💎 Pro: unlimited</span>
              </div>
            </div>
          </div>

          {/* FEATURE SHOWCASE — mobile */}
          <div style={{ marginBottom: '40px' }}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ color: 'var(--accent)', fontSize: '10px', letterSpacing: '3px', fontWeight: 700, marginBottom: '10px' }}>WHAT YOU GET</div>
              <div style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.5px', marginBottom: '8px' }}>Everything you need. Nothing you don't.</div>
              <div style={{ color: 'var(--text-3)', fontSize: '13px', lineHeight: 1.6 }}>Three tools that tell you if a stock deserves your money.</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

              {/* Easy Mode */}
              <div className="glass" style={{ padding: '20px', display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div style={{ position: 'relative', width: '72px', height: '72px', flexShrink: 0 }}>
                  <svg width="72" height="72" viewBox="0 0 72 72" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="36" cy="36" r="30" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
                    <circle cx="36" cy="36" r="30" fill="none" stroke="#34d399" strokeWidth="7" strokeLinecap="round"
                      strokeDasharray="188" strokeDashoffset={188 - 188 * 0.78} />
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: '#34d399', lineHeight: 1 }}>78</div>
                    <div style={{ fontSize: '8px', color: 'var(--text-3)' }}>/100</div>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 800, marginBottom: '4px' }}>Easy Mode Score</div>
                  <div style={{ color: 'var(--text-3)', fontSize: '12px', lineHeight: 1.6 }}>A health score from 0 to 100. No spreadsheets needed.</div>
                </div>
              </div>

              {/* Fair Value */}
              <div className="glass" style={{ padding: '20px' }}>
                <div style={{ fontSize: '15px', fontWeight: 800, marginBottom: '12px' }}>Fair Value Check</div>
                <div style={{ position: 'relative', height: '8px', borderRadius: '6px', background: 'linear-gradient(90deg, #34d399 0%, #fbbf24 50%, #f87171 100%)', opacity: 0.45, marginBottom: '6px' }}>
                  <div style={{ position: 'absolute', top: '-4px', width: '4px', height: '16px', borderRadius: '2px', background: 'white', left: '36%' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-3)', marginBottom: '10px' }}>
                  <span>Cheap</span><span>Fair</span><span>Expensive</span>
                </div>
                <div style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)', borderRadius: '8px', padding: '6px 12px', textAlign: 'center' }}>
                  <span style={{ color: '#34d399', fontSize: '12px', fontWeight: 700 }}>UNDERVALUED · +15% upside</span>
                </div>
              </div>

              {/* Quality Scorecard */}
              <div className="glass" style={{ padding: '20px' }}>
                <div style={{ fontSize: '15px', fontWeight: 800, marginBottom: '12px' }}>Quality Scorecard</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  {[
                    { label: 'Core Business', score: 4.2, color: '#34d399' },
                    { label: 'Opportunity', score: 3.8, color: '#a78bfa' },
                    { label: 'Growth Quality', score: 4.5, color: '#34d399' },
                    { label: 'Final Note', score: 4.2, color: '#34d399', highlight: true },
                  ].map(m => (
                    <div key={m.label} style={{ background: m.highlight ? 'rgba(167,139,250,0.08)' : 'rgba(255,255,255,0.04)', border: `1px solid ${m.highlight ? 'rgba(167,139,250,0.2)' : 'rgba(255,255,255,0.06)'}`, borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '8px', color: 'var(--text-3)', marginBottom: '4px', fontWeight: 700 }}>{m.label.toUpperCase()}</div>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: m.color, lineHeight: 1 }}>{m.score}</div>
                      <div style={{ fontSize: '8px', color: 'var(--text-3)' }}>/5</div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>

          {/* HOW IT WORKS */}
        <div style={{ marginBottom: '48px' }}>
          <div style={{ color: 'var(--text-3)', fontSize: '10px', letterSpacing: '3px', marginBottom: '16px', fontFamily: 'Nunito, sans-serif' }}>HOW IT WORKS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              { step: '01', title: 'Search a company', desc: 'Type any company name. Traqcker pulls real data directly from company filings — no opinions, no noise.' },
              { step: '02', title: 'Does it deserve your money?', desc: 'See instantly if the company is financially healthy and whether the price makes sense.' },
              { step: '03', title: 'Make the decision', desc: 'No buy or sell recommendations. Just the facts you need to decide for yourself.' },
            ].map(s => (
              <div key={s.step} className="glass" style={{ padding: '20px' }}>
                <div style={{ color: 'var(--accent)', fontSize: '28px', fontWeight: 700, letterSpacing: '-1px', marginBottom: '10px', opacity: 0.35 }}>{s.step}</div>
                <div style={{ color: 'var(--text)', fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>{s.title}</div>
                <div style={{ color: 'var(--text-3)', fontSize: '13px', lineHeight: 1.7 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>

         

          {/* CTA MID — mobile */}
          <div style={{ marginBottom: '40px', borderRadius: '20px', padding: '32px 24px', background: 'linear-gradient(135deg, rgba(167,139,250,0.10) 0%, rgba(96,165,250,0.06) 100%)', border: '1px solid rgba(167,139,250,0.2)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '200px', height: '200px', background: 'radial-gradient(ellipse, rgba(167,139,250,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ color: 'var(--accent)', fontSize: '10px', letterSpacing: '2px', fontWeight: 700, marginBottom: '10px' }}>FREE · NO CREDIT CARD</div>
              <div style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-0.5px', lineHeight: 1.2, marginBottom: '16px' }}>
                Start in 30 seconds.<br /><span style={{ color: 'var(--accent)' }}>Cancel whenever.</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
                {[
                  'Easy Mode score for 8,000+ stocks',
                  'Fair Value estimate',
                  'Community votes',
                  'Stock of the Week',
                ].map(f => (
                  <div key={f} style={{ display: 'flex', gap: '10px', alignItems: 'center', color: 'var(--text-2)', fontSize: '13px' }}>
                    <span style={{ color: '#34d399', fontWeight: 800, flexShrink: 0 }}>✓</span>{f}
                  </div>
                ))}
              </div>
              <a href="/sign-up" className="btn-primary" style={{ display: 'block', textAlign: 'center', fontSize: '15px', padding: '14px', borderRadius: '12px' }}>
                Start for free →
              </a>
              <a href="/pricing" style={{ display: 'block', textAlign: 'center', color: 'var(--text-3)', fontSize: '12px', textDecoration: 'none', fontWeight: 600, marginTop: '12px' }}>
                See what Pro unlocks →
              </a>
            </div>
          </div>

          {/* TESTIMONIALS — mobile */}
          {(() => {
            const cols = [
              [
                { text: "Finally understand what I'm buying. The Easy Mode score tells me everything in 10 seconds.", name: "Sarah K.", role: "Retail investor" },
                { text: "I avoided a disaster — the score flagged weak cash flow before the stock dropped 40%.", name: "David M.", role: "Self-taught investor" },
                { text: "Free tier is already better than paid tools I've tried before.", name: "Nate F.", role: "College student" },
                { text: "The Fair Value bar is brilliant. So simple but so powerful.", name: "Priya S.", role: "Software engineer" },
              ],
              [
                { text: "Screener + Compare is insane for finding undervalued stocks. Worth every penny of Pro.", name: "Chris B.", role: "Pro subscriber" },
                { text: "As someone with zero finance background, this is the first tool that makes sense.", name: "Mia J.", role: "First-time investor" },
                { text: "Data straight from SEC filings — not some analyst's opinion. That's what I needed.", name: "Tom H.", role: "Independent investor" },
                { text: "Been investing for 10 years. This is the most honest stock tool I've found.", name: "Anita W.", role: "Experienced investor" },
              ],
            ];
            return (
              <div style={{ marginBottom: '40px' }}>
                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                  <div style={{ color: 'var(--accent)', fontSize: '10px', letterSpacing: '2px', fontWeight: 700, marginBottom: '8px' }}>WHAT INVESTORS SAY</div>
                  <div style={{ fontSize: '20px', fontWeight: 800 }}>Trusted by independent investors</div>
                </div>
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px',
                  height: '380px', overflow: 'hidden',
                  WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)',
                  maskImage: 'linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)',
                }}>
                  {cols.map((cards, ci) => (
                    <div key={ci} style={{ overflow: 'hidden' }}>
                      <div className={`testimonial-col testimonial-col-${ci === 0 ? 'up' : 'down'}`} style={{ animationDuration: ci === 0 ? '28s' : '24s' }}>
                        {[...cards, ...cards].map((c, i) => (
                          <div key={i} className="glass" style={{ padding: '14px', marginBottom: '10px', flexShrink: 0 }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-2)', lineHeight: 1.6, marginBottom: '10px' }}>"{c.text}"</div>
                            <div style={{ fontSize: '11px', fontWeight: 800 }}>{c.name}</div>
                            <div style={{ fontSize: '10px', color: 'var(--text-3)' }}>{c.role}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* FAQ — mobile */}
          {(() => {
            const faqs = [
              { q: 'Is it really free?', a: 'Yes — no credit card needed. Easy Mode score, Fair Value, votes and Stock of the Week are free forever. Pro unlocks financials, screener, DCF and Compare.' },
              { q: 'Where does the data come from?', a: 'Directly from SEC EDGAR filings — the same source companies are legally required to file with. Supplemented by Finnhub for real-time prices.' },
              { q: 'Do I need a finance background?', a: 'No. Easy Mode is designed for everyone. The score and plain-language summaries give you everything you need without a finance degree.' },
              { q: 'How is this different from other apps?', a: 'We show you the actual business — margins, cash flow, debt — scored in plain language. No analyst opinions. No buy/sell recommendations. Just the facts.' },
              { q: 'What does Pro include?', a: 'Full financials, DCF valuation model, screener across 8,000+ stocks, side-by-side comparison, and unlimited Spin the Market.' },
            ];
            return (
              <div style={{ marginBottom: '40px' }}>
                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                  <div style={{ color: 'var(--accent)', fontSize: '10px', letterSpacing: '2px', fontWeight: 700, marginBottom: '8px' }}>FAQ</div>
                  <div style={{ fontSize: '22px', fontWeight: 800 }}>Common questions</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {faqs.map((f, i) => (
                    <div key={i} className="glass" style={{ overflow: 'hidden', cursor: 'pointer' }} onClick={() => setFaqOpen(faqOpen === i ? null : i)}>
                      <div style={{ padding: '16px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: faqOpen === i ? 'var(--accent)' : 'var(--text)' }}>{f.q}</span>
                        <span style={{ color: 'var(--accent)', fontSize: '18px', fontWeight: 300, flexShrink: 0, transform: faqOpen === i ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s', lineHeight: 1 }}>+</span>
                      </div>
                      {faqOpen === i && (
                        <div style={{ padding: '0 18px 16px', color: 'var(--text-2)', fontSize: '13px', lineHeight: 1.7, borderTop: '1px solid var(--border)' }}>
                          <div style={{ paddingTop: '12px' }}>{f.a}</div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', color: 'var(--text-3)', fontSize: '9px', letterSpacing: '1px', textAlign: 'center' }}>
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginBottom: '8px', alignItems: 'center' }}>
              <a href="/privacy" style={{ color: 'var(--text-3)', textDecoration: 'none' }}>PRIVACY</a>
              <a href="/terms" style={{ color: 'var(--text-3)', textDecoration: 'none' }}>TERMS</a>
              <a href="/about" style={{ color: 'var(--text-3)', textDecoration: 'none' }}>ABOUT</a>
            </div>
            <div style={{ marginBottom: '8px' }}>
              <a href="https://launchllama.co?utm_source=badge&utm_medium=referral" target="_blank" rel="noopener">
                <img src="https://speaktechenglish.com/wp-content/uploads/2026/04/Screenshot_2026-04-09_at_17.40.44-removebg-preview.png" alt="Featured on Launch Llama" width="100" height="25" style={{ opacity: 0.7, verticalAlign: 'middle' }} />
              </a>
            </div>
            NOT INVESTMENT ADVICE · © 2026 TRAQCKER
          </div>
        </div>

      <div className="desktop-only">

      {/* HERO */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '64px 24px 48px', maxWidth: '1400px', margin: '0 auto', boxSizing: 'border-box', width: '100%', position: 'relative', zIndex: 1 }}>
        {/* Hero background glow */}
        <div style={{ position: 'absolute', top: '-80px', left: '10%', width: '700px', height: '500px', background: 'radial-gradient(ellipse, rgba(167,139,250,0.18) 0%, rgba(96,165,250,0.08) 45%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
        <div style={{ position: 'absolute', top: '0', right: '5%', width: '400px', height: '400px', background: 'radial-gradient(ellipse, rgba(96,165,250,0.1) 0%, transparent 65%)', pointerEvents: 'none', zIndex: 0 }} />

        {/* Top: headline + search */}
        <div style={{ marginBottom: '40px', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'var(--accent-dim)', border: '1px solid var(--accent)', padding: '4px 12px', borderRadius: '20px', marginBottom: '20px' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
            <span style={{ color: 'var(--accent)', fontSize: '10px', letterSpacing: '2px', fontWeight: 700 }}>DATA FROM COMPANY FILINGS</span>
          </div>

          <h1 style={{ fontSize: '64px', fontWeight: 800, letterSpacing: '-2px', lineHeight: 1.0, marginBottom: '16px', whiteSpace: 'nowrap', fontFamily: 'Nunito, sans-serif' }}>
            Know if a company is worth it.<span style={{ color: 'var(--accent)' }}> In seconds.</span>
          </h1>
          <p style={{ color: 'var(--text-2)', fontSize: '17px', lineHeight: 1.6, marginBottom: '16px', maxWidth: '560px' }}>
            Real data from company filings. No finance degree needed. Free to start.
          </p>
          {displayCount > 0 && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: '50px', padding: '7px 16px', marginBottom: '28px' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)', display: 'inline-block', flexShrink: 0 }} />
              <span style={{ color: 'var(--accent)', fontWeight: 800, fontSize: '14px' }}>{displayCount.toLocaleString()}</span>
              <span style={{ color: 'var(--text-3)', fontSize: '14px', fontWeight: 600 }}>investors already using Traqcker</span>
            </div>
          )}

          {/* Search bar — full width */}
          <div style={{ position: 'relative', zIndex: 50, maxWidth: '600px' }}>
            <div style={{ display: 'flex', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 0 0 1px rgba(255,255,255,0.1)' }}>
              <input
                style={{ flex: 1, background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(20px)', border: 'none', color: 'var(--text)', fontFamily: 'Space Grotesk, sans-serif', fontSize: '16px', fontWeight: 500, padding: '14px 20px', outline: 'none', letterSpacing: '0.5px' }}
                placeholder="Search a company, e.g. Apple"
                value={searchQ || ticker}
                onChange={e => { const v = e.target.value; setSearchQ(v); setTicker(v.toUpperCase()); setShowSuggestions(true); }}
                onKeyDown={e => { if (e.key === 'Enter') { go(); setShowSuggestions(false); } if (e.key === 'Escape') setShowSuggestions(false); }}
                maxLength={50}
                onFocus={e => { e.target.style.borderColor = 'var(--accent)'; setShowSuggestions(true); }}
                onBlur={e => { e.target.style.borderColor = 'var(--border-2)'; setTimeout(() => setShowSuggestions(false), 200); }}
              />
              <button onClick={() => go()} className="btn-primary" style={{ borderRadius: '0 12px 12px 0', whiteSpace: 'nowrap', padding: '14px 32px' }}>
                Analyze →
              </button>
            </div>
            {showSuggestions && suggestions.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-1)', border: '1px solid var(--border)', maxHeight: '300px', overflowY: 'auto', zIndex: 9999, marginTop: '4px', boxSizing: 'border-box' }}>
                {suggestions.map(s => (
                  <div key={s.ticker}
                    onMouseDown={() => { router.push(`/stock/${s.ticker}`); setShowSuggestions(false); }}
                    style={{ padding: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <span style={{ color: 'var(--accent)', fontSize: '13px', fontWeight: 700, width: 56, flexShrink: 0 }}>{s.ticker}</span>
                    <span style={{ color: 'var(--text-2)', fontSize: '12px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                    <span style={{ color: 'var(--text-3)', fontSize: '10px', flexShrink: 0 }}>{s.exchange}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
            {['AAPL', 'MSFT', 'NVDA', 'V', 'ASML', 'GOOGL'].map(t => (
              <button key={t} onClick={() => go(t)}
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text-3)', padding: '4px 12px', fontFamily: 'Nunito, sans-serif', fontSize: '11px', fontWeight: 500, cursor: 'pointer', borderRadius: '8px' }}
                onMouseEnter={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.color = 'var(--accent)'; }}
                onMouseLeave={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.color = 'var(--text-3)'; }}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Bottom: SOTW left | Spin right */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'stretch' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* SOTW */}
          {sotw ? (
            <div className="glass" style={{ padding: '24px 28px' }}>
              <div>
                <a href={`/stock/${sotw.ticker}`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <span style={{ fontSize: '16px' }}>🔥</span>
                  <span style={{ color: 'var(--accent)', fontSize: '10px', fontWeight: 700, letterSpacing: '1px' }}>STOCK OF THE WEEK</span>
                  <span style={{ color: 'var(--text)', fontSize: '13px', fontWeight: 700 }}>{sotw.ticker}</span>
                  <span style={{ color: 'var(--text-3)', fontSize: '11px' }}>– {sotw.name}</span>
                </a>
                <div style={{ display: 'flex', height: '6px', overflow: 'hidden', marginBottom: '8px' }}>
                  <div style={{ background: 'var(--green)', width: `${sotwVotes.BUY}%`, transition: 'width 0.4s' }} />
                  <div style={{ background: 'var(--amber)', width: `${sotwVotes.HOLD}%`, transition: 'width 0.4s' }} />
                  <div style={{ background: 'var(--red)', width: `${sotwVotes.SELL}%`, transition: 'width 0.4s' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                  <span style={{ color: 'var(--green)' }}>● {sotwVotes.BUY}% Buy</span>
                  <span style={{ color: 'var(--text-3)' }}>{sotwVotes.total} votes</span>
                  <span style={{ color: 'var(--red)' }}>{sotwVotes.SELL}% Sell ●</span>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '16px' }}>
                {['BUY', 'HOLD', 'SELL'].map((v) => (
                  <button key={v}
                    onClick={async (e) => {
                      e.preventDefault();
                      if (!isSignedIn) { router.push('/sign-in'); return; }
                      await fetch('/api/votes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ticker: sotw.ticker, vote: v }) });
                      fetch(`/api/votes?ticker=${sotw.ticker}`).then(r => r.json()).then(d => setSotwVotes({ ...d.percentages, total: d.total }));
                    }}
                    style={{ padding: '12px 10px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${v === 'BUY' ? 'rgba(52,211,153,0.3)' : v === 'SELL' ? 'rgba(248,113,113,0.3)' : 'rgba(251,191,36,0.3)'}`, borderRadius: '10px', color: v === 'BUY' ? 'var(--green)' : v === 'SELL' ? 'var(--red)' : 'var(--amber)', fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="glass" style={{ padding: '24px 28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: 'var(--text-3)', fontSize: '10px', letterSpacing: '2px' }}>LOADING...</span>
            </div>
          )}

          {/* Stats below SOTW */}
          <div className="glass" style={{ padding: '20px 28px', display: 'flex', gap: '40px', alignItems: 'center', justifyContent: 'center' }}>
            {[
              { val: '8,000+', label: 'US COMPANIES' },
              { val: '100%', label: 'ACCURATE DATA' },
              { val: 'FREE', label: 'TO START' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ color: 'var(--accent)', fontSize: '20px', fontWeight: 700, letterSpacing: '-0.5px' }}>{s.val}</div>
                <div style={{ color: 'var(--text-3)', fontSize: '9px', letterSpacing: '2px', marginTop: '2px' }}>{s.label}</div>
              </div>
            ))}
          </div>
          </div>

            {/* Discover / Slot machine */}
            <div className="glass" style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '16px', justifyContent: 'space-between' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: 'var(--accent)', fontSize: '18px', fontWeight: 700, letterSpacing: '2px', marginBottom: '6px' }}>⚡ SPIN THE MARKET</div>
                <div style={{ color: 'var(--text-2)', fontSize: '12px' }}>Discover a random stock from 8,000+</div>
                {discoverRemaining !== null && discoverRemaining !== 'unlimited' && discoverState !== 'limited' && (
                  <div style={{ marginTop: '6px' }}>
                    <span style={{ color: 'var(--text-3)', fontSize: '10px', background: 'var(--bg-2)', border: '1px solid var(--border)', padding: '3px 10px', borderRadius: '20px' }}>
                      {discoverRemaining} LEFT
                    </span>
                  </div>
                )}
              </div>

              {/* Slot display */}
              <div style={{
                background: 'rgba(0,0,0,0.3)',
                backdropFilter: 'blur(10px)',
                border: `1.5px solid ${discoverState === 'revealed' ? 'var(--accent)' : discoverState === 'limited' ? 'var(--red)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: '12px',
                height: '72px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'border-color 0.3s',
                boxShadow: discoverState === 'revealed' ? '0 0 24px rgba(167,139,250,0.2)' : 'none',
              }}>
                <style>{`
                  @keyframes slot-blur { 0%,100%{opacity:1;transform:translateY(0)} 50%{opacity:0.3;transform:translateY(-3px)} }
                  .slot-spinning{animation:slot-blur 0.16s infinite}
                `}</style>
                <span className={discoverState === 'spinning' ? 'slot-spinning' : ''}
                  style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '32px', fontWeight: 700, letterSpacing: '6px', color: discoverState === 'revealed' ? 'var(--accent)' : discoverState === 'limited' ? 'var(--red)' : 'var(--text-3)' }}>
                  {discoverState === 'idle' ? '? ? ?' : discoverSlot}
                </span>
              </div>

              {/* Actions */}
              {discoverState !== 'limited' ? (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={handleDiscover} disabled={discoverState === 'spinning'}
                    className={discoverState === 'spinning' ? '' : 'btn-primary'}
                    style={{ flex: 1, ...(discoverState === 'spinning' ? { background: 'var(--bg-2)', color: 'var(--text-3)', border: 'none', padding: '11px', borderRadius: '10px', cursor: 'default', fontFamily: 'Nunito, sans-serif', fontSize: '13px', fontWeight: 600 } : { borderRadius: '10px', padding: '11px 10px' }) }}>
                    {discoverState === 'spinning' ? 'Spinning...' : discoverState === 'revealed' ? '⚡ Spin Again' : '⚡ Spin'}
                  </button>
                  {discoverState === 'revealed' && discoverTicker && (
                    <button onClick={() => router.push(`/stock/${discoverTicker}`)}
                      style={{ flex: 1, background: 'none', border: '1px solid var(--accent)', color: 'var(--accent)', padding: '11px', cursor: 'pointer', fontFamily: 'Nunito, sans-serif', fontSize: '13px', fontWeight: 600, borderRadius: '10px' }}>
                      Analyze →
                    </button>
                  )}
                </div>
              ) : (
                <div>
                  <div style={{ color: 'var(--red)', fontSize: '10px', letterSpacing: '1px', marginBottom: '8px', textAlign: 'center' }}>
                    {isSignedIn ? 'DAILY LIMIT REACHED' : 'SIGN IN FOR MORE'}
                  </div>
                  <a href={isSignedIn ? '/pricing' : '/sign-up'} className="btn-primary"
                    style={{ display: 'block', textAlign: 'center', borderRadius: '10px' }}>
                    {isSignedIn ? 'Upgrade to Pro →' : 'Sign up free →'}
                  </a>
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px', fontSize: '9px', color: 'var(--text-3)', flexWrap: 'wrap' }}>
                <span>👤 1/day</span>
                <span style={{ color: 'var(--border)' }}>·</span>
                <span>🆓 Free: 3/day</span>
                <span style={{ color: 'var(--border)' }}>·</span>
                <span style={{ color: 'var(--accent)' }}>💎 Pro: unlimited</span>
              </div>
            </div>
        </div>
      </div>

      {/* STATS BAR */}
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '32px 24px' }}>

        {/* FEATURE SHOWCASE */}
        <div style={{ marginBottom: '64px' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <div style={{ color: 'var(--accent)', fontSize: '10px', letterSpacing: '3px', fontWeight: 700, marginBottom: '12px' }}>WHAT YOU GET</div>
            <div style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-0.5px', marginBottom: '10px' }}>Everything you need. Nothing you don't.</div>
            <div style={{ color: 'var(--text-3)', fontSize: '15px', maxWidth: '520px', margin: '0 auto', lineHeight: 1.6 }}>Three tools that tell you if a stock deserves your money — in plain language.</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>

            {/* Easy Mode Score */}
            <div className="glass reveal" style={{ padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ position: 'relative', width: '100px', height: '100px' }}>
                  <svg width="100" height="100" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="9" />
                    <circle cx="50" cy="50" r="42" fill="none" stroke="#34d399" strokeWidth="9" strokeLinecap="round"
                      strokeDasharray="264" strokeDashoffset={264 - 264 * 0.78} />
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ fontSize: '28px', fontWeight: 800, color: '#34d399', lineHeight: 1 }}>78</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '2px' }}>/ 100</div>
                  </div>
                </div>
              </div>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 800, marginBottom: '10px' }}>Easy Mode Score</div>
                <div style={{ color: 'var(--text-3)', fontSize: '14px', lineHeight: 1.7 }}>A 0–100 health score that weighs margins, growth, cash flow and debt — so you don't have to.</div>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {['ROIC', 'Margins', 'FCF', 'Debt'].map(t => (
                  <span key={t} style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)', color: '#34d399', fontSize: '10px', fontWeight: 700, padding: '3px 9px', borderRadius: '6px' }}>{t}</span>
                ))}
              </div>
            </div>

            {/* Fair Value */}
            <div className="glass reveal" style={{ padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingTop: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-3)', fontWeight: 600 }}>Current price</span>
                  <span style={{ fontSize: '17px', fontWeight: 800 }}>$182.50</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-3)', fontWeight: 600 }}>Our estimate</span>
                  <span style={{ fontSize: '17px', fontWeight: 800, color: '#34d399' }}>$210.00</span>
                </div>
                <div style={{ position: 'relative', height: '10px', borderRadius: '6px', background: 'linear-gradient(90deg, #34d399 0%, #fbbf24 50%, #f87171 100%)', opacity: 0.4, marginTop: '4px' }}>
                  <div style={{ position: 'absolute', top: '-5px', width: '4px', height: '20px', borderRadius: '2px', background: 'white', left: '36%' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-3)' }}>
                  <span>Cheap</span><span>Fair</span><span>Expensive</span>
                </div>
                <div style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)', borderRadius: '10px', padding: '8px 12px', textAlign: 'center' }}>
                  <span style={{ color: '#34d399', fontSize: '13px', fontWeight: 700 }}>UNDERVALUED · +15% upside</span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 800, marginBottom: '10px' }}>Fair Value Check</div>
                <div style={{ color: 'var(--text-3)', fontSize: '14px', lineHeight: 1.7 }}>See instantly if a stock is cheap, fairly priced or overvalued — based on earnings and growth.</div>
              </div>
            </div>

            {/* Quality Scorecard */}
            <div className="glass reveal" style={{ padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {[
                  { label: 'Core Business', score: 4.2, color: '#34d399' },
                  { label: 'Opportunity', score: 3.8, color: '#a78bfa' },
                  { label: 'Growth Quality', score: 4.5, color: '#34d399' },
                  { label: 'Final Note', score: 4.2, color: '#34d399', highlight: true },
                ].map(m => (
                  <div key={m.label} style={{ background: m.highlight ? 'rgba(167,139,250,0.08)' : 'rgba(255,255,255,0.04)', border: `1px solid ${m.highlight ? 'rgba(167,139,250,0.2)' : 'rgba(255,255,255,0.06)'}`, borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '9px', color: 'var(--text-3)', marginBottom: '6px', fontWeight: 700, letterSpacing: '0.5px' }}>{m.label.toUpperCase()}</div>
                    <div style={{ fontSize: '26px', fontWeight: 800, color: m.color, lineHeight: 1 }}>{m.score}</div>
                    <div style={{ fontSize: '9px', color: 'var(--text-3)', marginTop: '2px' }}>/5</div>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 800, marginBottom: '10px' }}>Quality Scorecard</div>
                <div style={{ color: 'var(--text-3)', fontSize: '14px', lineHeight: 1.7 }}>Sector-adjusted scoring across 4 dimensions. Cuts through noise to find genuinely great businesses.</div>
              </div>
            </div>

          </div>
        </div>

        {/* HOW IT WORKS */}
        <div style={{ marginBottom: '48px' }}>
          <div style={{ color: 'var(--text-3)', fontSize: '9px', letterSpacing: '3px', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
            HOW IT WORKS
          </div>
          <div className="how-it-works-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            {[
              { step: '01', title: 'Search a company', desc: 'Type any company name. Traqcker pulls real data directly from company filings — no opinions, no noise.' },
              { step: '02', title: 'Does it deserve your money?', desc: 'See instantly if the company is financially healthy and whether the price makes sense.' },
              { step: '03', title: 'Make the decision', desc: 'No buy or sell recommendations. Just the facts you need to decide for yourself.' },
            ].map(s => (
              <div key={s.step} className="glass reveal" style={{ padding: '28px 24px' }}>
                <div style={{ color: 'var(--accent)', fontSize: '36px', fontWeight: 700, letterSpacing: '-1px', marginBottom: '16px', opacity: 0.35, fontFamily: 'Space Grotesk, sans-serif' }}>{s.step}</div>
                <div style={{ color: 'var(--text)', fontSize: '14px', fontWeight: 600, marginBottom: '8px', fontFamily: 'Space Grotesk, sans-serif' }}>{s.title}</div>
                <div style={{ color: 'var(--text-3)', fontSize: '13px', lineHeight: 1.7 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* TESTIMONIALS */}
        {(() => {
          const cols = [
            [
              { text: "Finally understand what I'm buying. The Easy Mode score tells me everything in 10 seconds.", name: "Sarah K.", role: "Retail investor, 3 years" },
              { text: "I use it every Sunday to check my watchlist. Takes 5 minutes instead of 5 hours.", name: "Marcus T.", role: "Long-term investor" },
              { text: "My whole family now uses Traqcker before making any investment decision.", name: "Elena R.", role: "Parent & part-time investor" },
              { text: "Spin the Market helped me discover stocks I never would have found otherwise.", name: "James L.", role: "Dividend investor" },
            ],
            [
              { text: "I avoided a disaster — the quality score flagged weak cash flow before the stock dropped 40%.", name: "David M.", role: "Self-taught investor" },
              { text: "The Fair Value bar is brilliant. So simple but so powerful.", name: "Priya S.", role: "Software engineer & investor" },
              { text: "Data straight from SEC filings — not some analyst's opinion. That's what I needed.", name: "Tom H.", role: "Former banker, now indie" },
            ],
            [
              { text: "Screener + Compare is insane for finding undervalued stocks. Worth every penny of Pro.", name: "Chris B.", role: "Pro subscriber" },
              { text: "Been investing for 10 years and this is the most honest stock tool I've found.", name: "Anita W.", role: "Experienced retail investor" },
              { text: "I cancelled my Bloomberg subscription after finding this.", name: "Rafael G.", role: "Independent analyst" },
            ],
            [
              { text: "As someone with zero finance background, this is the first tool that actually makes sense to me.", name: "Mia J.", role: "First-time investor" },
              { text: "Free tier is already better than paid tools I've tried before.", name: "Nate F.", role: "College student investor" },
              { text: "The sector-adjusted scoring is a game changer. A 20% margin means different things in tech vs retail.", name: "Sophie D.", role: "Finance grad, DIY investor" },
            ],
          ];
          const dirs = ['up', 'down', 'up', 'down'];
          const speeds = ['32s', '28s', '36s', '30s'];
          return (
            <div style={{ marginBottom: '64px' }}>
              <style>{`
                @keyframes scrollUp { 0% { transform: translateY(0); } 100% { transform: translateY(-50%); } }
                @keyframes scrollDown { 0% { transform: translateY(-50%); } 100% { transform: translateY(0); } }
                .testimonial-col { display: flex; flex-direction: column; gap: 14px; }
                .testimonial-col-up { animation-name: scrollUp; animation-timing-function: linear; animation-iteration-count: infinite; }
                .testimonial-col-down { animation-name: scrollDown; animation-timing-function: linear; animation-iteration-count: infinite; }
              `}</style>
              <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                <div style={{ color: 'var(--accent)', fontSize: '10px', letterSpacing: '3px', fontWeight: 700, marginBottom: '12px' }}>WHAT INVESTORS SAY</div>
                <div style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-0.5px' }}>Trusted by independent investors</div>
              </div>
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px',
                height: '480px', overflow: 'hidden',
                WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)',
                maskImage: 'linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)',
              }}>
                {cols.map((cards, ci) => (
                  <div key={ci} style={{ overflow: 'hidden' }}>
                    <div
                      className={`testimonial-col testimonial-col-${dirs[ci]}`}
                      style={{ animationDuration: speeds[ci] }}
                    >
                      {[...cards, ...cards].map((c, i) => (
                        <div key={i} className="glass" style={{ padding: '20px', flexShrink: 0 }}>
                          <div style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.7, marginBottom: '14px' }}>"{c.text}"</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text)' }}>{c.name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>{c.role}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* CTA MID */}
        <div className="reveal" style={{ marginBottom: '64px', position: 'relative', borderRadius: '24px', overflow: 'hidden', padding: '56px 48px', background: 'linear-gradient(135deg, rgba(167,139,250,0.10) 0%, rgba(96,165,250,0.06) 100%)', border: '1px solid rgba(167,139,250,0.2)' }}>
          <div style={{ position: 'absolute', top: '-60px', right: '-60px', width: '300px', height: '300px', background: 'radial-gradient(ellipse, rgba(167,139,250,0.18) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '48px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '280px' }}>
              <div style={{ color: 'var(--accent)', fontSize: '11px', letterSpacing: '3px', fontWeight: 700, marginBottom: '14px' }}>FREE TO START · NO CREDIT CARD</div>
              <div style={{ fontSize: '36px', fontWeight: 800, letterSpacing: '-1px', lineHeight: 1.1, marginBottom: '20px' }}>
                Start in 30 seconds.<br /><span style={{ color: 'var(--accent)' }}>Cancel whenever.</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  'Easy Mode score for any of 8,000+ stocks',
                  'Fair Value estimate based on real earnings',
                  'Community Buy / Hold / Sell votes',
                  'Stock of the Week picks',
                ].map(f => (
                  <div key={f} style={{ display: 'flex', gap: '10px', alignItems: 'center', color: 'var(--text-2)', fontSize: '14px' }}>
                    <span style={{ color: '#34d399', fontWeight: 800, fontSize: '16px', flexShrink: 0 }}>✓</span>
                    {f}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', flexShrink: 0 }}>
              <a href="/sign-up" className="btn-primary" style={{ fontSize: '16px', padding: '16px 40px', borderRadius: '14px', whiteSpace: 'nowrap' }}>
                Start for free →
              </a>
              <a href="/pricing" style={{ color: 'var(--text-3)', fontSize: '13px', textDecoration: 'none', fontWeight: 600 }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}>
                See what Pro unlocks →
              </a>
            </div>
          </div>
        </div>

        {/* FREE VS PRO TABLE */}
        {(() => {
          const rows = [
            { feature: 'Easy Mode Score',         free: true,        pro: true },
            { feature: 'Fair Value Check',         free: true,        pro: true },
            { feature: 'Community Votes',          free: true,        pro: true },
            { feature: 'Stock of the Week',        free: true,        pro: true },
            { feature: 'Price Charts',             free: true,        pro: true },
            { feature: 'Watchlist',                free: '5 stocks',  pro: 'Unlimited' },
            { feature: 'Spin the Market',          free: '3 / day',   pro: 'Unlimited' },
            { feature: 'Quality Scorecard',        free: false,       pro: true },
            { feature: 'Full Financial Statements',free: false,       pro: true },
            { feature: 'DCF / Graham Valuation',   free: false,       pro: true },
            { feature: 'Stock Screener (8,000+)',  free: false,       pro: true },
            { feature: 'Compare Stocks',           free: false,       pro: true },
          ];
          const Cell = ({ val, accent }) => {
            if (val === true)  return <span style={{ color: '#34d399', fontSize: '16px', fontWeight: 800 }}>✓</span>;
            if (val === false) return <span style={{ color: 'var(--border-2)', fontSize: '14px' }}>—</span>;
            return <span style={{ color: accent ? 'var(--accent)' : 'var(--text-3)', fontSize: '12px', fontWeight: 700 }}>{val}</span>;
          };
          return (
            <div style={{ marginBottom: '64px' }}>
              <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                <div style={{ color: 'var(--accent)', fontSize: '10px', letterSpacing: '3px', fontWeight: 700, marginBottom: '12px' }}>PLANS</div>
                <div style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-0.5px' }}>Free vs Pro</div>
              </div>
              <div className="glass" style={{ overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '16px 24px', textAlign: 'left', color: 'var(--text-3)', fontSize: '12px', fontWeight: 700, letterSpacing: '1px', width: '55%' }}>FEATURE</th>
                      <th style={{ padding: '16px 24px', textAlign: 'center', color: 'var(--text-3)', fontSize: '12px', fontWeight: 700, letterSpacing: '1px' }}>FREE</th>
                      <th style={{ padding: '16px 24px', textAlign: 'center', fontSize: '12px', fontWeight: 800, letterSpacing: '1px', background: 'rgba(167,139,250,0.06)', borderLeft: '1px solid rgba(167,139,250,0.15)' }}>
                        <span style={{ background: 'linear-gradient(135deg,#a78bfa,#60a5fa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>PRO</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} style={{ borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                        <td style={{ padding: '14px 24px', fontSize: '14px', color: 'var(--text-2)', fontWeight: 600 }}>{r.feature}</td>
                        <td style={{ padding: '14px 24px', textAlign: 'center' }}><Cell val={r.free} /></td>
                        <td style={{ padding: '14px 24px', textAlign: 'center', background: 'rgba(167,139,250,0.04)', borderLeft: '1px solid rgba(167,139,250,0.15)' }}><Cell val={r.pro} accent /></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '1px solid var(--border)', background: 'rgba(167,139,250,0.04)' }}>
                      <td style={{ padding: '20px 24px', color: 'var(--text-3)', fontSize: '13px', fontWeight: 600' }}>No credit card required to start</td>
                      <td style={{ padding: '20px 24px', textAlign: 'center' }}>
                        <a href="/sign-up" className="btn-secondary" style={{ textDecoration: 'none', fontSize: '13px', padding: '9px 18px' }}>Start free</a>
                      </td>
                      <td style={{ padding: '20px 24px', textAlign: 'center', borderLeft: '1px solid rgba(167,139,250,0.15)' }}>
                        <a href="/pricing" className="btn-primary" style={{ textDecoration: 'none', fontSize: '13px', padding: '9px 18px' }}>Go Pro →</a>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          );
        })()}

        {/* FAQ */}
        {(() => {
          const faqs = [
            { q: 'Is it really free?', a: 'Yes — no credit card, no trial. Easy Mode score, Fair Value check, community votes and Stock of the Week are free forever for every stock. Pro unlocks full financial statements, the screener, DCF valuation and Compare.' },
            { q: 'Where does the data come from?', a: 'Directly from SEC EDGAR filings (the same source public companies are legally required to file with), supplemented by Finnhub for real-time prices and international stocks. No analyst opinions, no aggregated estimates — primary sources only.' },
            { q: 'Do I need a finance background to use this?', a: 'No. Easy Mode is specifically designed for people who don\'t read balance sheets. The score, the Fair Value bar and the plain-language summaries give you everything you need to make an informed decision without a finance degree.' },
            { q: 'How is this different from other stock apps?', a: 'Most apps show you price charts and analyst ratings. We show you the actual business: margins, cash flow, return on capital, debt levels — scored and explained in plain language. No buy/sell recommendations. Just the facts.' },
            { q: 'What exactly does Pro include?', a: 'Full income statement, balance sheet and cash flow history. DCF / Graham intrinsic value model. Stock screener across 8,000+ companies with 10+ filters. Side-by-side comparison of up to 3 stocks. Unlimited Spin the Market.' },
          ];
          return (
            <div style={{ marginBottom: '64px' }}>
              <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                <div style={{ color: 'var(--accent)', fontSize: '10px', letterSpacing: '3px', fontWeight: 700, marginBottom: '12px' }}>FAQ</div>
                <div style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-0.5px' }}>Common questions</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {faqs.map((f, i) => (
                  <div key={i} className="glass" style={{ overflow: 'hidden', cursor: 'pointer' }} onClick={() => setFaqOpen(faqOpen === i ? null : i)}>
                    <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                      <span style={{ fontSize: '15px', fontWeight: 700, color: faqOpen === i ? 'var(--accent)' : 'var(--text)' }}>{f.q}</span>
                      <span style={{ color: 'var(--accent)', fontSize: '18px', fontWeight: 300, flexShrink: 0, transform: faqOpen === i ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s', lineHeight: 1 }}>+</span>
                    </div>
                    {faqOpen === i && (
                      <div style={{ padding: '0 24px 20px', color: 'var(--text-2)', fontSize: '14px', lineHeight: 1.8, borderTop: '1px solid var(--border)' }}>
                        <div style={{ paddingTop: '16px' }}>{f.a}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* FOOTER */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-3)', fontSize: '10px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
            <a href="/privacy" style={{ color: 'var(--text-3)', textDecoration: 'none', letterSpacing: '1px' }}>PRIVACY</a>
            <a href="/terms" style={{ color: 'var(--text-3)', textDecoration: 'none', letterSpacing: '1px' }}>TERMS</a>
            <a href="/about" style={{ color: 'var(--text-3)', textDecoration: 'none', letterSpacing: '1px' }}>ABOUT</a>
            <a href="/pricing" style={{ color: 'var(--text-3)', textDecoration: 'none', letterSpacing: '1px' }}>PRICING</a>
            <a href="https://launchllama.co?utm_source=badge&utm_medium=referral" target="_blank" rel="noopener">
              <img src="https://speaktechenglish.com/wp-content/uploads/2026/04/Screenshot_2026-04-09_at_17.40.44-removebg-preview.png" alt="Featured on Launch Llama" width="100" height="25" style={{ opacity: 0.7, verticalAlign: 'middle' }} />
            </a>
          </div>
          <div style={{ letterSpacing: '1px' }}>DATA: SEC EDGAR · FINNHUB · YAHOO FINANCE · NOT INVESTMENT ADVICE · © 2026 TRAQCKER</div>
        </div>
      </div>
    </div>

      {/* STICKY MOBILE WIDGET */}
      {!isSignedIn && (
        <a href="/sign-up" className="mobile-only" style={{
          position: 'fixed', bottom: '76px', right: '16px', zIndex: 100,
          display: showStickyBar ? 'flex' : 'none',
          alignItems: 'center', gap: '8px',
          background: 'linear-gradient(135deg, #a78bfa, #60a5fa)',
          color: '#000', fontFamily: 'Nunito, sans-serif', fontWeight: 800,
          fontSize: '14px', padding: '12px 20px', borderRadius: '50px',
          textDecoration: 'none',
          boxShadow: '0 4px 24px rgba(167,139,250,0.4)',
          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = '0 6px 32px rgba(167,139,250,0.55)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 24px rgba(167,139,250,0.4)'; }}>
          ✦ Start free
        </a>
      )}
    </main>
  );
}