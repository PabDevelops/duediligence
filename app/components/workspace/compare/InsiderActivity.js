'use client';
import { useEffect, useState } from 'react';

// SEC Form 4 transaction codes — P/S are genuine open-market trades, everything else
// (grants, exercises, tax withholding, gifts...) moves shares for administrative reasons
// and isn't a real buy/sell signal worth surfacing on a "who's trading" radar.
const TXN_CODE_LABELS = {
  P: 'BUY', S: 'SELL', A: 'GRANT', M: 'EXERCISE', F: 'TAX WITHHOLD', G: 'GIFT', C: 'CONVERSION',
};

// Compact Insider Activity widget — samples insider trades from tickers already
// surfaced by the movers feed (Finnhub doesn't offer a market-wide insider feed
// on our plan, only per-symbol), then shows the most recent buys/sells.
export default function InsiderActivity({ movers, triggerSpotlight }) {
  const [trades, setTrades] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!movers) return;
    const pool = [
      ...(movers.bigCapMovers || []).slice(0, 4),
      ...(movers.gainers || []).slice(0, 3),
      ...(movers.losers || []).slice(0, 3),
    ];
    const tickers = [...new Set(pool.map(s => s.ticker))].slice(0, 8);
    if (tickers.length === 0) { setLoading(false); return; }

    let cancelled = false;
    setLoading(true);
    Promise.all(
      tickers.map(t =>
        fetch(`/api/insider-trades?ticker=${t}&limit=5`).then(r => r.json()).catch(() => null)
      )
    ).then(results => {
      if (cancelled) return;
      const flat = results.flatMap(r => r?.transactions || []).sort((a, b) => b.date.localeCompare(a.date));
      // Prefer real open-market trades; only backfill with grants/exercises/etc. if there
      // aren't enough, since a page of identical director grants isn't an interesting signal.
      const openMarket = flat.filter(t => t.isOpenMarket);
      const rest = flat.filter(t => !t.isOpenMarket);
      setTrades([...openMarket, ...rest].slice(0, 6));
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [movers]);

  return (
    <div style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px', height: '100%', boxSizing: 'border-box' }}>
      <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--ws-accent)', letterSpacing: '1px', borderBottom: '1px solid var(--ws-border)', paddingBottom: '8px' }}>
        INSIDER ACTIVITY
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, justifyContent: loading || !trades?.length ? 'center' : 'flex-start' }}>
        {loading ? (
          <span className="text-ws-text-3 text-[11px]" style={{ textAlign: 'center' }}>Scanning Form 4 filings…</span>
        ) : !trades || trades.length === 0 ? (
          <span className="text-ws-text-3 text-[11px]" style={{ textAlign: 'center' }}>No recent insider activity</span>
        ) : (
          trades.map((t, i) => (
            <div
              key={i}
              onClick={() => triggerSpotlight(t.ticker)}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', paddingBottom: i < trades.length - 1 ? '8px' : 0, borderBottom: i < trades.length - 1 ? '1px dashed var(--ws-border)' : 'none' }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.75'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              <div style={{ minWidth: 0 }}>
                <span style={{ fontWeight: 800, fontSize: '11px', marginRight: '6px' }}>{t.ticker}</span>
                <span style={{ fontSize: '10px', color: 'var(--ws-text-3)' }}>{t.insider}</span>
              </div>
              <span style={{ fontSize: '10px', fontWeight: 800, color: t.isOpenMarket ? (t.type === 'BUY' ? '#059669' : '#dc2626') : 'var(--ws-text-3)', flexShrink: 0, marginLeft: '8px' }}>
                {t.type === 'BUY' ? '▲' : '▼'} {TXN_CODE_LABELS[t.code] || t.type} {t.shares >= 1000 ? `${Math.round(t.shares / 1000)}K` : t.shares}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
