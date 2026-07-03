'use client';
import { useState, useEffect } from 'react';
import { useUser } from '../components/AuthProvider';
import { useRouter } from 'next/navigation';
import Topbar from '../components/Topbar';
import Sparkline from '../components/Sparkline';

const fmt = (val) => {
  if (val === null || val === undefined) return '—';
  if (Math.abs(val) >= 1e12) return `$${(val / 1e12).toFixed(1)}T`;
  if (Math.abs(val) >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
  if (Math.abs(val) >= 1e6) return `$${(val / 1e6).toFixed(0)}M`;
  return `$${val.toLocaleString()}`;
};

export default function Watchlist() {
  const { isSignedIn } = useUser();
  const router = useRouter();
  const [tickers, setTickers] = useState([]);
  const [stocks, setStocks] = useState({});
  const [sparklines, setSparklines] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSignedIn) return;
    fetch('/api/watchlist').then(r => r.json()).then(d => {
      setTickers(d.tickers || []);
      setLoading(false);
      d.tickers?.forEach(({ ticker }) => {
        fetch(`/api/stock?ticker=${ticker}`).then(r => r.json()).then(data => setStocks(prev => ({ ...prev, [ticker]: data })));
        fetch(`/api/sparkline?ticker=${ticker}`).then(r => r.json()).then(data => setSparklines(prev => ({ ...prev, [ticker]: data.candles })));
      });
    });
  }, [isSignedIn]);

  const remove = async (ticker) => {
    await fetch('/api/watchlist', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ticker }) });
    setTickers(prev => prev.filter(t => t.ticker !== ticker));
  };

  const logoUrl = (name) => {
    if (!name) return null;
    const domain = name.toLowerCase().replace(/\binc\b|\bcorp\b|\bltd\b|\bplc\b|\bco\b|\bllc\b|\bgroup\b|\bholdings\b|\binternational\b|\bthe\b/g, '').trim().split(/\s+/)[0].replace(/[^a-z0-9]/g, '');
    return `https://img.logo.dev/${domain}.com?token=pk_B4aaLZF6S4G1YbCgqZq2Ug`;
  };

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', fontFamily: 'Nunito, sans-serif' }}>
      <Topbar />
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '40px 24px 80px' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
          <div>
            <div style={{ color: 'var(--accent)', fontSize: '11px', letterSpacing: '2px', marginBottom: '8px', fontWeight: 700 }}>MY WATCHLIST</div>
            <h1 style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-0.5px' }}>Tracked Stocks</h1>
          </div>
          <div style={{ color: 'var(--text-3)', fontSize: '13px', fontWeight: 600 }}>{tickers.length} stocks</div>
        </div>

        {!isSignedIn ? (
          <div className="glass" style={{ padding: '64px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
            <div style={{ color: 'var(--text-2)', fontSize: '15px', marginBottom: '24px' }}>Sign in to see your watchlist</div>
            <a href="/sign-in" className="btn-primary">Sign in →</a>
          </div>
        ) : loading ? (
          <div style={{ color: 'var(--text-3)', fontSize: '14px', padding: '40px 0' }}>Loading...</div>
        ) : tickers.length === 0 ? (
          <div className="glass" style={{ padding: '64px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⭐</div>
            <div style={{ color: 'var(--text-2)', fontSize: '15px', marginBottom: '8px', fontWeight: 600 }}>Your watchlist is empty</div>
            <div style={{ color: 'var(--text-3)', fontSize: '13px', marginBottom: '24px' }}>Add stocks from any stock page using the ☆ Watchlist button</div>
            <a href="/" style={{ color: 'var(--accent)', fontSize: '14px', textDecoration: 'none', fontWeight: 600 }}>← Back to home</a>
          </div>
        ) : (
          <div className="glass" style={{ overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.03)' }}>
                  {['Stock', 'Price', 'Change', 'Market Cap', 'P/E', 'FCF Yield', '1M', ''].map(h => (
                    <th key={h} style={{ padding: '12px 14px', textAlign: h === 'Stock' ? 'left' : 'right', fontWeight: 700, fontSize: '11px', color: 'var(--text-3)', letterSpacing: '0.5px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tickers.map(({ ticker }) => {
                  const s = stocks[ticker];
                  const up = s?.priceChangePct >= 0;
                  return (
                    <tr key={ticker} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.15s' }}
                      onClick={() => router.push(`/stock/${ticker}`)}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {s && <img src={logoUrl(s.name)} alt="" style={{ width: 26, height: 26, objectFit: 'contain', background: 'white', padding: 2, borderRadius: '6px', flexShrink: 0 }} onError={e => e.target.style.display = 'none'} />}
                          <div>
                            <div style={{ color: 'var(--accent)', fontWeight: 800, fontSize: '14px' }}>{ticker}</div>
                            <div style={{ color: 'var(--text-3)', fontSize: '11px' }}>{s?.name || '...'}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '14px', textAlign: 'right', fontWeight: 700 }}>{s?.currentPrice ? `$${s.currentPrice.toFixed(2)}` : '—'}</td>
                      <td style={{ padding: '14px', textAlign: 'right', color: up ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
                        {s?.priceChangePct ? `${up ? '+' : ''}${s.priceChangePct.toFixed(2)}%` : '—'}
                      </td>
                      <td style={{ padding: '14px', textAlign: 'right', color: 'var(--text-2)' }}>{s ? fmt(s.marketCap) : '—'}</td>
                      <td style={{ padding: '14px', textAlign: 'right', color: s?.pe > 0 && s?.pe < 20 ? 'var(--green)' : s?.pe > 35 ? 'var(--red)' : 'var(--text)' }}>{s?.pe ? s.pe.toFixed(1) : '—'}</td>
                      <td style={{ padding: '14px', textAlign: 'right', color: s?.fcfYield > 5 ? 'var(--green)' : s?.fcfYield > 2 ? 'var(--accent)' : 'var(--text)' }}>{s?.fcfYield ? `${s.fcfYield}%` : '—'}</td>
                      <td style={{ padding: '14px', textAlign: 'center' }}>
                        {sparklines[ticker] && <Sparkline data={sparklines[ticker]} width={80} height={28} />}
                      </td>
                      <td style={{ padding: '14px', textAlign: 'right' }}>
                        <button onClick={e => { e.stopPropagation(); remove(ticker); }}
                          style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: '14px', fontFamily: 'Nunito, sans-serif', padding: '2px 6px', borderRadius: '6px', transition: 'color 0.15s' }}
                          onMouseEnter={e => e.target.style.color = 'var(--red)'}
                          onMouseLeave={e => e.target.style.color = 'var(--text-3)'}>
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
