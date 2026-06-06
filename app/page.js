'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import MarketBar from './components/MarketBar';

export default function Home() {
  const [ticker, setTicker] = useState('');
  const router = useRouter();

  function go(t) {
    const tk = (t || ticker).toUpperCase().trim();
    if (!tk) return;
    router.push(`/stock/${tk}`);
  }

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)' }}>

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
    onMouseLeave={e => e.target.style.color = 'var(--text-3)'}>
    SCREENER
  </a>
  <span style={{ color: 'var(--text-3)' }}>{new Date().toISOString().slice(0, 10)} · SEC EDGAR · FINNHUB</span>
        </div>
      </div>

      {/* Market bar */}
<MarketBar />

{/* Hero */}

      {/* Hero */}
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '80px 24px 60px' }}>

        {/* ASCII-style header */}
        <div style={{ marginBottom: '48px' }}>
          <div style={{ color: 'var(--text-3)', fontSize: '11px', marginBottom: '8px', letterSpacing: '1px' }}>
            ┌─────────────────────────────────────────┐
          </div>
          <div style={{ color: 'var(--text-3)', fontSize: '11px', marginBottom: '4px' }}>
            │ &nbsp;STOCK ANALYSIS TRAQCKER &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;│
          </div>
          <div style={{ color: 'var(--text-3)', fontSize: '11px', marginBottom: '8px' }}>
            └─────────────────────────────────────────┘
          </div>
          <h1 style={{ fontSize: '42px', fontWeight: 600, letterSpacing: '-1px', lineHeight: 1.1, marginBottom: '16px', fontFamily: 'IBM Plex Mono, monospace' }}>
            Fundamental analysis<br />
            <span style={{ color: 'var(--accent)' }}>without opinions.</span>
          </h1>
          <p style={{ color: 'var(--text-2)', fontSize: '14px', maxWidth: '480px', lineHeight: 1.7 }}>
            15 questions. 5 dimensions. Evidence from SEC filings only.
            No recommendations. No noise. Just data.
          </p>
        </div>

        {/* Search */}
        <div style={{ marginBottom: '48px' }}>
          <div style={{ color: 'var(--text-3)', fontSize: '11px', marginBottom: '8px', letterSpacing: '1px' }}>
            ENTER TICKER SYMBOL_
          </div>
          <div style={{ display: 'flex', gap: '8px', maxWidth: '480px' }}>
            <input
              style={{
                flex: 1,
                background: 'var(--bg-2)',
                border: '1px solid var(--border-2)',
                color: 'var(--accent)',
                fontFamily: 'IBM Plex Mono, monospace',
                fontSize: '20px',
                fontWeight: 600,
                padding: '12px 16px',
                outline: 'none',
                letterSpacing: '4px',
              }}
              placeholder="AAPL_"
              value={ticker}
              onChange={e => setTicker(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && go()}
              maxLength={6}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e => e.target.style.borderColor = 'var(--border-2)'}
            />
            <button
              onClick={() => go()}
              style={{
                background: 'var(--accent)',
                color: '#000',
                border: 'none',
                padding: '12px 24px',
                fontFamily: 'IBM Plex Mono, monospace',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                letterSpacing: '1px',
              }}
              onMouseEnter={e => e.target.style.opacity = '0.85'}
              onMouseLeave={e => e.target.style.opacity = '1'}
            >
              ANALYZE →
            </button>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
            {['AAPL', 'MSFT', 'NVDA', 'ASML', 'V', 'GOOGL'].map(t => (
              <button key={t} onClick={() => go(t)}
                style={{
                  background: 'none',
                  border: '1px solid var(--border)',
                  color: 'var(--text-3)',
                  padding: '4px 10px',
                  fontFamily: 'IBM Plex Mono, monospace',
                  fontSize: '11px',
                  cursor: 'pointer',
                  letterSpacing: '1px',
                }}
                onMouseEnter={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.color = 'var(--accent)'; }}
                onMouseLeave={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.color = 'var(--text-3)'; }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: 'var(--border)', marginBottom: '48px' }}>
          {[
            { val: '8,000+', label: 'US COMPANIES' },
            { val: '15', label: 'DD QUESTIONS' },
            { val: '5', label: 'DIMENSIONS' },
            { val: '100%', label: 'PRIMARY DATA' },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--bg-1)', padding: '20px', textAlign: 'center' }}>
              <div style={{ color: 'var(--accent)', fontSize: '24px', fontWeight: 600, marginBottom: '4px' }}>{s.val}</div>
              <div style={{ color: 'var(--text-3)', fontSize: '10px', letterSpacing: '2px' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Dimensions */}
        <div style={{ marginBottom: '48px' }}>
          <div style={{ color: 'var(--text-3)', fontSize: '11px', letterSpacing: '2px', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
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