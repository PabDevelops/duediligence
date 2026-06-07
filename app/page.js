'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
      style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-2)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
      <img src={logoUrl(s.name)} alt="" style={{ width: 16, height: 16, objectFit: 'contain', background: 'white', padding: 1, flexShrink: 0 }}
        onError={e => e.target.style.display = 'none'} />
      <span style={{ color: 'var(--accent)', fontSize: '12px', fontWeight: 700, width: 52, flexShrink: 0 }}>{s.ticker}</span>
      <span style={{ color: 'var(--text-3)', fontSize: '11px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
      <span style={{ color: 'var(--text)', fontSize: '12px', flexShrink: 0 }}>${s.currentPrice?.toFixed(2)}</span>
      <span style={{ color: up ? 'var(--green)' : 'var(--red)', fontSize: '12px', fontWeight: 600, width: 68, textAlign: 'right', flexShrink: 0 }}>
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
  const router = useRouter();

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

  function go(t) {
    const tk = (t || ticker).toUpperCase().trim();
    if (!tk) return;
    router.push(`/stock/${tk}`);
  }

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', fontFamily: 'IBM Plex Mono, monospace' }}>
      <Topbar />
      <MarketBar />
      {isMobile && (
        <div style={{ background: 'var(--bg-1)', borderBottom: '1px solid var(--accent)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: 'var(--accent)', fontSize: '11px' }}>⚠</span>
          <span style={{ color: 'var(--text-2)', fontSize: '10px', letterSpacing: '0.5px', lineHeight: 1.5 }}>
            Traqcker is designed as a desktop terminal. For the best experience, open on a computer.
          </span>
        </div>
      )}

      {isMobile && (
        <div style={{ padding: '24px 16px' }}>
          <div style={{ marginBottom: '32px' }}>
            <h1 style={{ fontSize: '32px', fontWeight: 700, letterSpacing: '-1px', lineHeight: 1.1, marginBottom: '16px' }}>
              Fundamental<br />analysis<span style={{ color: 'var(--accent)' }}>.</span><br />
              <span style={{ color: 'var(--accent)' }}>Without noise.</span>
            </h1>
            <p style={{ color: 'var(--text-2)', fontSize: '12px', lineHeight: 1.8, marginBottom: '24px' }}>
              Primary data from SEC EDGAR. No opinions. No buy/sell calls.
            </p>
            <div style={{ display: 'flex', gap: '0', marginBottom: '16px' }}>
              <input
                style={{ flex: 1, background: 'var(--bg-2)', border: '1px solid var(--border-2)', borderRight: 'none', color: 'var(--accent)', fontFamily: 'IBM Plex Mono, monospace', fontSize: '18px', fontWeight: 700, padding: '12px 16px', outline: 'none', letterSpacing: '3px' }}
                placeholder="AAPL"
                value={ticker}
                onChange={e => setTicker(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && go()}
                maxLength={6}
              />
              <button onClick={() => go()}
                style={{ background: 'var(--accent)', color: '#000', border: 'none', padding: '12px 20px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', fontWeight: 700, cursor: 'pointer', letterSpacing: '1px' }}>
                GO →
              </button>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px' }}>
              {['AAPL', 'MSFT', 'NVDA', 'V', 'GOOGL'].map(t => (
                <button key={t} onClick={() => go(t)}
                  style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-3)', padding: '4px 10px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', cursor: 'pointer', letterSpacing: '1px' }}>
                  {t}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <a href="/sign-up" style={{ flex: 1, background: 'var(--accent)', color: '#000', padding: '12px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textDecoration: 'none', textAlign: 'center' }}>
                START FREE →
              </a>
              <a href="/pricing" style={{ flex: 1, background: 'none', border: '1px solid var(--border)', color: 'var(--text-3)', padding: '12px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', letterSpacing: '1px', textDecoration: 'none', textAlign: 'center' }}>
                PRICING
              </a>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'var(--border)', marginBottom: '24px' }}>
            {[
              { icon: '◈', title: 'QUALITY SCORE', desc: 'Sector-adjusted scoring' },
              { icon: '◎', title: 'DCF VALUATION', desc: 'Graham formula' },
              { icon: '⊞', title: 'SCREENER', desc: '8,000+ US stocks' },
              { icon: '⊟', title: 'COMPARE', desc: 'Side-by-side analysis' },
            ].map(f => (
              <div key={f.title} style={{ background: 'var(--bg-1)', padding: '16px' }}>
                <div style={{ color: 'var(--accent)', fontSize: '20px', marginBottom: '6px' }}>{f.icon}</div>
                <div style={{ color: 'var(--text)', fontSize: '10px', fontWeight: 700, letterSpacing: '1px', marginBottom: '4px' }}>{f.title}</div>
                <div style={{ color: 'var(--text-3)', fontSize: '10px', lineHeight: 1.5 }}>{f.desc}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'var(--border)', marginBottom: '24px' }}>
            {[
              { val: '8,000+', label: 'US STOCKS' },
              { val: '15', label: 'DD QUESTIONS' },
              { val: '5', label: 'DIMENSIONS' },
              { val: 'FREE', label: 'TO START' },
            ].map(s => (
              <div key={s.label} style={{ background: 'var(--bg-1)', padding: '16px', textAlign: 'center' }}>
                <div style={{ color: 'var(--accent)', fontSize: '20px', fontWeight: 700 }}>{s.val}</div>
                <div style={{ color: 'var(--text-3)', fontSize: '9px', letterSpacing: '2px', marginTop: '4px' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {movers && (
            <div style={{ marginBottom: '24px' }}>
              <div style={{ color: 'var(--text-3)', fontSize: '9px', letterSpacing: '3px', marginBottom: '8px' }}>MARKET DATA</div>
              <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)' }}>
                <TableHeader title="▲ TOP GAINERS" color="var(--green)" />
                {movers.gainers.slice(0, 5).map(s => <MoverRow key={s.ticker} s={s} router={router} />)}
              </div>
            </div>
          )}

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', color: 'var(--text-3)', fontSize: '9px', letterSpacing: '1px', textAlign: 'center' }}>
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginBottom: '8px' }}>
              <a href="/privacy" style={{ color: 'var(--text-3)', textDecoration: 'none' }}>PRIVACY</a>
              <a href="/terms" style={{ color: 'var(--text-3)', textDecoration: 'none' }}>TERMS</a>
              <a href="/about" style={{ color: 'var(--text-3)', textDecoration: 'none' }}>ABOUT</a>
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
      <div style={{ borderBottom: '1px solid var(--border)', padding: '48px 24px 40px', maxWidth: '1400px', margin: '0 auto', boxSizing: 'border-box', width: '100%' }}>
        <div className="hero-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '64px', alignItems: 'center' }}>

          {/* Left — copy */}
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'var(--accent-dim)', border: '1px solid var(--accent)', padding: '4px 12px', marginBottom: '24px' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
              <span style={{ color: 'var(--accent)', fontSize: '10px', letterSpacing: '2px', fontWeight: 700 }}>LIVE · SEC EDGAR · FINNHUB</span>
            </div>

            <h1 className="hero-title" style={{ fontSize: '52px', fontWeight: 700, letterSpacing: '-2px', lineHeight: 1.05, marginBottom: '20px' }}>
              Fundamental<br />
              analysis<span style={{ color: 'var(--accent)' }}>.</span><br />
              <span style={{ color: 'var(--accent)' }}>Without noise.</span>
            </h1>

            <p style={{ color: 'var(--text-2)', fontSize: '14px', lineHeight: 1.8, marginBottom: '32px', maxWidth: '440px' }}>
              Primary data from SEC EDGAR. No opinions. No buy/sell calls. 
              15 due diligence questions across 5 dimensions — built for investors who do their own work.
            </p>

            {/* Search */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ color: 'var(--text-3)', fontSize: '10px', letterSpacing: '2px', marginBottom: '8px' }}>
                ENTER TICKER{blink ? '_' : ' '}
              </div>
              <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex', gap: '0' }}>
                <input
                  style={{ flex: 1, maxWidth: '280px', background: 'var(--bg-2)', border: '1px solid var(--border-2)', borderRight: 'none', color: 'var(--accent)', fontFamily: 'IBM Plex Mono, monospace', fontSize: '22px', fontWeight: 700, padding: '12px 16px', outline: 'none', letterSpacing: '4px' }}
                  placeholder="AAPL"
                  value={searchQ || ticker}
                  onChange={e => { const v = e.target.value.toUpperCase(); setTicker(v); setSearchQ(v); setShowSuggestions(true); }}
                  onKeyDown={e => { if (e.key === 'Enter') { go(); setShowSuggestions(false); } if (e.key === 'Escape') setShowSuggestions(false); }}
                  maxLength={6}
                  onFocus={e => { e.target.style.borderColor = 'var(--accent)'; setShowSuggestions(true); }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border-2)'; setTimeout(() => setShowSuggestions(false), 200); }}
                />
                <button onClick={() => go()}
                  style={{ background: 'var(--accent)', color: '#000', border: 'none', padding: '12px 24px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '13px', fontWeight: 700, cursor: 'pointer', letterSpacing: '1px' }}
                  onMouseEnter={e => e.target.style.opacity = '0.85'}
                  onMouseLeave={e => e.target.style.opacity = '1'}>
                  ANALYZE →
                </button>
                </div>
              {showSuggestions && suggestions.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, background: 'var(--bg-1)', border: '1px solid var(--border)', minWidth: '320px', zIndex: 100, marginTop: '2px' }}>
                  {suggestions.map(s => (
                    <div key={s.ticker}
                      onMouseDown={() => { router.push(`/stock/${s.ticker}`); setShowSuggestions(false); }}
                      style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border)' }}
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
          </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '32px' }}>
              {['AAPL', 'MSFT', 'NVDA', 'V', 'ASML', 'GOOGL'].map(t => (
                <button key={t} onClick={() => go(t)}
                  style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-3)', padding: '3px 10px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', cursor: 'pointer', letterSpacing: '1px' }}
                  onMouseEnter={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.color = 'var(--accent)'; }}
                  onMouseLeave={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.color = 'var(--text-3)'; }}>
                  {t}
                </button>
              ))}
            </div>

            {/* CTAs */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <a href="/sign-up" style={{ background: 'var(--accent)', color: '#000', padding: '10px 20px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textDecoration: 'none' }}>
                START FREE →
              </a>
              <a href="/pricing" style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-3)', padding: '10px 20px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', letterSpacing: '1px', textDecoration: 'none' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-3)'; }}>
                SEE PRICING
              </a>
            </div>

          {/* Right — feature grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'var(--border)' }}>
            {[
              { icon: '◈', title: 'QUALITY SCORE', desc: 'ROIC, margins, leverage — sector-adjusted scoring from 1 to 5' },
              { icon: '◎', title: 'DCF VALUATION', desc: 'Graham formula with conservative, base, and optimistic scenarios' },
              { icon: '⊞', title: 'SCREENER', desc: 'Filter 8,000+ US stocks by margins, P/E, FCF yield and more' },
              { icon: '⊟', title: 'COMPARE', desc: 'Side-by-side comparison with winner highlighting across all metrics' },
            ].map(f => (
              <div key={f.title} style={{ background: 'var(--bg-1)', padding: '28px' }}>
                <div style={{ color: 'var(--accent)', fontSize: '24px', marginBottom: '10px' }}>{f.icon}</div>
                <div style={{ color: 'var(--text)', fontSize: '12px', fontWeight: 700, letterSpacing: '1px', marginBottom: '8px' }}>{f.title}</div>
                <div style={{ color: 'var(--text-3)', fontSize: '11px', lineHeight: 1.6 }}>{f.desc}</div>
              </div>
            ))}
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
            <div className="market-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1px', background: 'var(--border)', marginBottom: '1px' }}>
              <div style={{ background: 'var(--bg-1)', gridColumn: '1' }}>
                <TableHeader title="▲ TOP GAINERS" sub="TOP 10" color="var(--green)" />
                {movers.gainers.slice(0, 10).map(s => <MoverRow key={s.ticker} s={s} router={router} />)}
              </div>
              <div style={{ background: 'var(--bg-1)', gridColumn: '2' }}>
                <TableHeader title="▼ TOP LOSERS" sub="TOP 10" color="var(--red)" />
                {movers.losers.slice(0, 10).map(s => <MoverRow key={s.ticker} s={s} router={router} />)}
              </div>
              <div style={{ background: 'var(--bg-1)', gridColumn: '3 / 5' }}>
                <TableHeader title="📅 UPCOMING EARNINGS" sub="NEXT 7 DAYS" />
                {earnings ? earnings.map(e => <EarningRow key={e.ticker + e.date} e={e} router={router} />) :
                  <div style={{ padding: '20px 12px', color: 'var(--text-3)', fontSize: '10px' }}>LOADING...</div>}
                {earnings?.length === 0 && <div style={{ padding: '20px 12px', color: 'var(--text-3)', fontSize: '10px' }}>NO EARNINGS THIS WEEK</div>}
              </div>
            </div>

            {/* Rankings */}
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
            <a href="/sign-up" style={{ background: 'var(--accent)', color: '#000', padding: '12px 28px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', fontWeight: 700, letterSpacing: '1px', textDecoration: 'none' }}>
              START FOR FREE →
            </a>
            <a href="/pricing" style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-3)', padding: '12px 28px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', letterSpacing: '1px', textDecoration: 'none' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-3)'; }}>
              VIEW PRICING
            </a>
          </div>
        </div>

        {/* FOOTER */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-3)', fontSize: '10px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '24px' }}>
            <a href="/privacy" style={{ color: 'var(--text-3)', textDecoration: 'none', letterSpacing: '1px' }}>PRIVACY</a>
            <a href="/terms" style={{ color: 'var(--text-3)', textDecoration: 'none', letterSpacing: '1px' }}>TERMS</a>
            <a href="/about" style={{ color: 'var(--text-3)', textDecoration: 'none', letterSpacing: '1px' }}>ABOUT</a>
            <a href="/pricing" style={{ color: 'var(--text-3)', textDecoration: 'none', letterSpacing: '1px' }}>PRICING</a>
          </div>
          <div style={{ letterSpacing: '1px' }}>DATA: SEC EDGAR · FINNHUB · YAHOO FINANCE · NOT INVESTMENT ADVICE · © 2026 TRAQCKER</div>
        </div>
      </div>
    </>}

    </main>
  );
}