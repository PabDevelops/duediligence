'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '../../components/AuthProvider';
import StockLogo from '../../components/workspace/StockLogo';

const MOVER_CATEGORIES = [
  { id: 'gainers', label: 'Top Gainers' },
  { id: 'losers', label: 'Top Losers' },
  { id: 'bigCapMovers', label: 'Big Cap Movers' },
];

const THEME_CATEGORIES = [
  { id: 'bigtech', label: 'Big Tech' },
  { id: 'ai', label: 'AI & Semiconductors' },
  { id: 'defence', label: 'Defence' },
  { id: 'quantum', label: 'Quantum Computing' },
  { id: 'evs', label: 'EVs' },
  { id: 'banks', label: 'Banks & Financials' },
  { id: 'dividends', label: 'Dividend Aristocrats' },
  { id: 'cybersecurity', label: 'Cybersecurity' },
  { id: 'biotech', label: 'Biotech & Drugs' },
  { id: 'energy', label: 'Oil & Gas' },
];

const INDUSTRY_CATEGORIES = [
  { id: 'bigpharma', label: 'Big Pharma' },
  { id: 'reit', label: 'REIT' },
  { id: 'airlines', label: 'Airlines' },
  { id: 'automotive', label: 'Automotive' },
  { id: 'chipmakers', label: 'Chipmakers' },
  { id: 'insurance', label: 'Insurance Giants' },
  { id: 'hotels', label: 'Hotels' },
  { id: 'restaurants', label: 'Restaurants' },
  { id: 'regionalbanks', label: 'Regional Banks' },
  { id: 'mining', label: 'Mining Prospects' },
  { id: 'chemicals', label: 'Chemical Manufacturing' },
  { id: 'railroads', label: 'Railroads' },
  { id: 'motionpictures', label: 'Motion Pictures' },
  { id: 'broadcasting', label: 'Broadcasting & Cable' },
  { id: 'grocery', label: 'Grocery Stores' },
  { id: 'footwear', label: 'Footwear' },
  { id: 'fashion', label: 'Fashion' },
  { id: 'robotics', label: 'Robotics' },
  { id: 'crypto', label: 'Crypto & Blockchain' },
  { id: 'spac', label: 'SPAC-Born' },
];

const SCREEN_CATEGORIES = [
  { id: 'highpe', label: 'High P/E' },
  { id: 'lowpe', label: 'Low P/E' },
  { id: 'volatile', label: 'Volatile' },
  { id: 'lowvolatility', label: 'Low Volatility' },
  { id: 'upcomingearnings', label: 'Upcoming Earnings' },
];

const MOVER_IDS = new Set(MOVER_CATEGORIES.map((c) => c.id));
const SCREEN_IDS = new Set(SCREEN_CATEGORIES.map((c) => c.id));

export default function ExplorePage() {
  const router = useRouter();
  const { isSignedIn } = useUser();

  const [activeCategory, setActiveCategory] = useState('gainers');
  const [movers, setMovers] = useState({ gainers: [], losers: [], bigCapMovers: [] });
  const [loadingMovers, setLoadingMovers] = useState(true);
  const [themeCache, setThemeCache] = useState({});
  const [loadingTheme, setLoadingTheme] = useState(false);
  const [watchlistSet, setWatchlistSet] = useState(new Set());
  const [globalMarkets, setGlobalMarkets] = useState([]);
  const [recents, setRecents] = useState([]);
  const [screenerData, setScreenerData] = useState(null);
  const [loadingScreener, setLoadingScreener] = useState(false);
  const [earningsData, setEarningsData] = useState(null);
  const [loadingEarnings, setLoadingEarnings] = useState(false);
  const [watchlistData, setWatchlistData] = useState([]);
  const [loadingWatchlist, setLoadingWatchlist] = useState(false);

  // Market movers — fetched once, all three tabs come from the same response
  useEffect(() => {
    fetch('/api/movers')
      .then((res) => res.json())
      .then((data) => {
        setMovers({
          gainers: data.gainers || [],
          losers: data.losers || [],
          bigCapMovers: data.bigCapMovers || [],
        });
      })
      .catch(() => {})
      .finally(() => setLoadingMovers(false));
  }, []);

  // Thematic basket — fetched lazily per category, cached so re-selecting is instant
  useEffect(() => {
    if (MOVER_IDS.has(activeCategory)) return;
    if (themeCache[activeCategory]) return;

    setLoadingTheme(true);
    fetch(`/api/explore?category=${activeCategory}`)
      .then((res) => res.json())
      .then((data) => {
        setThemeCache((prev) => ({ ...prev, [activeCategory]: data }));
        // Seed any tickers the cache didn't have yet — same on-demand pattern as the
        // ETF screener's search bar. Next visit to this category will show them.
        (data.missing || []).forEach((ticker) => {
          fetch(`/api/stock?ticker=${ticker}`).catch(() => {});
        });
      })
      .catch(() => {})
      .finally(() => setLoadingTheme(false));
  }, [activeCategory, themeCache]);

  // Dynamic screens — computed from the screener cache / earnings calendar instead of a
  // curated ticker list, fetched lazily the first time one of these categories is opened.
  useEffect(() => {
    if (!SCREEN_IDS.has(activeCategory)) return;

    if (activeCategory === 'upcomingearnings') {
      if (earningsData) return;
      setLoadingEarnings(true);
      fetch('/api/earnings')
        .then((res) => res.json())
        .then((data) => setEarningsData(data.earnings || []))
        .catch(() => setEarningsData([]))
        .finally(() => setLoadingEarnings(false));
      return;
    }

    if (screenerData) return;
    setLoadingScreener(true);
    fetch('/api/screener')
      .then((res) => res.json())
      .then((data) => setScreenerData(data.stocks || []))
      .catch(() => setScreenerData([]))
      .finally(() => setLoadingScreener(false));
  }, [activeCategory, screenerData, earningsData]);

  // Watchlist membership, for the quick add/remove column
  useEffect(() => {
    fetch('/api/watchlist')
      .then((res) => res.json())
      .then((data) => setWatchlistSet(new Set((data.tickers || []).map((t) => t.ticker))))
      .catch(() => {});
  }, []);

  // Load full watchlist details when watchlist tab is active
  useEffect(() => {
    if (activeCategory !== 'mywatchlist') return;
    setLoadingWatchlist(true);
    fetch('/api/watchlist?full=true')
      .then((res) => res.json())
      .then((data) => {
        setWatchlistData(data.tickers || []);
      })
      .catch(() => {})
      .finally(() => setLoadingWatchlist(false));
  }, [activeCategory]);

  // Global markets panel (indices + commodities)
  useEffect(() => {
    fetch('/api/market?extended=true')
      .then((res) => res.json())
      .then((data) => setGlobalMarkets(data.markets || []))
      .catch(() => {});
  }, []);

  // Recently viewed stocks (same localStorage key the Home dashboard writes to)
  useEffect(() => {
    let tickers = [];
    try {
      const viewedKey = Object.keys(localStorage).find((k) => k.startsWith('viewed_stocks_')) || 'viewed_stocks';
      tickers = JSON.parse(localStorage.getItem(viewedKey) || '[]').slice(0, 5);
    } catch (e) {}

    if (tickers.length === 0) return;
    Promise.all(
      tickers.map((ticker) =>
        fetch(`/api/stock?ticker=${ticker}`)
          .then((res) => res.json())
          .then((d) => (d.error ? null : { ticker, currentPrice: d.currentPrice, priceChangePct: d.priceChangePct }))
          .catch(() => null)
      )
    ).then((results) => setRecents(results.filter(Boolean)));
  }, []);

  const toggleWatchlist = useCallback(async (ticker) => {
    if (!isSignedIn) { window.location.href = '/sign-in'; return; }
    const inList = watchlistSet.has(ticker);
    const method = inList ? 'DELETE' : 'POST';
    await fetch('/api/watchlist', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker }),
    });
    setWatchlistSet((prev) => {
      const next = new Set(prev);
      if (inList) next.delete(ticker); else next.add(ticker);
      return next;
    });
    if (inList) {
      setWatchlistData((prev) => prev.filter(t => t.ticker !== ticker));
    }
  }, [isSignedIn, watchlistSet]);

  const { rows, loading, categoryLabel } = useMemo(() => {
    if (activeCategory === 'mywatchlist') {
      return { rows: watchlistData, loading: loadingWatchlist, categoryLabel: 'My Watchlist' };
    }

    if (MOVER_IDS.has(activeCategory)) {
      const label = MOVER_CATEGORIES.find((c) => c.id === activeCategory)?.label;
      return { rows: movers[activeCategory] || [], loading: loadingMovers, categoryLabel: label };
    }

    if (SCREEN_IDS.has(activeCategory)) {
      const label = SCREEN_CATEGORIES.find((c) => c.id === activeCategory)?.label;

      if (activeCategory === 'upcomingearnings') {
        if (!earningsData) return { rows: [], loading: loadingEarnings, categoryLabel: label };
        const today = new Date().toISOString().slice(0, 10);
        const priceByTicker = Object.fromEntries((screenerData || []).map((s) => [s.ticker, s]));
        const screenRows = earningsData
          .filter((e) => e.date >= today)
          .sort((a, b) => a.date.localeCompare(b.date))
          .slice(0, 40)
          .map((e) => ({
            ticker: e.ticker,
            name: priceByTicker[e.ticker]?.name || e.ticker,
            currentPrice: priceByTicker[e.ticker]?.currentPrice ?? null,
            priceChangePct: priceByTicker[e.ticker]?.priceChangePct ?? null,
            earningsDate: e.date,
          }));
        return { rows: screenRows, loading: loadingEarnings, categoryLabel: label };
      }

      if (!screenerData) return { rows: [], loading: loadingScreener, categoryLabel: label };
      let screenRows = [];
      if (activeCategory === 'highpe') screenRows = screenerData.filter((s) => s.pe != null && s.pe > 0).sort((a, b) => b.pe - a.pe).slice(0, 40);
      else if (activeCategory === 'lowpe') screenRows = screenerData.filter((s) => s.pe != null && s.pe > 0).sort((a, b) => a.pe - b.pe).slice(0, 40);
      else if (activeCategory === 'volatile') screenRows = screenerData.filter((s) => s.beta != null).sort((a, b) => b.beta - a.beta).slice(0, 40);
      else if (activeCategory === 'lowvolatility') screenRows = screenerData.filter((s) => s.beta != null).sort((a, b) => a.beta - b.beta).slice(0, 40);
      return { rows: screenRows, loading: loadingScreener, categoryLabel: label };
    }

    const cached = themeCache[activeCategory];
    const label = [...THEME_CATEGORIES, ...INDUSTRY_CATEGORIES].find((c) => c.id === activeCategory)?.label;
    return { rows: cached?.stocks || [], loading: loadingTheme && !cached, categoryLabel: cached?.label || label };
  }, [activeCategory, movers, loadingMovers, themeCache, loadingTheme, screenerData, loadingScreener, earningsData, loadingEarnings, watchlistData, loadingWatchlist]);

  const isEarningsCategory = activeCategory === 'upcomingearnings';

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', minHeight: 'calc(100vh - var(--topbar-height))', boxSizing: 'border-box' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .explore-layout {
          display: grid;
          grid-template-columns: 220px 1fr 300px;
          gap: 20px;
          align-items: stretch;
        }
        @media (max-width: 1280px) {
          .explore-layout {
            grid-template-columns: 200px 1fr;
          }
          .explore-right-col {
            display: none;
          }
        }
        @media (max-width: 860px) {
          .explore-layout {
            grid-template-columns: 1fr;
          }
        }
      `}} />

      {/* Terminal title bar */}
      <div style={{ border: '1px solid var(--ws-border)', background: 'var(--ws-bg-1)', overflow: 'hidden' }}>
        <div style={{ background: 'var(--ws-bg-2)', borderBottom: '1px solid var(--ws-border)', padding: '7px 16px' }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: 'var(--ws-accent)', fontWeight: 700, letterSpacing: '1px' }}>
            $ traq explore
          </span>
        </div>
      </div>

      <div>
        <h1 style={{ fontSize: '26px', fontWeight: 800, color: 'var(--ws-text)', letterSpacing: '-0.75px', marginBottom: '4px' }}>Explore Markets</h1>
        <p style={{ fontSize: '12px', color: 'var(--ws-text-3)' }}>Market movers and thematic baskets to discover what to research next.</p>
      </div>

      <div className="explore-layout">

        {/* LEFT: CATEGORY SIDEBAR */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', padding: '16px', boxSizing: 'border-box' }}>
          {[
            { title: 'MY WATCHLIST', items: [{ id: 'mywatchlist', label: 'Watchlist' }] },
            { title: 'MARKET MOVERS', items: MOVER_CATEGORIES },
            { title: 'THEMATIC', items: THEME_CATEGORIES },
            { title: 'INDUSTRIES', items: INDUSTRY_CATEGORIES },
            { title: 'SCREENS', items: SCREEN_CATEGORIES },
          ].map((group, gi) => (
            <div key={group.title} style={gi > 0 ? { borderTop: '1px solid var(--ws-border)', paddingTop: '14px' } : undefined}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', color: 'var(--ws-text-3)', letterSpacing: '1.5px', fontWeight: 700, marginBottom: '8px' }}>
                {group.title}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {group.items.map((cat) => (
                  <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
                    style={{
                      textAlign: 'left',
                      padding: '7px 10px',
                      fontSize: '12px',
                      fontWeight: activeCategory === cat.id ? 700 : 500,
                      background: activeCategory === cat.id ? 'var(--ws-accent-dim)' : 'transparent',
                      border: 'none',
                      color: activeCategory === cat.id ? 'var(--ws-accent)' : 'var(--ws-text-2)',
                      cursor: 'pointer'
                    }}>
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* MAIN: TABLE */}
        <div style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', overflow: 'hidden' }}>
          <div style={{ background: 'var(--ws-bg-2)', borderBottom: '1px solid var(--ws-border)', padding: '10px 16px' }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', color: 'var(--ws-text-3)', letterSpacing: '1px', fontWeight: 700 }}>
              {(categoryLabel || '').toUpperCase()}
            </span>
          </div>

          {loading ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--ws-text-3)' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: 'var(--ws-accent)', fontSize: '11px' }}>▶</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', letterSpacing: '1px' }}>LOADING {(categoryLabel || '').toUpperCase()}...</span>
              </div>
            </div>
          ) : rows.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--ws-text-3)', fontSize: '12px' }}>
              {activeCategory === 'mywatchlist' ? (
                !isSignedIn ? (
                  <div>
                    Please <a href="/sign-in" style={{ color: 'var(--ws-accent)', fontWeight: 600, textDecoration: 'underline' }}>sign in</a> to view your watchlist.
                  </div>
                ) : (
                  'Your watchlist is empty. Search for a stock to add it to your watchlist!'
                )
              ) : (
                'No data available for this category yet.'
              )}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--ws-bg-2)' }}>
                  <th style={{ padding: '10px 16px', fontWeight: 700, fontSize: '10px', color: 'var(--ws-text-3)', borderBottom: '2px solid var(--ws-border)' }}>NAME</th>
                  <th style={{ padding: '10px 16px', fontWeight: 700, fontSize: '10px', color: 'var(--ws-text-3)', borderBottom: '2px solid var(--ws-border)' }}>SYMBOL</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, fontSize: '10px', color: 'var(--ws-text-3)', borderBottom: '2px solid var(--ws-border)' }}>PRICE</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, fontSize: '10px', color: 'var(--ws-text-3)', borderBottom: '2px solid var(--ws-border)' }}>CHANGE</th>
                  <th style={{ padding: '10px 16px', fontWeight: 700, fontSize: '10px', color: 'var(--ws-text-3)', borderBottom: '2px solid var(--ws-border)' }}>{isEarningsCategory ? 'EARNINGS DATE' : 'EXCHANGE'}</th>
                  <th style={{ padding: '10px 16px', width: '40px', borderBottom: '2px solid var(--ws-border)' }} />
                </tr>
              </thead>
              <tbody>
                {rows.map((s, idx) => {
                  const isUp = s.priceChangePct != null && s.priceChangePct >= 0;
                  const inWatchlist = watchlistSet.has(s.ticker);
                  return (
                    <tr key={s.ticker}
                      onClick={() => router.push(`/stock/${s.ticker}`)}
                      style={{ cursor: 'pointer', background: idx % 2 === 0 ? 'var(--ws-bg-1)' : 'var(--ws-bg-2)', borderBottom: '1px solid var(--ws-border)' }}
                    >
                      <td style={{ padding: '10px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <StockLogo ticker={s.ticker} />
                          <span style={{ color: 'var(--ws-text-2)', fontWeight: 600, maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {s.name || s.ticker}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 16px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, color: 'var(--ws-text)' }}>
                        {s.ticker}
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: 'var(--ws-text)' }}>
                        {s.currentPrice != null ? `$${s.currentPrice.toFixed(2)}` : '—'}
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: s.priceChangePct == null ? 'var(--ws-text-3)' : isUp ? 'var(--ws-accent)' : 'var(--ws-red)' }}>
                        {s.priceChangePct != null ? `${isUp ? '+' : ''}${s.priceChangePct.toFixed(2)}%` : '—'}
                      </td>
                      <td style={{ padding: '10px 16px', color: 'var(--ws-text-3)', fontSize: '11px' }}>
                        {isEarningsCategory ? (s.earningsDate || '—') : (s.exchange || '—')}
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleWatchlist(s.ticker); }}
                          title={inWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist'}
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '4px',
                            border: '1px solid var(--ws-border)',
                            background: inWatchlist ? 'var(--ws-text)' : 'var(--ws-bg-2)',
                            color: inWatchlist ? 'var(--ws-bg)' : 'var(--ws-text)',
                            fontSize: '13px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            lineHeight: 1
                          }}>
                          {inWatchlist ? '✓' : '+'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* RIGHT: GLOBAL MARKETS + RECENTS */}
        <div className="explore-right-col" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          <div style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', overflow: 'hidden' }}>
            <div style={{ background: 'var(--ws-bg-2)', borderBottom: '1px solid var(--ws-border)', padding: '10px 16px' }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', color: 'var(--ws-text-3)', letterSpacing: '1px', fontWeight: 700 }}>GLOBAL MARKETS</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {globalMarkets.length === 0 ? (
                <div style={{ padding: '20px 16px', color: 'var(--ws-text-3)', fontSize: '11px' }}>Loading...</div>
              ) : globalMarkets.map((m) => {
                const isUp = m.changePct != null && m.changePct >= 0;
                return (
                  <div key={m.symbol} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid var(--ws-border)' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ws-text-2)' }}>{m.label}</span>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', fontWeight: 700, color: 'var(--ws-text)' }}>
                        {m.price != null ? m.price.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}
                      </div>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', fontWeight: 700, color: m.changePct == null ? 'var(--ws-text-3)' : isUp ? 'var(--ws-accent)' : 'var(--ws-red)' }}>
                        {m.changePct != null ? `${isUp ? '+' : ''}${m.changePct.toFixed(2)}%` : '—'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', overflow: 'hidden' }}>
            <div style={{ background: 'var(--ws-bg-2)', borderBottom: '1px solid var(--ws-border)', padding: '10px 16px' }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', color: 'var(--ws-text-3)', letterSpacing: '1px', fontWeight: 700 }}>RECENTS</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {recents.length === 0 ? (
                <div style={{ padding: '20px 16px', color: 'var(--ws-text-3)', fontSize: '11px' }}>No recently viewed tickers yet.</div>
              ) : recents.map((r) => {
                const isUp = r.priceChangePct != null && r.priceChangePct >= 0;
                return (
                  <div key={r.ticker} onClick={() => router.push(`/stock/${r.ticker}`)}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid var(--ws-border)', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <StockLogo ticker={r.ticker} size={20} />
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ws-text)' }}>{r.ticker}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', fontWeight: 600, color: 'var(--ws-text)' }}>
                        {r.currentPrice != null ? `$${r.currentPrice.toFixed(2)}` : '—'}
                      </div>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', fontWeight: 700, color: r.priceChangePct == null ? 'var(--ws-text-3)' : isUp ? 'var(--ws-accent)' : 'var(--ws-red)' }}>
                        {r.priceChangePct != null ? `${isUp ? '+' : ''}${r.priceChangePct.toFixed(2)}%` : '—'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
