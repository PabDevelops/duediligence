'use client';
import { useState, useEffect } from 'react';
import { useUser } from './AuthProvider';
import Sparkline from './Sparkline';
import { openInNewTab } from '../../lib/openInNewTab';

export default function WatchlistWidget() {
  const { isSignedIn } = useUser();
  const [open, setOpen] = useState(false);
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isSignedIn || !open) return;
    setLoading(true);
    fetch('/api/watchlist')
      .then(r => r.json())
      .then(async d => {
        const top4 = (d.tickers || []).slice(0, 10);
        const results = await Promise.all(
          top4.map(({ ticker }) =>
            fetch(`/api/stock?ticker=${ticker}`)
              .then(r => r.json())
              .then(data => ({ ticker, ...data }))
              .catch(() => ({ ticker }))
          )
        );
        setStocks(results);
        setLoading(false);
      });
  }, [isSignedIn, open]);

  if (!isSignedIn) return null;

  return (
    <div className="watchlist-widget" style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 50, fontFamily: 'JetBrains Mono, monospace' }}>
      {open && (
        <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', marginBottom: '8px', width: '280px', maxHeight: '420px', overflowY: 'auto' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--accent)', fontSize: '10px', letterSpacing: '2px', fontWeight: 700 }}>WATCHLIST</span>
            <a href="/watchlist" style={{ color: 'var(--text-3)', fontSize: '9px', letterSpacing: '1px', textDecoration: 'none' }}>VIEW ALL →</a>
          </div>
          {loading ? (
            <div style={{ padding: '20px', color: 'var(--text-3)', fontSize: '10px', textAlign: 'center', letterSpacing: '1px' }}>LOADING...</div>
          ) : stocks.length === 0 ? (
            <div style={{ padding: '20px', color: 'var(--text-3)', fontSize: '10px', textAlign: 'center', letterSpacing: '1px' }}>
              NO STOCKS YET<br />
              <a href="/screener" style={{ color: 'var(--accent)', textDecoration: 'none', marginTop: '8px', display: 'inline-block' }}>BROWSE SCREENER →</a>
            </div>
          ) : (
            stocks.map(s => {
              const up = s.priceChangePct >= 0;
              return (
                <div key={s.ticker}
                  onClick={() => openInNewTab(`/stock/${s.ticker}`)}
                  style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--accent)', fontSize: '12px', fontWeight: 700 }}>{s.ticker}</span>
                      <span style={{ color: 'var(--text)', fontSize: '12px', fontWeight: 600 }}>${s.currentPrice?.toFixed(2) || '—'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                      <span style={{ color: 'var(--text-3)', fontSize: '9px' }}>{s.name?.split(' ').slice(0, 2).join(' ')}</span>
                      <span style={{ color: up ? 'var(--green)' : 'var(--red)', fontSize: '10px', fontWeight: 600 }}>
                        {s.priceChangePct ? `${up ? '+' : ''}${s.priceChangePct.toFixed(2)}%` : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      <button
        onClick={() => setOpen(!open)}
        style={{ background: open ? 'var(--accent)' : 'var(--bg-1)', border: '1px solid var(--border)', color: open ? '#000' : 'var(--accent)', fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', fontWeight: 700, padding: '8px 16px', cursor: 'pointer', letterSpacing: '2px', display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
        {open ? 'CLOSE' : 'WATCHLIST'}
      </button>
    </div>
  );
}