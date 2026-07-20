'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '../../components/AuthProvider';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import MarketStatusDot from '../../components/workspace/MarketStatusDot';
import { formatPriceWithSymbol as formatCurrency } from '../../../lib/formatters';
import { useCurrencyRates } from '../../../lib/hooks/useCurrencyRates';
import { distributeMasonryColumns } from '../../../lib/homeLayout';
import { computeEasyMode } from '../../../lib/stockScoring';
import { openInNewTab } from '../../../lib/openInNewTab';
import StockLogo from '../../components/workspace/StockLogo';
import NewsImage from '../../components/workspace/home/NewsImage';
import Card from '../../components/workspace/home/Card';
import WelcomeModal from '../../components/workspace/home/WelcomeModal';
import StockChart from '../../components/StockChart';
import AdSlot from '../../components/AdSlot';

// Same set + localStorage key as the dedicated /portfolio page, so the display
// currency preference stays in sync between that page and this dashboard widget.
const CURRENCIES = { USD: '$', EUR: '€', GBP: '£' };

// Fixed dashboard layout — a new user with an empty portfolio/watchlist shouldn't have to
// configure a dashboard before it's useful. Market Intelligence, Earnings Calendar and Stock
// of the Week were cut entirely — they duplicated content that already lives (in more depth)
// on the Radar and Calendar pages, or added little beyond a gimmick once the community-voting
// angle was removed. News stays: unlike those, it's content the user actually comes back to
// Home to read. Advanced Mode (see below) replaces this whole grid with a terminal-style
// chart view instead of customizing it, so there's no drag-to-reorder here anymore.
const WIDGET_ORDER = ['indices', 'portfolio', 'workspace', 'secFeed', 'leaders'];
const MAX_CHART_TICKERS = 16;

const WIDGETS_METADATA = [
  { id: 'indices', label: 'Major Indices' },
  { id: 'portfolio', label: 'My Portfolio' },
  { id: 'workspace', label: 'Coverage Workspace' },
  { id: 'secFeed', label: 'SEC Filings & Alerts' },
  { id: 'leaders', label: 'Fundamental Leaders' }
];

// Same "is there enough fundamental data to score this" check used on the stock detail
// page's Quality tab and the /watchlist table — avoids showing a fabricated-looking score
// for recent IPOs / thinly-covered tickers with no SEC/Finnhub fundamentals yet.
const hasFundamentals = (data) => data.revVal != null || data.niVal != null || data.marketCap != null
  || data.roic != null || data.grossMargin != null || (data.revHistory?.length ?? 0) > 0;

// Same 1-5 -> color mapping as the Quality tab's ScoreBar/grid on the stock detail page
// and the /watchlist table's CBS/OPPO/GQS columns.
const scoreColor = (s) => s >= 4 ? 'var(--ws-accent)' : s >= 3 ? 'var(--ws-text)' : 'var(--ws-red)';

// Animated fill bar for the main Quality Score.
function QualityScoreBar({ score100, color }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    setWidth(0);
    const t = setTimeout(() => setWidth(score100), 400);
    return () => clearTimeout(t);
  }, [score100]);
  return (
    <div style={{
      position: 'relative', width: '150px', height: '18px', overflow: 'hidden', flexShrink: 0,
      backgroundImage: `radial-gradient(circle, ${color} 1.1px, transparent 1.1px)`,
      backgroundSize: '6px 6px', backgroundColor: 'var(--ws-bg-1)',
    }}>
      <div style={{ position: 'absolute', inset: 0, width: `${width}%`, background: color, transition: 'width 1.1s cubic-bezier(0.16, 1, 0.3, 1)' }} />
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(90deg, var(--ws-bg-1) 0px, var(--ws-bg-1) 2px, transparent 2px, transparent 15px)' }} />
    </div>
  );
}

// Faceted diamond icon
function GemDiamondIcon({ size = 46 }) {
  return (
    <svg viewBox="0 0 231.884 231.884" width={size} height={size} style={{ overflow: 'visible' }}>
      <defs>
        <clipPath id="gemOutlineClip">
          <polygon points="110.327,15.329 65.057,80.069 40.085,15.657" />
          <polygon points="35.24,19.685 59.8,83.029 0,82.665" />
          <polygon points="1.301,88.638 62.067,89.014 107.171,216.556" />
          <polygon points="112.643,214.127 68.41,89.05 112.917,89.324" />
          <polygon points="112.935,83.357 70.218,83.095 112.845,22.137 113.072,21.821 112.959,71.823" />
          <polygon points="231.884,82.665 172.085,83.029 196.638,19.685" />
          <polygon points="191.799,15.657 166.828,80.069 121.557,15.329" />
          <polygon points="118.926,71.823 118.812,21.821 119.033,22.137 161.666,83.095 118.95,83.357" />
          <polygon points="118.961,89.324 163.474,89.05 119.242,214.127" />
          <polygon points="124.714,216.556 169.817,89.014 230.584,88.638" />
        </clipPath>
      </defs>
      <polygon fill="#85B7EB" points="110.327,15.329 65.057,80.069 40.085,15.657" />
      <polygon fill="#B5D4F4" points="35.24,19.685 59.8,83.029 0,82.665" />
      <polygon fill="#378ADD" points="1.301,88.638 62.067,89.014 107.171,216.556" />
      <polygon fill="#185FA5" points="112.643,214.127 68.41,89.05 112.917,89.324" />
      <polygon fill="#E6F1FB" points="112.935,83.357 70.218,83.095 112.845,22.137 113.072,21.821 112.959,71.823" />
      <polygon fill="#378ADD" points="231.884,82.665 172.085,83.029 196.638,19.685" />
      <polygon fill="#185FA5" points="191.799,15.657 166.828,80.069 121.557,15.329" />
      <polygon fill="#0C447C" points="118.926,71.823 118.812,21.821 119.033,22.137 161.666,83.095 118.95,83.357" />
      <polygon fill="#042C53" points="118.961,89.324 163.474,89.05 119.242,214.127" />
      <polygon fill="#0C447C" points="124.714,216.556 169.817,89.014 230.584,88.638" />
      <polygon fill="none" stroke="#E6F1FB" strokeWidth="1.5" opacity="0.4"
        points="110.327,15.329 191.799,15.657 231.884,82.665 230.584,88.638 169.817,89.014 124.714,216.556 107.171,216.556 62.067,89.014 1.301,88.638 0,82.665 40.085,15.657" />
      <g clipPath="url(#gemOutlineClip)">
        <rect x="-60" y="-20" width="50" height="280" fill="#ffffff" opacity="0.6" style={{ animation: 'gem-shine 1.8s ease-in-out 0.3s infinite' }} />
      </g>
    </svg>
  );
}

// Blue Gem Reveal Animation
function GemRevealBar({ score100 }) {
  const [stage, setStage] = useState('filling'); // filling -> shaking -> exploding -> revealed
  const [fillWidth, setFillWidth] = useState(0);
  const [chunks, setChunks] = useState([]);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    setStage('filling');
    setFillWidth(0);
    setChunks([]);
    setFlash(false);

    const tFill = setTimeout(() => setFillWidth(100), 400);
    const tShake = setTimeout(() => setStage('shaking'), 1500);
    const tExplode = setTimeout(() => {
      const n = 5;
      const colors = ['#5DCAA5', '#1D9E75', '#5DCAA5', '#1D9E75', '#9FE1CB'];
      setChunks(Array.from({ length: n }, (_, i) => ({
        left: (i * 130) / n, width: 130 / n, color: colors[i],
        ex: (i - (n - 1) / 2) * 22 + (Math.random() * 10 - 5),
        ey: -18 - Math.random() * 16,
        rot: Math.random() * 140 - 70,
        flying: false,
      })));
      setFlash(true);
      setStage('exploding');
      setTimeout(() => setFlash(false), 70);
      setTimeout(() => {
        setChunks(cs => cs.map(c => ({ ...c, flying: true })));
      }, 30);
    }, 2500);
    const tReveal = setTimeout(() => setStage('revealed'), 2700);

    return () => { clearTimeout(tFill); clearTimeout(tShake); clearTimeout(tExplode); clearTimeout(tReveal); };
  }, [score100]);

  const barHidden = stage === 'exploding' || stage === 'revealed';

  return (
    <div style={{ position: 'relative', height: '46px', display: 'flex', alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', opacity: stage === 'revealed' ? 0 : 1, transition: 'opacity 0.2s' }}>
        <div style={{
          position: 'relative', width: '130px', height: '18px', flexShrink: 0, overflow: 'visible',
          backgroundImage: 'radial-gradient(circle, #1D9E75 1.1px, transparent 1.1px)',
          backgroundSize: '6px 6px', backgroundColor: 'var(--ws-bg-1)',
          animation: stage === 'shaking' ? 'gem-escalate-shake 1s ease-in-out 1' : 'none',
        }}>
          <div style={{
            position: 'absolute', inset: 0, background: '#1D9E75', width: `${fillWidth}%`,
            opacity: barHidden ? 0 : 1,
            transition: 'width 1.1s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.15s',
          }} />
          <div style={{ position: 'absolute', inset: '-6px', background: '#fff', opacity: flash ? 1 : 0, transition: flash ? 'opacity 0.06s' : 'opacity 0.3s' }} />
          {chunks.map((c, i) => (
            <div key={i} style={{
              position: 'absolute', top: 0, height: '18px', left: `${c.left}px`, width: `${c.width}px`, background: c.color,
              transform: c.flying ? `translate(${c.ex}px, ${c.ey}px) rotate(${c.rot}deg)` : 'translate(0, 0) rotate(0)',
              opacity: c.flying ? 0 : 1,
              transition: 'transform 0.5s cubic-bezier(0.3, 0, 0.7, 1), opacity 0.5s',
            }} />
          ))}
        </div>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '28px', fontWeight: 700, color: '#1D9E75', lineHeight: 1 }}>{score100}</span>
      </div>

      <div style={{
        position: 'absolute', left: 0, top: '50%', marginTop: '-23px', display: 'flex', alignItems: 'center', gap: '12px',
        opacity: stage === 'revealed' ? 1 : 0, transition: 'opacity 0.3s', pointerEvents: stage === 'revealed' ? 'auto' : 'none',
      }}>
        <div style={{
          position: 'absolute', left: '4px', top: '50%', width: '64px', height: '64px', marginTop: '-32px', marginLeft: '-9px',
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(133,183,235,0.9) 0%, rgba(55,138,221,0.4) 45%, transparent 75%)',
          animation: stage === 'revealed' ? 'gem-glow-pulse 0.9s ease-out 1' : 'none', pointerEvents: 'none',
        }} />
        <div style={{ width: '46px', height: '46px', flexShrink: 0, transform: stage === 'revealed' ? 'scale(1)' : 'scale(0)', transition: 'transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
          <GemDiamondIcon size={46} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '17px', fontWeight: 700, color: '#85B7EB', letterSpacing: '0.5px', lineHeight: 1.1 }}>HIDDEN GEM</span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '9px', color: '#5a7ba0', letterSpacing: '1px' }}>QUALITY OFF THE CHARTS</span>
        </div>
      </div>
    </div>
  );
}

export default function WorkspaceHome() {
  const router = useRouter();

  const [widgetVisibility, setWidgetVisibility] = useState({
    indices: true,
    portfolio: true,
    workspace: true,
    secFeed: true,
    leaders: true
  });
  const [showCustomizer, setShowCustomizer] = useState(false);

  // Advanced Mode — opt-in, persisted. Replaces the widget grid below with a terminal-style
  // view: a ticker rail, one big chart, and a detail panel — off by default so a new user's
  // dashboard stays the plain, un-configured grid until they ask for more.
  const [advancedMode, setAdvancedMode] = useState(false);

  // Tickers the user has pinned to chart in the terminal view (Advanced Mode only).
  const [chartTickers, setChartTickers] = useState([]);
  const [newChartTicker, setNewChartTicker] = useState('');
  // Which ticker the terminal's big chart is currently showing, which left-rail tab is active,
  // and whether that rail is collapsed — same collapse pattern as the app's own Sidebar.
  const [terminalTicker, setTerminalTicker] = useState(null);
  const [terminalTab, setTerminalTab] = useState('watchlist');
  const terminalRailCollapsed = false;
  const [layoutMode, setLayoutMode] = useState('1');
  const [slotTickers, setSlotTickers] = useState(['AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'META', 'GOOGL', 'NFLX']);
  const [activeSlot, setActiveSlot] = useState(0);
  const [slotRanges, setSlotRanges] = useState(['1w', '1w', '1w', '1w', '1w', '1w', '1w', '1w']);
  const [slotModes, setSlotModes] = useState(['line', 'line', 'line', 'line', 'line', 'line', 'line', 'line']);

  const handleRangeChange = (newRange) => {
    setSlotRanges(prev => {
      const next = [...prev];
      next[activeSlot] = newRange;
      try { localStorage.setItem('traqcker_slot_ranges', JSON.stringify(next)); } catch (e) {}
      return next;
    });
  };

  const handleModeChange = (newMode) => {
    setSlotModes(prev => {
      const next = [...prev];
      next[activeSlot] = newMode;
      try { localStorage.setItem('traqcker_slot_modes', JSON.stringify(next)); } catch (e) {}
      return next;
    });
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem('traqcker_widget_visibility');
      if (saved) {
        setWidgetVisibility(prev => ({ ...prev, ...JSON.parse(saved) }));
      }
      const savedAdvanced = localStorage.getItem('traqcker_advanced_mode');
      if (savedAdvanced) setAdvancedMode(savedAdvanced === 'true');
      const savedCharts = localStorage.getItem('traqcker_chart_tickers');
      if (savedCharts) setChartTickers(JSON.parse(savedCharts));
      const savedLayout = localStorage.getItem('traqcker_layout_mode');
      if (savedLayout) setLayoutMode(savedLayout);
      const savedSlots = localStorage.getItem('traqcker_slot_tickers');
      if (savedSlots) setSlotTickers(JSON.parse(savedSlots));
      const savedRanges = localStorage.getItem('traqcker_slot_ranges');
      if (savedRanges) setSlotRanges(JSON.parse(savedRanges));
      const savedModes = localStorage.getItem('traqcker_slot_modes');
      if (savedModes) setSlotModes(JSON.parse(savedModes));
    } catch (e) {}
  }, []);

  // Advanced Mode's toggle lives in the sidebar footer (Sidebar.js), not on this page —
  // it writes to the same localStorage key and dispatches this event so the terminal can
  // appear/disappear live without a reload while already on Home.
  useEffect(() => {
    const handler = (e) => setAdvancedMode(e.detail);
    window.addEventListener('traqcker-advanced-mode-changed', handler);
    return () => window.removeEventListener('traqcker-advanced-mode-changed', handler);
  }, []);

  const changeLayoutMode = (mode) => {
    setLayoutMode(mode);
    try { localStorage.setItem('traqcker_layout_mode', mode); } catch (e) {}
  };

  const updateSlotTicker = (slotIdx, ticker) => {
    setSlotTickers(prev => {
      const updated = [...prev];
      updated[slotIdx] = ticker;
      try { localStorage.setItem('traqcker_slot_tickers', JSON.stringify(updated)); } catch (e) {}
      return updated;
    });
  };

  const selectTerminalTicker = (ticker) => {
    setTerminalTicker(ticker);
    updateSlotTicker(activeSlot, ticker);
  };

  const toggleWidget = (id) => {
    setWidgetVisibility(prev => {
      const updated = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem('traqcker_widget_visibility', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  const addChartTicker = (e) => {
    e.preventDefault();
    const t = newChartTicker.toUpperCase().trim();
    if (!t || chartTickers.includes(t) || chartTickers.length >= MAX_CHART_TICKERS) return;
    const updated = [...chartTickers, t];
    setChartTickers(updated);
    try { localStorage.setItem('traqcker_chart_tickers', JSON.stringify(updated)); } catch (e) {}
    setNewChartTicker('');
    selectTerminalTicker(t);
  };

  const removeChartTicker = (ticker) => {
    const updated = chartTickers.filter(t => t !== ticker);
    setChartTickers(updated);
    try { localStorage.setItem('traqcker_chart_tickers', JSON.stringify(updated)); } catch (e) {}
  };

  // Responsive layout columns detector: 1 (<1024px), 2 (1024px-1600px), 3 (>1600px)
  const [columns, setColumns] = useState(1);
  useEffect(() => {
    const check = () => {
      const w = window.innerWidth;
      if (w < 1024) setColumns(1);
      else if (w < 1600) setColumns(2);
      else setColumns(3);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  const isMobile = columns === 1;

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
  const [stockDetails, setStockDetails] = useState({}); // ticker -> full stock api data
  const [txCurrency, setTxCurrency] = useState('USD');
  const [portfolioTab, setPortfolioTab] = useState('pies'); // Default to 'pies' view for cleaner collapsed list
  const [currency, setCurrency] = useState('USD');
  const { rates: fxRates, toUSD } = useCurrencyRates();

  useEffect(() => {
    const saved = localStorage.getItem('portfolio_currency');
    if (saved && CURRENCIES[saved]) setCurrency(saved);
  }, []);

  const changeCurrency = (c) => { setCurrency(c); localStorage.setItem('portfolio_currency', c); };
  const fxRate = currency === 'USD' ? 1 : (fxRates[currency] || 1);
  const currencySymbol = CURRENCIES[currency];

  // Widget States — movers still feeds the top marquee ticker even though the Market
  // Intelligence widget that used to also read from it was cut (see WIDGET_ORDER above).
  const [movers, setMovers] = useState(null);
  const [marqueeMode, setMarqueeMode] = useState('gainers'); // 'gainers' | 'losers' | 'bigCapMovers'
  const [watchlist, setWatchlist] = useState([]);
  const [recentViewed, setRecentViewed] = useState([]);
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
    // 1. Fetch movers — feeds the top marquee ticker
    fetch('/api/movers')
      .then(r => r.json())
      .then(setMovers);

    // 2. Fetch watchlist from Supabase
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

  // Keep the "LIVE" data fresh: re-poll indices, movers and market news every 3min.
  // Skipped while the tab is in the background, and re-run immediately on becoming
  // visible again, to avoid burning Supabase egress on idle background tabs.
  useEffect(() => {
    const refreshLiveData = () => {
      if (document.visibilityState !== 'visible') return;
      fetch('/api/movers').then(r => r.json()).then(setMovers).catch(() => {});
      fetch('/api/market').then(r => r.json()).then(d => { if (d.markets) setIndices(d.markets); }).catch(() => {});
      fetch('/api/filings').then(r => r.json()).then(d => { if (d.filings) setSecFeed(d.filings); }).catch(() => {});
    };
    const interval = setInterval(refreshLiveData, 180000);
    document.addEventListener('visibilitychange', refreshLiveData);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', refreshLiveData);
    };
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

  // Every ticker we need a live price/day-change quote for — portfolio, watchlist, recently
  // viewed, AND the terminal's pinned chart tickers — so both the Coverage Workspace table and
  // the Advanced Mode ticker rail can show price/today without a separate fetch per widget.
  const quoteTickers = useMemo(() => {
    return [...new Set([...newsTickers, ...recentViewed, ...chartTickers, terminalTicker, ...slotTickers].filter(Boolean))];
  }, [newsTickers, recentViewed, chartTickers, terminalTicker, slotTickers]);

  // Pick a sensible default for the terminal's big chart the first time there's anything to
  // show — watchlist first (most intentional signal), then pinned charts, then a holding.
  useEffect(() => {
    if (terminalTicker) return;
    const first = watchlist[0]?.ticker || chartTickers[0] || activeTickers[0];
    if (first) setTerminalTicker(first);
  }, [watchlist, chartTickers, activeTickers, terminalTicker]);

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
          .then(data => ({ ticker, data }))
          .catch(() => ({ ticker, data: null }))
      )
    ).then(results => {
      const priceMap = {};
      const changeMap = {};
      const detailMap = {};
      results.forEach(r => {
        if (r.data) {
          detailMap[r.ticker] = r.data;
          if (r.data.currentPrice !== null) priceMap[r.ticker] = r.data.currentPrice;
          if (r.data.priceChangePct !== null && r.data.priceChangePct !== undefined) changeMap[r.ticker] = r.data.priceChangePct;
        }
      });
      setPrices(prev => ({ ...prev, ...priceMap }));
      setDayChanges(prev => ({ ...prev, ...changeMap }));
      setStockDetails(prev => ({ ...prev, ...detailMap }));
      setPricesLoading(false);
    });
  };

  useEffect(() => {
    fetchQuotes(quoteTickers);
  }, [quoteTickers]);

  // Keep holding/watchlist prices reasonably live — mirrors the movers/market/filings poll above.
  // Same visibility-aware pausing: no point re-fetching a per-ticker quote for every
  // holding/watchlist/recent ticker while the tab isn't even in view.
  useEffect(() => {
    if (quoteTickers.length === 0) return;
    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      fetchQuotes(quoteTickers, { refresh: true });
    };
    const interval = setInterval(refresh, 180000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [quoteTickers]);

  // Uniform display holdings: [{ ticker, shares, avgPrice, pie, costCurrency, avgPriceUSD }]
  const displayHoldings = useMemo(() => {
    if (isSignedIn) {
      const byKey = {};
      holdings.forEach(h => {
        const key = `${h.ticker}-${h.pie || ''}`;
        const p = byKey[key] ||= { ticker: h.ticker, shares: 0, cost: 0, costUSD: 0, pie: h.pie || '', costCurrency: h.cost_basis_currency || 'USD' };
        p.shares += Number(h.shares);
        p.cost += Number(h.shares) * Number(h.cost_basis);
        p.costUSD += Number(h.shares) * toUSD(Number(h.cost_basis), h.cost_basis_currency || 'USD');
      });
      return Object.values(byKey).map(p => ({
        ticker: p.ticker,
        shares: p.shares,
        avgPrice: p.cost / p.shares,
        avgPriceUSD: p.costUSD / p.shares,
        pie: p.pie,
        costCurrency: p.costCurrency
      }));
    } else {
      return portfolio.map(p => ({
        ...p,
        avgPriceUSD: toUSD(p.avgPrice, p.costCurrency || 'USD'),
        costCurrency: p.costCurrency || 'USD'
      }));
    }
  }, [holdings, portfolio, isSignedIn, fxRates]);

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
        const priceCurrency = stockDetails[item.ticker]?.currency || 'USD';
        const priceNative = prices[item.ticker] ?? item.avgPrice;
        const currentPriceUSD = toUSD(priceNative, priceCurrency);
        const avgPriceUSD = item.avgPriceUSD ?? toUSD(item.avgPrice, item.costCurrency);
        cost += item.shares * avgPriceUSD;
        val += item.shares * currentPriceUSD;
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
  }, [displayHoldings, prices, stockDetails, fxRates]);

  // Record a daily portfolio snapshot from Home too — not just /portfolio — so the growth
  // chart keeps accumulating points even for users who only ever look at the dashboard.
  const homeTotals = useMemo(() => {
    let cost = 0, value = 0;
    displayHoldings.forEach(item => {
      const priceCurrency = stockDetails[item.ticker]?.currency || 'USD';
      const priceNative = prices[item.ticker];
      const currentPriceUSD = toUSD(priceNative, priceCurrency);
      const avgPriceUSD = item.avgPriceUSD ?? toUSD(item.avgPrice, item.costCurrency);
      cost += item.shares * avgPriceUSD;
      value += item.shares * (currentPriceUSD ?? avgPriceUSD);
    });
    return { cost, value };
  }, [displayHoldings, prices, stockDetails, fxRates]);

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
          pie: pieTrimmed,
          costBasisCurrency: txCurrency
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
        newPort = portfolio.map(p => (p.ticker === tickUpper && (p.pie || '') === pieTrimmed) ? { ...p, shares: newShares, avgPrice: parseFloat(newAvg.toFixed(2)), costCurrency: p.costCurrency || txCurrency } : p);
      } else {
        newPort = [...portfolio, { ticker: tickUpper, shares: parsedShares, avgPrice: parsedPrice, pie: pieTrimmed, costCurrency: txCurrency }];
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

  // Widget Renderers
  const renderIndices = () => {
    if (indicesLoading) {
      return (
        <Card title="Major Indices Overview" subtitle="Key market benchmarks & volatility index.">
          <div className="p-[30px] text-center text-ws-text-3 text-xs">
            Loading market benchmarks...
          </div>
        </Card>
      );
    }

    if (indices.length === 0) {
      return (
        <Card title="Major Indices Overview" subtitle="Key market benchmarks & volatility index.">
          <div className="p-[30px] text-center text-ws-text-3 text-xs">
            Indices data currently unavailable.
          </div>
        </Card>
      );
    }

    return (
      <Card
        title="Major Indices Overview"
        subtitle="Key market benchmarks & volatility index."
      >
        <div className="widget-indices-grid" style={{ padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
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
      >
        {activeWorkspaceTab === 'watchlist' ? (
          <div className="flex flex-col">
            {watchlist.length === 0 ? (
              <div className="px-5 py-10 text-center text-ws-text-3 text-[13px]">
                Your watchlist is empty. Go to a stock page and save it.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-ws-border bg-black/[0.01]">
                      <th className="px-[18px] py-2.5 text-left font-semibold text-ws-text-3 text-[10px]">TICKER</th>
                      <th className="px-[18px] py-2.5 text-right font-semibold text-ws-text-3 text-[10px]">PRICE</th>
                      <th className="px-[18px] py-2.5 text-right font-semibold text-ws-text-3 text-[10px]">TODAY</th>
                      <th className="px-[18px] py-2.5 text-right font-semibold text-ws-text-3 text-[10px]" title="Core Business Score · ROIC · Margins · Liquidity">CBS</th>
                      <th className="px-[18px] py-2.5 text-right font-semibold text-ws-text-3 text-[10px]" title="Opportunity Score · P/FCF · FCF Yield">OPPO</th>
                      <th className="px-[18px] py-2.5 text-right font-semibold text-ws-text-3 text-[10px]" title="Growth Quality Score · Revenue · R&D · SBC">GQS</th>
                      <th className="px-[18px] py-2.5 text-right font-semibold text-ws-text-3 text-[10px]" title="Final Note · Traqcker Score · Weighted composite (CBS 45% · OPPO 30% · GQS 25% · Moat ±20%)">QUALITY</th>
                      <th className="px-[18px] py-2.5 text-left font-semibold text-ws-text-3 text-[10px]">ADDED</th>
                      <th className="px-[18px] py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {watchlist.map(item => {
                      const price = prices[item.ticker];
                      const changePct = dayChanges[item.ticker];
                      const hasChange = changePct != null;
                      const detail = stockDetails[item.ticker];
                      const easyMode = detail ? computeEasyMode(detail, hasFundamentals(detail)) : null;
                      return (
                        <tr key={item.ticker} onClick={() => openInNewTab(`/stock/${item.ticker}`)}
                          className="border-b border-ws-border cursor-pointer transition-[background] duration-150"
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--ws-bg-2)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <td className="px-[18px] py-2.5 flex items-center gap-2 font-semibold text-ws-text">
                            <StockLogo ticker={item.ticker} name={item.ticker} size={20} />
                            {item.ticker}
                          </td>
                          <td className="px-[18px] py-2.5 text-right font-semibold text-ws-text">
                            {price != null ? formatCurrency(price, CURRENCIES[stockDetails[item.ticker]?.currency] || stockDetails[item.ticker]?.currency) : '—'}
                          </td>
                          <td style={{ padding: '10px 18px', textAlign: 'right', fontWeight: 700, color: hasChange ? (changePct >= 0 ? '#10b981' : 'var(--ws-red)') : 'var(--ws-text-3)' }}>
                            {hasChange ? `${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%` : '—'}
                          </td>
                          <td style={{ padding: '10px 18px', textAlign: 'right', fontWeight: 600, color: easyMode ? scoreColor(easyMode.cbs) : 'var(--ws-text-3)' }}>
                            {easyMode ? Math.round(easyMode.cbs * 20) : '—'}
                          </td>
                          <td style={{ padding: '10px 18px', textAlign: 'right', fontWeight: 600, color: easyMode ? scoreColor(easyMode.oppo) : 'var(--ws-text-3)' }}>
                            {easyMode ? Math.round(easyMode.oppo * 20) : '—'}
                          </td>
                          <td style={{ padding: '10px 18px', textAlign: 'right', fontWeight: 600, color: easyMode ? scoreColor(easyMode.gqs) : 'var(--ws-text-3)' }}>
                            {easyMode ? Math.round(easyMode.gqs * 20) : '—'}
                          </td>
                          <td style={{ padding: '10px 18px', textAlign: 'right', fontWeight: 700, color: easyMode ? easyMode.verdictColor : 'var(--ws-text-3)' }} title={easyMode ? easyMode.verdict : 'Not enough fundamentals yet'}>
                            {easyMode ? easyMode.score100 : '—'}
                          </td>
                          <td style={{ padding: '10px 18px', color: 'var(--ws-text-3)' }}>
                            {new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </td>
                          <td className="px-[18px] py-2.5 text-right font-semibold text-ws-accent">
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
          <div className="flex flex-col">
            {recentViewed.length === 0 ? (
              <div className="px-5 py-10 text-center text-ws-text-3 text-[13px]">
                No recently viewed stocks. Tickers will appear here as you search.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-ws-border bg-black/[0.01]">
                      <th className="px-[18px] py-2.5 text-left font-semibold text-ws-text-3 text-[10px]">TICKER</th>
                      <th className="px-[18px] py-2.5 text-right font-semibold text-ws-text-3 text-[10px]">PRICE</th>
                      <th className="px-[18px] py-2.5 text-right font-semibold text-ws-text-3 text-[10px]">TODAY</th>
                      <th className="px-[18px] py-2.5 text-right font-semibold text-ws-text-3 text-[10px]" title="Core Business Score · ROIC · Margins · Liquidity">CBS</th>
                      <th className="px-[18px] py-2.5 text-right font-semibold text-ws-text-3 text-[10px]" title="Opportunity Score · P/FCF · FCF Yield">OPPO</th>
                      <th className="px-[18px] py-2.5 text-right font-semibold text-ws-text-3 text-[10px]" title="Growth Quality Score · Revenue · R&D · SBC">GQS</th>
                      <th className="px-[18px] py-2.5 text-right font-semibold text-ws-text-3 text-[10px]" title="Final Note · Traqcker Score · Weighted composite (CBS 45% · OPPO 30% · GQS 25% · Moat ±20%)">QUALITY</th>
                      <th className="px-[18px] py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {recentViewed.map(ticker => {
                      const price = prices[ticker];
                      const changePct = dayChanges[ticker];
                      const hasChange = changePct != null;
                      const detail = stockDetails[ticker];
                      const easyMode = detail ? computeEasyMode(detail, hasFundamentals(detail)) : null;
                      return (
                        <tr key={ticker} onClick={() => openInNewTab(`/stock/${ticker}`)}
                          className="border-b border-ws-border cursor-pointer transition-[background] duration-150"
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--ws-bg-2)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <td className="px-[18px] py-2.5 flex items-center gap-2 font-semibold text-ws-text">
                            <StockLogo ticker={ticker} name={ticker} size={20} />
                            {ticker}
                          </td>
                          <td className="px-[18px] py-2.5 text-right font-semibold text-ws-text">
                            {price != null ? formatCurrency(price, CURRENCIES[stockDetails[ticker]?.currency] || stockDetails[ticker]?.currency) : '—'}
                          </td>
                          <td style={{ padding: '10px 18px', textAlign: 'right', fontWeight: 700, color: hasChange ? (changePct >= 0 ? '#10b981' : 'var(--ws-red)') : 'var(--ws-text-3)' }}>
                            {hasChange ? `${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%` : '—'}
                          </td>
                          <td style={{ padding: '10px 18px', textAlign: 'right', fontWeight: 600, color: easyMode ? scoreColor(easyMode.cbs) : 'var(--ws-text-3)' }}>
                            {easyMode ? Math.round(easyMode.cbs * 20) : '—'}
                          </td>
                          <td style={{ padding: '10px 18px', textAlign: 'right', fontWeight: 600, color: easyMode ? scoreColor(easyMode.oppo) : 'var(--ws-text-3)' }}>
                            {easyMode ? Math.round(easyMode.oppo * 20) : '—'}
                          </td>
                          <td style={{ padding: '10px 18px', textAlign: 'right', fontWeight: 600, color: easyMode ? scoreColor(easyMode.gqs) : 'var(--ws-text-3)' }}>
                            {easyMode ? Math.round(easyMode.gqs * 20) : '—'}
                          </td>
                          <td style={{ padding: '10px 18px', textAlign: 'right', fontWeight: 700, color: easyMode ? easyMode.verdictColor : 'var(--ws-text-3)' }} title={easyMode ? easyMode.verdict : 'Not enough fundamentals yet'}>
                            {easyMode ? easyMode.score100 : '—'}
                          </td>
                          <td className="px-[18px] py-2.5 text-right font-semibold text-ws-accent">
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
      const priceCurrency = stockDetails[item.ticker]?.currency || 'USD';
      const priceNative = prices[item.ticker] ?? item.avgPrice;
      const currentPriceUSD = toUSD(priceNative, priceCurrency);
      const avgPriceUSD = item.avgPriceUSD ?? toUSD(item.avgPrice, item.costCurrency);
      
      const changePct = dayChanges[item.ticker];
      totalCost += item.shares * avgPriceUSD;
      totalValue += item.shares * currentPriceUSD;
      if (changePct != null) {
        totalTodayChange += item.shares * currentPriceUSD * (changePct / 100);
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
      : displayHoldings.map(item => {
          const priceCurrency = stockDetails[item.ticker]?.currency || 'USD';
          const priceNative = prices[item.ticker] ?? item.avgPrice;
          const currentPriceUSD = toUSD(priceNative, priceCurrency);
          return {
            name: item.ticker,
            value: item.shares * currentPriceUSD
          };
        }).filter(s => s.value > 0).sort((a, b) => b.value - a.value);
    const hasHoldings = chartData.length > 0;

    // Every individual position, ranked by market value — always visible, no clicking required
    const sortedHoldings = displayHoldings
      .map(item => {
        const priceCurrency = stockDetails[item.ticker]?.currency || 'USD';
        const priceNative = prices[item.ticker] ?? item.avgPrice;
        const currentPriceUSD = toUSD(priceNative, priceCurrency);
        const valueUSD = item.shares * currentPriceUSD;
        const costUSD = item.shares * (item.avgPriceUSD ?? toUSD(item.avgPrice, item.costCurrency));
        const ret = valueUSD - costUSD;
        const retPct = costUSD > 0 ? (ret / costUSD) * 100 : 0;
        return {
          ...item,
          currentPrice: priceNative,
          priceCurrency,
          value: valueUSD,
          ret,
          retPct,
          changePct: dayChanges[item.ticker]
        };
      })
      .sort((a, b) => b.value - a.value);

    return (
      <Card
        title="Equity Portfolio"
        subtitle={isSignedIn ? "Real-time holdings synced with your database." : "Track your mock trades & performance."}
        rightElement={
          <div className="flex items-center gap-2">
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
      >
        <div className="widget-portfolio-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '16px' }}>
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
              <span>ℹ️ Using local portfolio. Sign in to sync.</span>
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
          <div className="home-portfolio-summary" style={{
            display: 'grid',
            background: 'var(--ws-bg-2)',
            border: '1px solid var(--ws-border)'
          }}>
            <div className="home-portfolio-summary-item">
              <div className="text-[10px] text-ws-text-3 font-bold uppercase">
                Portfolio Value
              </div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '17px', fontWeight: 800, color: 'var(--ws-text)', marginTop: '2px' }}>
                {currencySymbol}{(totalValue * fxRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="home-portfolio-summary-item">
              <div className="text-[10px] text-ws-text-3 font-bold uppercase">
                Today
              </div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', fontWeight: 700, color: todayPositive ? '#10b981' : 'var(--ws-red)', marginTop: '4px' }}>
                {todayPositive ? '+' : '-'} {currencySymbol}{Math.abs(totalTodayChange * fxRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({totalTodayPct.toFixed(2)}%)
              </div>
            </div>
            <div className="home-portfolio-summary-item">
              <div className="text-[10px] text-ws-text-3 font-bold uppercase">
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
              <div className="overflow-x-auto">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <thead>
                    <tr style={{ background: 'rgba(0,0,0,0.01)', borderBottom: '1px solid var(--ws-border)' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--ws-text-3)', fontSize: '9px' }}>POSITION</th>
                      <th className="px-3 py-2 text-right font-semibold text-ws-text-3 text-[9px]">SHARES</th>
                      <th className="px-3 py-2 text-right font-semibold text-ws-text-3 text-[9px]">AVG COST</th>
                      <th className="px-3 py-2 text-right font-semibold text-ws-text-3 text-[9px]">PRICE</th>
                      <th className="px-3 py-2 text-right font-semibold text-ws-text-3 text-[9px]">TODAY</th>
                      <th className="px-3 py-2 text-right font-semibold text-ws-text-3 text-[9px]">VALUE</th>
                      <th className="px-3 py-2 text-right font-semibold text-ws-text-3 text-[9px]">RETURN</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedHoldings.map((item, idx) => {
                      const itemPositive = item.ret >= 0;
                      const hasChange = item.changePct != null;
                      const changePositive = hasChange && item.changePct >= 0;
                      return (
                        <tr key={item.ticker + (item.pie || '') + idx}
                          onClick={() => openInNewTab(`/stock/${item.ticker}`)}
                          style={{ borderBottom: idx === sortedHoldings.length - 1 ? 'none' : '1px solid var(--ws-border)', cursor: 'pointer', transition: 'background 0.15s' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--ws-bg-2)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
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
                          <td className="px-3 py-2 text-right text-ws-text-2">{item.shares}</td>
                          {/* Avg cost / price stay in their native trading currency (USD here) — only
                              aggregate value/gain figures convert to the selected reporting currency,
                              same behavior as the dedicated /portfolio page. */}
                          <td className="px-3 py-2 text-right text-ws-text-2">{formatCurrency(item.avgPrice, CURRENCIES[item.costCurrency] || item.costCurrency)}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--ws-text)', fontWeight: 600 }}>{formatCurrency(item.currentPrice, CURRENCIES[item.priceCurrency] || item.priceCurrency)}</td>
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
              <div className="home-portfolio-trade-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                <div>
                  <label className="text-[9px] text-ws-text-3 font-bold uppercase">Ticker</label>
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
                  <label className="text-[9px] text-ws-text-3 font-bold uppercase">Shares</label>
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
                  <div style={{ fontSize: '9px', color: 'var(--ws-text-3)', fontWeight: 700, textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Avg Cost</span>
                    <select
                      value={txCurrency}
                      onChange={e => setTxCurrency(e.target.value)}
                      style={{
                        fontSize: '9px',
                        fontWeight: 700,
                        color: 'var(--ws-accent)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        outline: 'none'
                      }}
                    >
                      {Object.keys(CURRENCIES).map(c => (
                        <option key={c} value={c} style={{ background: 'var(--ws-bg-1)', color: 'var(--ws-text)' }}>{c}</option>
                      ))}
                    </select>
                  </div>
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
                  <label className="text-[9px] text-ws-text-3 font-bold uppercase">Pie (Optional)</label>
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



  const renderSecFeed = () => {
    const activeFeed = (newsTab === 'holdings' ? holdingsNews : secFeed).slice(0, 12);
    const activeLoading = newsTab === 'holdings' ? holdingsNewsLoading : secFeedLoading;

    return (
      <Card
        title="Market News"
        subtitle="Stock & ETF headlines, ranked by relevance."
      >
        {/* Widget Tabs */}
        <div className="flex border-b border-ws-border bg-black/[0.01]">
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
          <div className="p-[30px] text-center text-ws-text-3 text-xs">
            Loading {newsTab === 'holdings' ? 'holdings' : 'market'} news...
          </div>
        ) : activeFeed.length === 0 ? (
          <div className="p-[30px] text-center text-ws-text-3 text-xs">
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
      </Card>
    );
  };

  const renderLeaders = () => {
    if (!movers) {
      return (
        <Card title="Fundamental Leaders" subtitle="Top 10 high-scoring stocks.">
          <div className="p-[30px] text-center text-ws-text-3 text-xs">
            Loading leaders data...
          </div>
        </Card>
      );
    }

    const top10 = movers.topScore || [];

    return (
      <Card
        title="Fundamental Leaders"
        subtitle="Top 10 highest-rated companies by Traqcker Score."
        rightElement={
          <Link href="/radar/leaders" style={{ fontSize: '10px', fontWeight: 700, color: 'var(--ws-accent)', textDecoration: 'none' }}>
            See Top 100 →
          </Link>
        }
      >
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full border-collapse text-xs text-left">
            <thead>
              <tr className="border-b border-ws-border bg-black/[0.01]">
                <th className="px-[18px] py-2.5 font-semibold text-ws-text-3 text-[10px]">RANK</th>
                <th className="px-[18px] py-2.5 font-semibold text-ws-text-3 text-[10px]">TICKER</th>
                <th className="px-[18px] py-2.5 text-right font-semibold text-ws-text-3 text-[10px]">SCORE</th>
                <th className="px-[18px] py-2.5 text-right font-semibold text-ws-text-3 text-[10px]">QUALITY</th>
                <th className="px-[18px] py-2.5 text-right font-semibold text-ws-text-3 text-[10px]">OPPO</th>
                <th className="px-[18px] py-2.5 text-right font-semibold text-ws-text-3 text-[10px]">GROWTH</th>
              </tr>
            </thead>
            <tbody>
              {top10.map((s, index) => (
                <tr
                  key={s.ticker}
                  onClick={() => openInNewTab(`/stock/${s.ticker}`)}
                  className="border-b border-ws-border cursor-pointer transition-[background] duration-150"
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--ws-bg-2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td className="px-[18px] py-2.5 font-bold text-ws-text-3" style={{ color: index < 3 ? 'var(--ws-accent)' : 'inherit' }}>
                    #{index + 1}
                  </td>
                  <td className="px-[18px] py-2.5 font-semibold text-ws-text">
                    {s.ticker}
                  </td>
                  <td className="px-[18px] py-2.5 text-right font-bold text-ws-accent">
                    {s.score ? `${Math.round(s.score * 20)}/100` : '—'}
                  </td>
                  <td className="px-[18px] py-2.5 text-right font-semibold text-ws-text">
                    {s.cbs ? `${Math.round(s.cbs * 20)}/100` : '—'}
                  </td>
                  <td className="px-[18px] py-2.5 text-right font-semibold text-ws-text">
                    {s.oppo ? `${Math.round(s.oppo * 20)}/100` : '—'}
                  </td>
                  <td className="px-[18px] py-2.5 text-right font-semibold text-ws-text">
                    {s.gqs ? `${Math.round(s.gqs * 20)}/100` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    );
  };

  const renderWidget = (id) => {
    switch (id) {
      case 'indices': return renderIndices();
      case 'portfolio': return renderPortfolio();
      case 'workspace': return renderWorkspace();
      case 'secFeed': return renderSecFeed();
      case 'leaders': return renderLeaders();
      default: return null;
    }
  };

  const visibleIds = useMemo(() => {
    return WIDGET_ORDER.filter(id => widgetVisibility[id] !== false);
  }, [widgetVisibility]);

  const layoutColumns = useMemo(() => {
    const colsCount = columns; // 1, 2, or 3
    const cols = Array.from({ length: colsCount }, () => []);

    if (colsCount === 1) {
      visibleIds.forEach(id => cols[0].push(id));
    } else if (colsCount === 2) {
      visibleIds.forEach(id => {
        if (id === 'indices' || id === 'portfolio' || id === 'workspace') {
          cols[0].push(id);
        } else {
          cols[1].push(id);
        }
      });
    } else {
      // 3 columns
      visibleIds.forEach(id => {
        if (id === 'indices' || id === 'portfolio') {
          cols[0].push(id);
        } else if (id === 'workspace') {
          cols[1].push(id);
        } else {
          cols[2].push(id);
        }
      });
    }

    return cols.filter(c => c.length > 0);
  }, [visibleIds, columns]);

  const renderTerminal = () => {
    if (!terminalTicker) {
      return (
        <div style={{
          textAlign: 'center',
          padding: '80px 24px',
          border: '1px dashed var(--ws-border)',
          borderRadius: '0px',
          color: 'var(--ws-text-3)',
          background: 'var(--ws-bg-1)',
          fontSize: '13px'
        }}>
          No ticker selected. Add a ticker or select from your watchlist to load the terminal.
        </div>
      );
    }

    // Determine the list of tickers for the active rail tab
    let railTickers = [];
    if (terminalTab === 'watchlist') {
      railTickers = watchlist.map(w => w.ticker);
    } else if (terminalTab === 'portfolio') {
      railTickers = activeTickers;
    } else {
      railTickers = chartTickers;
    }

    // No pagination — the list scrolls internally and always fills the rail's height,
    // instead of capping at a page size and leaving dead space below a short list.
    const displayedTickers = railTickers;

    const detailData = stockDetails[terminalTicker];
    const easyMode = detailData ? computeEasyMode(detailData, hasFundamentals(detailData)) : null;
    const userHolding = displayHoldings.find(h => h.ticker === terminalTicker);

    const isSmallScreen = columns === 1;
    const isMediumScreen = columns === 2;

    const LAYOUTS = [
      { id: '1', label: '1 Chart', svg: (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <rect x="0" y="0" width="12" height="12" />
        </svg>
      ) },
      { id: '2c', label: '2 Columns', svg: (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <rect x="0" y="0" width="5" height="12" />
          <rect x="7" y="0" width="5" height="12" />
        </svg>
      ) },
      { id: '2r', label: '2 Rows', svg: (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <rect x="0" y="0" width="12" height="5" />
          <rect x="0" y="7" width="12" height="5" />
        </svg>
      ) },
      { id: '3c', label: '3 Columns', svg: (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <rect x="0" y="0" width="3" height="12" />
          <rect x="4.5" y="0" width="3" height="12" />
          <rect x="9" y="0" width="3" height="12" />
        </svg>
      ) },
      { id: '3r', label: '3 Rows', svg: (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <rect x="0" y="0" width="12" height="3" />
          <rect x="0" y="4.5" width="12" height="3" />
          <rect x="0" y="9" width="12" height="3" />
        </svg>
      ) },
      { id: '4g', label: '4 Grid', svg: (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <rect x="0" y="0" width="5" height="5" />
          <rect x="7" y="0" width="5" height="5" />
          <rect x="0" y="7" width="5" height="5" />
          <rect x="7" y="7" width="5" height="5" />
        </svg>
      ) },
      { id: '3l', label: 'Left/Right Split', svg: (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <rect x="0" y="0" width="5" height="12" />
          <rect x="7" y="0" width="5" height="5" />
          <rect x="7" y="7" width="5" height="5" />
        </svg>
      ) },
      { id: '3t', label: 'Top/Bottom Split', svg: (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <rect x="0" y="0" width="12" height="5" />
          <rect x="0" y="7" width="5" height="5" />
          <rect x="7" y="7" width="5" height="5" />
        </svg>
      ) },
      { id: '5g', label: '5 Grid', svg: (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <rect x="0" y="0" width="5" height="5" />
          <rect x="7" y="0" width="5" height="5" />
          <rect x="0" y="7" width="3.2" height="5" />
          <rect x="4.4" y="7" width="3.2" height="5" />
          <rect x="8.8" y="7" width="3.2" height="5" />
        </svg>
      ) },
      { id: '6g', label: '6 Grid', svg: (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <rect x="0" y="0" width="3.2" height="5" />
          <rect x="4.4" y="0" width="3.2" height="5" />
          <rect x="8.8" y="0" width="3.2" height="5" />
          <rect x="0" y="7" width="3.2" height="5" />
          <rect x="4.4" y="7" width="3.2" height="5" />
          <rect x="8.8" y="7" width="3.2" height="5" />
        </svg>
      ) },
      { id: '7g', label: '7 Grid', svg: (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <rect x="0" y="0" width="3.2" height="5" />
          <rect x="4.4" y="0" width="3.2" height="5" />
          <rect x="8.8" y="0" width="3.2" height="5" />
          <rect x="0" y="7" width="2.2" height="5" />
          <rect x="3.2" y="7" width="2.2" height="5" />
          <rect x="6.4" y="7" width="2.2" height="5" />
          <rect x="9.6" y="7" width="2.2" height="5" />
        </svg>
      ) },
      { id: '8g', label: '8 Grid', svg: (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <rect x="0" y="0" width="2.2" height="5" />
          <rect x="3.2" y="0" width="2.2" height="5" />
          <rect x="6.4" y="0" width="2.2" height="5" />
          <rect x="9.6" y="0" width="2.2" height="5" />
          <rect x="0" y="7" width="2.2" height="5" />
          <rect x="3.2" y="7" width="2.2" height="5" />
          <rect x="6.4" y="7" width="2.2" height="5" />
          <rect x="9.6" y="7" width="2.2" height="5" />
        </svg>
      ) }
    ];

    const renderChartSlot = (slotIdx, extraStyles = {}) => {
      const slotTicker = slotTickers[slotIdx] || terminalTicker || 'AAPL';
      const isActive = activeSlot === slotIdx;
      const slotData = stockDetails[slotTicker];

      // Calculate layout-specific chart height to prevent overflows
      let chartHeight = 450; // Default height for 1 chart
      if (layoutMode === '2r') {
        chartHeight = 220;
      } else if (layoutMode === '3r') {
        chartHeight = 110;
      } else if (layoutMode === '4g' || layoutMode === '5g' || layoutMode === '6g' || layoutMode === '7g' || layoutMode === '8g') {
        chartHeight = 200;
      } else if (layoutMode === '3l') {
        chartHeight = slotIdx === 0 ? 450 : 200;
      } else if (layoutMode === '3t') {
        chartHeight = slotIdx === 0 ? 240 : 180;
      }

      return (
        <div
          key={slotIdx}
          onClick={() => {
            setActiveSlot(slotIdx);
            setTerminalTicker(slotTicker);
          }}
          style={{
            flex: 1,
            minWidth: 0,
            background: 'var(--ws-bg-1)',
            border: isActive ? '2px solid var(--ws-accent)' : '1px solid var(--ws-border)',
            borderRadius: '0px',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            cursor: 'pointer',
            position: 'relative',
            ...extraStyles
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <StockLogo ticker={slotTicker} size={20} />
              <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--ws-text)' }}>{slotTicker}</span>
            </div>
          </div>
          <div style={{ flex: 1, position: 'relative', minHeight: `${chartHeight}px` }}>
            <StockChart
              ticker={slotTicker}
              currency={currency}
              height={chartHeight}
              isMultichart={true}
              range={slotRanges[slotIdx]}
              mode={slotModes[slotIdx]}
            />
          </div>
        </div>
      );
    };

    const renderChartsLayout = () => {
      if (layoutMode === '1') {
        return (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px', height: '100%' }}>
            {renderChartSlot(0)}
          </div>
        );
      }
      if (layoutMode === '2c') {
        return (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', height: '100%' }}>
            {renderChartSlot(0)}
            {renderChartSlot(1)}
          </div>
        );
      }
      if (layoutMode === '2r') {
        return (
          <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', gap: '10px', height: '100%' }}>
            {renderChartSlot(0)}
            {renderChartSlot(1)}
          </div>
        );
      }
      if (layoutMode === '3c') {
        return (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', height: '100%' }}>
            {renderChartSlot(0)}
            {renderChartSlot(1)}
            {renderChartSlot(2)}
          </div>
        );
      }
      if (layoutMode === '3r') {
        return (
          <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr 1fr', gap: '10px', height: '100%' }}>
            {renderChartSlot(0)}
            {renderChartSlot(1)}
            {renderChartSlot(2)}
          </div>
        );
      }
      if (layoutMode === '4g') {
        return (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: '10px', height: '100%' }}>
            {renderChartSlot(0)}
            {renderChartSlot(1)}
            {renderChartSlot(2)}
            {renderChartSlot(3)}
          </div>
        );
      }
      if (layoutMode === '3l') {
        return (
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gridTemplateRows: '1fr 1fr', gap: '10px', height: '100%' }}>
            {renderChartSlot(0, { gridRow: '1 / 3' })}
            {renderChartSlot(1)}
            {renderChartSlot(2)}
          </div>
        );
      }
      if (layoutMode === '3t') {
        return (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1.2fr 1fr', gap: '10px', height: '100%' }}>
            {renderChartSlot(0, { gridColumn: '1 / 3' })}
            {renderChartSlot(1)}
            {renderChartSlot(2)}
          </div>
        );
      }
      if (layoutMode === '5g') {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', height: '100%' }}>
            <div style={{ display: 'flex', gap: '10px', flex: 1, minHeight: 0 }}>
              {renderChartSlot(0)}
              {renderChartSlot(1)}
            </div>
            <div style={{ display: 'flex', gap: '10px', flex: 1, minHeight: 0 }}>
              {renderChartSlot(2)}
              {renderChartSlot(3)}
              {renderChartSlot(4)}
            </div>
          </div>
        );
      }
      if (layoutMode === '6g') {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', height: '100%' }}>
            <div style={{ display: 'flex', gap: '10px', flex: 1, minHeight: 0 }}>
              {renderChartSlot(0)}
              {renderChartSlot(1)}
              {renderChartSlot(2)}
            </div>
            <div style={{ display: 'flex', gap: '10px', flex: 1, minHeight: 0 }}>
              {renderChartSlot(3)}
              {renderChartSlot(4)}
              {renderChartSlot(5)}
            </div>
          </div>
        );
      }
      if (layoutMode === '7g') {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', height: '100%' }}>
            <div style={{ display: 'flex', gap: '10px', flex: 1, minHeight: 0 }}>
              {renderChartSlot(0)}
              {renderChartSlot(1)}
              {renderChartSlot(2)}
            </div>
            <div style={{ display: 'flex', gap: '10px', flex: 1, minHeight: 0 }}>
              {renderChartSlot(3)}
              {renderChartSlot(4)}
              {renderChartSlot(5)}
              {renderChartSlot(6)}
            </div>
          </div>
        );
      }
      if (layoutMode === '8g') {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', height: '100%' }}>
            <div style={{ display: 'flex', gap: '10px', flex: 1, minHeight: 0 }}>
              {renderChartSlot(0)}
              {renderChartSlot(1)}
              {renderChartSlot(2)}
              {renderChartSlot(3)}
            </div>
            <div style={{ display: 'flex', gap: '10px', flex: 1, minHeight: 0 }}>
              {renderChartSlot(4)}
              {renderChartSlot(5)}
              {renderChartSlot(6)}
              {renderChartSlot(7)}
            </div>
          </div>
        );
      }
      return null;
    };

    const selectTab = (tab) => {
      setTerminalTab(tab);
      setRailPage(0);
    };

    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: isSmallScreen ? '1fr' : '260px 1fr',
        gap: '20px',
        flex: 1,
        minHeight: 0,
        height: isSmallScreen ? 'auto' : '100%',
        maxHeight: isSmallScreen ? 'none' : '100%',
        alignItems: 'stretch',
      }}>
        {/* LEFT RAIL */}
        <div style={{
          background: 'var(--ws-bg-1)',
          border: '1px solid var(--ws-border)',
          borderRadius: '0px',
          display: 'flex',
          flexDirection: 'column',
          height: isSmallScreen ? 'auto' : '100%',
          maxHeight: isSmallScreen ? '350px' : '100%',
          overflow: 'hidden'
        }}>
          {/* Rail Header */}
          <div style={{ padding: '12px', borderBottom: '1px solid var(--ws-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--ws-text-3)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Terminal Rail</span>
            </div>
            
            {/* Tab Selector Buttons */}
            <div style={{ display: 'flex', gap: '2px', background: 'var(--ws-bg-2)', padding: '2px', borderRadius: '0px' }}>
              {['watchlist', 'portfolio', 'charts'].map(tab => (
                <button
                  key={tab}
                  onClick={() => selectTab(tab)}
                  style={{
                    flex: 1,
                    padding: '5px 0',
                    fontSize: '9px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    border: 'none',
                    borderRadius: '0px',
                    background: terminalTab === tab ? 'var(--ws-bg-1)' : 'transparent',
                    color: terminalTab === tab ? 'var(--ws-text)' : 'var(--ws-text-3)',
                    cursor: 'pointer',
                    transition: 'all 0.1s'
                  }}
                >
                  {tab === 'charts' ? 'Pinned' : tab}
                </button>
              ))}
            </div>
          </div>

          {/* Ticker List Container */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {displayedTickers.map(ticker => {
              const price = prices[ticker];
              const pct = dayChanges[ticker];
              const isActive = terminalTicker === ticker;
              const hasChange = pct != null;
              const isPositive = pct >= 0;

              const tickerData = stockDetails[ticker];
              const tickerEasyMode = tickerData ? computeEasyMode(tickerData, hasFundamentals(tickerData)) : null;
              const score = tickerEasyMode?.score100;

              return (
                <div
                  key={ticker}
                  onClick={() => selectTerminalTicker(ticker)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: (terminalRailCollapsed && !isSmallScreen) ? 'center' : 'space-between',
                    padding: '8px',
                    borderRadius: '0px',
                    background: isActive ? 'var(--ws-bg-2)' : 'transparent',
                    border: `1px solid ${isActive ? 'var(--ws-border)' : 'transparent'}`,
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={e => { if(!isActive) e.currentTarget.style.background = 'var(--ws-bg-2)'; }}
                  onMouseLeave={e => { if(!isActive) e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <StockLogo ticker={ticker} size={18} />
                    {(!terminalRailCollapsed || isSmallScreen) && (
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ws-text)' }}>{ticker}</span>
                    )}
                  </div>
                  
                  {(!terminalRailCollapsed || isSmallScreen) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {score != null && (
                        <span style={{ 
                          fontSize: '9px', 
                          fontWeight: 700, 
                          color: tickerEasyMode.verdictColor || 'var(--ws-text-3)',
                          fontFamily: 'JetBrains Mono, monospace',
                          background: 'var(--ws-bg-2)',
                          padding: '2px 5px',
                          border: `1px solid ${tickerEasyMode.verdictColor || 'var(--ws-border)'}`,
                          borderRadius: '0px'
                        }}>
                          QS {score}
                        </span>
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'end' }}>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--ws-text)' }}>
                          {price ? `${currencySymbol}${price.toFixed(2)}` : '—'}
                        </span>
                        {hasChange && (
                          <span style={{ fontSize: '9px', fontWeight: 700, color: isPositive ? '#10b981' : 'var(--ws-red)' }}>
                            {isPositive ? '+' : ''}{pct.toFixed(2)}%
                          </span>
                        )}
                      </div>

                      {/* Remove button for Pinned Charts */}
                      {terminalTab === 'charts' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeChartTicker(ticker);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--ws-text-3)',
                            cursor: 'pointer',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                          onMouseEnter={e => e.currentTarget.style.color = 'var(--ws-red)'}
                          onMouseLeave={e => e.currentTarget.style.color = 'var(--ws-text-3)'}
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                          </svg>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {railTickers.length === 0 && (
              <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--ws-text-3)', fontSize: '10px' }}>
                No tickers in this tab.
              </div>
            )}
          </div>

          {/* Add Pinned Chart Input (charts tab only, expanded only) */}
          {(!terminalRailCollapsed || isSmallScreen) && terminalTab === 'charts' && (
            <form 
              onSubmit={addChartTicker}
              style={{
                padding: '10px',
                borderTop: '1px solid var(--ws-border)',
                display: 'flex',
                gap: '6px'
              }}
            >
              <input
                type="text"
                value={newChartTicker}
                onChange={e => setNewChartTicker(e.target.value)}
                placeholder="ADD TICKER..."
                maxLength="6"
                style={{
                  flex: 1,
                  background: 'var(--ws-bg-2)',
                  border: '1px solid var(--ws-border)',
                  borderRadius: '0px',
                  padding: '5px 8px',
                  fontSize: '10px',
                  fontWeight: 600,
                  color: 'var(--ws-text)',
                  outline: 'none',
                  textTransform: 'uppercase'
                }}
              />
              <button
                type="submit"
                style={{
                  background: 'var(--ws-accent)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '0px',
                  padding: '5px 10px',
                  fontSize: '10px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                ADD
              </button>
            </form>
          )}
        </div>

        {/* CENTER & RIGHT CONTENT */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: (isSmallScreen || isMediumScreen) ? '1fr' : '2.2fr 1fr',
          gap: '20px',
          alignItems: 'stretch',
          flex: 1,
          minHeight: 0,
          height: isSmallScreen ? 'auto' : '100%'
        }}>
          {/* CHARTS CONTAINER PANEL */}
          <div style={{
            background: 'var(--ws-bg-1)',
            border: '1px solid var(--ws-border)',
            borderRadius: '0px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            height: '100%',
            overflow: 'hidden'
          }}>
             {/* Header: Layout Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--ws-border)', paddingBottom: '10px', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--ws-text-3)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                  Multi-Chart Terminal
                </span>
                
                {/* Active Slot Timeframe/Range Selector */}
                <div style={{ display: 'flex', gap: '1px', background: 'var(--ws-border)', padding: '1px', borderRadius: '0px' }}>
                  {[
                    { label: '1D', value: '1d' },
                    { label: '1W', value: '1w' },
                    { label: '1M', value: '1m' },
                    { label: '3M', value: '3m' },
                    { label: '1Y', value: '1y' },
                    { label: 'YTD', value: 'ytd' },
                    { label: 'MAX', value: 'max' }
                  ].map(r => {
                    const isActive = slotRanges[activeSlot] === r.value;
                    return (
                      <button
                        key={r.value}
                        onClick={() => handleRangeChange(r.value)}
                        style={{
                          padding: '3px 6px',
                          fontSize: '9px',
                          fontWeight: isActive ? 700 : 400,
                          letterSpacing: '0.5px',
                          background: isActive ? 'var(--ws-accent)' : 'var(--ws-bg-2)',
                          color: isActive ? '#000' : 'var(--ws-text-3)',
                          border: 'none',
                          cursor: 'pointer',
                          fontFamily: 'JetBrains Mono, monospace',
                          transition: 'all 0.1s'
                        }}
                      >
                        {r.label}
                      </button>
                    );
                  })}
                </div>

                {/* Active Slot Mode Selector */}
                <div style={{ display: 'flex', gap: '1px', background: 'var(--ws-border)', padding: '1px', borderRadius: '0px' }}>
                  {['line', 'candles'].map(m => {
                    const isActive = slotModes[activeSlot] === m;
                    return (
                      <button
                        key={m}
                        onClick={() => handleModeChange(m)}
                        style={{
                          padding: '3px 8px',
                          fontSize: '9px',
                          fontWeight: isActive ? 700 : 400,
                          letterSpacing: '0.5px',
                          background: isActive ? 'var(--ws-accent)' : 'var(--ws-bg-2)',
                          color: isActive ? '#000' : 'var(--ws-text-3)',
                          border: 'none',
                          cursor: 'pointer',
                          fontFamily: 'JetBrains Mono, monospace',
                          transition: 'all 0.1s'
                        }}
                      >
                        {m.toUpperCase()}
                      </button>
                    );
                  })}
                </div>
              </div>
              
              {/* 8 Grid layouts selector */}
              <div style={{ display: 'flex', gap: '2px', background: 'var(--ws-bg-2)', padding: '2px', border: '1px solid var(--ws-border)', borderRadius: '0px' }}>
                {LAYOUTS.map(layout => (
                  <button
                    key={layout.id}
                    onClick={() => changeLayoutMode(layout.id)}
                    title={layout.label}
                    style={{
                      width: '24px',
                      height: '24px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: 'none',
                      background: layoutMode === layout.id ? 'var(--ws-accent)' : 'transparent',
                      color: layoutMode === layout.id ? '#fff' : 'var(--ws-text-3)',
                      cursor: 'pointer',
                      borderRadius: '0px',
                      transition: 'all 0.15s'
                    }}
                  >
                    {layout.svg}
                  </button>
                ))}
              </div>
            </div>

            {/* Layout Canvas */}
            <div style={{ flex: 1, overflow: 'hidden' }}>
              {renderChartsLayout()}
            </div>

            {/* Active Tickers Quick Nav Bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '8px',
              marginTop: '12px',
              paddingTop: '12px',
              borderTop: '1px solid var(--ws-border)',
            }}>
              <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--ws-text-3)', textTransform: 'uppercase', marginRight: '4px' }}>
                Active Grid Tickers:
              </span>
              {Array.from({ length: 
                layoutMode === '1' ? 1 :
                (layoutMode === '2c' || layoutMode === '2r') ? 2 :
                (layoutMode === '4g') ? 4 :
                layoutMode === '5g' ? 5 :
                layoutMode === '6g' ? 6 :
                layoutMode === '7g' ? 7 :
                layoutMode === '8g' ? 8 : 3
              }).map((_, idx) => {
                const ticker = slotTickers[idx] || 'AAPL';
                const isActive = activeSlot === idx;
                return (
                  <button
                    key={idx}
                    onClick={() => {
                      setActiveSlot(idx);
                      setTerminalTicker(ticker);
                    }}
                    style={{
                      background: isActive ? 'var(--ws-accent)' : 'var(--ws-bg-2)',
                      color: isActive ? '#000' : 'var(--ws-text)',
                      border: `1px solid ${isActive ? 'var(--ws-accent)' : 'var(--ws-border)'}`,
                      padding: '4px 10px',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ opacity: isActive ? 0.6 : 0.4, fontSize: '9px' }}>#{idx + 1}</span>
                    {ticker}
                  </button>
                );
              })}
            </div>
          </div>

          {/* DETAIL SUMMARY PANEL */}
          <div style={{
            background: 'var(--ws-bg-1)',
            border: '1px solid var(--ws-border)',
            borderRadius: '0px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            overflow: 'hidden'
          }}>
            {/* Pinned Stock Price & Change Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--ws-border)', paddingBottom: '12px', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <StockLogo ticker={terminalTicker} size={24} />
                <div>
                  <h3 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--ws-text)', margin: 0 }}>{terminalTicker}</h3>
                  <p style={{ fontSize: '9px', color: 'var(--ws-text-3)', margin: '2px 0 0' }}>
                    {detailData?.name || 'Loading company info...'}
                  </p>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--ws-text)' }}>
                  {prices[terminalTicker] ? `${currencySymbol}${prices[terminalTicker].toFixed(2)}` : '—'}
                </div>
                {dayChanges[terminalTicker] != null && (
                  <div style={{ fontSize: '10px', fontWeight: 700, color: dayChanges[terminalTicker] >= 0 ? '#10b981' : 'var(--ws-red)' }}>
                    {dayChanges[terminalTicker] >= 0 ? '+' : ''}{dayChanges[terminalTicker].toFixed(2)}% Today
                  </div>
                )}
              </div>
            </div>

            {/* Scrollable Content Area */}
            <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', paddingRight: '4px', margin: '12px 0', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Portfolio Holding status */}
              {userHolding ? (
                <div style={{
                  background: 'var(--ws-accent-dim)',
                  border: '1px solid var(--ws-accent)',
                  padding: '10px',
                  borderRadius: '0px',
                  fontSize: '10px',
                  fontWeight: 800,
                  color: 'var(--ws-accent)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span>PORTFOLIO</span>
                  <span>{userHolding.shares} Shares @ {currencySymbol}{userHolding.avgPrice != null ? userHolding.avgPrice.toFixed(2) : '—'}</span>
                </div>
              ) : (
                <div style={{
                  background: 'var(--ws-bg-2)',
                  border: '1px solid var(--ws-border)',
                  padding: '10px',
                  borderRadius: '0px',
                  fontSize: '10px',
                  fontWeight: 800,
                  color: 'var(--ws-text-3)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span>PORTFOLIO</span>
                  <span>NOT OWNED</span>
                </div>
              )}

              {/* Fundamental Quality Score */}
              <div>
                <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--ws-text-3)', letterSpacing: '0.5px', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                  Quality Score
                </span>
                {!easyMode ? (
                  <div style={{ fontSize: '11px', color: 'var(--ws-text-3)', marginTop: '8px' }}>
                    No fundamental data available for scoring.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                    {easyMode.isBlueGem ? (
                      <GemRevealBar score100={easyMode.score100} />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <QualityScoreBar score100={easyMode.score100} color={easyMode.verdictColor} />
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '28px', fontWeight: 700, color: easyMode.verdictColor, lineHeight: 1 }}>
                          {easyMode.score100}
                        </span>
                      </div>
                    )}
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 700, color: easyMode.verdictColor, letterSpacing: '1px', textTransform: 'uppercase' }}>
                      {easyMode.verdict}
                    </div>
                  </div>
                )}
              </div>

              {/* Analyst Summary sentence */}
              {easyMode?.summary && (
                <div style={{ 
                  background: 'var(--ws-bg-2)', 
                  border: '1px solid var(--ws-border)', 
                  borderRadius: '0px', 
                  padding: '10px',
                  fontSize: '11px',
                  lineHeight: '1.4',
                  color: 'var(--ws-text-2)',
                  fontStyle: 'italic'
                }}>
                  {easyMode.summary}
                </div>
              )}

              {/* Quality Breakdown — same CBS/OPPO/GQS/Moat/Final Note tiles as the Quality tab
                  on the stock detail page (app/(workspace)/stock/[ticker]/page.js), stacked
                  vertically here instead of a 5-column grid since this panel is narrow. */}
              {easyMode && (
                <div>
                  <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--ws-text-3)', letterSpacing: '0.5px', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                    Quality Breakdown
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {[
                      { label: 'Core Business', score: easyMode.cbs, desc: 'ROIC · Margins · Liquidity' },
                      { label: 'Opportunity', score: easyMode.oppo, desc: 'P/FCF · FCF Yield' },
                      { label: 'Growth Quality', score: easyMode.gqs, desc: 'Revenue · R&D · SBC' },
                      { label: 'Moat', text: easyMode.moat, color: easyMode.moatColor, desc: 'ROIC · Op. margin' },
                      { label: 'Final Note', score: easyMode.finalNote, desc: 'Weighted composite', highlight: true },
                    ].map(s => (
                      <div key={s.label} style={{
                        background: s.highlight ? 'var(--ws-accent-dim)' : 'var(--ws-bg-2)',
                        border: '1px solid var(--ws-border)',
                        padding: '8px 10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px'
                      }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '9px', color: 'var(--ws-text-3)', letterSpacing: '0.5px', fontWeight: 700 }}>{s.label.toUpperCase()}</div>
                          <div style={{ fontSize: '8px', color: 'var(--ws-text-3)', marginTop: '2px' }}>{s.desc}</div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: '18px', fontWeight: 700, color: s.text ? s.color : scoreColor(s.score) }}>
                            {s.text || Math.round(s.score * 20)}
                          </div>
                          {!s.text && (
                            <div style={{ width: '50px', height: '3px', background: 'var(--ws-border)', borderRadius: '2px', marginTop: '4px' }}>
                              <div style={{ width: `${(s.score / 5) * 100}%`, height: '100%', background: scoreColor(s.score), borderRadius: '2px' }} />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Basic Metrics Grid */}
              {detailData && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid var(--ws-border)', paddingTop: '12px' }}>
                  <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--ws-text-3)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Key Ratios</span>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {[
                      { label: 'P/E Ratio', val: detailData.pe != null ? parseFloat(detailData.pe).toFixed(1) : '—' },
                      { label: 'P/FCF Ratio', val: detailData.pfcf != null ? parseFloat(detailData.pfcf).toFixed(1) : '—' },
                      { label: 'ROIC', val: detailData.roic != null ? `${(parseFloat(detailData.roic)).toFixed(1)}%` : '—' },
                      { label: 'Debt to Equity', val: detailData.debtToEquity != null ? parseFloat(detailData.debtToEquity).toFixed(2) : '—' }
                    ].map(m => (
                      <div key={m.label} style={{ background: 'var(--ws-bg-2)', padding: '6px', borderRadius: '0px', border: '1px solid var(--ws-border)' }}>
                        <div style={{ fontSize: '8px', color: 'var(--ws-text-3)', fontWeight: 600 }}>{m.label}</div>
                        <div style={{ fontSize: '11px', color: 'var(--ws-text)', fontWeight: 700, marginTop: '2px' }}>{m.val}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Numbers, Simplified */}
              {detailData && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--ws-border)', paddingTop: '12px' }}>
                  <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--ws-text-3)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                    The Numbers, Simplified
                  </span>
                  <div style={{ background: 'var(--ws-bg-2)', border: '1px solid var(--ws-border)', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {(() => {
                      const fcfMargin = detailData.fcfVal != null && detailData.revVal ? (detailData.fcfVal / detailData.revVal) * 100 : null;
                      const rows = [
                        {
                          label: detailData.revGrowth == null ? 'Revenue data unavailable' : detailData.revGrowth > 10 ? 'Revenue growing fast' : detailData.revGrowth > 0 ? 'Revenue is growing' : 'Revenue is shrinking',
                          value: detailData.revGrowth != null ? `${detailData.revGrowth > 0 ? '+' : ''}${detailData.revGrowth}%` : 'N/A',
                          pct: detailData.revGrowth != null ? Math.max(4, Math.min(100, 50 + detailData.revGrowth * 2)) : 0,
                          color: detailData.revGrowth == null ? 'var(--ws-text-3)' : detailData.revGrowth > 10 ? 'var(--ws-accent)' : detailData.revGrowth > 0 ? 'var(--ws-text-2)' : 'var(--ws-red)',
                        },
                        {
                          label: detailData.opMargin == null ? 'Margin data unavailable' : detailData.opMargin > 15 ? 'Healthy profit margin' : detailData.opMargin > 0 ? 'Modest profit margin' : 'Operating at a loss',
                          value: detailData.opMargin != null ? `${detailData.opMargin}%` : 'N/A',
                          pct: detailData.opMargin != null ? Math.max(4, Math.min(100, detailData.opMargin * 2.5)) : 0,
                          color: detailData.opMargin == null ? 'var(--ws-text-3)' : detailData.opMargin > 15 ? 'var(--ws-accent)' : detailData.opMargin > 0 ? 'var(--ws-text-2)' : 'var(--ws-red)',
                        },
                        {
                          label: detailData.fcfVal == null ? 'Cash flow data unavailable' : fcfMargin != null && fcfMargin > 15 ? 'Strong cash generation' : detailData.fcfVal > 0 ? 'Positive cash flow' : 'Negative cash flow',
                          value: detailData.fcfVal == null ? 'N/A' : fcfMargin != null && fcfMargin > 15 ? 'Strong' : detailData.fcfVal > 0 ? 'Positive' : 'Negative',
                          pct: detailData.fcfVal == null ? 0 : fcfMargin != null && fcfMargin > 15 ? 90 : detailData.fcfVal > 0 ? 60 : 15,
                          color: detailData.fcfVal == null ? 'var(--ws-text-3)' : fcfMargin != null && fcfMargin > 15 ? 'var(--ws-accent)' : detailData.fcfVal > 0 ? 'var(--ws-text-2)' : 'var(--ws-red)',
                        },
                        {
                          label: detailData.debtToEquity == null ? 'Debt levels unavailable' : detailData.debtToEquity < 0 ? 'Negative equity (High Risk)' : detailData.debtToEquity < 1 ? 'Debt levels manageable' : detailData.debtToEquity < 2 ? 'Debt worth watching' : 'Highly leveraged',
                          value: detailData.debtToEquity != null ? `${detailData.debtToEquity.toFixed(2)}x` : 'N/A',
                          pct: detailData.debtToEquity != null ? Math.max(4, Math.min(100, 100 - detailData.debtToEquity * 30)) : 0,
                          color: detailData.debtToEquity == null ? 'var(--ws-text-3)' : detailData.debtToEquity < 0 ? 'var(--ws-red)' : detailData.debtToEquity < 1 ? 'var(--ws-accent)' : detailData.debtToEquity < 2 ? 'var(--ws-text-2)' : 'var(--ws-red)',
                        },
                      ];
                      return rows.map((m, i) => (
                        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
                            <span style={{ fontSize: '10px', color: 'var(--ws-text-2)', lineHeight: 1.3 }}>{m.label}</span>
                            <span style={{ fontSize: '9px', fontWeight: 700, flexShrink: 0, color: m.color, fontFamily: "'JetBrains Mono', monospace" }}>{m.value}</span>
                          </div>
                          <div style={{ height: '4px', background: 'var(--ws-bg-1)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${m.pct}%`, background: m.color }} />
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}
            </div>

            {/* Pinned Bottom Button */}
            <Link
              href={`/stock/${terminalTicker}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'block',
                textAlign: 'center',
                background: 'var(--ws-bg-2)',
                border: '1px solid var(--ws-border)',
                borderRadius: '0px',
                padding: '8px',
                fontSize: '10px',
                fontWeight: 700,
                color: 'var(--ws-text)',
                textDecoration: 'none',
                transition: 'all 0.15s',
                marginTop: '12px',
                flexShrink: 0
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--ws-bg-1)'; e.currentTarget.style.borderColor = 'var(--ws-accent)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--ws-bg-2)'; e.currentTarget.style.borderColor = 'var(--ws-border)'; }}
            >
              Analyze Detail Page →
            </Link>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="home-container" style={{
      padding: (advancedMode && !isMobile) ? '16px' : '24px',
      display: 'flex',
      flexDirection: 'column',
      gap: (advancedMode && !isMobile) ? '12px' : '24px',
      height: (advancedMode && !isMobile) ? '100vh' : 'auto',
      boxSizing: 'border-box',
      overflow: (advancedMode && !isMobile) ? 'hidden' : 'visible'
    }}>
      <WelcomeModal />

      {/* Dashboard Title & Customize Layout Control — the Advanced Mode toggle itself now
          lives in the sidebar footer (Sidebar.js), so this whole header (and the vertical
          space it takes up) is skipped entirely once the terminal takes over. */}
      {!advancedMode && (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '-8px' }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--ws-text)', letterSpacing: '-0.5px', margin: 0 }}>Terminal Dashboard</h1>
          <p style={{ fontSize: '11px', color: 'var(--ws-text-3)', margin: '2px 0 0' }}>Real-time overview of indices, portfolios, watchlists, and filings.</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowCustomizer(!showCustomizer)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--ws-text-2)',
              background: 'var(--ws-bg-1)',
              border: '1px solid var(--ws-border)',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--ws-accent)'; e.currentTarget.style.color = 'var(--ws-text)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--ws-border)'; e.currentTarget.style.color = 'var(--ws-text-2)'; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            Customize Layout
          </button>
          
          {showCustomizer && (
            <>
              <div 
                onClick={() => setShowCustomizer(false)}
                style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 998 }}
              />
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                right: 0,
                width: '220px',
                background: 'var(--ws-bg-1)',
                border: '1px solid var(--ws-border)',
                borderRadius: '8px',
                padding: '12px',
                boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
                zIndex: 999,
                animation: 'fadeInSlide 0.15s ease-out'
              }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--ws-text-3)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Show/Hide Widgets
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {WIDGETS_METADATA.map(w => (
                    <label 
                      key={w.id} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px', 
                        fontSize: '11px', 
                        fontWeight: 500, 
                        color: 'var(--ws-text-2)', 
                        cursor: 'pointer',
                        padding: '4px 6px',
                        borderRadius: '4px',
                        transition: 'background 0.1s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--ws-bg-2)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <input 
                        type="checkbox" 
                        checked={widgetVisibility[w.id] !== false}
                        onChange={() => toggleWidget(w.id)}
                        style={{
                          accentColor: 'var(--ws-accent)',
                          cursor: 'pointer',
                          margin: 0
                        }}
                      />
                      {w.label}
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
        </div>
      </div>
      )}

      {/* Top Movers Marquee Ticker — pick Gainers/Losers/Big Cap Movers from the dropdown, all today-only (see MAX_CACHE_AGE_HOURS in /api/movers), auto-scrolls continuously */}
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
          <div className="home-marquee-container" style={{
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
                    <div key={`${s.ticker}-${i}`} onClick={() => openInNewTab(`/stock/${s.ticker}`)}
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

      {/* Advanced Mode replaces the widget grid entirely with a terminal-style chart view;
          otherwise render the normal 1/2/3-column grid based on screen width and visibility. */}
      {advancedMode ? renderTerminal() : (
        visibleIds.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '60px 24px',
            border: '1px dashed var(--ws-border)',
            borderRadius: '8px',
            color: 'var(--ws-text-3)',
            background: 'var(--ws-bg-1)',
            fontSize: '12px',
            marginTop: '12px'
          }}>
            All widgets hidden. Click "Customize Layout" to restore widget visibility.
          </div>
        ) : (
          <div className="home-main-grid" style={{
            display: 'grid',
            gridTemplateColumns: layoutColumns.length === 1 ? '1fr' : `repeat(${layoutColumns.length}, 1fr)`,
            gap: '20px',
            alignItems: 'start'
          }}>
            {layoutColumns.map((colWidgets, colIndex) => (
              <div key={colIndex} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {colWidgets.map(id => (
                  <div key={id}>
                    {renderWidget(id)}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )
      )}

      {/* Signed-out visitors only — subscribers never see ads. Advanced Mode's terminal
          view is a fixed-height, no-scroll layout, so there's no good spot for it there. */}
      {!advancedMode && (
        <AdSlot slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOME} style={{ minHeight: '90px' }} />
      )}

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

