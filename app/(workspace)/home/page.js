'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '../../components/AuthProvider';
import { ResponsiveContainer, LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { formatPriceWithSymbol as formatCurrency } from '../../../lib/formatters';
import { useCurrencyRates } from '../../../lib/hooks/useCurrencyRates';
import { openInNewTab } from '../../../lib/openInNewTab';
import StockLogo from '../../components/workspace/StockLogo';
import Card from '../../components/workspace/home/Card';
import WelcomeModal from '../../components/workspace/home/WelcomeModal';
import AdSlot from '../../components/AdSlot';
import { computeEasyMode } from '../../../lib/stockScoring';

// Same set + localStorage key as the dedicated /portfolio page, so the display
// currency preference stays in sync between that page and this dashboard widget.
const CURRENCIES = { USD: '$', EUR: '€', GBP: '£' };

// Same "is there enough fundamental data to score this" check used on the stock detail
// page's Quality tab — avoids a fabricated-looking score for thinly-covered tickers.
const hasFundamentals = (data) => data.revVal != null || data.niVal != null || data.marketCap != null
  || data.roic != null || data.grossMargin != null || (data.revHistory?.length ?? 0) > 0;

const formatCompact = (n) => {
  if (n == null) return '—';
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${n.toLocaleString()}`;
};

export default function WorkspaceHome() {
  const router = useRouter();

  // Responsive layout: single column below 1024px, two columns (main + rail) above it.
  const [isMobile, setIsMobile] = useState(true);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Portfolio States
  const { user, isSignedIn } = useUser();
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
  const [currency, setCurrency] = useState('USD');
  const { rates: fxRates, toUSD, toUSDStable } = useCurrencyRates();

  useEffect(() => {
    const saved = localStorage.getItem('portfolio_currency');
    if (saved && CURRENCIES[saved]) setCurrency(saved);
  }, []);

  const changeCurrency = (c) => { setCurrency(c); localStorage.setItem('portfolio_currency', c); };
  const fxRate = currency === 'USD' ? 1 : (fxRates[currency] || 1);
  const currencySymbol = CURRENCIES[currency];

  const [watchlist, setWatchlist] = useState([]);
  const [recentViewed, setRecentViewed] = useState([]);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState('watchlist');
  const [heatmapTab, setHeatmapTab] = useState('holdings');

  // Portfolio value history (signed-in users only — see /api/portfolio/snapshot) and
  // S&P 500 / Nasdaq candles over the same window, for the Performance vs Benchmarks chart.
  const [snapshots, setSnapshots] = useState([]);
  const [benchmarks, setBenchmarks] = useState([]);
  const [benchmarksLoading, setBenchmarksLoading] = useState(true);

  // Market-wide movers (Top Movers card) and filings/news (Market Intelligence card) —
  // not personalized to the portfolio, same sources the old widgets used.
  const [movers, setMovers] = useState(null);
  const [newsFeed, setNewsFeed] = useState([]);

  // Earnings dates and SEC filings for the portfolio's own tickers (not market-wide) — the
  // "Upcoming for your holdings" row, fetched once per unique ticker set instead of once
  // per ticker.
  const [holdingsEarnings, setHoldingsEarnings] = useState([]);
  const [holdingsFilings, setHoldingsFilings] = useState([]);
  const [holdingsEventsLoading, setHoldingsEventsLoading] = useState(true);

  useEffect(() => {
    // Fetch watchlist from Supabase
    fetch('/api/watchlist')
      .then(r => r.json())
      .then(d => setWatchlist(d.tickers || []))
      .catch(() => {});

    // Load recently viewed stocks from localStorage
    try {
      const viewedKey = Object.keys(localStorage).find(k => k.startsWith('viewed_stocks_')) || 'viewed_stocks';
      const items = JSON.parse(localStorage.getItem(viewedKey) || '[]');
      setRecentViewed(items.slice(0, 10)); // Top 10 recents
    } catch (e) {}

    // Portfolio value history, for the guests-get-nothing-yet benchmark chart
    fetch('/api/portfolio/snapshot')
      .then(r => r.json())
      .then(d => setSnapshots(d.snapshots || []))
      .catch(() => {});

    // S&P 500 + Nasdaq, 3 months of daily closes
    fetch('/api/market?range=3mo')
      .then(r => r.json())
      .then(d => {
        setBenchmarks((d.markets || []).filter(m => m.symbol === '^GSPC' || m.symbol === '^IXIC'));
        setBenchmarksLoading(false);
      })
      .catch(() => setBenchmarksLoading(false));

    // Market-wide gainers/losers
    fetch('/api/movers')
      .then(r => r.json())
      .then(setMovers)
      .catch(() => {});

    // General market filings/news
    fetch('/api/filings')
      .then(r => r.json())
      .then(d => setNewsFeed(d.filings || []))
      .catch(() => {});
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
        const saved = localStorage.getItem('bulltrace_portfolio');
        if (saved) {
          setPortfolio(JSON.parse(saved));
        } else {
          const seed = [
            { ticker: 'AAPL', shares: 10, avgPrice: 175.50, pie: 'Tech' },
            { ticker: 'MSFT', shares: 5, avgPrice: 380.20, pie: 'Tech' },
            { ticker: 'NVDA', shares: 20, avgPrice: 450.00, pie: 'AI' }
          ];
          localStorage.setItem('bulltrace_portfolio', JSON.stringify(seed));
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

  // Upcoming earnings + recent SEC filings for the portfolio's own tickers. Earnings reuses
  // the existing range-based /api/earnings endpoint (one fetch, filtered client-side) rather
  // than a per-ticker call; filings hits SEC EDGAR's submissions feed directly per ticker via
  // /api/holdings-filings, same pattern as the personalized /api/filings news call.
  useEffect(() => {
    if (activeTickers.length === 0) {
      setHoldingsEarnings([]);
      setHoldingsFilings([]);
      setHoldingsEventsLoading(false);
      return;
    }
    setHoldingsEventsLoading(true);
    const tickerSet = new Set(activeTickers);
    const today = new Date();
    const from = today.toISOString().slice(0, 10);
    const to = new Date(today.getTime() + 45 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    Promise.all([
      fetch(`/api/earnings?from=${from}&to=${to}`).then(r => r.json()).catch(() => ({ earnings: [] })),
      fetch(`/api/holdings-filings?tickers=${activeTickers.join(',')}`).then(r => r.json()).catch(() => ({ filings: [] })),
    ]).then(([earningsData, filingsData]) => {
      const filtered = (earningsData.earnings || [])
        .filter(e => tickerSet.has(e.ticker))
        .sort((a, b) => a.date.localeCompare(b.date));
      setHoldingsEarnings(filtered);
      setHoldingsFilings(filingsData.filings || []);
      setHoldingsEventsLoading(false);
    });
  }, [activeTickers]);

  // Portfolio + watchlist tickers, deduped — the set the dashboard actually cares about.
  const trackedTickers = useMemo(() => {
    return [...new Set([...activeTickers, ...watchlist.map(w => w.ticker)])];
  }, [activeTickers, watchlist]);

  // Every ticker we need a live price/day-change quote for — portfolio, watchlist, and
  // recently viewed — so the watchlist table and hero chart can show price/today without
  // a separate fetch per widget.
  const quoteTickers = useMemo(() => {
    return [...new Set([...trackedTickers, ...recentViewed])];
  }, [trackedTickers, recentViewed]);

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

  // Keep holding/watchlist prices reasonably live. Visibility-aware pausing: no point
  // re-fetching a per-ticker quote for every
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
  // Grouped by ticker only — matching /portfolio's buildPositions — so a ticker split
  // across multiple lots (e.g. tagged into different Pies over time) rolls up into one
  // consolidated row with total shares instead of one row per lot/pie. It previously
  // grouped by `ticker-pie`, so the same stock held under two Pie tags (or one lot tagged
  // and another not) rendered as two separate "duplicate" positions here.
  const displayHoldings = useMemo(() => {
    const lots = isSignedIn
      ? holdings.map(h => ({ ticker: h.ticker, shares: Number(h.shares), costBasis: Number(h.cost_basis), costCurrency: h.cost_basis_currency || 'USD', pie: h.pie || '' }))
      : portfolio.map(p => ({ ticker: p.ticker, shares: Number(p.shares), costBasis: Number(p.avgPrice), costCurrency: p.costCurrency || 'USD', pie: p.pie || '' }));

    const byTicker = {};
    lots.forEach(l => {
      const p = byTicker[l.ticker] ||= { ticker: l.ticker, shares: 0, cost: 0, costUSD: 0, pie: '', costCurrency: l.costCurrency };
      p.shares += l.shares;
      p.cost += l.shares * l.costBasis;
      p.costUSD += l.shares * toUSDStable(l.costBasis, l.costCurrency);
      if (!p.pie && l.pie) p.pie = l.pie;
    });
    return Object.values(byTicker).map(p => ({
      ticker: p.ticker,
      shares: p.shares,
      avgPrice: p.cost / p.shares,
      avgPriceUSD: p.costUSD / p.shares,
      pie: p.pie,
      costCurrency: p.costCurrency
    }));
  }, [holdings, portfolio, isSignedIn, fxRates]);

  // Record a daily portfolio snapshot from Home too — not just /portfolio — so the growth
  // chart keeps accumulating points even for users who only ever look at the dashboard.
  const homeTotals = useMemo(() => {
    let cost = 0, value = 0;
    displayHoldings.forEach(item => {
      const priceCurrency = stockDetails[item.ticker]?.currency || 'USD';
      const priceNative = prices[item.ticker];
      const currentPriceUSD = toUSD(priceNative, priceCurrency);
      const avgPriceUSD = item.avgPriceUSD ?? toUSDStable(item.avgPrice, item.costCurrency);
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

  // Every position with its live USD value/cost/return/today's move and normalized sector —
  // the shared shape the portfolio summary, sectors, and hero chart widgets all read from,
  // instead of each re-deriving it from displayHoldings independently.
  const valuedHoldings = useMemo(() => {
    return displayHoldings.map(item => {
      const priceCurrency = stockDetails[item.ticker]?.currency || 'USD';
      const priceNative = prices[item.ticker] ?? item.avgPrice;
      const currentPriceUSD = toUSD(priceNative, priceCurrency);
      const avgPriceUSD = item.avgPriceUSD ?? toUSDStable(item.avgPrice, item.costCurrency);
      const value = item.shares * currentPriceUSD;
      const cost = item.shares * avgPriceUSD;
      const changePct = dayChanges[item.ticker];
      return {
        ...item,
        currentPrice: priceNative,
        priceCurrency,
        value,
        cost,
        ret: value - cost,
        retPct: cost > 0 ? ((value - cost) / cost) * 100 : 0,
        changePct,
        sector: stockDetails[item.ticker]?.sector || 'Other',
      };
    }).sort((a, b) => b.value - a.value);
  }, [displayHoldings, prices, stockDetails, dayChanges, fxRates]);

  const portfolioTotals = useMemo(() => {
    let cost = 0, value = 0, todayChange = 0;
    valuedHoldings.forEach(item => {
      cost += item.cost;
      value += item.value;
      if (item.changePct != null) todayChange += item.value * (item.changePct / 100);
    });
    const ret = value - cost;
    const retPct = cost > 0 ? (ret / cost) * 100 : 0;
    const prevValue = value - todayChange;
    const todayPct = prevValue > 0 ? (todayChange / prevValue) * 100 : 0;
    return { cost, value, ret, retPct, todayChange, todayPct };
  }, [valuedHoldings]);

  // Value-weighted average Bulltrace Quality Score across holdings with enough fundamentals
  // to score — the KPI row's honest substitute for the reference's fabricated Risk/Beta tile.
  const portfolioQuality = useMemo(() => {
    let weightedSum = 0, weightTotal = 0;
    valuedHoldings.forEach(item => {
      const detail = stockDetails[item.ticker];
      if (!detail || item.value <= 0 || !hasFundamentals(detail)) return;
      const easy = computeEasyMode(detail, true);
      weightedSum += easy.score100 * item.value;
      weightTotal += item.value;
    });
    return weightTotal > 0 ? Math.round(weightedSum / weightTotal) : null;
  }, [valuedHoldings, stockDetails]);

  // Portfolio value % change (from real daily snapshots, signed-in users only) vs S&P 500
  // and Nasdaq % change (from real index candles) over the same overlapping window.
  const performanceData = useMemo(() => {
    // Drop the zero-value anchor day the snapshot API seeds the day before a user's very
    // first real snapshot (see /api/portfolio/snapshot) — dividing from a $0 baseline would
    // otherwise flatline the whole portfolio line at 0%.
    const realSnapshots = snapshots.filter(s => s.value > 0);
    if (realSnapshots.length < 2 || benchmarks.length === 0) return [];
    const sp = benchmarks.find(b => b.symbol === '^GSPC');
    const nq = benchmarks.find(b => b.symbol === '^IXIC');
    if (!sp && !nq) return [];

    const toDateStr = (unixSec) => new Date(unixSec * 1000).toISOString().slice(0, 10);
    const buildMap = (candles) => {
      const map = {};
      (candles || []).forEach(c => { map[toDateStr(c.t)] = c.c; });
      return map;
    };
    const spMap = sp ? buildMap(sp.candles) : {};
    const nqMap = nq ? buildMap(nq.candles) : {};
    const lookupClose = (map, dateStr) => {
      if (map[dateStr] != null) return map[dateStr];
      let val = null;
      for (const d of Object.keys(map).sort()) { if (d <= dateStr) val = map[d]; else break; }
      return val;
    };

    const firstSp = lookupClose(spMap, realSnapshots[0].date);
    const firstNq = lookupClose(nqMap, realSnapshots[0].date);

    // Portfolio line is return-on-cost-basis, not change-from-day-1-value — cost basis grows
    // exactly when new capital goes in, so depositing/buying more doesn't fake a jump the way
    // comparing raw value to a fixed starting point would. This is the same math as the KPI
    // row's "Total Return", just plotted day by day instead of as a single current number.
    return realSnapshots.map(s => {
      const spClose = lookupClose(spMap, s.date);
      const nqClose = lookupClose(nqMap, s.date);
      return {
        date: s.date,
        portfolio: s.cost > 0 ? ((s.value - s.cost) / s.cost) * 100 : 0,
        sp500: (firstSp && spClose) ? ((spClose - firstSp) / firstSp) * 100 : null,
        nasdaq: (firstNq && nqClose) ? ((nqClose - firstNq) / firstNq) * 100 : null,
      };
    });
  }, [snapshots, benchmarks]);

  // Last 7 recorded snapshots, for the Allocation card's weekly trend sparkline.
  const weeklyTrend = useMemo(() => snapshots.slice(-7), [snapshots]);

  // Real, non-fabricated substitutes for the reference's Volatility/Sortino tiles.
  const allocationStats = useMemo(() => {
    const held = valuedHoldings.filter(h => h.value > 0);
    const totalVal = held.reduce((sum, h) => sum + h.value, 0);
    const weightedMcap = totalVal > 0 ? held.reduce((sum, h) => {
      const mc = stockDetails[h.ticker]?.marketCap;
      return mc ? sum + mc * (h.value / totalVal) : sum;
    }, 0) : 0;
    const best = held.length > 0 ? held.reduce((a, b) => (b.retPct > a.retPct ? b : a)) : null;
    return { positions: held.length, weightedMcap, best };
  }, [valuedHoldings, stockDetails]);

  const savePortfolio = (newPort) => {
    setPortfolio(newPort);
    localStorage.setItem('bulltrace_portfolio', JSON.stringify(newPort));
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

  // Widget Renderers
  const renderHeatmap = () => {
    const heatTiles = valuedHoldings.filter(h => h.value > 0);

    const sectorMap = {};
    heatTiles.forEach(item => {
      const s = sectorMap[item.sector] ||= { sector: item.sector, value: 0, cost: 0 };
      s.value += item.value;
      s.cost += item.cost;
    });
    const sectorTotal = Object.values(sectorMap).reduce((sum, s) => sum + s.value, 0);
    const sectorRows = Object.values(sectorMap)
      .map(s => ({ ...s, weight: sectorTotal > 0 ? (s.value / sectorTotal) * 100 : 0, returnPct: s.cost > 0 ? ((s.value - s.cost) / s.cost) * 100 : 0 }))
      .sort((a, b) => b.value - a.value);

    if (heatTiles.length === 0) {
      return (
        <Card title="Heatmap" subtitle="Today's move across your holdings.">
          <div className="p-[30px] text-center text-ws-text-3 text-xs">
            Add holdings to see today's heatmap.
          </div>
        </Card>
      );
    }

    return (
      <Card
        title="Heatmap"
        subtitle={heatmapTab === 'holdings' ? "Today's move across your holdings." : 'Weight and return by sector.'}
        rightElement={
          <div style={{ display: 'flex', gap: '2px', background: 'var(--ws-bg-2)', padding: '2px', borderRadius: '6px' }}>
            <button onClick={() => setHeatmapTab('holdings')}
              style={{
                padding: '4px 10px', fontSize: '10px', fontWeight: 600, border: 'none', borderRadius: '4px',
                background: heatmapTab === 'holdings' ? 'var(--ws-bg-1)' : 'transparent',
                color: heatmapTab === 'holdings' ? 'var(--ws-text)' : 'var(--ws-text-3)', cursor: 'pointer'
              }}>
              Holdings
            </button>
            <button onClick={() => setHeatmapTab('sectors')}
              style={{
                padding: '4px 10px', fontSize: '10px', fontWeight: 600, border: 'none', borderRadius: '4px',
                background: heatmapTab === 'sectors' ? 'var(--ws-bg-1)' : 'transparent',
                color: heatmapTab === 'sectors' ? 'var(--ws-text)' : 'var(--ws-text-3)', cursor: 'pointer'
              }}>
              Sectors
            </button>
          </div>
        }
      >
        {heatmapTab === 'holdings' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gridAutoRows: '1fr', gap: '8px', padding: '16px', flex: 1, alignContent: 'stretch' }}>
            {heatTiles.map(t => {
              const c = t.changePct;
              const positive = c != null && c >= 0;
              const intensity = c != null ? Math.min(1, Math.abs(c) / 5) : 0;
              const bg = c == null
                ? 'var(--ws-bg-2)'
                : positive
                  ? `rgba(16, 185, 129, ${0.15 + intensity * 0.55})`
                  : `rgba(239, 68, 68, ${0.15 + intensity * 0.55})`;
              return (
                <div key={t.ticker} onClick={() => openInNewTab(`/stock/${t.ticker}`)}
                  style={{
                    background: bg, borderRadius: '6px', padding: '8px 6px', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px', minHeight: '56px',
                  }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--ws-text)' }}>{t.ticker}</span>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: c == null ? 'var(--ws-text-3)' : (positive ? '#10b981' : 'var(--ws-red)') }}>
                    {c != null ? `${positive ? '+' : ''}${c.toFixed(2)}%` : '—'}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', padding: '16px', flex: 1, alignItems: 'center' }}>
            {sectorRows.map(row => {
              const positive = row.returnPct >= 0;
              return (
                <div key={row.sector} style={{
                  minWidth: '140px', flexShrink: 0, background: 'var(--ws-bg-2)', border: '1px solid var(--ws-border)',
                  borderRadius: '10px', padding: '14px',
                }}>
                  <div style={{ fontWeight: 800, color: 'var(--ws-text)', fontSize: '12px' }}>{row.sector}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', gap: '10px' }}>
                    <div>
                      <div style={{ fontSize: '9px', color: 'var(--ws-text-3)', fontWeight: 700, textTransform: 'uppercase' }}>Weight</div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ws-text)', marginTop: '2px' }}>{row.weight.toFixed(1)}%</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '9px', color: 'var(--ws-text-3)', fontWeight: 700, textTransform: 'uppercase' }}>Return</div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: positive ? '#10b981' : 'var(--ws-red)', marginTop: '2px' }}>
                        {positive ? '+' : ''}{row.returnPct.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    );
  };

  const WORKSPACE_ROW_LIMIT = 5;

  const renderWorkspace = () => {
    const allRows = activeWorkspaceTab === 'watchlist' ? watchlist.map(w => w.ticker) : recentViewed;
    const rows = allRows.slice(0, WORKSPACE_ROW_LIMIT);
    const emptyMsg = activeWorkspaceTab === 'watchlist'
      ? 'Your watchlist is empty. Go to a stock page and save it.'
      : 'No recently viewed stocks. Tickers will appear here as you search.';

    return (
      <Card
        title="Watchlist"
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
        {rows.length === 0 ? (
          <div className="px-5 py-10 text-center text-ws-text-3 text-[13px]">{emptyMsg}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {rows.map(ticker => {
              const price = prices[ticker];
              const changePct = dayChanges[ticker];
              const hasChange = changePct != null;
              const detail = stockDetails[ticker];
              return (
                <div key={ticker} onClick={() => openInNewTab(`/stock/${ticker}`)}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', cursor: 'pointer', borderBottom: '1px solid var(--ws-border)', transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--ws-bg-2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <StockLogo ticker={ticker} name={ticker} size={44} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: 'var(--ws-text)' }}>{ticker}</div>
                    <div style={{ fontSize: '10px', color: 'var(--ws-text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{detail?.name || ''}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontWeight: 700, color: 'var(--ws-text)' }}>
                      {price != null ? formatCurrency(price, CURRENCIES[detail?.currency] || detail?.currency) : '—'}
                    </div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: hasChange ? (changePct >= 0 ? '#10b981' : 'var(--ws-red)') : 'var(--ws-text-3)' }}>
                      {hasChange ? `${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%` : '—'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <Link href="/watchlist" style={{
          display: 'block', textAlign: 'center', padding: '10px', fontSize: '11px', fontWeight: 700,
          color: 'var(--ws-accent)', textDecoration: 'none', borderTop: '1px solid var(--ws-border)',
        }}>
          View all →
        </Link>
      </Card>
    );
  };

  const renderHoldingsList = () => {
    const { value: totalValue } = portfolioTotals;
    const sortedHoldings = valuedHoldings;

    return (
      <Card
        title="Holdings"
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
                    color: currency === c ? 'var(--accent-text)' : 'var(--ws-text-2)'
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
            <Link href="/portfolio" style={{ fontSize: '10px', fontWeight: 700, color: 'var(--ws-accent)', textDecoration: 'none' }}>
              View All →
            </Link>
          </div>
        }
      >
        <div className="widget-portfolio-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '16px' }}>
          {/* Sign In Banner if not signed in */}
          {!isSignedIn && (
            <div style={{
              background: 'var(--ws-accent-dim)',
              border: '1px solid rgba(199, 255, 56, 0.25)',
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
                  background: 'var(--ws-accent)',
                  color: 'var(--accent-text)',
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

          {/* Holdings list — Asset / Price / Weight / P&L, matching /portfolio's fuller table
              but glanceable. Full editable table with avg cost/remove lives on the dedicated
              /portfolio page (see "View All" above). */}
          {sortedHoldings.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--ws-text-3)', fontSize: '11px', border: '1px solid var(--ws-border)', borderRadius: '10px' }}>
              No active holdings. Click "+ Add Trade" to track positions!
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0 4px 8px', fontSize: '9px', fontWeight: 700, color: 'var(--ws-text-3)', textTransform: 'uppercase' }}>
                <div style={{ width: '32px' }} />
                <div style={{ flex: '1 1 120px' }}>Asset</div>
                <div style={{ width: '64px', textAlign: 'right' }}>Price</div>
                <div style={{ width: '90px' }}>Weight</div>
                <div style={{ width: '56px', textAlign: 'right' }}>P/L</div>
              </div>
              {/* Capped height with internal scroll — a portfolio with a lot of positions
                  shouldn't stretch this card (and the grid row it shares with the benchmark
                  chart) to match its full length. Everything is still one scroll away, and
                  the whole thing is a click away on /portfolio via "View All" above. */}
              <div style={{ maxHeight: '460px', overflowY: 'auto' }}>
              {sortedHoldings.map((item, idx) => {
                const itemPositive = item.ret >= 0;
                const weight = totalValue > 0 ? (item.value / totalValue) * 100 : 0;
                return (
                  <div key={item.ticker + (item.pie || '') + idx}
                    onClick={() => openInNewTab(`/stock/${item.ticker}`)}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 4px', cursor: 'pointer', borderTop: '1px solid var(--ws-border)', transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--ws-bg-2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <StockLogo ticker={item.ticker} name={item.ticker} size={32} />
                    <div style={{ flex: '1 1 120px', minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: 'var(--ws-text)' }}>{item.ticker}</div>
                      <div style={{ fontSize: '10px', color: 'var(--ws-text-3)' }}>{stockDetails[item.ticker]?.sector || item.pie || ''}</div>
                    </div>
                    <div style={{ width: '64px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: 'var(--ws-text)' }}>
                      {formatCurrency(item.currentPrice, CURRENCIES[item.priceCurrency] || item.priceCurrency)}
                    </div>
                    <div style={{ width: '90px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ flex: 1, height: '4px', background: 'var(--ws-bg-2)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, weight)}%`, height: '100%', background: 'var(--ws-accent)' }} />
                      </div>
                      <span style={{ fontSize: '10px', color: 'var(--ws-text-3)', flexShrink: 0 }}>{weight.toFixed(0)}%</span>
                    </div>
                    <div style={{ width: '56px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: itemPositive ? '#10b981' : 'var(--ws-red)' }}>
                      {itemPositive ? '+' : ''}{item.retPct.toFixed(1)}%
                    </div>
                  </div>
                );
              })}
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
                  color: 'var(--accent-text)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textAlign: 'center',
                  boxShadow: '0 2px 6px rgba(199,255,56,0.15)'
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

  const renderKPIRow = () => {
    const { value: totalValue, ret: totalReturn, retPct: totalReturnPct, todayChange: totalTodayChange, todayPct: totalTodayPct } = portfolioTotals;
    const positive = totalReturn >= 0;
    const todayPositive = totalTodayChange >= 0;

    const stats = [
      {
        label: 'Portfolio Value',
        value: `${currencySymbol}${(totalValue * fxRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        sub: `${positive ? '+' : ''}${totalReturnPct.toFixed(2)}% All Time`,
        subColor: positive ? '#10b981' : 'var(--ws-red)',
      },
      {
        label: "Today's P/L",
        value: `${todayPositive ? '+' : '-'}${currencySymbol}${Math.abs(totalTodayChange * fxRate).toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
        valueColor: todayPositive ? '#10b981' : 'var(--ws-red)',
        sub: `${todayPositive ? '+' : ''}${totalTodayPct.toFixed(2)}%`,
        subColor: todayPositive ? '#10b981' : 'var(--ws-red)',
      },
      {
        label: 'Total Return',
        value: `${positive ? '+' : '-'}${currencySymbol}${Math.abs(totalReturn * fxRate).toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
        valueColor: positive ? '#10b981' : 'var(--ws-red)',
        sub: `${positive ? '+' : ''}${totalReturnPct.toFixed(2)}%`,
        subColor: positive ? '#10b981' : 'var(--ws-red)',
      },
      {
        label: 'Quality Score',
        value: portfolioQuality != null ? `${portfolioQuality}` : '—',
        sub: portfolioQuality != null ? 'Bulltrace Score, weighted' : 'Add holdings to score',
        subColor: 'var(--ws-text-3)',
      },
    ];

    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
        {stats.map(s => (
          <div key={s.label} style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', borderRadius: 'var(--radius)', padding: '16px' }}>
            <div style={{ fontSize: '10px', color: 'var(--ws-text-3)', fontWeight: 700, textTransform: 'uppercase' }}>{s.label}</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: s.valueColor || 'var(--ws-text)', marginTop: '6px' }}>{s.value}</div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: s.subColor, marginTop: '4px' }}>{s.sub}</div>
          </div>
        ))}
      </div>
    );
  };

  const renderBenchmarkChart = () => {
    if (!isSignedIn) {
      return (
        <Card title="Performance vs Benchmarks" subtitle="Your portfolio vs the S&P 500 and Nasdaq.">
          <div className="p-[30px] text-center text-ws-text-3 text-xs">
            Sign in to start tracking your portfolio's performance history.
          </div>
        </Card>
      );
    }
    if (benchmarksLoading) {
      return (
        <Card title="Performance vs Benchmarks" subtitle="Your portfolio vs the S&P 500 and Nasdaq.">
          <div className="p-[30px] text-center text-ws-text-3 text-xs">Loading benchmarks...</div>
        </Card>
      );
    }
    if (performanceData.length < 2) {
      return (
        <Card title="Performance vs Benchmarks" subtitle="Your portfolio vs the S&P 500 and Nasdaq.">
          <div className="p-[30px] text-center text-ws-text-3 text-xs">
            Not enough history yet — check back after a few days of tracking.
          </div>
        </Card>
      );
    }

    const last = performanceData[performanceData.length - 1];
    const first = performanceData[0];

    return (
      <Card
        title="Performance vs Benchmarks"
        subtitle={`Since ${new Date(first.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`}
        rightElement={
          <div style={{ display: 'flex', gap: '14px', fontSize: '11px', fontWeight: 700, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <span style={{ color: 'var(--ws-accent)' }}>● Portfolio {last.portfolio >= 0 ? '+' : ''}{last.portfolio.toFixed(1)}%</span>
            {last.sp500 != null && <span style={{ color: 'var(--ws-text-2)' }}>● S&P 500 {last.sp500 >= 0 ? '+' : ''}{last.sp500.toFixed(1)}%</span>}
            {last.nasdaq != null && <span style={{ color: 'var(--ws-text-3)' }}>● Nasdaq {last.nasdaq >= 0 ? '+' : ''}{last.nasdaq.toFixed(1)}%</span>}
          </div>
        }
      >
        <div style={{ padding: '16px', flex: 1, minHeight: '280px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={performanceData}>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--ws-text-3)' }} tickFormatter={d => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} minTickGap={30} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--ws-text-3)' }} tickFormatter={v => `${v.toFixed(0)}%`} width={40} />
              <Tooltip
                contentStyle={{ background: 'var(--ws-bg-2)', border: '1px solid var(--ws-border)', borderRadius: '8px', fontSize: '11px' }}
                labelFormatter={d => new Date(d).toLocaleDateString()}
                formatter={(v, name) => [v != null ? `${v.toFixed(2)}%` : '—', name]}
              />
              <Line type="monotone" dataKey="portfolio" name="Portfolio" stroke="#C7FF38" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="sp500" name="S&P 500" stroke="#9ca3af" strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="nasdaq" name="Nasdaq" stroke="#5f6b8b" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    );
  };

  const renderAllocation = () => {
    const { value: totalValue } = portfolioTotals;
    const { positions, weightedMcap, best } = allocationStats;
    const bestPositive = best && best.retPct >= 0;

    return (
      <Card title="Allocation" subtitle="This week">
        <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px', minHeight: 0 }}>
          <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--ws-text)' }}>
            {currencySymbol}{(totalValue * fxRate).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div style={{ flex: 1, minHeight: '70px' }}>
            {weeklyTrend.length >= 2 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weeklyTrend}>
                  <defs>
                    <linearGradient id="allocFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--ws-accent)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--ws-accent)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="value" stroke="var(--ws-accent)" strokeWidth={2} fill="url(#allocFill)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: 'var(--ws-text-3)' }}>
                Not enough history yet
              </div>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', paddingTop: '10px', borderTop: '1px solid var(--ws-border)', marginTop: 'auto' }}>
            <div>
              <div style={{ fontSize: '9px', color: 'var(--ws-text-3)', fontWeight: 700, textTransform: 'uppercase' }}>Positions</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ws-text)', marginTop: '2px' }}>{positions}</div>
            </div>
            <div>
              <div style={{ fontSize: '9px', color: 'var(--ws-text-3)', fontWeight: 700, textTransform: 'uppercase' }}>Avg Market Cap</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ws-text)', marginTop: '2px' }}>{formatCompact(weightedMcap)}</div>
            </div>
            <div>
              <div style={{ fontSize: '9px', color: 'var(--ws-text-3)', fontWeight: 700, textTransform: 'uppercase' }}>Best Performer</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: best ? (bestPositive ? '#10b981' : 'var(--ws-red)') : 'var(--ws-text-3)', marginTop: '2px' }}>
                {best ? `${best.ticker} ${bestPositive ? '+' : ''}${best.retPct.toFixed(1)}%` : '—'}
              </div>
            </div>
          </div>
        </div>
      </Card>
    );
  };

  const renderTopMovers = () => {
    if (!movers) {
      return (
        <Card title="Top Movers" subtitle="Today">
          <div className="p-[30px] text-center text-ws-text-3 text-xs">Loading movers...</div>
        </Card>
      );
    }
    const gainers = (movers.gainers || []).slice(0, 5);
    const losers = (movers.losers || []).slice(0, 5);
    const renderRow = (s, color) => (
      <div key={s.ticker} onClick={() => openInNewTab(`/stock/${s.ticker}`)}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', padding: '6px 0', cursor: 'pointer' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ws-text)' }}>{s.ticker}</div>
          <div style={{ fontSize: '10px', color: 'var(--ws-text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '110px' }}>{s.name}</div>
        </div>
        <div style={{ fontSize: '12px', fontWeight: 700, color, flexShrink: 0 }}>{s.priceChangePct >= 0 ? '+' : ''}{s.priceChangePct?.toFixed(2)}%</div>
      </div>
    );
    return (
      <Card title="Top Movers" subtitle="Today">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', flex: 1, minHeight: 0 }}>
          <div style={{ padding: '16px', borderRight: '1px solid var(--ws-border)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#10b981', textTransform: 'uppercase', marginBottom: '8px' }}>Gainers</div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: gainers.length > 1 ? 'space-between' : 'flex-start' }}>
              {gainers.length === 0 ? <div style={{ fontSize: '11px', color: 'var(--ws-text-3)' }}>—</div> : gainers.map(s => renderRow(s, '#10b981'))}
            </div>
          </div>
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--ws-red)', textTransform: 'uppercase', marginBottom: '8px' }}>Losers</div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: losers.length > 1 ? 'space-between' : 'flex-start' }}>
              {losers.length === 0 ? <div style={{ fontSize: '11px', color: 'var(--ws-text-3)' }}>—</div> : losers.map(s => renderRow(s, 'var(--ws-red)'))}
            </div>
          </div>
        </div>
      </Card>
    );
  };

  const renderMarketIntelligence = () => {
    const items = newsFeed.slice(0, 5);
    return (
      <Card title="Market Intelligence" subtitle="Latest headlines">
        {items.length === 0 ? (
          <div className="p-[30px] text-center text-ws-text-3 text-xs">No headlines right now.</div>
        ) : (
          <div>
            {items.map((item, idx) => (
              <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer"
                style={{ display: 'block', padding: '12px 16px', borderTop: idx === 0 ? 'none' : '1px solid var(--ws-border)', textDecoration: 'none' }}
              >
                <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--ws-accent)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{item.source}</div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ws-text)', marginTop: '4px', lineHeight: 1.4 }}>{item.title}</div>
                <div style={{ fontSize: '10px', color: 'var(--ws-text-3)', marginTop: '4px' }}>{item.time}</div>
              </a>
            ))}
          </div>
        )}
      </Card>
    );
  };

  const FORM_LABELS = { '10-K': '10-K', '10-K/A': '10-K/A', '10-Q': '10-Q', '10-Q/A': '10-Q/A', '8-K': '8-K', '8-K/A': '8-K/A', '20-F': '20-F', '20-F/A': '20-F/A', '6-K': '6-K' };
  const EARNINGS_HOUR_LABELS = { bmo: 'Before open', amc: 'After close', dmh: 'During hours' };

  const daysUntilLabel = (dateStr) => {
    const days = Math.round((new Date(dateStr + 'T00:00:00') - new Date(new Date().toDateString())) / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    return `In ${days}d`;
  };

  const renderUpcomingEarnings = () => {
    const rows = holdingsEarnings.slice(0, 5);
    return (
      <Card title="Upcoming Earnings" subtitle="Next reports for your holdings">
        {activeTickers.length === 0 ? (
          <div className="p-[30px] text-center text-ws-text-3 text-xs">Add holdings to see upcoming earnings.</div>
        ) : holdingsEventsLoading ? (
          <div className="p-[30px] text-center text-ws-text-3 text-xs">Loading earnings...</div>
        ) : rows.length === 0 ? (
          <div className="p-[30px] text-center text-ws-text-3 text-xs">No earnings scheduled in the next 45 days.</div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: rows.length > 1 ? 'space-between' : 'flex-start' }}>
            {rows.map((e, idx) => (
              <div key={e.ticker + e.date} onClick={() => openInNewTab(`/stock/${e.ticker}`)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '10px 16px', cursor: 'pointer', borderTop: idx === 0 ? 'none' : '1px solid var(--ws-border)' }}
                onMouseEnter={ev => ev.currentTarget.style.background = 'var(--ws-bg-2)'}
                onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ws-text)' }}>{e.ticker}</div>
                  <div style={{ fontSize: '10px', color: 'var(--ws-text-3)', marginTop: '2px' }}>
                    {new Date(e.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    {e.hour && EARNINGS_HOUR_LABELS[e.hour] ? ` · ${EARNINGS_HOUR_LABELS[e.hour]}` : ''}
                  </div>
                </div>
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--ws-accent)', background: 'var(--ws-accent-dim)', padding: '3px 8px', borderRadius: '20px', flexShrink: 0 }}>
                  {daysUntilLabel(e.date)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    );
  };

  const renderRecentFilings = () => {
    const rows = holdingsFilings.slice(0, 5);
    return (
      <Card title="Recent Filings" subtitle="Latest SEC filings for your holdings">
        {activeTickers.length === 0 ? (
          <div className="p-[30px] text-center text-ws-text-3 text-xs">Add holdings to see recent filings.</div>
        ) : holdingsEventsLoading ? (
          <div className="p-[30px] text-center text-ws-text-3 text-xs">Loading filings...</div>
        ) : rows.length === 0 ? (
          <div className="p-[30px] text-center text-ws-text-3 text-xs">No recent filings found.</div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: rows.length > 1 ? 'space-between' : 'flex-start' }}>
            {rows.map((f, idx) => (
              <a key={f.ticker + f.date + f.form} href={f.url} target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '10px 16px', textDecoration: 'none', borderTop: idx === 0 ? 'none' : '1px solid var(--ws-border)' }}
                onMouseEnter={ev => ev.currentTarget.style.background = 'var(--ws-bg-2)'}
                onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ws-text)' }}>{f.ticker}</div>
                  <div style={{ fontSize: '10px', color: 'var(--ws-text-3)', marginTop: '2px' }}>
                    {new Date(f.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </div>
                </div>
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--ws-text-2)', background: 'var(--ws-bg-2)', border: '1px solid var(--ws-border)', padding: '3px 8px', borderRadius: '6px', flexShrink: 0 }}>
                  {FORM_LABELS[f.form] || f.form}
                </span>
              </a>
            ))}
          </div>
        )}
      </Card>
    );
  };

  const displayName = user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0];
  const todayLabel = new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="home-container" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', boxSizing: 'border-box' }}>
      <WelcomeModal />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--ws-text)', letterSpacing: '-0.5px', margin: 0 }}>
            {isSignedIn ? `Welcome back${displayName ? `, ${displayName}` : ''}` : 'Dashboard'}
          </h1>
          <p style={{ fontSize: '11px', color: 'var(--ws-text-3)', margin: '2px 0 0' }}>{todayLabel}</p>
        </div>
        <Link href="/portfolio" style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ws-accent)', textDecoration: 'none' }}>
          Manage Portfolio →
        </Link>
      </div>

      {renderKPIRow()}

      <div className="home-main-grid" style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr',
        gap: '20px'
      }}>
        {renderBenchmarkChart()}
        {renderHoldingsList()}
      </div>

      <div className="home-main-grid" style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
        gap: '20px'
      }}>
        {renderAllocation()}
        {renderTopMovers()}
        {renderMarketIntelligence()}
      </div>

      <div className="home-main-grid" style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
        gap: '20px'
      }}>
        {renderWorkspace()}
        {renderHeatmap()}
      </div>

      <div className="home-main-grid" style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
        gap: '20px'
      }}>
        {renderUpcomingEarnings()}
        {renderRecentFilings()}
      </div>

      <AdSlot slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOME} style={{ minHeight: '90px' }} />
    </div>
  );
}

