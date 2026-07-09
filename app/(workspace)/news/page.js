'use client';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useUser } from '../../components/AuthProvider';
import { distributeMasonryColumns } from '../../../lib/homeLayout';
import NewsImage from '../../components/workspace/home/NewsImage';

export default function NewsPage() {
  const { isSignedIn } = useUser();

  const [tab, setTab] = useState('all');
  const [marketNews, setMarketNews] = useState([]);
  const [marketLoading, setMarketLoading] = useState(true);
  const [holdingsNews, setHoldingsNews] = useState([]);
  const [holdingsLoading, setHoldingsLoading] = useState(false);
  const [tickers, setTickers] = useState([]);
  const [columnCount, setColumnCount] = useState(3);

  const resizeObserverRef = useRef(null);
  const feedRef = useCallback((node) => {
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
      resizeObserverRef.current = null;
    }
    if (node) {
      const compute = () => setColumnCount(Math.min(4, Math.max(1, Math.floor(node.offsetWidth / 220))));
      const ro = new ResizeObserver(compute);
      ro.observe(node);
      resizeObserverRef.current = ro;
      compute();
    }
  }, []);

  const fetchMarketNews = useCallback(() => {
    fetch('/api/filings')
      .then(r => r.json())
      .then(d => { if (d.filings) setMarketNews(d.filings); })
      .catch(() => {})
      .finally(() => setMarketLoading(false));
  }, []);

  useEffect(() => {
    fetchMarketNews();
    const interval = setInterval(fetchMarketNews, 60000);
    return () => clearInterval(interval);
  }, [fetchMarketNews]);

  // Gather portfolio + watchlist tickers to personalize the "My Holdings" tab
  useEffect(() => {
    fetch('/api/watchlist')
      .then(r => r.json())
      .then(d => {
        const watchTickers = (d.tickers || []).map(w => w.ticker || w);
        if (isSignedIn) {
          fetch('/api/portfolio')
            .then(r => r.json())
            .then(d2 => {
              const holdingTickers = (d2.holdings || []).map(h => h.ticker);
              setTickers([...new Set([...holdingTickers, ...watchTickers])]);
            })
            .catch(() => setTickers([...new Set(watchTickers)]));
        } else {
          try {
            const saved = JSON.parse(localStorage.getItem('traqcker_portfolio') || '[]');
            setTickers([...new Set([...saved.map(p => p.ticker), ...watchTickers])]);
          } catch (e) {
            setTickers([...new Set(watchTickers)]);
          }
        }
      })
      .catch(() => {});
  }, [isSignedIn]);

  useEffect(() => {
    if (tickers.length === 0) {
      setHoldingsNews([]);
      return;
    }
    setHoldingsLoading(true);
    fetch(`/api/filings?tickers=${tickers.join(',')}`)
      .then(r => r.json())
      .then(d => setHoldingsNews(d.holdingsNews || []))
      .catch(() => setHoldingsNews([]))
      .finally(() => setHoldingsLoading(false));
  }, [tickers.join(',')]);

  const activeFeed = useMemo(() => (tab === 'holdings' ? holdingsNews : marketNews), [tab, holdingsNews, marketNews]);
  const activeLoading = tab === 'holdings' ? holdingsLoading : marketLoading;

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', minHeight: 'calc(100vh - var(--topbar-height))', boxSizing: 'border-box' }}>
      {/* Terminal title bar */}
      <div style={{ border: '1px solid var(--ws-border)', background: 'var(--ws-bg-1)', overflow: 'hidden' }}>
        <div style={{ background: 'var(--ws-bg-2)', borderBottom: '1px solid var(--ws-border)', padding: '7px 16px' }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: 'var(--ws-accent)', fontWeight: 700, letterSpacing: '1px' }}>
            $ traq news
          </span>
        </div>
      </div>

      <div>
        <h1 style={{ fontSize: '26px', fontWeight: 800, color: 'var(--ws-text)', letterSpacing: '-0.75px', marginBottom: '4px' }}>Market News</h1>
        <p style={{ fontSize: '12px', color: 'var(--ws-text-3)' }}>Stock & ETF headlines, ranked by relevance.</p>
      </div>

      <div style={{ border: '1px solid var(--ws-border)', background: 'var(--ws-bg-1)', borderRadius: '10px', overflow: 'hidden' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--ws-border)', background: 'rgba(0,0,0,0.01)' }}>
          {['all', 'holdings'].map(tabKey => (
            <button key={tabKey} onClick={() => setTab(tabKey)}
              style={{
                padding: '12px 20px',
                fontSize: '11px',
                fontWeight: 700,
                color: tab === tabKey ? 'var(--ws-accent)' : 'var(--ws-text-3)',
                background: 'none',
                border: 'none',
                borderBottom: tab === tabKey ? '2px solid var(--ws-accent)' : '2px solid transparent',
                cursor: 'pointer',
                outline: 'none',
                transition: 'all 0.15s ease',
              }}
            >
              {tabKey === 'all' ? 'All' : `My Holdings (${tickers.length})`}
            </button>
          ))}
        </div>

        {activeLoading ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--ws-text-3)', fontSize: '12px' }}>
            Loading {tab === 'holdings' ? 'holdings' : 'market'} news...
          </div>
        ) : activeFeed.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--ws-text-3)', fontSize: '12px' }}>
            {tab === 'holdings'
              ? (tickers.length === 0
                ? 'Add positions or watchlist tickers to see news about them here.'
                : 'No recent news for your holdings.')
              : 'No recent financial news available.'}
          </div>
        ) : (
          <div ref={feedRef} style={{ display: 'flex', gap: '16px', padding: '20px', alignItems: 'flex-start' }}>
            {distributeMasonryColumns(activeFeed, columnCount).map((column, colIdx) => (
              <div key={colIdx} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {column.map(({ item: f, index: i }) => {
                  const sourceLetter = f.source ? f.source.charAt(0).toUpperCase() : 'N';
                  const isFeatured = i === 0;
                  return (
                    <a
                      key={f.id || i}
                      href={f.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'block',
                        borderRadius: '10px',
                        border: '1px solid var(--ws-border)',
                        background: 'var(--ws-bg-2)',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        textDecoration: 'none',
                        transition: 'all 0.2s ease-in-out',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 6px 18px rgba(0,0,0,0.14)';
                        e.currentTarget.style.borderColor = 'var(--ws-accent)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.transform = 'none';
                        e.currentTarget.style.boxShadow = 'none';
                        e.currentTarget.style.borderColor = 'var(--ws-border)';
                      }}
                    >
                      <NewsImage src={f.image} alt={f.title} ticker={f.ticker} large={isFeatured} />
                      <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{
                          fontSize: isFeatured ? '15px' : '12px',
                          fontWeight: 700,
                          color: 'var(--ws-text)',
                          lineHeight: '1.45',
                        }}>
                          {f.title}
                        </div>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          borderTop: '1px solid var(--ws-border)',
                          paddingTop: '8px',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{
                              width: '16px',
                              height: '16px',
                              borderRadius: '50%',
                              background: 'var(--ws-accent)',
                              color: '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '9px',
                              fontWeight: 900,
                              flexShrink: 0,
                            }}>
                              {sourceLetter}
                            </div>
                            <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--ws-text-2)' }}>
                              {f.source}
                            </span>
                          </div>
                          <span style={{ fontSize: '9px', color: 'var(--ws-text-3)', whiteSpace: 'nowrap' }}>
                            {f.time}
                          </span>
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
