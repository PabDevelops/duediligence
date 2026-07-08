'use client';
import { useState, useEffect, useCallback } from 'react';
import { useUser } from '../../components/AuthProvider';
import { useRouter } from 'next/navigation';
import StockChart from '../../components/StockChart';
import { fmt, formatPrice as formatCurrency } from '../../../lib/formatters';

import StockLogo from '../../components/workspace/StockLogo';

function NewsRow({ item, isLast }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div onClick={() => setExpanded(e => !e)}
      style={{ padding: '12px 14px', borderBottom: isLast ? 'none' : '1px solid var(--ws-border)', cursor: 'pointer', background: 'transparent', transition: 'background 0.15s' }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--ws-bg-2)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ws-text)', lineHeight: 1.4 }}>{item.title}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
        <span style={{ fontSize: '10px', color: 'var(--ws-text-3)' }}>{item.source} · {item.time}</span>
      </div>
      {expanded && (
        <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--ws-text-2)', lineHeight: 1.5 }}>
          <div>{item.summary || 'No summary available for this story.'}</div>
          <a href={item.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
            style={{ display: 'inline-block', marginTop: '6px', fontSize: '11px', fontWeight: 700, color: 'var(--ws-accent)', textDecoration: 'none' }}>
            Read full article ↗
          </a>
        </div>
      )}
    </div>
  );
}

export default function WatchlistPage() {
  const { isSignedIn } = useUser();
  const router = useRouter();
  const [tickers, setTickers] = useState([]);
  const [loadingWatchlist, setLoadingWatchlist] = useState(true);
  const [activeTicker, setActiveTicker] = useState(null);
  const [selectedStockData, setSelectedStockData] = useState(null);
  const [loadingStock, setLoadingStock] = useState(false);
  const [news, setNews] = useState([]);
  const [loadingNews, setLoadingNews] = useState(false);

  // Search/Add states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchError, setSearchError] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // Responsive state
  const [showDetailOnMobile, setShowDetailOnMobile] = useState(false);

  // Fetch watchlist symbols + brief details
  const fetchWatchlist = useCallback(async (selectTicker = null) => {
    setLoadingWatchlist(true);
    try {
      const res = await fetch('/api/watchlist?full=true');
      const data = await res.json();
      const list = data.tickers || [];
      setTickers(list);
      
      if (list.length > 0) {
        if (selectTicker) {
          setActiveTicker(selectTicker);
        } else if (!activeTicker) {
          setActiveTicker(list[0].ticker);
        }
      } else {
        setActiveTicker(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingWatchlist(false);
    }
  }, [activeTicker]);

  useEffect(() => {
    if (isSignedIn) {
      fetchWatchlist();
    } else {
      setLoadingWatchlist(false);
    }
  }, [isSignedIn]);

  // Fetch selected stock fundamentals
  useEffect(() => {
    if (!activeTicker) {
      setSelectedStockData(null);
      return;
    }
    setLoadingStock(true);
    fetch(`/api/stock?ticker=${activeTicker}`)
      .then(r => r.json())
      .then(d => {
        if (!d.error) {
          setSelectedStockData(d);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingStock(false));
  }, [activeTicker]);

  // Fetch news for active stock
  useEffect(() => {
    if (!activeTicker) {
      setNews([]);
      return;
    }
    setLoadingNews(true);
    fetch(`/api/filings?tickers=${activeTicker}`)
      .then(r => r.json())
      .then(d => {
        setNews(d.holdingsNews || []);
      })
      .catch(() => setNews([]))
      .finally(() => setLoadingNews(false));
  }, [activeTicker]);

  // Remove ticker
  const removeTicker = async (tickerToRemove) => {
    await fetch('/api/watchlist', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker: tickerToRemove }),
    });

    setTickers(prev => prev.filter(t => t.ticker !== tickerToRemove));
    if (activeTicker === tickerToRemove) {
      const remaining = tickers.filter(t => t.ticker !== tickerToRemove);
      if (remaining.length > 0) {
        setActiveTicker(remaining[0].ticker);
      } else {
        setActiveTicker(null);
      }
    }
  };

  // Add ticker
  const handleAddStock = async (e) => {
    if (e.key !== 'Enter') return;
    const ticker = searchQuery.trim().toUpperCase();
    if (!ticker) return;

    setIsAdding(true);
    setSearchError('');

    try {
      const res = await fetch(`/api/stock?ticker=${ticker}`);
      const data = await res.json();
      if (data.error) {
        setSearchError('Symbol not found');
        setIsAdding(false);
        return;
      }

      const addRes = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker }),
      });

      if (addRes.ok) {
        setSearchQuery('');
        fetchWatchlist(ticker);
      } else {
        setSearchError('Error adding symbol');
      }
    } catch (err) {
      setSearchError('Connection error');
    } finally {
      setIsAdding(false);
    }
  };

  if (!isSignedIn) {
    return (
      <div style={{ display: 'flex', flex1: 1, height: 'calc(100vh - var(--topbar-height))', alignItems: 'center', justifyContent: 'center', background: 'var(--ws-bg-1)', padding: '24px', boxSizing: 'border-box' }}>
        <div style={{ border: '1px solid var(--ws-border)', background: 'var(--ws-bg-2)', width: '100%', maxWidth: '420px', padding: '30px 24px', textAlign: 'center' }}>
          <div style={{ color: 'var(--ws-accent)', fontSize: '24px', marginBottom: '14px' }}>★</div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 10px', color: 'var(--ws-text)' }}>Your Watchlist</h2>
          <p style={{ fontSize: '13px', color: 'var(--ws-text-3)', lineHeight: 1.6, margin: '0 0 24px' }}>
            Please sign in to start tracking and analyzing your favorite stocks in real-time.
          </p>
          <button onClick={() => router.push('/sign-in')}
            style={{ width: '100%', padding: '12px', background: 'var(--ws-accent)', border: 'none', color: '#000', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
            SIGN IN
          </button>
        </div>
      </div>
    );
  }

  const activeStock = tickers.find(t => t.ticker === activeTicker);
  return (
    <div className="watchlist-container">
      {/* LEFT COLUMN: LIST OF TICKERS */}
      <div className={`watchlist-left-col ${showDetailOnMobile ? 'mobile-hide' : ''}`}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--ws-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--ws-accent)', fontSize: '14px' }}>★</span>
            <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--ws-text)', letterSpacing: '1px', fontFamily: 'JetBrains Mono, monospace' }}>WATCHLIST</span>
          </div>
          <span style={{ fontSize: '10px', color: 'var(--ws-text-3)', fontFamily: 'JetBrains Mono, monospace' }}>
            {tickers.length} TICKERS
          </span>
        </div>

        {/* SEARCH ADD BAR */}
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--ws-border)', background: 'var(--ws-bg-2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', padding: '6px 10px' }}>
            <span style={{ color: 'var(--ws-text-3)', fontSize: '12px' }}>+</span>
            <input
              type="text"
              placeholder="Add symbol... (Enter)"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setSearchError(''); }}
              onKeyDown={handleAddStock}
              disabled={isAdding}
              style={{ background: 'transparent', border: 'none', color: 'var(--ws-text)', fontSize: '11px', outline: 'none', width: '100%', fontFamily: 'JetBrains Mono, monospace' }}
            />
          </div>
          {searchError && (
            <div style={{ fontSize: '10px', color: 'var(--ws-red)', marginTop: '4px', fontFamily: 'JetBrains Mono, monospace' }}>
              {searchError}
            </div>
          )}
        </div>

        {/* LIST */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loadingWatchlist ? (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--ws-text-3)', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}>
              LOADING...
            </div>
          ) : tickers.length === 0 ? (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--ws-text-3)', fontSize: '12px', lineHeight: 1.6 }}>
              Your watchlist is empty.<br/>Add symbols above to get started.
            </div>
          ) : (
            tickers.map((t) => {
              const active = t.ticker === activeTicker;
              const priceChange = t.priceChangePct ?? 0;
              const isPositive = priceChange >= 0;

              return (
                <div key={t.ticker}
                  onClick={() => {
                    setActiveTicker(t.ticker);
                    setShowDetailOnMobile(true);
                  }}
                  className={`watchlist-item ${active ? 'active' : ''}`}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <StockLogo ticker={t.ticker} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '12px', color: active ? 'var(--ws-accent)' : 'var(--ws-text)', fontFamily: 'JetBrains Mono, monospace' }}>{t.ticker}</div>
                      <div style={{ fontSize: '10px', color: 'var(--ws-text-3)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{t.name || '—'}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, fontSize: '11px', color: 'var(--ws-text)', fontFamily: 'JetBrains Mono, monospace' }}>
                        {formatCurrency(t.currentPrice, t.currency || 'USD')}
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '10px', color: isPositive ? 'var(--ws-accent)' : 'var(--ws-red)', fontFamily: 'JetBrains Mono, monospace' }}>
                        {isPositive ? '+' : ''}{priceChange.toFixed(2)}%
                      </div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); removeTicker(t.ticker); }}
                      style={{ background: 'none', border: 'none', color: 'var(--ws-text-3)', cursor: 'pointer', fontSize: '14px', padding: '4px' }}
                      onMouseEnter={e => e.target.style.color = 'var(--ws-red)'}
                      onMouseLeave={e => e.target.style.color = 'var(--ws-text-3)'}>
                      ✕
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      {/* CENTER COLUMN: CHART & DETAILS */}
      <div className={`watchlist-center-col ${showDetailOnMobile ? 'mobile-show' : ''}`}>
        {showDetailOnMobile && (
          <div className="watchlist-back-btn">
            <button onClick={() => setShowDetailOnMobile(false)}
              className="ws-btn-secondary"
              style={{ margin: '14px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              ← BACK TO LIST
            </button>
          </div>
        )}

        {!activeTicker ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', color: 'var(--ws-text-3)', fontSize: '12px' }}>
            Select a stock to view details and chart
          </div>
        ) : (
          <div>
            {/* Header info */}
            <div style={{ borderBottom: '1px solid var(--ws-border)', padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <StockLogo ticker={activeTicker} size={36} />
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--ws-text-3)', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '1px' }}>
                    {activeTicker} · {activeStock?.exchange || 'NASDAQ'}
                  </div>
                  <h1 style={{ fontSize: '18px', fontWeight: 800, margin: '2px 0 0', color: 'var(--ws-text)' }}>
                    {activeStock?.name || '—'}
                  </h1>
                </div>
              </div>
              
              {activeStock && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--ws-text)', fontFamily: 'JetBrains Mono, monospace' }}>
                    {formatCurrency(activeStock.currentPrice, activeStock.currency || 'USD')}
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: (activeStock.priceChangePct ?? 0) >= 0 ? 'var(--ws-accent)' : 'var(--ws-red)', fontFamily: 'JetBrains Mono, monospace' }}>
                    {(activeStock.priceChangePct ?? 0) >= 0 ? '+' : ''}{(activeStock.priceChangePct ?? 0).toFixed(2)}%
                  </div>
                </div>
              )}
            </div>

            {/* CHART */}
            <div style={{ borderBottom: '1px solid var(--ws-border)', background: '#111111' }}>
              <StockChart ticker={activeTicker} currency={selectedStockData?.currency || 'USD'} />
            </div>

            {/* KEY METRICS */}
            <div style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '10px', color: 'var(--ws-text-3)', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '1.5px', margin: '0 0 16px', fontWeight: 800 }}>
                KEY FINANCIAL STATISTICS
              </h3>

              {loadingStock ? (
                <div style={{ padding: '20px 0', color: 'var(--ws-text-3)', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}>
                  LOADING DATA...
                </div>
              ) : selectedStockData ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 32px' }}>
                  {[
                    { label: 'MARKET CAP', value: fmt(selectedStockData.marketCap) },
                    { label: 'P/E RATIO', value: selectedStockData.pe ? selectedStockData.pe.toFixed(1) : '—' },
                    { label: 'FORWARD P/E', value: selectedStockData.forwardPE ? selectedStockData.forwardPE.toFixed(1) : '—' },
                    { label: 'FCF YIELD', value: selectedStockData.fcfYield ? `${selectedStockData.fcfYield.toFixed(2)}%` : '—' },
                    { label: 'DIVIDEND YIELD', value: selectedStockData.dividendYield ? `${selectedStockData.dividendYield.toFixed(2)}%` : '—' },
                    { label: 'BETA (1Y)', value: selectedStockData.beta ? selectedStockData.beta.toFixed(2) : '—' },
                    { label: '52W RANGE', value: selectedStockData.low52 && selectedStockData.high52 ? `$${selectedStockData.low52.toFixed(2)} - $${selectedStockData.high52.toFixed(2)}` : '—' },
                    { label: 'SECTOR', value: selectedStockData.sector || '—' },
                  ].map((metric) => (
                    <div key={metric.label} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--ws-border)', paddingBottom: '6px' }}>
                      <span style={{ fontSize: '10px', color: 'var(--ws-text-3)', fontFamily: 'JetBrains Mono, monospace' }}>
                        {metric.label}
                      </span>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ws-text)', fontFamily: 'JetBrains Mono, monospace' }}>
                        {metric.value}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: 'var(--ws-text-3)', fontSize: '11px' }}>
                  No fundamental metrics available for this ticker.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* RIGHT COLUMN: NEWS & FILINGS */}
      <div className="watchlist-right-col">
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--ws-border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: 'var(--ws-accent)', fontSize: '12px' }}>▶</span>
          <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--ws-text)', letterSpacing: '1.5px', fontFamily: 'JetBrains Mono, monospace' }}>NEWS & FILINGS</span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {!activeTicker ? (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--ws-text-3)', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}>
              SELECT TICKER
            </div>
          ) : loadingNews ? (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--ws-text-3)', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}>
              LOADING HEADLINES...
            </div>
          ) : news.length === 0 ? (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--ws-text-3)', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}>
              NO NEWS AVAILABLE
            </div>
          ) : (
            news.map((item, i) => (
              <NewsRow key={item.id || i} item={item} isLast={i === news.length - 1} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
