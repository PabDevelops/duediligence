'use client';
import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
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
    fetch('/api/watchlist')
      .then(r => r.json())
      .then(d => {
        setTickers(d.tickers || []);
        setLoading(false);
        d.tickers?.forEach(({ ticker }) => {
          fetch(`/api/stock?ticker=${ticker}`)
            .then(r => r.json())
            .then(data => setStocks(prev => ({ ...prev, [ticker]: data })));
          fetch(`/api/sparkline?ticker=${ticker}`)
            .then(r => r.json())
            .then(data => setSparklines(prev => ({ ...prev, [ticker]: data.candles })));
        });
      });
  }, [isSignedIn]);

  const remove = async (ticker) => {
    await fetch('/api/watchlist', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker }),
    });
    setTickers(prev => prev.filter(t => t.ticker !== ticker));
  };

  const logoUrl = (name) => {
    if (!name) return null;
    const domain = name.toLowerCase()
      .replace(/\binc\b|\bcorp\b|\bltd\b|\bplc\b|\bco\b|\bllc\b|\bgroup\b|\bholdings\b|\binternational\b|\bthe\b/g, '')
      .trim().split(/\s+/)[0].replace(/[^a-z0-9]/g, '');
    return `https://img.logo.dev/${domain}.com?token=pk_B4aaLZF6S4G1YbCgqZq2Ug`;
  };

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', fontFamily: 'IBM Plex Mono, monospace' }}>
      <Topbar />
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '40px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
          <div>
            <div style={{ color: 'var(--accent)', fontSize: '10px', letterSpacing: '3px', marginBottom: '8px' }}>MY WATCHLIST</div>
            <h1 style={{ fontSize: '24px', fontWeight: 600, letterSpacing: '-0.5px' }}>Tracked Stocks</h1>
          </div>
          <div style={{ color: 'var(--text-3)', fontSize: '11px' }}>{tickers.length} STOCKS</div>
        </div>

        {!isSignedIn ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ color: 'var(--text-3)', fontSize: '11px', letterSpacing: '2px', marginBottom: '16px' }}>SIGN IN TO SEE YOUR WATCHLIST</div>
            <a href="/sign-in" style={{ background: 'var(--accent)', color: '#000', padding: '8px 20px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textDecoration: 'none' }}>SIGN IN →</a>
          </div>
        ) : loading ? (
          <div style={{ color: 'var(--text-3)', fontSize: '11px', letterSpacing: '2px' }}>LOADING...</div>
        ) : tickers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ color: 'var(--text-3)', fontSize: '11px', letterSpacing: '2px', marginBottom: '8px' }}>YOUR WATCHLIST IS EMPTY</div>
            <div style={{ color: 'var(--text-3)', fontSize: '11px', marginBottom: '24px' }}>Add stocks from any stock page using the ☆ WATCHLIST button</div>
            <a href="/" style={{ color: 'var(--accent)', fontSize: '11px', textDecoration: 'none', letterSpacing: '1px' }}>← BACK TO HOME</a>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '8px 0', textAlign: 'left', fontWeight: 400, fontSize: '10px', color: 'var(--text-3)', letterSpacing: '1px' }}>STOCK</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 400, fontSize: '10px', color: 'var(--text-3)', letterSpacing: '1px' }}>PRICE</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 400, fontSize: '10px', color: 'var(--text-3)', letterSpacing: '1px' }}>CHANGE</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 400, fontSize: '10px', color: 'var(--text-3)', letterSpacing: '1px' }}>MARKET CAP</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 400, fontSize: '10px', color: 'var(--text-3)', letterSpacing: '1px' }}>P/E</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 400, fontSize: '10px', color: 'var(--text-3)', letterSpacing: '1px' }}>FCF YIELD</th>
                <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 400, fontSize: '10px', color: 'var(--text-3)', letterSpacing: '1px' }}>1M</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 400, fontSize: '10px', color: 'var(--text-3)', letterSpacing: '1px' }}></th>
              </tr>
            </thead>
            <tbody>
              {tickers.map(({ ticker }) => {
                const s = stocks[ticker];
                const up = s?.priceChangePct >= 0;
                return (
                  <tr key={ticker} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                    onClick={() => router.push(`/stock/${ticker}`)}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-1)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '12px 0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {s && <img src={logoUrl(s.name)} alt="" style={{ width: 24, height: 24, objectFit: 'contain', background: 'white', padding: 2, flexShrink: 0 }}
                          onError={e => e.target.style.display = 'none'} />}
                        <div>
                          <div style={{ color: 'var(--accent)', fontWeight: 700, fontSize: '13px' }}>{ticker}</div>
                          <div style={{ color: 'var(--text-3)', fontSize: '10px' }}>{s?.name || '...'}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 600 }}>{s?.currentPrice ? `$${s.currentPrice.toFixed(2)}` : '—'}</td>
                    <td style={{ padding: '12px', textAlign: 'right', color: up ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                      {s?.priceChangePct ? `${up ? '+' : ''}${s.priceChangePct.toFixed(2)}%` : '—'}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', color: 'var(--text-2)' }}>{s ? fmt(s.marketCap) : '—'}</td>
                    <td style={{ padding: '12px', textAlign: 'right', color: s?.pe > 0 && s?.pe < 20 ? 'var(--green)' : s?.pe > 35 ? 'var(--red)' : 'var(--text)' }}>{s?.pe ? s.pe.toFixed(1) : '—'}</td>
                    <td style={{ padding: '12px', textAlign: 'right', color: s?.fcfYield > 5 ? 'var(--green)' : s?.fcfYield > 2 ? 'var(--accent)' : 'var(--text)' }}>{s?.fcfYield ? `${s.fcfYield}%` : '—'}</td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      {sparklines[ticker] && <Sparkline data={sparklines[ticker]} width={80} height={28} />}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      <button onClick={e => { e.stopPropagation(); remove(ticker); }}
                        style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: '11px', fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '1px' }}
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
        )}
      </div>
    </div>
  );
}