'use client';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '../../components/AuthProvider';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import MarketStatusDot from '../../components/workspace/MarketStatusDot';

// Premium SVG Gear Icon
function GearIcon({ style }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="16" 
      height="16" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
      style={style}
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

// Helper component for loading corporate logo avatars
function StockLogo({ ticker, name, size = 32 }) {
  const [error, setError] = useState(false);
  if (error || !ticker) {
    return (
      <div style={{
        width: size,
        height: size,
        borderRadius: '6px',
        background: 'var(--ws-bg-2)',
        border: '1px solid var(--ws-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size > 24 ? '11px' : '9px',
        fontWeight: 700,
        color: 'var(--ws-accent)',
        flexShrink: 0
      }}>
        {ticker.slice(0, 2)}
      </div>
    );
  }
  return (
    <img
      src={`https://img.logo.dev/ticker/${ticker.toUpperCase()}?token=pk_B4aaLZF6S4G1YbCgqZq2Ug`}
      alt={name || ticker}
      style={{
        width: size,
        height: size,
        borderRadius: '6px',
        border: '1px solid var(--ws-border)',
        objectFit: 'contain',
        background: '#fff',
        padding: '2px',
        flexShrink: 0
      }}
      onError={() => setError(true)}
    />
  );
}

// Smart news image — renders normally, hides container if image is a logo (wide ratio)
function NewsImage({ src, alt, ticker, large }) {
  const containerRef = useRef(null);

  const handleLoad = (e) => {
    const img = e.currentTarget;
    const ratio = img.naturalWidth / img.naturalHeight;
    // Logos are banner-shaped (> 2.5:1). Real thumbnails: 16:9=1.77, 4:3=1.33, 1:1=1
    if (ratio > 2.5 && containerRef.current) {
      containerRef.current.style.display = 'none';
    }
  };

  const handleError = () => {
    if (containerRef.current) containerRef.current.style.display = 'none';
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', overflow: 'hidden', borderBottom: '1px solid var(--ws-border)' }}>
      <img
        src={src}
        alt={alt}
        style={large
          ? { width: '100%', height: '260px', objectFit: 'cover', display: 'block' }
          : { width: '100%', height: 'auto', display: 'block' }}
        onLoad={handleLoad}
        onError={handleError}
      />
      {ticker && (
        <div style={{
          position: 'absolute',
          top: '14px',
          right: '-34px',
          width: '130px',
          transform: 'rotate(45deg)',
          background: 'var(--ws-accent)',
          color: '#fff',
          fontSize: '10px',
          fontWeight: 800,
          textAlign: 'center',
          padding: '3px 4px',
          letterSpacing: '0.5px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          {ticker}
        </div>
      )}
    </div>
  );
}

// Pinterest-style masonry: greedily assigns each item to whichever column is
// currently shortest (by estimated height), so columns stay balanced and the
// full container width is always used regardless of how many items there are.
function distributeMasonryColumns(items, columnCount) {
  const columns = Array.from({ length: columnCount }, () => []);
  const heights = new Array(columnCount).fill(0);
  items.forEach((item, index) => {
    const shortest = heights.indexOf(Math.min(...heights));
    const estHeight = (index === 0 ? 260 : 140) + Math.ceil((item.title || '').length / 28) * 18 + 70;
    columns[shortest].push({ item, index });
    heights[shortest] += estHeight;
  });
  return columns;
}

// Reusable card wrapper with drag handles and modern shadows
function Card({ title, subtitle, rightElement, dragProps, children }) {
  return (
    <div 
      {...dragProps}
      style={{
        border: '1px solid var(--ws-border)',
        background: 'var(--ws-bg-1)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02), 0 1px 2px rgba(0,0,0,0.01)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        transition: 'box-shadow 0.15s ease, transform 0.2s ease, opacity 0.15s ease',
        ...dragProps?.style
      }}
    >
      <div style={{
        padding: '14px 18px',
        borderBottom: '1px solid var(--ws-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(0, 0, 0, 0.01)',
        cursor: dragProps ? 'grab' : 'default'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {dragProps && (
            <span style={{ color: 'var(--ws-text-3)', fontSize: '13px', marginRight: '4px', userSelect: 'none' }}>
              ⋮⋮
            </span>
          )}
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ws-text)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              {title}
            </div>
            {subtitle && (
              <div style={{ fontSize: '10px', color: 'var(--ws-text-3)', marginTop: '2px' }}>
                {subtitle}
              </div>
            )}
          </div>
        </div>
        {rightElement}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  );
}

// Same set + localStorage key as the dedicated /portfolio page, so the display
// currency preference stays in sync between that page and this dashboard widget.
const CURRENCIES = { USD: '$', EUR: '€', GBP: '£' };

// "Movers" (gainers) dropped from here — it's now covered by the header marquee's
// dropdown, so this widget focuses on the proprietary quality metrics that live
// nowhere else in the app. topFcfYield/topRevGrowth were already computed by
// /api/movers but never actually rendered anywhere until now.
const MOVER_TABS = [
  {
    key: 'topRoic', label: 'High ROIC',
    renderValue: (s) => <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ws-text)' }}>{s.roic?.toFixed(1)}% ROIC</span>
  },
  {
    key: 'topFcfYield', label: 'FCF Yield',
    renderValue: (s) => <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ws-text)' }}>{s.fcfYield?.toFixed(1)}%</span>
  },
  {
    key: 'topRevGrowth', label: 'Rev Growth',
    renderValue: (s) => <span style={{ fontSize: '12px', fontWeight: 700, color: '#10b981' }}>+{s.revGrowth?.toFixed(1)}%</span>
  },
  {
    key: 'topScore', label: 'Top Scores',
    renderValue: (s) => (
      <span style={{ fontSize: '11px', background: 'var(--ws-accent-dim)', color: 'var(--ws-accent)', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
        {s.score}
      </span>
    )
  }
];

const DEFAULT_WIDGETS = [
  { id: 'indices', column: 'left', order: 0, visible: true },
  { id: 'portfolio', column: 'left', order: 1, visible: true },
  { id: 'sotw', column: 'left', order: 2, visible: true },
  { id: 'workspace', column: 'left', order: 3, visible: true },
  { id: 'earnings', column: 'right', order: 0, visible: true },
  { id: 'movers', column: 'right', order: 1, visible: true },
  { id: 'secFeed', column: 'right', order: 2, visible: true }
];

export default function WorkspaceHome() {
  const router = useRouter();
  
  // Layout States
  const [widgets, setWidgets] = useState([]);
  const [draggedId, setDraggedId] = useState(null);
  
  const [showConfig, setShowConfig] = useState(false);
  const [layoutMode, setLayoutMode] = useState('split');

  // Portfolio States
  const { isSignedIn } = useUser();
  const [holdings, setHoldings] = useState([]);
  const [portfolio, setPortfolio] = useState([]);
  const [showAddTx, setShowAddTx] = useState(false);
  const [txTicker, setTxTicker] = useState('');
  const [txShares, setTxShares] = useState('');
  const [txPrice, setTxPrice] = useState('');
  const [txPie, setTxPie] = useState('');
  const [prices, setPrices] = useState({});
  const [pricesLoading, setPricesLoading] = useState(false);
  const [dayChanges, setDayChanges] = useState({}); // ticker -> today's % change
  const [portfolioTab, setPortfolioTab] = useState('pies'); // Default to 'pies' view for cleaner collapsed list
  const [currency, setCurrency] = useState('USD');
  // Approximate fallback rates in case the live fetch fails (network/CORS) — overwritten below when it succeeds.
  const [fxRates, setFxRates] = useState({ EUR: 0.92, GBP: 0.79 });

  useEffect(() => {
    const saved = localStorage.getItem('portfolio_currency');
    if (saved && CURRENCIES[saved]) setCurrency(saved);
  }, []);

  useEffect(() => {
    fetch('https://api.frankfurter.dev/v1/latest?from=USD&to=EUR,GBP')
      .then(r => r.json())
      .then(d => { if (d.rates && d.rates.EUR && d.rates.GBP) setFxRates(d.rates); })
      .catch(() => {});
  }, []);

  const changeCurrency = (c) => { setCurrency(c); localStorage.setItem('portfolio_currency', c); };
  const fxRate = currency === 'USD' ? 1 : (fxRates[currency] || 1);
  const currencySymbol = CURRENCIES[currency];

  // Widget States
  const [sotw, setSotw] = useState(null);
  const [sotwStats, setSotwStats] = useState(null); // quick sector/market cap/P-E teaser to kick off research
  const [sotwVotes, setSotwVotes] = useState({ BUY: 0, HOLD: 0, SELL: 0, total: 0 });
  const [hasVoted, setHasVoted] = useState(false);
  const [currentUserVote, setCurrentUserVote] = useState(null);
  const [movers, setMovers] = useState(null);
  const [marqueeMode, setMarqueeMode] = useState('gainers'); // 'gainers' | 'losers' | 'bigCapMovers'
  const [earnings, setEarnings] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [recentViewed, setRecentViewed] = useState([]);
  const [activeMoverTab, setActiveMoverTab] = useState('topRoic');
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState('watchlist');

  // Live market and news states
  const [indices, setIndices] = useState([]);
  const [indicesLoading, setIndicesLoading] = useState(true);
  const [secFeed, setSecFeed] = useState([]);
  const [secFeedLoading, setSecFeedLoading] = useState(true);
  const [newsTab, setNewsTab] = useState('all');
  const [holdingsNews, setHoldingsNews] = useState([]);
  const [holdingsNewsLoading, setHoldingsNewsLoading] = useState(false);
  const [newsColumnCount, setNewsColumnCount] = useState(2);
  const newsResizeObserverRef = useRef(null);

  // Callback ref (not useEffect) so this fires exactly when the masonry container
  // mounts — it only appears once the feed finishes loading, not on initial mount.
  const newsFeedRef = useCallback((node) => {
    if (newsResizeObserverRef.current) {
      newsResizeObserverRef.current.disconnect();
      newsResizeObserverRef.current = null;
    }
    if (node) {
      const compute = () => setNewsColumnCount(Math.min(4, Math.max(1, Math.floor(node.offsetWidth / 180))));
      compute();
      const ro = new ResizeObserver(compute);
      ro.observe(node);
      newsResizeObserverRef.current = ro;
    }
  }, []);

  useEffect(() => {
    // 1. Load layout
    const savedLayout = localStorage.getItem('traqcker_dashboard_layout');
    if (savedLayout) {
      try {
        const parsed = JSON.parse(savedLayout);
        if (parsed && Array.isArray(parsed) && parsed.length > 0) {
          // Sync missing default widgets in case structure changed
          const merged = DEFAULT_WIDGETS.map(def => {
            const match = parsed.find(p => p.id === def.id);
            return match ? { ...def, ...match } : def;
          });
          setWidgets(merged);
        } else {
          setWidgets(DEFAULT_WIDGETS);
        }
      } catch (e) {
        setWidgets(DEFAULT_WIDGETS);
      }
    } else {
      setWidgets(DEFAULT_WIDGETS);
    }

    // Load layout mode
    const savedMode = localStorage.getItem('traqcker_layout_mode');
    if (savedMode) setLayoutMode(savedMode);

    // 2. Fetch Stock of the Week
    fetch('/api/stock-of-week')
      .then(r => r.json())
      .then(d => {
        if (!d.ticker) return;
        setSotw({ ticker: d.ticker, name: d.name });
        fetch(`/api/votes?ticker=${d.ticker}`)
          .then(r => r.json())
          .then(v => {
            setSotwVotes({ ...v.percentages, total: v.total });
            if (v.userVote) {
              setHasVoted(true);
              setCurrentUserVote(v.userVote);
            }
          });
        fetch(`/api/stock?ticker=${d.ticker}`)
          .then(r => r.json())
          .then(s => setSotwStats({ sector: s.sector, marketCap: s.marketCap, pe: s.pe }))
          .catch(() => {});
      });

    // 3. Fetch market intelligence / movers
    fetch('/api/movers')
      .then(r => r.json())
      .then(setMovers);

    // 4. Fetch earnings calendar
    fetch('/api/earnings')
      .then(r => r.json())
      .then(d => setEarnings(d.earnings || []));

    // 5. Fetch watchlist from Supabase
    fetch('/api/watchlist')
      .then(r => r.json())
      .then(d => setWatchlist(d.tickers || []))
      .catch(() => {});

    // 6. Load recently viewed stocks from localStorage
    try {
      const viewedKey = Object.keys(localStorage).find(k => k.startsWith('viewed_stocks_')) || 'viewed_stocks';
      const items = JSON.parse(localStorage.getItem(viewedKey) || '[]');
      setRecentViewed(items.slice(0, 10)); // Top 10 recents
    } catch (e) {}

    // 7. Fetch live indices from /api/market
    fetch('/api/market')
      .then(r => r.json())
      .then(d => {
        if (d.markets) setIndices(d.markets);
        setIndicesLoading(false);
      })
      .catch(() => {
        setIndicesLoading(false);
      });

    // 8. Fetch live filings/news alerts from /api/filings
    fetch('/api/filings')
      .then(r => r.json())
      .then(d => {
        if (d.filings) setSecFeed(d.filings);
        setSecFeedLoading(false);
      })
      .catch(() => {
        setSecFeedLoading(false);
      });
  }, []);

  // Keep the "LIVE" data fresh: re-poll indices, movers and market news every 60s
  useEffect(() => {
    const refreshLiveData = () => {
      fetch('/api/movers').then(r => r.json()).then(setMovers).catch(() => {});
      fetch('/api/market').then(r => r.json()).then(d => { if (d.markets) setIndices(d.markets); }).catch(() => {});
      fetch('/api/filings').then(r => r.json()).then(d => { if (d.filings) setSecFeed(d.filings); }).catch(() => {});
    };
    const interval = setInterval(refreshLiveData, 60000);
    return () => clearInterval(interval);
  }, []);

  // Load portfolio from localStorage or Database on mount / auth change
  const loadPortfolio = () => {
    if (isSignedIn) {
      fetch('/api/portfolio')
        .then(async r => {
          const d = await r.json();
          if (r.ok && d.holdings) {
            setHoldings(d.holdings);
          }
        })
        .catch(() => {});
    } else {
      try {
        const saved = localStorage.getItem('traqcker_portfolio');
        if (saved) {
          setPortfolio(JSON.parse(saved));
        } else {
          const seed = [
            { ticker: 'AAPL', shares: 10, avgPrice: 175.50, pie: 'Tech' },
            { ticker: 'MSFT', shares: 5, avgPrice: 380.20, pie: 'Tech' },
            { ticker: 'NVDA', shares: 20, avgPrice: 450.00, pie: 'AI' }
          ];
          localStorage.setItem('traqcker_portfolio', JSON.stringify(seed));
          setPortfolio(seed);
        }
      } catch (e) {}
    }
  };

  useEffect(() => {
    loadPortfolio();
  }, [isSignedIn]);

  // Unique tickers across active portfolio
  const activeTickers = useMemo(() => {
    if (isSignedIn) {
      return [...new Set(holdings.map(h => h.ticker))];
    } else {
      return [...new Set(portfolio.map(p => p.ticker))];
    }
  }, [holdings, portfolio, isSignedIn]);

  // Tickers to personalize the "My Holdings" news tab with (portfolio + watchlist, deduped)
  const newsTickers = useMemo(() => {
    return [...new Set([...activeTickers, ...watchlist.map(w => w.ticker)])];
  }, [activeTickers, watchlist]);

  // Every ticker we need a live price/day-change quote for — portfolio, watchlist, AND
  // recently viewed — so the Coverage Workspace table can show price/today alongside them.
  const quoteTickers = useMemo(() => {
    return [...new Set([...newsTickers, ...recentViewed])];
  }, [newsTickers, recentViewed]);

  // Fetch personalized news whenever the holdings/watchlist ticker set changes
  useEffect(() => {
    if (newsTickers.length === 0) {
      setHoldingsNews([]);
      return;
    }
    setHoldingsNewsLoading(true);
    fetch(`/api/filings?tickers=${newsTickers.join(',')}`)
      .then(r => r.json())
      .then(d => setHoldingsNews(d.holdingsNews || []))
      .catch(() => setHoldingsNews([]))
      .finally(() => setHoldingsNewsLoading(false));
  }, [newsTickers.join(',')]);

  // Fetch current prices (and today's % change) for portfolio + watchlist + recently viewed tickers
  const fetchQuotes = (tickers, { refresh = false } = {}) => {
    if (tickers.length === 0) return;
    setPricesLoading(true);
    Promise.all(
      tickers.map(ticker =>
        fetch(`/api/stock?ticker=${ticker}${refresh ? '&refresh=true' : ''}`)
          .then(r => r.json())
          .then(data => ({ ticker, price: data.currentPrice, changePct: data.priceChangePct }))
          .catch(() => ({ ticker, price: null, changePct: null }))
      )
    ).then(results => {
      const priceMap = {};
      const changeMap = {};
      results.forEach(r => {
        if (r.price !== null) priceMap[r.ticker] = r.price;
        if (r.changePct !== null && r.changePct !== undefined) changeMap[r.ticker] = r.changePct;
      });
      setPrices(prev => ({ ...prev, ...priceMap }));
      setDayChanges(prev => ({ ...prev, ...changeMap }));
      setPricesLoading(false);
    });
  };

  useEffect(() => {
    fetchQuotes(quoteTickers);
  }, [quoteTickers]);

  // Keep holding/watchlist prices reasonably live — mirrors the movers/market/filings poll above.
  useEffect(() => {
    if (quoteTickers.length === 0) return;
    const interval = setInterval(() => fetchQuotes(quoteTickers, { refresh: true }), 60000);
    return () => clearInterval(interval);
  }, [quoteTickers]);

  // Uniform display holdings: [{ ticker, shares, avgPrice, pie }]
  const displayHoldings = useMemo(() => {
    if (isSignedIn) {
      const byKey = {};
      holdings.forEach(h => {
        const key = `${h.ticker}-${h.pie || ''}`;
        const p = byKey[key] ||= { ticker: h.ticker, shares: 0, cost: 0, pie: h.pie || '' };
        p.shares += Number(h.shares);
        p.cost += Number(h.shares) * Number(h.cost_basis);
      });
      return Object.values(byKey).map(p => ({
        ticker: p.ticker,
        shares: p.shares,
        avgPrice: p.cost / p.shares,
        pie: p.pie
      }));
    } else {
      return portfolio;
    }
  }, [holdings, portfolio, isSignedIn]);

  // Group display holdings by Pie
  const piesData = useMemo(() => {
    const groups = {};
    displayHoldings.forEach(item => {
      const pieName = item.pie || 'Unassigned';
      groups[pieName] ||= [];
      groups[pieName].push(item);
    });

    return Object.entries(groups).map(([name, items]) => {
      let cost = 0;
      let val = 0;
      items.forEach(item => {
        const currentPrice = prices[item.ticker] || item.avgPrice;
        cost += item.shares * item.avgPrice;
        val += item.shares * currentPrice;
      });
      const gain = val - cost;
      const gainPct = cost > 0 ? (gain / cost) * 100 : 0;
      return {
        name,
        items,
        cost,
        value: val,
        gain,
        gainPct
      };
    }).sort((a, b) => {
      if (a.name === 'Unassigned') return 1;
      if (b.name === 'Unassigned') return -1;
      return b.value - a.value;
    });
  }, [displayHoldings, prices]);

  // Record a daily portfolio snapshot from Home too — not just /portfolio — so the growth
  // chart keeps accumulating points even for users who only ever look at the dashboard.
  const homeTotals = useMemo(() => {
    let cost = 0, value = 0;
    displayHoldings.forEach(item => {
      const currentPrice = prices[item.ticker];
      cost += item.shares * item.avgPrice;
      value += item.shares * (currentPrice ?? item.avgPrice);
    });
    return { cost, value };
  }, [displayHoldings, prices]);

  const homePricesReady = displayHoldings.length > 0 && displayHoldings.every(item => prices[item.ticker] != null);

  useEffect(() => {
    if (!isSignedIn || !homePricesReady || homeTotals.value === 0) return;
    fetch('/api/portfolio/snapshot', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: homeTotals.value, cost: homeTotals.cost }),
    }).catch(() => {});
  }, [isSignedIn, homePricesReady, homeTotals.value, homeTotals.cost]);

  const savePortfolio = (newPort) => {
    setPortfolio(newPort);
    localStorage.setItem('traqcker_portfolio', JSON.stringify(newPort));
  };

  const handleAddTx = async (e) => {
    e.preventDefault();
    if (!txTicker || !txShares || !txPrice) return;
    
    const parsedShares = parseFloat(txShares);
    const parsedPrice = parseFloat(txPrice);
    if (isNaN(parsedShares) || isNaN(parsedPrice)) return;

    const tickUpper = txTicker.toUpperCase().trim();
    const pieTrimmed = txPie.trim();

    if (isSignedIn) {
      const res = await fetch('/api/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: tickUpper,
          shares: parsedShares,
          costBasis: parsedPrice,
          purchaseDate: new Date().toISOString().slice(0, 10),
          pie: pieTrimmed
        })
      });
      if (res.ok) {
        loadPortfolio();
      }
    } else {
      const existing = portfolio.find(p => p.ticker === tickUpper && (p.pie || '') === pieTrimmed);
      let newPort;
      if (existing) {
        const newShares = existing.shares + parsedShares;
        const newAvg = ((existing.shares * existing.avgPrice) + (parsedShares * parsedPrice)) / newShares;
        newPort = portfolio.map(p => (p.ticker === tickUpper && (p.pie || '') === pieTrimmed) ? { ...p, shares: newShares, avgPrice: parseFloat(newAvg.toFixed(2)) } : p);
      } else {
        newPort = [...portfolio, { ticker: tickUpper, shares: parsedShares, avgPrice: parsedPrice, pie: pieTrimmed }];
      }
      savePortfolio(newPort);
    }

    setTxTicker('');
    setTxShares('');
    setTxPrice('');
    setTxPie('');
    setShowAddTx(false);
  };

  const handleRemoveTx = async (tickerToRemove, pieToRemove = '') => {
    if (isSignedIn) {
      const lots = holdings.filter(h => h.ticker === tickerToRemove && (h.pie || '') === pieToRemove);
      await Promise.all(
        lots.map(lot =>
          fetch('/api/portfolio', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: lot.id })
          })
        )
      );
      loadPortfolio();
    } else {
      const newPort = portfolio.filter(p => !(p.ticker === tickerToRemove && (p.pie || '') === pieToRemove));
      savePortfolio(newPort);
    }
  };

  // Smooth Auto-scroll during Drag & Drop
  useEffect(() => {
    if (!draggedId) return;

    let scrollSpeed = 0;
    let animationFrameId = null;

    const handleWindowDragOver = (e) => {
      const threshold = 120; // Zone in pixels from top/bottom of screen to trigger scroll
      const maxSpeed = 15;   // Maximum speed of scrolling in pixels per frame
      const clientY = e.clientY;
      const height = window.innerHeight;

      if (clientY < threshold) {
        // Near top, scroll up
        const intensity = (threshold - clientY) / threshold;
        scrollSpeed = -maxSpeed * intensity;
      } else if (clientY > height - threshold) {
        // Near bottom, scroll down
        const intensity = (clientY - (height - threshold)) / threshold;
        scrollSpeed = maxSpeed * intensity;
      } else {
        scrollSpeed = 0;
      }
    };

    const scrollLoop = () => {
      if (scrollSpeed !== 0) {
        window.scrollBy(0, scrollSpeed);
      }
      animationFrameId = requestAnimationFrame(scrollLoop);
    };

    window.addEventListener('dragover', handleWindowDragOver);
    animationFrameId = requestAnimationFrame(scrollLoop);

    return () => {
      window.removeEventListener('dragover', handleWindowDragOver);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [draggedId]);

  const changeLayoutMode = (mode) => {
    setLayoutMode(mode);
    localStorage.setItem('traqcker_layout_mode', mode);
  };

  // Drag and drop handlers
  const handleDragStart = (e, id) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    // Persist final rearranged layout on drag release
    localStorage.setItem('traqcker_dashboard_layout', JSON.stringify(widgets));
    setDraggedId(null);
  };

  const handleDragOverWidget = (e, targetId) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;

    // Get the target's midpoint coordinates to prevent jitter feedback loops
    const targetElement = e.currentTarget;
    const rect = targetElement.getBoundingClientRect();
    const clientY = e.clientY;
    const midpoint = rect.top + rect.height / 2;

    const currentWidgets = [...widgets];
    const draggedWidget = currentWidgets.find(w => w.id === draggedId);
    const targetWidget = currentWidgets.find(w => w.id === targetId);

    if (!draggedWidget || !targetWidget) return;

    const isSameColumn = draggedWidget.column === targetWidget.column;

    if (isSameColumn) {
      const isDragDown = draggedWidget.order < targetWidget.order;
      // Only swap if crossing card's midpoint
      if (isDragDown && clientY < midpoint) return;
      if (!isDragDown && clientY > midpoint) return;

      const col = draggedWidget.column;
      const colWidgets = currentWidgets
        .filter(w => w.column === col && w.visible !== false)
        .sort((a, b) => a.order - b.order);

      const draggedInColIdx = colWidgets.findIndex(w => w.id === draggedId);
      const targetInColIdx = colWidgets.findIndex(w => w.id === targetId);

      if (draggedInColIdx === -1 || targetInColIdx === -1) return;

      colWidgets.splice(draggedInColIdx, 1);
      colWidgets.splice(targetInColIdx, 0, draggedWidget);

      colWidgets.forEach((w, idx) => {
        const original = currentWidgets.find(x => x.id === w.id);
        if (original) original.order = idx;
      });

      setWidgets(currentWidgets);
    } else {
      // Cross-column live shift: only trigger if pointer is fully within target boundaries
      if (clientY < rect.top || clientY > rect.bottom) return;

      draggedWidget.column = targetWidget.column;

      // Re-index target column
      const targetColWidgets = currentWidgets
        .filter(w => w.column === targetWidget.column && w.visible !== false)
        .sort((a, b) => a.order - b.order);

      const draggedInColIdx = targetColWidgets.findIndex(w => w.id === draggedId);
      const targetInColIdx = targetColWidgets.findIndex(w => w.id === targetId);

      if (draggedInColIdx !== -1) {
        targetColWidgets.splice(draggedInColIdx, 1);
      }
      targetColWidgets.splice(targetInColIdx, 0, draggedWidget);

      targetColWidgets.forEach((w, idx) => {
        const original = currentWidgets.find(x => x.id === w.id);
        if (original) original.order = idx;
      });

      // Clean up source column
      const srcCol = targetWidget.column === 'left' ? 'right' : 'left';
      const srcWidgets = currentWidgets
        .filter(w => w.column === srcCol && w.visible !== false)
        .sort((a, b) => a.order - b.order);

      srcWidgets.forEach((w, idx) => {
        const original = currentWidgets.find(x => x.id === w.id);
        if (original) original.order = idx;
      });

      setWidgets(currentWidgets);
    }
  };

  const handleDragOverColumn = (e, column) => {
    e.preventDefault();
    if (!draggedId) return;

    // Only shift to bottom if dragging over the outer column container background space
    const isColumnContainer = e.currentTarget.getAttribute('data-column-container') === 'true';
    if (!isColumnContainer) return;

    const currentWidgets = [...widgets];
    const draggedWidget = currentWidgets.find(w => w.id === draggedId);
    if (!draggedWidget) return;

    if (draggedWidget.column !== column) {
      draggedWidget.column = column;

      const colWidgets = currentWidgets
        .filter(w => w.column === column && w.visible !== false)
        .sort((a, b) => a.order - b.order);

      const idx = colWidgets.findIndex(w => w.id === draggedId);
      if (idx !== -1) colWidgets.splice(idx, 1);
      colWidgets.push(draggedWidget);

      colWidgets.forEach((w, i) => {
        const original = currentWidgets.find(x => x.id === w.id);
        if (original) original.order = i;
      });

      // Clean up source column
      const srcCol = column === 'left' ? 'right' : 'left';
      const srcWidgets = currentWidgets
        .filter(w => w.column === srcCol && w.visible !== false)
        .sort((a, b) => a.order - b.order);

      srcWidgets.forEach((w, i) => {
        const original = currentWidgets.find(x => x.id === w.id);
        if (original) original.order = i;
      });

      setWidgets(currentWidgets);
    }
  };

  const castVote = async (vote) => {
    if (!sotw || hasVoted) return;
    setHasVoted(true);
    setCurrentUserVote(vote);
    await fetch('/api/votes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker: sotw.ticker, vote })
    });
    fetch(`/api/votes?ticker=${sotw.ticker}`)
      .then(r => r.json())
      .then(v => setSotwVotes({ ...v.percentages, total: v.total }));
  };

  // Widget Renderers
  const renderIndices = () => {
    if (indicesLoading) {
      return (
        <Card title="Major Indices Overview" subtitle="Key market benchmarks & volatility index.">
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--ws-text-3)', fontSize: '12px' }}>
            Loading market benchmarks...
          </div>
        </Card>
      );
    }

    if (indices.length === 0) {
      return (
        <Card title="Major Indices Overview" subtitle="Key market benchmarks & volatility index.">
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--ws-text-3)', fontSize: '12px' }}>
            Indices data currently unavailable.
          </div>
        </Card>
      );
    }

    return (
      <Card
        title="Major Indices Overview"
        subtitle="Key market benchmarks & volatility index."
        dragProps={{
          draggable: true,
          onDragStart: (e) => handleDragStart(e, 'indices'),
          onDragEnd: handleDragEnd,
          onDragOver: (e) => handleDragOverWidget(e, 'indices'),
          style: {
            opacity: draggedId === 'indices' ? 0.35 : 1,
            transform: draggedId === 'indices' ? 'scale(0.98)' : 'scale(1)',
            boxShadow: draggedId === 'indices' ? '0 5px 15px rgba(0,0,0,0.05)' : 'none'
          }
        }}
      >
        <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
          {indices.map(idx => {
            const positive = idx.changePct >= 0;
            const changeStr = `${positive ? '+' : ''}${idx.changePct?.toFixed(2)}%`;
            const priceStr = idx.price ? idx.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'N/A';
            const closePrices = idx.candles?.map(c => c.c) || [];

            return (
              <div key={idx.symbol} style={{
                background: 'var(--ws-bg-2)',
                border: '1px solid var(--ws-border)',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                height: '110px'
              }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ws-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{idx.label}</span>
                    <span style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '9px',
                      fontWeight: 700,
                      color: positive ? '#10b981' : 'var(--ws-red)',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}>
                      {changeStr}
                    </span>
                  </div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '15px', fontWeight: 800, color: 'var(--ws-text)', marginTop: '6px' }}>{priceStr}</div>
                </div>
                
                {closePrices.length > 1 ? (
                  <div style={{ height: '30px', marginTop: '10px' }}>
                    <svg width="100%" height="100%" viewBox="0 0 100 30" preserveAspectRatio="none">
                      <path
                        d={`M ${closePrices.map((val, i) => `${(i / (closePrices.length - 1)) * 100} ${30 - ((val - Math.min(...closePrices)) / (Math.max(...closePrices) - Math.min(...closePrices) || 1)) * 25 - 2}`).join(' L ')}`}
                        fill="none"
                        stroke={positive ? '#10b981' : 'var(--ws-red)'}
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                ) : (
                  <div style={{ height: '30px', marginTop: '10px', background: 'var(--ws-border)', borderRadius: '4px', opacity: 0.3 }} />
                )}
              </div>
            );
          })}
        </div>
      </Card>
    );
  };

  const renderSotw = () => {
    return (
      <Card 
        title="Spotlight: Stock of the Week"
        subtitle="A new stock, picked at random, spotlighted for a week of community research."
        rightElement={
          sotw && (
            <div style={{ fontSize: '11px', color: 'var(--ws-text-3)', fontWeight: 600 }}>
              Consensus: {sotwVotes.total} votes
            </div>
          )
        }
        dragProps={{
          draggable: true,
          onDragStart: (e) => handleDragStart(e, 'sotw'),
          onDragEnd: handleDragEnd,
          onDragOver: (e) => handleDragOverWidget(e, 'sotw'),
          style: {
            opacity: draggedId === 'sotw' ? 0.35 : 1,
            transform: draggedId === 'sotw' ? 'scale(0.98)' : 'scale(1)',
            boxShadow: draggedId === 'sotw' ? '0 5px 15px rgba(0,0,0,0.05)' : 'none'
          }
        }}
      >
        {sotw ? (
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div onClick={() => router.push(`/stock/${sotw.ticker}`)} 
                style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                <StockLogo ticker={sotw.ticker} name={sotw.name} size={42} />
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--ws-text)' }}>{sotw.ticker}</div>
                  <div style={{ fontSize: '12px', color: 'var(--ws-text-3)', marginTop: '2px' }}>{sotw.name}</div>
                </div>
              </div>
              <button onClick={() => router.push(`/stock/${sotw.ticker}`)}
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--ws-accent)',
                  background: 'var(--ws-accent-dim)',
                  border: 'none',
                  padding: '8px 14px',
                  cursor: 'pointer',
                  transition: 'opacity 0.15s'
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = 0.8}
                onMouseLeave={e => e.currentTarget.style.opacity = 1}
              >
                Open Analysis →
              </button>
            </div>

            {/* Quick teaser stats — a starting point for the week's research, not a verdict */}
            {sotwStats && (
              <div style={{ display: 'flex', gap: '10px' }}>
                {[
                  { label: 'Sector', value: sotwStats.sector || '—' },
                  {
                    label: 'Market Cap',
                    value: sotwStats.marketCap == null ? '—'
                      : sotwStats.marketCap >= 1e12 ? `$${(sotwStats.marketCap / 1e12).toFixed(1)}T`
                      : sotwStats.marketCap >= 1e9 ? `$${(sotwStats.marketCap / 1e9).toFixed(1)}B`
                      : `$${(sotwStats.marketCap / 1e6).toFixed(0)}M`
                  },
                  { label: 'P/E', value: sotwStats.pe != null ? sotwStats.pe.toFixed(1) : '—' }
                ].map(stat => (
                  <div key={stat.label} style={{ flex: 1, background: 'var(--ws-bg-2)', border: '1px solid var(--ws-border)', padding: '8px 10px' }}>
                    <div style={{ fontSize: '9px', color: 'var(--ws-text-3)', fontWeight: 700, textTransform: 'uppercase' }}>{stat.label}</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ws-text)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stat.value}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Sentiment Voting */}
            <div style={{ background: 'var(--ws-bg-2)', padding: '16px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ws-text-2)', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{hasVoted ? "Consensus results:" : "How do you underwrite this stock?"}</span>
                {hasVoted && currentUserVote && (
                  <span style={{ color: 'var(--ws-accent)', fontWeight: 800 }}>Your vote: {currentUserVote}</span>
                )}
              </div>
              
              {hasVoted ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {['BUY', 'HOLD', 'SELL'].map(v => {
                    const pct = sotwVotes[v] || 0;
                    const fillCol = v === 'BUY' ? '#10b981' : v === 'SELL' ? 'var(--ws-red)' : '#6b7280';
                    return (
                      <div key={v} style={{ fontSize: '11px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, marginBottom: '4px', color: 'var(--ws-text)' }}>
                          <span>{v}</span>
                          <span>{pct}%</span>
                        </div>
                        <div style={{ width: '100%', height: '8px', background: 'var(--ws-border)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: fillCol, borderRadius: '4px', transition: 'width 0.4s' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '10px' }}>
                  {['BUY', 'HOLD', 'SELL'].map(v => {
                    const hoverCol = v === 'BUY' ? '#10b981' : v === 'SELL' ? 'var(--ws-red)' : 'var(--ws-text)';
                    return (
                      <button key={v} onClick={() => castVote(v)}
                        style={{
                          flex: 1,
                          padding: '10px 0',
                          fontSize: '12px',
                          fontWeight: 700,
                          border: '1px solid var(--ws-border)',
                          background: 'var(--ws-bg-1)',
                          color: 'var(--ws-text-2)',
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.color = hoverCol;
                          e.currentTarget.style.borderColor = hoverCol;
                          e.currentTarget.style.background = 'rgba(0, 0, 0, 0.01)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.color = 'var(--ws-text-2)';
                          e.currentTarget.style.borderColor = 'var(--ws-border)';
                          e.currentTarget.style.background = 'var(--ws-bg-1)';
                        }}
                      >
                        {v}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--ws-text-3)', fontSize: '13px' }}>Loading spotlight data…</div>
        )}
      </Card>
    );
  };

  const renderWorkspace = () => {
    return (
      <Card 
        title="My Coverage Workspace" 
        rightElement={
          <div style={{ display: 'flex', gap: '2px', background: 'var(--ws-bg-2)', padding: '2px', borderRadius: '6px' }}>
            <button 
              onClick={() => setActiveWorkspaceTab('watchlist')}
              style={{
                padding: '4px 10px',
                fontSize: '10px',
                fontWeight: 600,
                border: 'none',
                borderRadius: '4px',
                background: activeWorkspaceTab === 'watchlist' ? 'var(--ws-bg-1)' : 'transparent',
                color: activeWorkspaceTab === 'watchlist' ? 'var(--ws-text)' : 'var(--ws-text-3)',
                cursor: 'pointer'
              }}
            >
              Watchlist ({watchlist.length})
            </button>
            <button 
              onClick={() => setActiveWorkspaceTab('recent')}
              style={{
                padding: '4px 10px',
                fontSize: '10px',
                fontWeight: 600,
                border: 'none',
                borderRadius: '4px',
                background: activeWorkspaceTab === 'recent' ? 'var(--ws-bg-1)' : 'transparent',
                color: activeWorkspaceTab === 'recent' ? 'var(--ws-text)' : 'var(--ws-text-3)',
                cursor: 'pointer'
              }}
            >
              Recent ({recentViewed.length})
            </button>
          </div>
        }
        dragProps={{
          draggable: true,
          onDragStart: (e) => handleDragStart(e, 'workspace'),
          onDragEnd: handleDragEnd,
          onDragOver: (e) => handleDragOverWidget(e, 'workspace'),
          style: {
            opacity: draggedId === 'workspace' ? 0.35 : 1,
            transform: draggedId === 'workspace' ? 'scale(0.98)' : 'scale(1)',
            boxShadow: draggedId === 'workspace' ? '0 5px 15px rgba(0,0,0,0.05)' : 'none'
          }
        }}
      >
        {activeWorkspaceTab === 'watchlist' ? (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {watchlist.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ws-text-3)', fontSize: '13px' }}>
                Your watchlist is empty. Go to a stock page and save it.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--ws-border)', background: 'rgba(0,0,0,0.01)' }}>
                      <th style={{ padding: '10px 18px', textAlign: 'left', fontWeight: 600, color: 'var(--ws-text-3)', fontSize: '10px' }}>TICKER</th>
                      <th style={{ padding: '10px 18px', textAlign: 'right', fontWeight: 600, color: 'var(--ws-text-3)', fontSize: '10px' }}>PRICE</th>
                      <th style={{ padding: '10px 18px', textAlign: 'right', fontWeight: 600, color: 'var(--ws-text-3)', fontSize: '10px' }}>TODAY</th>
                      <th style={{ padding: '10px 18px', textAlign: 'left', fontWeight: 600, color: 'var(--ws-text-3)', fontSize: '10px' }}>ADDED</th>
                      <th style={{ padding: '10px 18px' }} />
                    </tr>
                  </thead>
                  <tbody>
                    {watchlist.map(item => {
                      const price = prices[item.ticker];
                      const changePct = dayChanges[item.ticker];
                      const hasChange = changePct != null;
                      return (
                        <tr key={item.ticker} onClick={() => router.push(`/stock/${item.ticker}`)}
                          style={{ borderBottom: '1px solid var(--ws-border)', cursor: 'pointer', transition: 'background 0.15s' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--ws-bg-2)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <td style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: 'var(--ws-text)' }}>
                            <StockLogo ticker={item.ticker} name={item.ticker} size={20} />
                            {item.ticker}
                          </td>
                          <td style={{ padding: '10px 18px', textAlign: 'right', fontWeight: 600, color: 'var(--ws-text)' }}>
                            {price != null ? `$${price.toFixed(2)}` : '—'}
                          </td>
                          <td style={{ padding: '10px 18px', textAlign: 'right', fontWeight: 700, color: hasChange ? (changePct >= 0 ? '#10b981' : 'var(--ws-red)') : 'var(--ws-text-3)' }}>
                            {hasChange ? `${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%` : '—'}
                          </td>
                          <td style={{ padding: '10px 18px', color: 'var(--ws-text-3)' }}>
                            {new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </td>
                          <td style={{ padding: '10px 18px', textAlign: 'right', fontWeight: 600, color: 'var(--ws-accent)' }}>
                            →
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {recentViewed.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ws-text-3)', fontSize: '13px' }}>
                No recently viewed stocks. Tickers will appear here as you search.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--ws-border)', background: 'rgba(0,0,0,0.01)' }}>
                      <th style={{ padding: '10px 18px', textAlign: 'left', fontWeight: 600, color: 'var(--ws-text-3)', fontSize: '10px' }}>TICKER</th>
                      <th style={{ padding: '10px 18px', textAlign: 'right', fontWeight: 600, color: 'var(--ws-text-3)', fontSize: '10px' }}>PRICE</th>
                      <th style={{ padding: '10px 18px', textAlign: 'right', fontWeight: 600, color: 'var(--ws-text-3)', fontSize: '10px' }}>TODAY</th>
                      <th style={{ padding: '10px 18px' }} />
                    </tr>
                  </thead>
                  <tbody>
                    {recentViewed.map(ticker => {
                      const price = prices[ticker];
                      const changePct = dayChanges[ticker];
                      const hasChange = changePct != null;
                      return (
                        <tr key={ticker} onClick={() => router.push(`/stock/${ticker}`)}
                          style={{ borderBottom: '1px solid var(--ws-border)', cursor: 'pointer', transition: 'background 0.15s' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--ws-bg-2)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <td style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: 'var(--ws-text)' }}>
                            <StockLogo ticker={ticker} name={ticker} size={20} />
                            {ticker}
                          </td>
                          <td style={{ padding: '10px 18px', textAlign: 'right', fontWeight: 600, color: 'var(--ws-text)' }}>
                            {price != null ? `$${price.toFixed(2)}` : '—'}
                          </td>
                          <td style={{ padding: '10px 18px', textAlign: 'right', fontWeight: 700, color: hasChange ? (changePct >= 0 ? '#10b981' : 'var(--ws-red)') : 'var(--ws-text-3)' }}>
                            {hasChange ? `${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%` : '—'}
                          </td>
                          <td style={{ padding: '10px 18px', textAlign: 'right', fontWeight: 600, color: 'var(--ws-accent)' }}>
                            →
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Card>
    );
  };

  const renderPortfolio = () => {
    const PALETTE = ['#4f7a68', '#7c6fe0', '#d99a4e', '#5a9bd4', '#c1666b', '#8fb996', '#b98fc9', '#e0a458', '#6b9080', '#a4a4a4'];

    let totalCost = 0;
    let totalValue = 0;
    let totalTodayChange = 0;
    displayHoldings.forEach(item => {
      const currentPrice = prices[item.ticker] || item.avgPrice;
      const changePct = dayChanges[item.ticker];
      totalCost += item.shares * item.avgPrice;
      totalValue += item.shares * currentPrice;
      if (changePct != null) {
        totalTodayChange += item.shares * currentPrice * (changePct / 100);
      }
    });

    const totalReturn = totalValue - totalCost;
    const totalReturnPct = totalCost > 0 ? (totalReturn / totalCost) * 100 : 0;
    const positive = totalReturn >= 0;

    const prevTotalValue = totalValue - totalTodayChange;
    const totalTodayPct = prevTotalValue > 0 ? (totalTodayChange / prevTotalValue) * 100 : 0;
    const todayPositive = totalTodayChange >= 0;

    // Allocation breakdown — grouped by Pie or by individual stock, whichever tab is active
    const chartData = portfolioTab === 'pies'
      ? piesData.map(group => ({ name: group.name, value: group.value })).filter(g => g.value > 0)
      : displayHoldings.map(item => ({
          name: item.ticker,
          value: item.shares * (prices[item.ticker] || item.avgPrice)
        })).filter(s => s.value > 0).sort((a, b) => b.value - a.value);
    const hasHoldings = chartData.length > 0;

    // Every individual position, ranked by market value — always visible, no clicking required
    const sortedHoldings = displayHoldings
      .map(item => {
        const currentPrice = prices[item.ticker] || item.avgPrice;
        const value = item.shares * currentPrice;
        const cost = item.shares * item.avgPrice;
        const ret = value - cost;
        const retPct = cost > 0 ? (ret / cost) * 100 : 0;
        return { ...item, currentPrice, value, ret, retPct, changePct: dayChanges[item.ticker] };
      })
      .sort((a, b) => b.value - a.value);

    return (
      <Card
        title="Equity Portfolio"
        subtitle={isSignedIn ? "Real-time holdings synced with your database." : "Track your mock trades & performance."}
        rightElement={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ display: 'flex', border: '1px solid var(--ws-border)', borderRadius: '6px', overflow: 'hidden' }}>
              {Object.keys(CURRENCIES).map(c => (
                <button key={c} onClick={() => changeCurrency(c)}
                  style={{
                    height: '24px',
                    padding: '0 8px',
                    fontSize: '10px',
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    background: currency === c ? 'var(--ws-accent)' : 'var(--ws-bg-1)',
                    color: currency === c ? '#fff' : 'var(--ws-text-2)'
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
            <button onClick={() => setShowAddTx(!showAddTx)}
              style={{
                fontSize: '10px',
                fontWeight: 700,
                color: 'var(--ws-accent)',
                background: 'var(--ws-accent-dim)',
                border: 'none',
                padding: '4px 8px',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              {showAddTx ? 'Cancel' : '+ Add Trade'}
            </button>
          </div>
        }
        dragProps={{
          draggable: true,
          onDragStart: (e) => handleDragStart(e, 'portfolio'),
          onDragEnd: handleDragEnd,
          onDragOver: (e) => handleDragOverWidget(e, 'portfolio'),
          style: {
            opacity: draggedId === 'portfolio' ? 0.35 : 1,
            transform: draggedId === 'portfolio' ? 'scale(0.98)' : 'scale(1)',
            boxShadow: draggedId === 'portfolio' ? '0 5px 15px rgba(0,0,0,0.05)' : 'none'
          }
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '16px' }}>
          {/* Sign In Banner if not signed in */}
          {!isSignedIn && (
            <div style={{
              background: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              borderRadius: '8px',
              padding: '8px 12px',
              fontSize: '11px',
              color: 'var(--ws-text-2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px'
            }}>
              <span>ℹ️ Utilizando portafolio local. Inicia sesión para sincronizar.</span>
              <button
                onClick={() => router.push('/sign-in')}
                style={{
                  background: 'var(--ws-text)',
                  color: 'var(--ws-bg-1)',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '4px 8px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontSize: '10px'
                }}
              >
                Sign In
              </button>
            </div>
          )}

          {/* Summary Row — Value, Today's move and Total Return, all at a glance */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            background: 'var(--ws-bg-2)',
            border: '1px solid var(--ws-border)'
          }}>
            <div style={{ padding: '12px 14px' }}>
              <div style={{ fontSize: '10px', color: 'var(--ws-text-3)', fontWeight: 700, textTransform: 'uppercase' }}>
                Portfolio Value
              </div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '17px', fontWeight: 800, color: 'var(--ws-text)', marginTop: '2px' }}>
                {currencySymbol}{(totalValue * fxRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div style={{ padding: '12px 14px', borderLeft: '1px solid var(--ws-border)', borderRight: '1px solid var(--ws-border)' }}>
              <div style={{ fontSize: '10px', color: 'var(--ws-text-3)', fontWeight: 700, textTransform: 'uppercase' }}>
                Today
              </div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', fontWeight: 700, color: todayPositive ? '#10b981' : 'var(--ws-red)', marginTop: '4px' }}>
                {todayPositive ? '+' : '-'} {currencySymbol}{Math.abs(totalTodayChange * fxRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({totalTodayPct.toFixed(2)}%)
              </div>
            </div>
            <div style={{ padding: '12px 14px' }}>
              <div style={{ fontSize: '10px', color: 'var(--ws-text-3)', fontWeight: 700, textTransform: 'uppercase' }}>
                Total Return
              </div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', fontWeight: 700, color: positive ? '#10b981' : 'var(--ws-red)', marginTop: '4px' }}>
                {positive ? '+' : '-'} {currencySymbol}{Math.abs(totalReturn * fxRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({totalReturnPct.toFixed(2)}%)
              </div>
            </div>
          </div>

          {/* Holdings table — every position always visible, ranked by size, click a row to open its stock page */}
          <div style={{ border: '1px solid var(--ws-border)', overflow: 'hidden' }}>
            {sortedHoldings.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--ws-text-3)', fontSize: '11px' }}>
                No active holdings. Click "+ Add Trade" to track positions!
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <thead>
                    <tr style={{ background: 'rgba(0,0,0,0.01)', borderBottom: '1px solid var(--ws-border)' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--ws-text-3)', fontSize: '9px' }}>POSITION</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--ws-text-3)', fontSize: '9px' }}>SHARES</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--ws-text-3)', fontSize: '9px' }}>AVG COST</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--ws-text-3)', fontSize: '9px' }}>PRICE</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--ws-text-3)', fontSize: '9px' }}>TODAY</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--ws-text-3)', fontSize: '9px' }}>VALUE</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--ws-text-3)', fontSize: '9px' }}>RETURN</th>
                      <th style={{ padding: '8px 12px' }} />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedHoldings.map((item, idx) => {
                      const itemPositive = item.ret >= 0;
                      const hasChange = item.changePct != null;
                      const changePositive = hasChange && item.changePct >= 0;
                      return (
                        <tr key={item.ticker + (item.pie || '') + idx}
                          onClick={() => router.push(`/stock/${item.ticker}`)}
                          style={{ borderBottom: idx === sortedHoldings.length - 1 ? 'none' : '1px solid var(--ws-border)', cursor: 'pointer', transition: 'background 0.15s' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--ws-bg-2)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <td style={{ padding: '8px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <StockLogo ticker={item.ticker} name={item.ticker} size={22} />
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 800, color: 'var(--ws-text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  {item.ticker}
                                  <MarketStatusDot ticker={item.ticker} />
                                </div>
                                {item.pie && (
                                  <div style={{ fontSize: '9px', color: 'var(--ws-accent)', fontWeight: 600, marginTop: '1px' }}>{item.pie}</div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--ws-text-2)' }}>{item.shares}</td>
                          {/* Avg cost / price stay in their native trading currency (USD here) — only
                              aggregate value/gain figures convert to the selected reporting currency,
                              same behavior as the dedicated /portfolio page. */}
                          <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--ws-text-2)' }}>${item.avgPrice.toFixed(2)}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--ws-text)', fontWeight: 600 }}>${item.currentPrice.toFixed(2)}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: hasChange ? (changePositive ? '#10b981' : 'var(--ws-red)') : 'var(--ws-text-3)' }}>
                            {hasChange ? `${changePositive ? '+' : ''}${item.changePct.toFixed(2)}%` : '—'}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--ws-text)', fontWeight: 700 }}>
                            {currencySymbol}{(item.value * fxRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: itemPositive ? '#10b981' : 'var(--ws-red)' }}>
                            {itemPositive ? '+' : ''}{item.retPct.toFixed(2)}%
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRemoveTx(item.ticker, item.pie); }}
                              type="button"
                              title="Remove position"
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--ws-text-3)',
                                fontSize: '12px',
                                cursor: 'pointer',
                                padding: '4px',
                                borderRadius: '4px',
                                transition: 'all 0.15s ease'
                              }}
                              onMouseEnter={e => { e.currentTarget.style.color = 'var(--ws-red)'; e.currentTarget.style.background = 'var(--ws-red-dim)'; }}
                              onMouseLeave={e => { e.currentTarget.style.color = 'var(--ws-text-3)'; e.currentTarget.style.background = 'none'; }}
                            >
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

          {/* Allocation — compact donut + legend, grouped by Pie or by individual stock */}
          {hasHoldings && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '18px',
              background: 'var(--ws-bg-2)',
              border: '1px solid var(--ws-border)',
              borderRadius: '10px',
              padding: '14px'
            }}>
              <div style={{ width: '80px', height: '80px', flexShrink: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={22}
                      outerRadius={38}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PALETTE[index % PALETTE.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
                  <button onClick={() => setPortfolioTab('pies')}
                    style={{ background: 'none', border: 'none', color: portfolioTab === 'pies' ? 'var(--ws-accent)' : 'var(--ws-text-3)', fontSize: '10px', fontWeight: 700, cursor: 'pointer', padding: 0 }}>
                    By Pies
                  </button>
                  <button onClick={() => setPortfolioTab('stocks')}
                    style={{ background: 'none', border: 'none', color: portfolioTab === 'stocks' ? 'var(--ws-accent)' : 'var(--ws-text-3)', fontSize: '10px', fontWeight: 700, cursor: 'pointer', padding: 0 }}>
                    By Stocks
                  </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px' }}>
                  {chartData.map((entry, index) => {
                    const pct = totalValue > 0 ? (entry.value / totalValue) * 100 : 0;
                    const color = PALETTE[index % PALETTE.length];
                    return (
                      <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
                        <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                        <span style={{ fontWeight: 700, color: 'var(--ws-text)' }}>{entry.name}</span>
                        <span style={{ color: 'var(--ws-text-3)' }}>{pct.toFixed(1)}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Add Transaction Form */}
          {showAddTx && (
            <form onSubmit={handleAddTx} style={{
              background: 'var(--ws-bg-2)',
              padding: '12px 14px',
              border: '1px solid var(--ws-border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ws-text)' }}>New Transaction</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '9px', color: 'var(--ws-text-3)', fontWeight: 700, textTransform: 'uppercase' }}>Ticker</label>
                  <input
                    type="text"
                    value={txTicker}
                    onChange={e => setTxTicker(e.target.value)}
                    placeholder="AAPL"
                    required
                    style={{
                      width: '100%',
                      background: 'var(--ws-bg-1)',
                      border: '1px solid var(--ws-border)',
                      borderRadius: '6px',
                      padding: '6px',
                      color: 'var(--ws-text)',
                      fontSize: '11px',
                      fontWeight: 600,
                      outline: 'none',
                      marginTop: '2px'
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '9px', color: 'var(--ws-text-3)', fontWeight: 700, textTransform: 'uppercase' }}>Shares</label>
                  <input
                    type="number"
                    step="any"
                    value={txShares}
                    onChange={e => setTxShares(e.target.value)}
                    placeholder="10"
                    required
                    style={{
                      width: '100%',
                      background: 'var(--ws-bg-1)',
                      border: '1px solid var(--ws-border)',
                      borderRadius: '6px',
                      padding: '6px',
                      color: 'var(--ws-text)',
                      fontSize: '11px',
                      fontWeight: 600,
                      outline: 'none',
                      marginTop: '2px'
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '9px', color: 'var(--ws-text-3)', fontWeight: 700, textTransform: 'uppercase' }}>Avg Cost</label>
                  <input
                    type="number"
                    step="any"
                    value={txPrice}
                    onChange={e => setTxPrice(e.target.value)}
                    placeholder="150"
                    required
                    style={{
                      width: '100%',
                      background: 'var(--ws-bg-1)',
                      border: '1px solid var(--ws-border)',
                      borderRadius: '6px',
                      padding: '6px',
                      color: 'var(--ws-text)',
                      fontSize: '11px',
                      fontWeight: 600,
                      outline: 'none',
                      marginTop: '2px'
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '9px', color: 'var(--ws-text-3)', fontWeight: 700, textTransform: 'uppercase' }}>Pie (Optional)</label>
                  <input
                    type="text"
                    value={txPie}
                    onChange={e => setTxPie(e.target.value)}
                    placeholder="Tech"
                    style={{
                      width: '100%',
                      background: 'var(--ws-bg-1)',
                      border: '1px solid var(--ws-border)',
                      borderRadius: '6px',
                      padding: '6px',
                      color: 'var(--ws-text)',
                      fontSize: '11px',
                      fontWeight: 600,
                      outline: 'none',
                      marginTop: '2px'
                    }}
                  />
                </div>
              </div>
              <button
                type="submit"
                style={{
                  background: 'var(--ws-accent)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textAlign: 'center',
                  boxShadow: '0 2px 6px rgba(15,118,110,0.1)'
                }}
              >
                Add Position
              </button>
            </form>
          )}
        </div>
      </Card>
    );
  };


  const renderEarnings = () => {
    return (
      <Card 
        title="Earnings Calendar" 
        subtitle="Next 7 days corporate announcements."
        rightElement={
          <button onClick={() => router.push('/calendar')}
            style={{
              fontSize: '10px',
              fontWeight: 600,
              color: 'var(--ws-accent)',
              background: 'none',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            View Full
          </button>
        }
        dragProps={{
          draggable: true,
          onDragStart: (e) => handleDragStart(e, 'earnings'),
          onDragEnd: handleDragEnd,
          onDragOver: (e) => handleDragOverWidget(e, 'earnings'),
          style: {
            opacity: draggedId === 'earnings' ? 0.35 : 1,
            transform: draggedId === 'earnings' ? 'scale(0.98)' : 'scale(1)',
            boxShadow: draggedId === 'earnings' ? '0 5px 15px rgba(0,0,0,0.05)' : 'none'
          }
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {earnings.slice(0, 6).map((e, index) => (
            <div key={e.ticker + e.date + index} onClick={() => router.push(`/stock/${e.ticker}`)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 16px',
                borderBottom: index < 5 ? '1px solid var(--ws-border)' : 'none',
                cursor: 'pointer',
                transition: 'background 0.15s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--ws-bg-2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <StockLogo ticker={e.ticker} name={e.ticker} size={22} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ws-text)' }}>{e.ticker}</div>
                <div style={{ fontSize: '10px', color: 'var(--ws-text-3)', marginTop: '2px' }}>
                  {new Date(e.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <span style={{
                  fontSize: '9px',
                  background: e.hour === 'bmo' ? '#f59e0b16' : '#3b82f616',
                  color: e.hour === 'bmo' ? '#d97706' : '#2563eb',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontWeight: 700,
                  textTransform: 'uppercase'
                }}>
                  {e.hour === 'bmo' ? 'Before Open' : e.hour === 'amc' ? 'After Close' : 'Time TBD'}
                </span>
                {e.epsEstimate != null && (
                  <div style={{ fontSize: '10px', color: 'var(--ws-text-2)', marginTop: '4px', fontWeight: 600 }}>Est. ${e.epsEstimate}</div>
                )}
              </div>
            </div>
          ))}
          {earnings.length === 0 && (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--ws-text-3)', fontSize: '12px' }}>
              No earnings calls in the next 7 days.
            </div>
          )}
        </div>
      </Card>
    );
  };

  const renderMovers = () => {
    return (
      <Card 
        title="Market Intelligence" 
        subtitle="Top computed metrics across database."
        dragProps={{
          draggable: true,
          onDragStart: (e) => handleDragStart(e, 'movers'),
          onDragEnd: handleDragEnd,
          onDragOver: (e) => handleDragOverWidget(e, 'movers'),
          style: {
            opacity: draggedId === 'movers' ? 0.35 : 1,
            transform: draggedId === 'movers' ? 'scale(0.98)' : 'scale(1)',
            boxShadow: draggedId === 'movers' ? '0 5px 15px rgba(0,0,0,0.05)' : 'none'
          }
        }}
      >
        {/* Widget Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--ws-border)', background: 'rgba(0,0,0,0.01)' }}>
          {MOVER_TABS.map(({ key, label }) => (
            <button key={key} onClick={() => setActiveMoverTab(key)}
              style={{
                flex: 1,
                padding: '10px 0',
                fontSize: '10px',
                fontWeight: 700,
                color: activeMoverTab === key ? 'var(--ws-accent)' : 'var(--ws-text-3)',
                background: 'none',
                border: 'none',
                borderBottom: activeMoverTab === key ? '2px solid var(--ws-accent)' : 'none',
                cursor: 'pointer',
                outline: 'none',
                transition: 'all 0.15s ease'
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Tab contents */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {movers ? (
            (() => {
              const activeTab = MOVER_TABS.find(t => t.key === activeMoverTab);
              const list = (movers[activeMoverTab] || []).slice(0, 6);
              return list.map((s, index) => (
                <div key={s.ticker} onClick={() => router.push(`/stock/${s.ticker}`)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 16px',
                    borderBottom: index < list.length - 1 ? '1px solid var(--ws-border)' : 'none',
                    cursor: 'pointer',
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--ws-bg-2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <StockLogo ticker={s.ticker} name={s.name} size={20} />
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ws-text)' }}>{s.ticker}</div>
                      <div style={{ fontSize: '10px', color: 'var(--ws-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px', marginTop: '2px' }}>{s.name}</div>
                    </div>
                  </div>
                  {activeTab.renderValue(s)}
                </div>
              ));
            })()
          ) : (
            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--ws-text-3)', fontSize: '12px' }}>Loading market data…</div>
          )}
        </div>
      </Card>
    );
  };

  const renderSecFeed = () => {
    const activeFeed = (newsTab === 'holdings' ? holdingsNews : secFeed).slice(0, 12);
    const activeLoading = newsTab === 'holdings' ? holdingsNewsLoading : secFeedLoading;

    return (
      <Card
        title="Market News"
        subtitle="Stock & ETF headlines, ranked by relevance."
        dragProps={{
          draggable: true,
          onDragStart: (e) => handleDragStart(e, 'secFeed'),
          onDragEnd: handleDragEnd,
          onDragOver: (e) => handleDragOverWidget(e, 'secFeed'),
          style: {
            opacity: draggedId === 'secFeed' ? 0.35 : 1,
            transform: draggedId === 'secFeed' ? 'scale(0.98)' : 'scale(1)',
            boxShadow: draggedId === 'secFeed' ? '0 5px 15px rgba(0,0,0,0.05)' : 'none'
          }
        }}
      >
        {/* Widget Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--ws-border)', background: 'rgba(0,0,0,0.01)' }}>
          {['all', 'holdings'].map(tabKey => (
            <button key={tabKey} onClick={() => setNewsTab(tabKey)}
              style={{
                flex: 1,
                padding: '10px 0',
                fontSize: '10px',
                fontWeight: 700,
                color: newsTab === tabKey ? 'var(--ws-accent)' : 'var(--ws-text-3)',
                background: 'none',
                border: 'none',
                borderBottom: newsTab === tabKey ? '2px solid var(--ws-accent)' : 'none',
                cursor: 'pointer',
                outline: 'none',
                transition: 'all 0.15s ease'
              }}
            >
              {tabKey === 'all' ? 'All' : `My Holdings (${newsTickers.length})`}
            </button>
          ))}
        </div>

        {activeLoading ? (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--ws-text-3)', fontSize: '12px' }}>
            Loading {newsTab === 'holdings' ? 'holdings' : 'market'} news...
          </div>
        ) : activeFeed.length === 0 ? (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--ws-text-3)', fontSize: '12px' }}>
            {newsTab === 'holdings'
              ? (newsTickers.length === 0
                ? 'Add positions or watchlist tickers to see news about them here.'
                : 'No recent news for your holdings.')
              : 'No recent financial news available.'}
          </div>
        ) : (
        /* True masonry: items are greedily balanced across columns, columns stretch (flex: 1) to fill the full widget width */
        <div ref={newsFeedRef} style={{ display: 'flex', gap: '14px', padding: '18px', alignItems: 'flex-start' }}>
          {distributeMasonryColumns(activeFeed, newsColumnCount).map((column, colIdx) => (
            <div key={colIdx} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
                      transition: 'all 0.2s ease-in-out'
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
                    {/* Smart news image — hides logos, shows real thumbnails, ticker ribbon in the corner */}
                    <NewsImage src={f.image} alt={f.title} ticker={f.ticker} large={isFeatured} />

                    {/* Card Content */}
                    <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {/* Headline — the top-ranked story reads bigger, Pinterest-style emphasis */}
                      <div style={{
                        fontSize: isFeatured ? '15px' : '12px',
                        fontWeight: 700,
                        color: 'var(--ws-text)',
                        lineHeight: '1.45'
                      }}>
                        {f.title}
                      </div>

                      {/* Metadata Footer */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderTop: '1px solid var(--ws-border)',
                        paddingTop: '8px'
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
                            flexShrink: 0
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
        <div onClick={() => router.push('/watchlist')}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            padding: '12px', borderTop: '1px solid var(--ws-border)', cursor: 'pointer',
            fontSize: '11px', fontWeight: 700, color: 'var(--ws-text-2)',
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--ws-accent)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--ws-text-2)'}>
          View all news →
        </div>
      </Card>
    );
  };

  const renderWidget = (id) => {
    switch (id) {
      case 'indices': return renderIndices();
      case 'portfolio': return renderPortfolio();
      case 'sotw': return renderSotw();
      case 'workspace': return renderWorkspace();
      case 'earnings': return renderEarnings();
      case 'movers': return renderMovers();
      case 'secFeed': return renderSecFeed();
      default: return null;
    }
  };

  // Filter columns (ignore hidden widgets)
  const leftWidgets = widgets.filter(w => w.column === 'left' && w.visible !== false).sort((a, b) => a.order - b.order);
  const rightWidgets = widgets.filter(w => w.column === 'right' && w.visible !== false).sort((a, b) => a.order - b.order);

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Floating layout/config gear — fixed bottom-right, stays reachable while scrolling */}
      <div
        onMouseEnter={() => setShowConfig(true)}
        onMouseLeave={() => setShowConfig(false)}
        style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 50 }}
      >
        <button
          style={{
            width: '36px',
            height: '36px',
            background: 'var(--ws-bg-1)',
            border: '1px solid var(--ws-border)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--ws-text-2)',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            outline: 'none'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'var(--ws-bg-2)';
            e.currentTarget.style.borderColor = 'var(--ws-accent)';
            e.currentTarget.style.color = 'var(--ws-accent)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'var(--ws-bg-1)';
            e.currentTarget.style.borderColor = 'var(--ws-border)';
            e.currentTarget.style.color = 'var(--ws-text-2)';
          }}
        >
          <GearIcon style={{
            transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
            transform: showConfig ? 'rotate(90deg)' : 'rotate(0deg)',
            pointerEvents: 'none',
          }} />
        </button>

        {showConfig && (
          <div style={{
            position: 'absolute',
            bottom: '100%',
            right: 0,
            paddingBottom: '8px', // Invisible bridge to keep hover active
            width: '280px',
            zIndex: 100,
            transformOrigin: 'bottom right',
            animation: 'fadeInSlideUp 0.18s cubic-bezier(0.16, 1, 0.3, 1) forwards'
          }}>
            <div style={{
              background: 'var(--ws-bg-1)',
              border: '1px solid var(--ws-border)',
              boxShadow: '0 10px 25px rgba(0,0,0,0.08)',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}>
              {/* Layout Mode Presets */}
              <div>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--ws-text-3)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>
                  Dashboard Layout
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[
                    { id: 'split', label: 'Standard' },
                    { id: 'equal', label: '50/50' },
                    { id: 'full', label: 'Full Width' }
                  ].map(lay => (
                    <button
                      key={lay.id}
                      onClick={() => changeLayoutMode(lay.id)}
                      style={{
                        flex: 1,
                        padding: '6px 0',
                        fontSize: '11px',
                        fontWeight: 600,
                        borderRadius: '4px',
                        border: layoutMode === lay.id ? '1px solid var(--ws-accent)' : '1px solid var(--ws-border)',
                        background: layoutMode === lay.id ? 'var(--ws-accent-dim)' : 'var(--ws-bg-2)',
                        color: layoutMode === lay.id ? 'var(--ws-accent)' : 'var(--ws-text-2)',
                        cursor: 'pointer',
                        transition: 'all 0.1s ease'
                      }}
                    >
                      {lay.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Active Widgets Checkboxes */}
              <div>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--ws-text-3)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>
                  Active Widgets
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                  {widgets.map(w => {
                    const label = w.id === 'indices' ? 'Market Benchmarks'
                                : w.id === 'portfolio' ? 'Equity Portfolio'
                                : w.id === 'sotw' ? 'Stock of the Week'
                                : w.id === 'workspace' ? 'Coverage Workspace'
                                : w.id === 'earnings' ? 'Earnings Calendar'
                                : w.id === 'movers' ? 'Market Intelligence'
                                : w.id === 'secFeed' ? 'Market News'
                                : w.id;
                    const isVisible = w.visible !== false;
                    return (
                      <label key={w.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--ws-text)', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={isVisible}
                          onChange={() => {
                            const updated = widgets.map(item => item.id === w.id ? { ...item, visible: !isVisible } : item);
                            setWidgets(updated);
                            localStorage.setItem('traqcker_dashboard_layout', JSON.stringify(updated));
                          }}
                          style={{ accentColor: 'var(--ws-accent)' }}
                        />
                        {label}
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Reset Buttons */}
              <button
                onClick={() => {
                  setWidgets(DEFAULT_WIDGETS);
                  localStorage.setItem('traqcker_dashboard_layout', JSON.stringify(DEFAULT_WIDGETS));
                  changeLayoutMode('split');
                  setShowConfig(false);
                }}
                style={{
                  padding: '8px 0',
                  fontSize: '11px',
                  fontWeight: 700,
                  border: 'none',
                  background: 'var(--ws-bg-2)',
                  color: 'var(--ws-red)',
                  cursor: 'pointer',
                  marginTop: '4px',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = 0.9}
                onMouseLeave={e => e.currentTarget.style.opacity = 1}
              >
                Reset Layout & Widgets
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 2. Top Movers Marquee Ticker — pick Gainers/Losers/Big Cap Movers from the dropdown, all today-only (see MAX_CACHE_AGE_HOURS in /api/movers), auto-scrolls continuously */}
      {movers && (() => {
        const MARQUEE_SOURCES = {
          gainers: { data: movers.gainers || [], colorMode: 'positive' },
          losers: { data: movers.losers || [], colorMode: 'negative' },
          bigCapMovers: { data: movers.bigCapMovers || [], colorMode: 'signed' }
        };
        const { data: sourceList, colorMode } = MARQUEE_SOURCES[marqueeMode];
        const tapeItems = sourceList.slice(0, 20);
        const colorFor = (s) => colorMode === 'positive' ? '#10b981' : colorMode === 'negative' ? 'var(--ws-red)' : (s.priceChangePct >= 0 ? '#10b981' : 'var(--ws-red)');
        const signFor = (s) => (colorMode === 'positive' || (colorMode === 'signed' && s.priceChangePct >= 0)) ? '+' : '';

        return (
          <div style={{
            background: 'var(--ws-bg-1)',
            border: '1px solid var(--ws-border)',
            padding: '12px 0 12px 18px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            display: 'flex',
            alignItems: 'center',
            gap: '24px',
            overflow: 'hidden'
          }}>
            <select
              value={marqueeMode}
              onChange={(e) => setMarqueeMode(e.target.value)}
              style={{
                fontSize: '10px', fontWeight: 700, color: 'var(--ws-text-3)', letterSpacing: '1px', textTransform: 'uppercase',
                borderRight: '1px solid var(--ws-border)', paddingRight: '16px', flexShrink: 0, background: 'none', border: 'none',
                borderRadius: 0, cursor: 'pointer', outline: 'none', WebkitAppearance: 'menulist', appearance: 'menulist'
              }}
            >
              <option value="gainers">Top Gainers Today</option>
              <option value="losers">Top Losers Today</option>
              <option value="bigCapMovers">Big Cap Movers</option>
            </select>
            {tapeItems.length === 0 ? (
              <span style={{ fontSize: '12px', color: 'var(--ws-text-3)' }}>No data available right now.</span>
            ) : (
              <div style={{ overflow: 'hidden', flex: 1 }}>
                <div
                  className="marquee-tape"
                  style={{ display: 'flex', gap: '28px', width: 'max-content', animation: 'marqueeScroll 45s linear infinite' }}
                  onMouseEnter={e => e.currentTarget.style.animationPlayState = 'paused'}
                  onMouseLeave={e => e.currentTarget.style.animationPlayState = 'running'}
                >
                  {/* Rendered twice back-to-back so translateX(-50%) loops seamlessly */}
                  {[...tapeItems, ...tapeItems].map((s, i) => (
                    <div key={`${s.ticker}-${i}`} onClick={() => router.push(`/stock/${s.ticker}`)}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', flexShrink: 0, transition: 'opacity 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.opacity = 0.8}
                      onMouseLeave={e => e.currentTarget.style.opacity = 1}>
                      <StockLogo ticker={s.ticker} name={s.name} size={18} />
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ws-text)', whiteSpace: 'nowrap' }}>{s.ticker}</span>
                      <span style={{ fontSize: '11px', color: colorFor(s), fontWeight: 600, whiteSpace: 'nowrap' }}>{signFor(s)}{s.priceChangePct?.toFixed(2)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <style>{`
              @keyframes marqueeScroll {
                from { transform: translateX(0); }
                to { transform: translateX(-50%); }
              }
            `}</style>
          </div>
        );
      })()}

      {/* 3. Main Custom Grid Layout */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: layoutMode === 'full' ? '1fr' : layoutMode === 'equal' ? '1fr 1fr' : '1fr 360px', 
        gap: '20px', 
        alignItems: 'start' 
      }}>
        
        {/* LEFT COLUMN */}
        <div 
          data-column-container="true"
          onDragOver={(e) => handleDragOverColumn(e, 'left')}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            minHeight: '400px',
            padding: '4px',
            transition: 'all 0.2s ease'
          }}
        >
          {leftWidgets.map((widget) => (
            <div key={widget.id}>
              {renderWidget(widget.id)}
            </div>
          ))}
        </div>

        {/* RIGHT COLUMN */}
        <div
          data-column-container="true"
          onDragOver={(e) => handleDragOverColumn(e, 'right')}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            minHeight: '400px',
            padding: '4px',
            transition: 'all 0.2s ease'
          }}
        >
          {rightWidgets.map((widget) => (
            <div key={widget.id}>
              {renderWidget(widget.id)}
            </div>
          ))}
        </div>

      </div>

      {/* Slide & Fade Animation styles for the Customize Dropdown */}
      <style>{`
        @keyframes fadeInSlide {
          from {
            opacity: 0;
            transform: translateY(-8px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes fadeInSlideUp {
          from {
            opacity: 0;
            transform: translateY(8px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
}
