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
  const [isMobile, setIsMobile] = useState(false);
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
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
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
    <main style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', fontFamily: 'JetBrains Mono, monospace' }}>
      <Topbar />
      <MarketBar />
      {isMobile && (
        <div style={{ padding: '20px 16px' }}>

          {/* Hero card */}
          <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: '20px', padding: '24px 20px', marginBottom: '16px' }}>
            <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '30px', fontWeight: 700, letterSpacing: '-0.5px', lineHeight: 1.15, marginBottom: '12px' }}>
              Know if a stock is worth buying.<br />
              <span style={{ color: 'var(--accent)' }}>In seconds.</span>
            </h1>
            <p style={{ color: 'var(--text-2)', fontSize: '13px', lineHeight: 1.7, marginBottom: '20px' }}>
              Type a ticker. Get a simple score, a fair value, and what other everyday investors think. No jargon.
            </p>
            <div style={{ display: 'flex', gap: '0', marginBottom: '14px', borderRadius: '14px', overflow: 'hidden', border: '1px solid var(--border-2)' }}>
              <input
                style={{ flex: 1, minWidth: 0, background: 'var(--bg-2)', border: 'none', color: 'var(--accent)', fontFamily: 'JetBrains Mono, monospace', fontSize: '18px', fontWeight: 700, padding: '14px 16px', outline: 'none', letterSpacing: '3px' }}
                placeholder="AAPL"
                value={ticker}
                onChange={e => setTicker(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && go()}
                maxLength={6}
              />
              <button onClick={() => go()}
                style={{ flexShrink: 0, whiteSpace: 'nowrap', background: 'var(--accent)', color: '#0B0E14', border: 'none', padding: '14px 18px', fontFamily: 'Space Grotesk, sans-serif', fontSize: '13px', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.5px' }}>
                GO →
              </button>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
              {['AAPL', 'MSFT', 'NVDA', 'V', 'GOOGL'].map(t => (
                <button key={t} onClick={() => go(t)}
                  style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: '10px', color: 'var(--text-2)', padding: '6px 12px', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', cursor: 'pointer', letterSpacing: '1px' }}>
                  {t}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <a href="/sign-up" style={{ flex: 1, background: 'var(--accent)', color: '#0B0E14', padding: '14px', borderRadius: '14px', fontFamily: 'Space Grotesk, sans-serif', fontSize: '13px', fontWeight: 700, letterSpacing: '0.3px', textDecoration: 'none', textAlign: 'center' }}>
                Start free
              </a>
              <a href="/pricing" style={{ flex: 1, background: 'none', border: '1px solid var(--border-2)', borderRadius: '14px', color: 'var(--text-2)', padding: '14px', fontFamily: 'Space Grotesk, sans-serif', fontSize: '13px', fontWeight: 600, letterSpacing: '0.3px', textDecoration: 'none', textAlign: 'center' }}>
                Pricing
              </a>
            </div>
          </div>

          {/* Stock of the Week - MOBILE ONLY - right after hero */}
          {sotw && (
            <a href={`/stock/${sotw?.ticker}`} style={{ display: 'block', padding: '0', marginBottom: '24px', textDecoration: 'none' }}>
              <div style={{ background: 'linear-gradient(135deg, var(--accent-dim), transparent)', border: '1.5px solid var(--accent)', borderRadius: '20px', padding: '24px', cursor: 'pointer', transition: 'all 0.2s', marginBottom: '16px' }} onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.transform = 'scale(1.02)'; }} onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.transform = 'scale(1)'; }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '16px' }}>
                  <div style={{ fontSize: '28px', flexShrink: 0 }}>🔥</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--accent)', fontWeight: 600, fontSize: '11px', letterSpacing: '1px', marginBottom: '4px' }}>STOCK OF THE WEEK</div>
                    <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>
                      {sotw?.ticker}
                      <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-2)', marginLeft: '6px' }}>– {sotw?.name}</span>
                    </div>
                  </div>
                </div>
                
                <div style={{ borderTop: '1px solid var(--accent)', paddingTop: '16px', marginBottom: '16px' }}>
                  <div style={{ color: 'var(--text-3)', fontSize: '10px', letterSpacing: '1px', marginBottom: '8px' }}>COMMUNITY CONSENSUS</div>
                  <div style={{ display: 'flex', height: '12px', borderRadius: '6px', overflow: 'hidden', marginBottom: '10px' }}>
                    <div style={{ background: `linear-gradient(90deg, var(--green) 0%, rgba(52, 211, 153, 0.7) 100%)`, width: `${sotwVotes.BUY}%` }} />
                    <div style={{ background: `linear-gradient(90deg, var(--amber) 0%, rgba(251, 191, 36, 0.7) 100%)`, width: `${sotwVotes.HOLD}%` }} />
                    <div style={{ background: `linear-gradient(90deg, var(--red) 0%, rgba(248, 113, 113, 0.7) 100%)`, width: `${sotwVotes.SELL}%` }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-2)' }}>
                    <span>● {sotwVotes.BUY}% Buy</span>
                    <span>● {sotwVotes.HOLD}% Hold</span>
                    <span>● {sotwVotes.SELL}% Sell</span>
                  </div>
                  {sotwVotes.total > 0 && (
                    <div style={{ marginTop: '8px', fontSize: '10px', color: 'var(--text-3)', textAlign: 'center' }}>
                      {sotwVotes.total} {sotwVotes.total === 1 ? 'person' : 'people'} voted
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {['BUY', 'HOLD', 'SELL'].slice(0, 2).map(v => (
                    <button key={v} onClick={async (e) => { e.stopPropagation(); if (!isSignedIn) { router.push('/sign-in'); return; } fetch('/api/votes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ticker: sotw?.ticker, vote: v }) }).then(() => { fetch(`/api/votes?ticker=${sotw?.ticker}`).then(r => r.json()).then(d => setSotwVotes({ ...d.percentages, total: d.total })); }); }} style={{ padding: '10px', borderRadius: '12px', background: 'var(--accent)', color: '#0B0E14', border: 'none', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}>
                      Vote {v}
                    </button>
                  ))}
                </div>
              </div>
            </a>
          )}

          {/* What you get - meter-style cards instead of plain grid */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-3)', fontSize: '11px', letterSpacing: '2px', marginBottom: '10px', paddingLeft: '4px' }}>
              WHAT YOU GET
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { icon: '🟢', title: 'Easy Mode score', desc: 'A simple 0-100 verdict for any stock' },
                { icon: '👍', title: 'Community votes', desc: 'See what other everyday investors think' },
                { icon: '💰', title: 'Price check', desc: 'Is it overpriced, fair, or underpriced right now?' },
              ].map(f => (
                <div key={f.title} style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: '16px', padding: '14px 16px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{ fontSize: '20px', lineHeight: 1.4 }}>{f.icon}</div>
                  <div>
                    <div style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text)', fontSize: '14px', fontWeight: 600, marginBottom: '3px' }}>{f.title}</div>
                    <div style={{ color: 'var(--text-3)', fontSize: '12px', lineHeight: 1.5 }}>{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Free access callout */}
            <div style={{ marginTop: '16px', padding: '14px 12px', background: 'rgba(167, 139, 250, 0.08)', border: '1px solid var(--accent)', borderRadius: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 600, letterSpacing: '0.5px' }}>
                ✨ Everything free. No paywalls.
              </div>
            </div>
          </div>

          {/* Stats strip */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
            {[
              { val: '8,000+', label: 'US STOCKS' },
              { val: 'FREE', label: 'EASY MODE' },
            ].map(s => (
              <div key={s.label} style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: '16px', padding: '16px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--accent)', fontSize: '22px', fontWeight: 700 }}>{s.val}</div>
                <div style={{ color: 'var(--text-3)', fontSize: '10px', letterSpacing: '2px', marginTop: '4px' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {movers && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-3)', fontSize: '11px', letterSpacing: '2px', marginBottom: '10px', paddingLeft: '4px' }}>MARKET MOVERS</div>
              <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden' }}>
                <TableHeader title="▲ TOP GAINERS" color="var(--green)" />
                {movers.gainers.slice(0, 5).map(s => <MoverRow key={s.ticker} s={s} router={router} />)}
              </div>
            </div>
          )}

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
      )}

      {!isMobile && <>
      {/* Ticker tape */}
      <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-1)', overflow: 'hidden', whiteSpace: 'nowrap', padding: '6px 0' }}>
        <style>{`
          @keyframes ticker { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
          .ticker-inner { display: inline-flex; animation: ticker 40s linear infinite; }
          .ticker-inner:hover { animation-play-state: paused; }
        `}</style>
        <div className="ticker-inner">
          {['AAPL','MSFT','NVDA','GOOGL','AMZN','META','TSLA','V','JPM','JNJ','WMT','PG','XOM','CVX','HD','KO','PEP','ABBV','MRK','LLY','COST','TMO','ABT','MCD','CRM','ACN','BAC','AVGO','CSCO','TXN','QCOM','INTC','AMD','ORCL','ADBE','NFLX','PYPL','UNH','GS','MS','AAPL','MSFT','NVDA','GOOGL','AMZN','META','TSLA','V','JPM','JNJ','WMT','PG','XOM','CVX','HD','KO','PEP','ABBV','MRK','LLY','COST','TMO','ABT','MCD','CRM','ACN','BAC','AVGO','CSCO','TXN','QCOM','INTC','AMD','ORCL','ADBE','NFLX','PYPL','UNH','GS','MS'].map((t, i) => (
            <span key={i} onClick={() => router.push(`/stock/${t}`)}
              style={{ display: 'inline-block', padding: '0 20px', color: 'var(--text-3)', fontSize: '10px', letterSpacing: '2px', cursor: 'pointer', borderRight: '1px solid var(--border)' }}
              onMouseEnter={e => e.target.style.color = 'var(--accent)'}
              onMouseLeave={e => e.target.style.color = 'var(--text-3)'}>
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* HERO */}
      <div style={{ borderBottom: '1px solid var(--border)', padding: '48px 24px 0', maxWidth: '1400px', margin: '0 auto', boxSizing: 'border-box', width: '100%' }}>

        {/* Top: headline + search */}
        <div style={{ marginBottom: '40px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'var(--accent-dim)', border: '1px solid var(--accent)', padding: '4px 12px', marginBottom: '20px' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
            <span style={{ color: 'var(--accent)', fontSize: '10px', letterSpacing: '2px', fontWeight: 700 }}>LIVE · SEC EDGAR · FINNHUB</span>
          </div>

          <h1 style={{ fontSize: '56px', fontWeight: 700, letterSpacing: '-2px', lineHeight: 1.0, marginBottom: '28px', whiteSpace: 'nowrap' }}>
            Know if a stock is worth it.<span style={{ color: 'var(--accent)' }}> In seconds.</span>
          </h1>

          {/* Search bar — full width */}
          <div style={{ position: 'relative', zIndex: 50, maxWidth: '600px' }}>
            <div style={{ display: 'flex' }}>
              <input
                style={{ flex: 1, background: 'var(--bg-2)', border: '1px solid var(--border-2)', borderRight: 'none', color: 'var(--accent)', fontFamily: 'JetBrains Mono, monospace', fontSize: '22px', fontWeight: 700, padding: '14px 20px', outline: 'none', letterSpacing: '4px' }}
                placeholder="AAPL"
                value={searchQ || ticker}
                onChange={e => { const v = e.target.value; setSearchQ(v); setTicker(v.toUpperCase()); setShowSuggestions(true); }}
                onKeyDown={e => { if (e.key === 'Enter') { go(); setShowSuggestions(false); } if (e.key === 'Escape') setShowSuggestions(false); }}
                maxLength={50}
                onFocus={e => { e.target.style.borderColor = 'var(--accent)'; setShowSuggestions(true); }}
                onBlur={e => { e.target.style.borderColor = 'var(--border-2)'; setTimeout(() => setShowSuggestions(false), 200); }}
              />
              <button onClick={() => go()}
                style={{ background: 'var(--accent)', color: '#000', border: 'none', padding: '14px 32px', fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', fontWeight: 700, cursor: 'pointer', letterSpacing: '1px', whiteSpace: 'nowrap' }}
                onMouseEnter={e => e.target.style.opacity = '0.85'}
                onMouseLeave={e => e.target.style.opacity = '1'}>
                ANALYZE →
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
                style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-3)', padding: '3px 10px', fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', cursor: 'pointer', letterSpacing: '1px' }}
                onMouseEnter={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.color = 'var(--accent)'; }}
                onMouseLeave={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.color = 'var(--text-3)'; }}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Bottom: SOTW left | Spin right */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'var(--border)' }}>

          {/* SOTW */}
          {sotw ? (
            <div style={{ background: 'var(--bg-1)', padding: '24px 28px' }}>
              <a href={`/stock/${sotw.ticker}`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <span style={{ fontSize: '16px' }}>🔥</span>
                <span style={{ color: 'var(--accent)', fontSize: '10px', fontWeight: 700, letterSpacing: '1px' }}>STOCK OF THE WEEK</span>
                <span style={{ color: 'var(--text)', fontSize: '13px', fontWeight: 700 }}>{sotw.ticker}</span>
                <span style={{ color: 'var(--text-3)', fontSize: '11px' }}>– {sotw.name}</span>
              </a>
              <div style={{ display: 'flex', height: '6px', overflow: 'hidden', marginBottom: '6px' }}>
                <div style={{ background: 'var(--green)', width: `${sotwVotes.BUY}%`, transition: 'width 0.4s' }} />
                <div style={{ background: 'var(--amber)', width: `${sotwVotes.HOLD}%`, transition: 'width 0.4s' }} />
                <div style={{ background: 'var(--red)', width: `${sotwVotes.SELL}%`, transition: 'width 0.4s' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '12px' }}>
                <span style={{ color: 'var(--green)' }}>● {sotwVotes.BUY}% Buy</span>
                <span style={{ color: 'var(--text-3)' }}>{sotwVotes.total} votes</span>
                <span style={{ color: 'var(--red)' }}>{sotwVotes.SELL}% Sell ●</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderTop: '1px solid var(--border)' }}>
                {['BUY', 'HOLD', 'SELL'].map((v, i) => (
                  <button key={v}
                    onClick={async (e) => {
                      e.preventDefault();
                      if (!isSignedIn) { router.push('/sign-in'); return; }
                      await fetch('/api/votes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ticker: sotw.ticker, vote: v }) });
                      fetch(`/api/votes?ticker=${sotw.ticker}`).then(r => r.json()).then(d => setSotwVotes({ ...d.percentages, total: d.total }));
                    }}
                    style={{ padding: '10px', background: 'none', border: 'none', borderRight: i < 2 ? '1px solid var(--border)' : 'none', color: v === 'BUY' ? 'var(--green)' : v === 'SELL' ? 'var(--red)' : 'var(--amber)', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: '11px', cursor: 'pointer', letterSpacing: '1px' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ background: 'var(--bg-1)', padding: '24px 28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: 'var(--text-3)', fontSize: '10px', letterSpacing: '2px' }}>LOADING...</span>
            </div>
          )}

            {/* Discover / Slot machine */}
            <div style={{ background: 'var(--bg-1)', padding: '24px 28px', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ color: 'var(--accent)', fontSize: '10px', letterSpacing: '2px', marginBottom: '4px' }}>⚡ SPIN THE MARKET</div>
                  <div style={{ color: 'var(--text-2)', fontSize: '11px' }}>Discover a random stock from 8,000+</div>
                </div>
                {discoverRemaining !== null && discoverRemaining !== 'unlimited' && discoverState !== 'limited' && (
                  <span style={{ color: 'var(--text-3)', fontSize: '10px', letterSpacing: '1px', background: 'var(--bg-2)', border: '1px solid var(--border)', padding: '3px 8px' }}>
                    {discoverRemaining} LEFT
                  </span>
                )}
              </div>

              {/* Slot display */}
              <div style={{
                background: 'var(--bg)', border: `1.5px solid ${discoverState === 'revealed' ? 'var(--accent)' : discoverState === 'limited' ? 'var(--red)' : 'var(--border)'}`,
                height: '72px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'border-color 0.3s',
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
                    style={{ flex: 1, background: discoverState === 'spinning' ? 'var(--bg-2)' : 'var(--accent)', color: discoverState === 'spinning' ? 'var(--text-3)' : '#000', border: 'none', padding: '10px', cursor: discoverState === 'spinning' ? 'default' : 'pointer', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', fontWeight: 700, letterSpacing: '1px' }}>
                    {discoverState === 'spinning' ? 'SPINNING...' : discoverState === 'revealed' ? '⚡ SPIN AGAIN' : '⚡ SPIN'}
                  </button>
                  {discoverState === 'revealed' && discoverTicker && (
                    <button onClick={() => router.push(`/stock/${discoverTicker}`)}
                      style={{ flex: 1, background: 'none', border: '1px solid var(--accent)', color: 'var(--accent)', padding: '10px', cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', fontWeight: 700, letterSpacing: '1px' }}>
                      ANALYZE →
                    </button>
                  )}
                </div>
              ) : (
                <div>
                  <div style={{ color: 'var(--red)', fontSize: '10px', letterSpacing: '1px', marginBottom: '8px', textAlign: 'center' }}>
                    {isSignedIn ? 'DAILY LIMIT REACHED' : 'SIGN IN FOR MORE'}
                  </div>
                  <a href={isSignedIn ? '/pricing' : '/sign-up'}
                    style={{ display: 'block', background: 'var(--accent)', color: '#000', padding: '10px', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textDecoration: 'none', textAlign: 'center' }}>
                    {isSignedIn ? 'UPGRADE TO PRO →' : 'SIGN UP FREE →'}
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
      <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-1)' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '16px 24px', display: 'flex', gap: '48px', alignItems: 'center' }}>
          {[
            { val: '8,000+', label: 'US STOCKS' },
            { val: '15', label: 'DD QUESTIONS' },
            { val: '5', label: 'ANALYSIS DIMENSIONS' },
            { val: '100%', label: 'PRIMARY DATA' },
            { val: 'FREE', label: 'TO START' },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ color: 'var(--accent)', fontSize: '18px', fontWeight: 700, letterSpacing: '-0.5px' }}>{s.val}</div>
              <div style={{ color: 'var(--text-3)', fontSize: '9px', letterSpacing: '2px', marginTop: '2px' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '32px 24px' }}>

        {/* MARKET DATA */}
        {movers && (
          <>
            <div style={{ color: 'var(--text-3)', fontSize: '9px', letterSpacing: '3px', marginBottom: '12px' }}>MARKET DATA · UPDATED DAILY</div>

            {/* Gainers / Losers / Earnings */}
            <div className="market-grid" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr 1fr 1fr' : '1fr 1fr', gap: '1px', background: 'var(--border)', marginBottom: '1px' }}>
              <div style={{ background: 'var(--bg-1)', gridColumn: '1' }}>
                <TableHeader title="▲ TOP GAINERS" sub="TOP 10" color="var(--green)" />
                {movers.gainers.slice(0, 10).map(s => <MoverRow key={s.ticker} s={s} router={router} />)}
              </div>
              <div style={{ background: 'var(--bg-1)', gridColumn: '2' }}>
                <TableHeader title="▼ TOP LOSERS" sub="TOP 10" color="var(--red)" />
                {movers.losers.slice(0, 10).map(s => <MoverRow key={s.ticker} s={s} router={router} />)}
              </div>
              {isMobile && (
              <div style={{ background: 'var(--bg-1)', gridColumn: '3 / 5' }}>
                <TableHeader title="📅 UPCOMING EARNINGS" sub="NEXT 7 DAYS" />
                {earnings ? earnings.map(e => <EarningRow key={e.ticker + e.date} e={e} router={router} />) :
                  <div style={{ padding: '20px 12px', color: 'var(--text-3)', fontSize: '10px' }}>LOADING...</div>}
                {earnings?.length === 0 && <div style={{ padding: '20px 12px', color: 'var(--text-3)', fontSize: '10px' }}>NO EARNINGS THIS WEEK</div>}
              </div>
              )}
            </div>

            {/* Rankings - MOBILE ONLY */}
            {isMobile && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: 'var(--border)', marginBottom: '48px' }}>
              {[
                { title: 'TOP ROIC', data: movers.topRoic, metric: 'roic', suffix: '%' },
                { title: 'TOP FCF YIELD', data: movers.topFcfYield, metric: 'fcfYield', suffix: '%' },
                { title: 'TOP REV GROWTH', data: movers.topRevGrowth, metric: 'revGrowth', suffix: '%' },
                { title: 'TOP TRAQCKER SCORE', data: movers.topScore, metric: 'score', suffix: '' },
              ].map(({ title, data, metric, suffix }) => (
                <div key={title} style={{ background: 'var(--bg-1)' }}>
                  <TableHeader title={title} />
                  {data.map((s, i) => <RankRow key={s.ticker} s={s} rank={i + 1} metric={metric} suffix={suffix} router={router} />)}
                </div>
              ))}
            </div>
            )}
          </>
        )}

        {/* HOW IT WORKS */}
        <div style={{ marginBottom: '48px' }}>
          <div style={{ color: 'var(--text-3)', fontSize: '9px', letterSpacing: '3px', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
            HOW IT WORKS
          </div>
          <div className="how-it-works-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: 'var(--border)' }}>
            {[
              { step: '01', title: 'SEARCH A TICKER', desc: 'Enter any US stock ticker. Traqcker fetches real-time data directly from SEC EDGAR filings and Finnhub.' },
              { step: '02', title: 'ANALYZE THE BUSINESS', desc: 'Review quality scores, margins, cash flow, valuation multiples, and Graham DCF across 5 analysis dimensions.' },
              { step: '03', title: 'MAKE YOUR OWN CALL', desc: 'No recommendations. No noise. Just the data you need to form your own informed investment thesis.' },
            ].map(s => (
              <div key={s.step} style={{ background: 'var(--bg-1)', padding: '24px' }}>
                <div style={{ color: 'var(--accent)', fontSize: '32px', fontWeight: 700, letterSpacing: '-1px', marginBottom: '12px', opacity: 0.4 }}>{s.step}</div>
                <div style={{ color: 'var(--text)', fontSize: '12px', fontWeight: 700, letterSpacing: '1px', marginBottom: '8px' }}>{s.title}</div>
                <div style={{ color: 'var(--text-3)', fontSize: '11px', lineHeight: 1.7 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* FRAMEWORK */}
        <div style={{ marginBottom: '48px' }}>
          <div style={{ color: 'var(--text-3)', fontSize: '9px', letterSpacing: '3px', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
            ANALYSIS FRAMEWORK · 5 DIMENSIONS · 15 QUESTIONS
          </div>
          <div className="framework-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1px', background: 'var(--border)' }}>
            {[
              { num: '01', name: 'MANAGEMENT', desc: 'Guidance, compensation alignment, C-suite stability' },
              { num: '02', name: 'CONCENTRATION', desc: 'Customer, geography, and product diversification' },
              { num: '03', name: 'OP. TREND', desc: 'Margin expansion, FCF/share CAGR, ROIC vs WACC' },
              { num: '04', name: 'EARN. QUALITY', desc: 'Cash conversion, accruals, receivables growth' },
              { num: '05', name: 'TRANSPARENCY', desc: 'Guidance quality, risk disclosure, segment reporting' },
            ].map(d => (
              <div key={d.num} style={{ background: 'var(--bg-1)', padding: '20px 16px' }}>
                <div style={{ color: 'var(--accent)', fontSize: '10px', marginBottom: '8px', opacity: 0.5 }}>{d.num}</div>
                <div style={{ color: 'var(--text)', fontSize: '11px', fontWeight: 700, marginBottom: '8px', letterSpacing: '0.5px' }}>{d.name}</div>
                <div style={{ color: 'var(--text-3)', fontSize: '10px', lineHeight: 1.6 }}>{d.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA BOTTOM */}
        <div style={{ border: '1px solid var(--border)', padding: '48px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '48px', background: 'var(--bg-1)' }}>
          <div>
            <div style={{ color: 'var(--accent)', fontSize: '10px', letterSpacing: '3px', marginBottom: '8px' }}>GET STARTED TODAY</div>
            <div style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.5px', marginBottom: '8px' }}>
              Free access. No credit card.
            </div>
            <div style={{ color: 'var(--text-3)', fontSize: '12px' }}>
              Overview + Quality Scorecard for every stock. Upgrade to Pro for Financials, DCF, Screener and Compare.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', flexShrink: 0 }}>
            <a href="/sign-up" style={{ background: 'var(--accent)', color: '#000', padding: '12px 28px', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', fontWeight: 700, letterSpacing: '1px', textDecoration: 'none' }}>
              START FOR FREE →
            </a>
            <a href="/pricing" style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-3)', padding: '12px 28px', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', letterSpacing: '1px', textDecoration: 'none' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
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
    </>}

    </main>
  );
}