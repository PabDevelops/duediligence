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
              <p style={{ color: 'var(--text-2)', fontSize: '15px', lineHeight: 1.6, marginBottom: '20px', fontFamily: 'Nunito, sans-serif' }}>
                Real data from company filings. No finance degree needed. Free to start.
              </p>
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
          <p style={{ color: 'var(--text-2)', fontSize: '17px', lineHeight: 1.6, marginBottom: '28px', maxWidth: '560px' }}>
            Real data from company filings. No finance degree needed. Free to start.
          </p>

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

        {/* CTA BOTTOM */}
        <div className="glass reveal" style={{ padding: '48px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '48px', background: 'linear-gradient(135deg, rgba(167,139,250,0.08), rgba(96,165,250,0.05))' }}>
          <div>
            <div style={{ color: 'var(--accent)', fontSize: '11px', letterSpacing: '3px', marginBottom: '10px', fontFamily: 'Space Grotesk, sans-serif' }}>GET STARTED TODAY</div>
            <div style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.5px', marginBottom: '8px', fontFamily: 'Space Grotesk, sans-serif' }}>
              Free access. No credit card.
            </div>
            <div style={{ color: 'var(--text-3)', fontSize: '13px' }}>
              Overview + Quality Scorecard for every stock. Upgrade to Pro for Financials, DCF, Screener and Compare.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', flexShrink: 0 }}>
            <a href="/sign-up" className="btn-primary">Start for free →</a>
            <a href="/pricing" className="btn-secondary"
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(167,139,250,0.4)'; e.currentTarget.style.color = 'var(--accent)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-3)'; }}>
              VIEW PRICING
            </a>
          </div>
        </div>

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

    </main>
  );
}