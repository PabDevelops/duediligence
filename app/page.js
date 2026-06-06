'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import MarketBar from './components/MarketBar';

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
      <span style={{ color: 'var(--accent)', fontSize: '12px', fontWeight: 700, width: 48, flexShrink: 0 }}>{s.ticker}</span>
      <span style={{ color: 'var(--text-3)', fontSize: '11px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
      <span style={{ color: 'var(--text)', fontSize: '12px', flexShrink: 0 }}>${s.currentPrice?.toFixed(2)}</span>
      <span style={{ color: up ? 'var(--green)' : 'var(--red)', fontSize: '12px', fontWeight: 600, width: 64, textAlign: 'right', flexShrink: 0 }}>
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
    <img src={logoUrl(e.ticker)} alt="" style={{ width: 16, height: 16, objectFit: 'contain', background: 'white', padding: 1, flexShrink: 0 }}
      onError={ev => ev.target.style.display = 'none'} />
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
    <span style={{ color: 'var(--border-2)', fontSize: '9px', width: 16, flexShrink: 0 }}>#{rank}</span>
    <img src={logoUrl(s.name)} alt="" style={{ width: 16, height: 16, objectFit: 'contain', background: 'white', padding: 1, flexShrink: 0 }}
      onError={e => e.target.style.display = 'none'} />
    <span style={{ color: 'var(--accent)', fontSize: '12px', fontWeight: 700, width: 48, flexShrink: 0 }}>{s.ticker}</span>
    <span style={{ color: 'var(--text-3)', fontSize: '11px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
    <span style={{ color: 'var(--green)', fontSize: '12px', fontWeight: 600, flexShrink: 0 }}>
      {s[metric]?.toFixed(1)}{suffix}
    </span>
  </div>
);

const TableHeader = ({ title, sub }) => (
  <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
    <span style={{ color: 'var(--accent)', fontSize: '10px', letterSpacing: '2px', fontWeight: 600 }}>{title}</span>
    {sub && <span style={{ color: 'var(--text-3)', fontSize: '9px' }}>{sub}</span>}
  </div>
);

export default function Home() {
  const [ticker, setTicker] = useState('');
  const [movers, setMovers] = useState(null);
  const [earnings, setEarnings] = useState(null);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/movers').then(r => r.json()).then(d => setMovers(d)).catch(() => {});
    fetch('/api/earnings').then(r => r.json()).then(d => setEarnings(d.earnings || [])).catch(() => {});
  }, []);

  function go(t) {
    const tk = (t || ticker).toUpperCase().trim();
    if (!tk) return;
    router.push(`/stock/${tk}`);
  }

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', fontFamily: 'IBM Plex Mono, monospace' }}>

      {/* Topbar */}
      <div style={{ borderBottom: '1px solid var(--border)', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="/logo.png" alt="Traqcker" style={{ height: '24px', objectFit: 'contain' }} />
          <span style={{ color: 'var(--text-3)' }}>|</span>
          <span style={{ color: 'var(--text-3)', fontSize: '11px' }}>FUNDAMENTAL ANALYSIS SYSTEM v1.0</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '11px' }}>
          <a href="/screener" style={{ color: 'var(--text-3)', textDecoration: 'none', letterSpacing: '1px' }}
            onMouseEnter={e => e.target.style.color = 'var(--accent)'}
            onMouseLeave={e => e.target.style.color = 'var(--text-3)'}>SCREENER</a>
          <span style={{ color: 'var(--text-3)' }}>{new Date().toISOString().slice(0, 10)} · SEC EDGAR · FINNHUB</span>
        </div>
      </div>

      <MarketBar />

      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '40px 24px' }}>

        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <h1 style={{ fontSize: '42px', fontWeight: 600, letterSpacing: '-1px', lineHeight: 1.1, marginBottom: '12px' }}>
            Fundamental analysis<br />
            <span style={{ color: 'var(--accent)' }}>without opinions.</span>
          </h1>
          <p style={{ color: 'var(--text-2)', fontSize: '13px', lineHeight: 1.7, marginBottom: '24px' }}>
            15 questions. 5 dimensions. Evidence from SEC filings only. No recommendations. No noise. Just data.
          </p>
          <div style={{ display: 'flex', gap: '8px', maxWidth: '600px', margin: '0 auto 12px' }}>
            <input
              style={{ flex: 1, background: 'var(--bg-2)', border: '1px solid var(--border-2)', color: 'var(--accent)', fontFamily: 'IBM Plex Mono, monospace', fontSize: '24px', fontWeight: 600, padding: '12px 16px', outline: 'none', letterSpacing: '4px' }}
              placeholder="AAPL_"
              value={ticker}
              onChange={e => setTicker(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && go()}
              maxLength={6}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e => e.target.style.borderColor = 'var(--border-2)'}
            />
            <button onClick={() => go()}
              style={{ background: 'var(--accent)', color: '#000', border: 'none', padding: '12px 24px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '13px', fontWeight: 600, cursor: 'pointer', letterSpacing: '1px' }}
              onMouseEnter={e => e.target.style.opacity = '0.85'}
              onMouseLeave={e => e.target.style.opacity = '1'}>
              ANALYZE →
            </button>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '600px', margin: '0 auto 24px' }}>
            {['AAPL', 'MSFT', 'NVDA', 'ASML', 'V', 'GOOGL'].map(t => (
              <button key={t} onClick={() => go(t)}
                style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-3)', padding: '3px 10px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', cursor: 'pointer', letterSpacing: '1px' }}
                onMouseEnter={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.color = 'var(--accent)'; }}
                onMouseLeave={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.color = 'var(--text-3)'; }}>
                {t}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '32px' }}>
            {[{ val: '8,000+', label: 'US COMPANIES' }, { val: '15', label: 'DD QUESTIONS' }, { val: '5', label: 'DIMENSIONS' }, { val: '100%', label: 'PRIMARY DATA' }].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ color: 'var(--accent)', fontSize: '16px', fontWeight: 600 }}>{s.val}</div>
                <div style={{ color: 'var(--text-3)', fontSize: '9px', letterSpacing: '2px', marginTop: '2px' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Main grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1px', background: 'var(--border)', marginBottom: '1px' }}>

          {/* Gainers */}
          <div style={{ background: 'var(--bg-1)', gridColumn: '1' }}>
            <TableHeader title="▲ TOP GAINERS" sub="TOP 10" />
            {movers ? movers.gainers.slice(0, 10).map(s => <MoverRow key={s.ticker} s={s} router={router} />) :
              <div style={{ padding: '20px 12px', color: 'var(--text-3)', fontSize: '10px' }}>LOADING...</div>}
          </div>

          {/* Losers */}
          <div style={{ background: 'var(--bg-1)', gridColumn: '2' }}>
            <TableHeader title="▼ TOP LOSERS" sub="TOP 10" />
            {movers ? movers.losers.slice(0, 10).map(s => <MoverRow key={s.ticker} s={s} router={router} />) :
              <div style={{ padding: '20px 12px', color: 'var(--text-3)', fontSize: '10px' }}>LOADING...</div>}
          </div>

          {/* Earnings */}
          <div style={{ background: 'var(--bg-1)', gridColumn: '3 / 5' }}>
            <TableHeader title="📅 UPCOMING EARNINGS" sub="NEXT 7 DAYS" />
            {earnings ? earnings.map(e => <EarningRow key={e.ticker + e.date} e={e} router={router} />) :
              <div style={{ padding: '20px 12px', color: 'var(--text-3)', fontSize: '10px' }}>LOADING...</div>}
            {earnings?.length === 0 && <div style={{ padding: '20px 12px', color: 'var(--text-3)', fontSize: '10px' }}>NO EARNINGS THIS WEEK</div>}
          </div>
        </div>

        {/* Rankings */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'var(--border)', marginBottom: '48px' }}>
          {movers && [
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

        {/* Framework */}
        <div style={{ marginBottom: '48px' }}>
          <div style={{ color: 'var(--text-3)', fontSize: '10px', letterSpacing: '2px', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
            ANALYSIS FRAMEWORK // 5 DIMENSIONS
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1px', background: 'var(--border)' }}>
            {[
              { num: '01', name: 'MANAGEMENT', desc: 'Guidance, compensation, C-suite stability' },
              { num: '02', name: 'CONCENTRATION', desc: 'Customers, geographies, products' },
              { num: '03', name: 'OP. TREND', desc: 'Margins, FCF/share, ROIC over time' },
              { num: '04', name: 'EARN. QUALITY', desc: 'Cash conversion, accruals, accounting' },
              { num: '05', name: 'TRANSPARENCY', desc: 'Guidance, risk disclosure, segments' },
            ].map(d => (
              <div key={d.num} style={{ background: 'var(--bg-1)', padding: '16px 12px' }}>
                <div style={{ color: 'var(--accent)', fontSize: '10px', marginBottom: '6px' }}>{d.num}</div>
                <div style={{ color: 'var(--text)', fontSize: '11px', fontWeight: 600, marginBottom: '6px', letterSpacing: '0.5px' }}>{d.name}</div>
                <div style={{ color: 'var(--text-3)', fontSize: '10px', lineHeight: 1.5 }}>{d.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', color: 'var(--text-3)', fontSize: '11px' }}>
          <span>DATA: SEC EDGAR (XBRL) · ALPHA VANTAGE · FINNHUB</span>
          <span>NOT INVESTMENT ADVICE</span>
        </div>
      </div>
    </main>
  );
}