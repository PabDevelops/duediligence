'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '../../components/AuthProvider';
import Sparkline from '../../components/Sparkline';

// Utility formatters
import { fmt, fmtP as fmtPercent, fmtN } from '../../../lib/formatters';
import { useTickerSearch } from '../../../lib/hooks/useTickerSearch';
import SentimentBreadth from '../../components/workspace/compare/SentimentBreadth';
import EconomicCalendar from '../../components/workspace/compare/EconomicCalendar';
import TechnicalScanner from '../../components/workspace/compare/TechnicalScanner';
import InsiderActivity from '../../components/workspace/compare/InsiderActivity';
const fmtP = (v) => fmtPercent(v, { decimals: 1 });

// Curated thematic/industry baskets — migrated in from the old standalone Explore page.
// Explore's other categories (market movers, high/low P/E, volatility, upcoming earnings,
// watchlist) were cut entirely: movers and fundamentals already have dedicated tabs right
// here, and the dynamic screens duplicated what the Screener page does properly. These
// curated collections were the one thing Explore had that nothing else in the app covers.
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

export default function MarketRadar() {
  const router = useRouter();
  const { isSignedIn } = useUser();
  const [movers, setMovers] = useState(null);
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [watchlist, setWatchlist] = useState([]);

  // Spotlight state
  const [spotlightTicker, setSpotlightTicker] = useState(null);
  const [spotlightData, setSpotlightData] = useState(null);
  const [loadingSpotlight, setLoadingSpotlight] = useState(false);
  const [spotlightSparkline, setSpotlightSparkline] = useState(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const { suggestions } = useTickerSearch(searchQuery);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Tab control
  const [activeTab, setActiveTab] = useState('movers'); // 'movers' | 'fundamentals' | 'baskets'

  // Baskets tab state — fetched lazily per category, cached so re-selecting is instant
  const [basketCategory, setBasketCategory] = useState('bigtech');
  const [basketCache, setBasketCache] = useState({});
  const [loadingBasket, setLoadingBasket] = useState(false);

  // Load the selected basket, on demand, once per category
  useEffect(() => {
    if (activeTab !== 'baskets' || basketCache[basketCategory]) return;
    setLoadingBasket(true);
    fetch(`/api/explore?category=${basketCategory}`)
      .then(r => r.json())
      .then(data => {
        setBasketCache(prev => ({ ...prev, [basketCategory]: data.stocks || [] }));
        // Seed any tickers the cache didn't have yet, same on-demand pattern the ETF
        // screener's search bar uses — next visit to this category will show them.
        (data.missing || []).forEach(ticker => { fetch(`/api/stock?ticker=${ticker}`).catch(() => {}); });
      })
      .catch(() => setBasketCache(prev => ({ ...prev, [basketCategory]: [] })))
      .finally(() => setLoadingBasket(false));
  }, [activeTab, basketCategory, basketCache]);

  // Load indices & movers dataset
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [moversRes, marketsRes] = await Promise.all([
          fetch('/api/movers'),
          fetch('/api/market')
        ]);
        const moversData = await moversRes.json();
        const marketsData = await marketsRes.json();

        setMovers(moversData);
        setMarkets(marketsData.markets || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();

    if (isSignedIn) {
      fetch('/api/watchlist')
        .then(r => r.json())
        .then(d => setWatchlist(d.tickers?.map(t => t.ticker) || []))
        .catch(() => { });
    }
  }, [isSignedIn]);


  // Trigger spotlight on select
  const triggerSpotlight = async (ticker) => {
    const t = ticker.toUpperCase();
    setSpotlightTicker(t);
    setLoadingSpotlight(true);
    setSpotlightData(null);
    setSpotlightSparkline(null);
    setShowSuggestions(false);
    setSearchQuery('');

    try {
      const [stockRes, sparkRes] = await Promise.all([
        fetch(`/api/stock?ticker=${t}`),
        fetch(`/api/sparkline?ticker=${t}`)
      ]);
      const stockData = await stockRes.json();
      const sparkData = await sparkRes.json();

      if (!stockData.error) {
        setSpotlightData(stockData);
      }
      setSpotlightSparkline(sparkData.candles || null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSpotlight(false);
    }
  };

  // Watchlist save/remove action
  const toggleWatchlist = async (ticker) => {
    if (!isSignedIn) {
      router.push('/sign-in');
      return;
    }
    const inWatchlist = watchlist.includes(ticker);
    const method = inWatchlist ? 'DELETE' : 'POST';

    try {
      await fetch('/api/watchlist', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker })
      });
      setWatchlist(prev =>
        inWatchlist ? prev.filter(t => t !== ticker) : [...prev, ticker]
      );
    } catch (err) {
      console.error(err);
    }
  };

  // Calculate sector summary based on current daily stock lists
  const sectorPulse = useMemo(() => {
    if (!movers) return [];
    const allStocks = [
      ...(movers.gainers || []),
      ...(movers.losers || []),
      ...(movers.bigCapMovers || [])
    ];

    const groups = {};
    allStocks.forEach(s => {
      if (!s.sector) return;
      if (!groups[s.sector]) {
        groups[s.sector] = { totalPct: 0, count: 0, topStock: null, topVal: -Infinity };
      }
      groups[s.sector].totalPct += s.priceChangePct || 0;
      groups[s.sector].count += 1;

      if (s.priceChangePct > groups[s.sector].topVal) {
        groups[s.sector].topVal = s.priceChangePct;
        groups[s.sector].topStock = s.ticker;
      }
    });

    return Object.entries(groups)
      .map(([name, data]) => ({
        name,
        avgChange: data.totalPct / data.count,
        topStock: data.topStock,
        topChange: data.topVal
      }))
      .sort((a, b) => b.avgChange - a.avgChange);
  }, [movers]);

  // Compute local Traqcker Score 100 for Spotlight details
  const spotlightQuality = useMemo(() => {
    if (!spotlightData) return null;
    const d = spotlightData;
    // A recent IPO or thinly-covered ticker has no SEC/Finnhub fundamentals at all — every
    // input below would default to its neutral midpoint, producing a plausible-looking but
    // entirely made-up score. Same guard as the stock detail page's Quality Score.
    const hasFundamentals = d.revVal != null || d.niVal != null || d.marketCap != null
      || d.roic != null || d.grossMargin != null || (d.revHistory?.length ?? 0) > 0;
    if (!hasFundamentals) return null;

    const sector = (d.sector || '').toLowerCase();
    const isFinancial = sector.includes('bank') || sector.includes('insurance') || sector.includes('financial');
    const isTech = sector.includes('tech') || sector.includes('software') || sector.includes('semi');
    const isPharma = sector.includes('pharma') || sector.includes('biotech') || sector.includes('health');

    const roicThreshold = isTech ? 0.25 : isPharma ? 0.20 : 0.15;
    const gmThreshold = isTech ? 0.65 : isPharma ? 0.65 : isFinancial ? 0.30 : 0.35;
    const omThreshold = isTech ? 0.20 : isPharma ? 0.20 : isFinancial ? 0.15 : 0.15;

    const roicScore = d.roic == null ? 2.5 : d.roic / 100 >= roicThreshold * 2 ? 5 : d.roic / 100 >= roicThreshold * 1.5 ? 4.5 : d.roic / 100 >= roicThreshold ? 4 : d.roic / 100 >= roicThreshold * 0.7 ? 3 : d.roic / 100 >= roicThreshold * 0.4 ? 2 : 1;
    const gmScore = d.grossMargin == null ? 2.5 : d.grossMargin / 100 >= gmThreshold * 1.4 ? 5 : d.grossMargin / 100 >= gmThreshold * 1.15 ? 4.5 : d.grossMargin / 100 >= gmThreshold ? 4 : d.grossMargin / 100 >= gmThreshold * 0.75 ? 3 : d.grossMargin / 100 >= gmThreshold * 0.5 ? 2 : 1;
    const omScore = d.opMargin == null ? 2.5 : d.opMargin / 100 >= omThreshold * 2 ? 5 : d.opMargin / 100 >= omThreshold * 1.5 ? 4.5 : d.opMargin / 100 >= omThreshold ? 4 : d.opMargin / 100 >= omThreshold * 0.65 ? 3 : d.opMargin / 100 > 0 ? 2 : 1;
    const deScore = d.debtToEquity == null ? 2.5 : d.debtToEquity < 0.3 ? 5 : d.debtToEquity < 0.7 ? 4.5 : d.debtToEquity < 1.2 ? 4 : d.debtToEquity < 2 ? 3 : d.debtToEquity < 3 ? 2 : 1;

    const cbs = (roicScore * 0.4 + gmScore * 0.25 + omScore * 0.25 + deScore * 0.1);
    const pfcfScore = d.pfcf == null || d.pfcf <= 0 ? 1 : d.pfcf < 12 ? 5 : d.pfcf < 18 ? 4.5 : d.pfcf < 25 ? 4 : d.pfcf < 35 ? 3 : d.pfcf < 50 ? 2 : 1;
    const fcfYieldScore = d.fcfYield == null ? 1 : d.fcfYield > 8 ? 5 : d.fcfYield > 5 ? 4.5 : d.fcfYield > 3 ? 4 : d.fcfYield > 1.5 ? 3 : d.fcfYield > 0 ? 2 : 1;

    const oppo = (pfcfScore * 0.55 + fcfYieldScore * 0.45);
    const revGrowthScore = d.revGrowth == null ? 2.5 : d.revGrowth > 25 ? 5 : d.revGrowth > 15 ? 4.5 : d.revGrowth > 8 ? 4 : d.revGrowth > 3 ? 3 : d.revGrowth > 0 ? 2 : 1;

    const fcfTrend = d.fcfHistory?.length >= 3 ? d.fcfHistory[d.fcfHistory.length - 1]?.val > d.fcfHistory[0]?.val ? 1 : 0 : null;
    const marginTrend = d.marginHistory?.length >= 3 ? (d.marginHistory[d.marginHistory.length - 1]?.margin || 0) > (d.marginHistory[0]?.margin || 0) ? 1 : 0 : null;
    const trendBonus = (fcfTrend === 1 ? 0.5 : 0) + (marginTrend === 1 ? 0.5 : 0);
    const gqs = Math.min(5, revGrowthScore * 0.6 + (2.5 + trendBonus * 2) * 0.4);

    const finalNote = (cbs * 0.45 + oppo * 0.30 + gqs * 0.25);
    const score100 = Math.round((finalNote / 5) * 100);

    let verdict, verdictColor;
    if (score100 >= 70) { verdict = 'Solid & steady'; verdictColor = 'var(--ws-accent)'; }
    else if (score100 >= 40) { verdict = 'Mixed signals'; verdictColor = 'var(--ws-text-2)'; }
    else { verdict = 'Needs caution'; verdictColor = 'var(--ws-red)'; }

    return { score100, verdict, verdictColor };
  }, [spotlightData]);

  // Calculate VIX market
  const vixMarket = useMemo(() => markets.find(m => m.symbol === '^VIX'), [markets]);

  // Calculate S&P 500 1-month change
  const sp500Change = useMemo(() => {
    const sp500 = markets.find(m => m.symbol === '^GSPC');
    if (sp500 && sp500.candles?.length > 1) {
      const startPrice = sp500.candles[0].c;
      const endPrice = sp500.candles[sp500.candles.length - 1].c;
      return ((endPrice - startPrice) / startPrice) * 100;
    }
    return 0;
  }, [markets]);

  // Calculate Movers Advance/Decline Ratio
  const advanceDeclineRatio = useMemo(() => {
    const gainersCount = movers?.gainers?.length || 0;
    const losersCount = movers?.losers?.length || 0;
    const totalMovers = gainersCount + losersCount;
    return totalMovers > 0 ? gainersCount / totalMovers : 0.5;
  }, [movers]);

  if (loading) {
    return (
      <div style={{ padding: '24px', fontFamily: "'JetBrains Mono', monospace" }}>
        <div style={{ border: '1px solid var(--ws-border)', background: 'var(--ws-bg-1)', overflow: 'hidden' }}>
          <div style={{ background: 'var(--ws-bg-2)', borderBottom: '1px solid var(--ws-border)', padding: '7px 16px' }}>
            <span style={{ fontSize: '11px', color: 'var(--ws-accent)', fontWeight: 700, letterSpacing: '1px' }}>$ traq radar</span>
          </div>
          <div style={{ padding: '24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {['CONNECTING TO MARKET FEED...', 'FETCHING MOVERS & SECTORS...', 'COMPUTING SENTIMENT INDEX...'].map((line, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ color: 'var(--ws-accent)', fontSize: '11px' }}>▶</span>
                  <span style={{ color: 'var(--ws-text-3)', fontSize: '11px', letterSpacing: '1px' }}>{line}</span>
                </div>
              ))}
              <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="text-ws-text-3 text-[11px]">█░░░░░░░░░</span>
                <span style={{ color: 'var(--ws-text-3)', fontSize: '10px', letterSpacing: '1px' }}>LOADING MARKET RADAR...</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - var(--topbar-height))', background: 'var(--ws-bg)', color: 'var(--ws-text)', position: 'relative', overflowX: 'hidden' }}>

      {/* Left / Main radar display */}
      <div style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0 }}>

        {/* Terminal title bar */}
        <div style={{ border: '1px solid var(--ws-border)', background: 'var(--ws-bg-1)', overflow: 'hidden' }}>
          <div style={{ background: 'var(--ws-bg-2)', borderBottom: '1px solid var(--ws-border)', padding: '7px 16px' }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: 'var(--ws-accent)', fontWeight: 700, letterSpacing: '1px' }}>
              $ traq radar
            </span>
          </div>
        </div>

        {/* Dense 3-Column Macro & Technical Dashboards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
          <SentimentBreadth vixMarket={vixMarket} sp500Change={sp500Change} advanceDeclineRatio={advanceDeclineRatio} />
          <EconomicCalendar triggerSpotlight={triggerSpotlight} />
          <TechnicalScanner movers={movers} triggerSpotlight={triggerSpotlight} />
          <InsiderActivity movers={movers} triggerSpotlight={triggerSpotlight} />
        </div>

        {/* Markets Indices Tracker */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          {markets.filter(m => m.symbol !== '^VIX').map(m => {
            const isUp = m.changePct >= 0;
            return (
              <div key={m.symbol} style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--ws-text-3)' }}>{m.label}</span>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: isUp ? 'var(--ws-accent)' : 'var(--ws-red)' }}>
                    {isUp ? '+' : '-'}{Math.abs(m.changePct)?.toFixed(2)}%
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <span style={{ fontSize: '16px', fontWeight: 800 }}>
                    {m.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  {m.candles?.length > 1 && (
                    <div style={{ opacity: 0.85 }}>
                      <Sparkline data={m.candles} width={70} height={20} color={isUp ? 'var(--ws-accent)' : 'var(--ws-red)'} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Sectors performance matrix */}
        <div>
          <div style={{ fontSize: '10px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: 'var(--ws-text-3)', letterSpacing: '1.5px', marginBottom: '10px' }}>SECTOR MOMENTUM INDEX</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
              {sectorPulse.map(sec => {
                const isUp = sec.avgChange >= 0;
                return (
                  <div key={sec.name} style={{
                    background: 'var(--ws-bg-1)',
                    border: '1px solid var(--ws-border)',
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    position: 'relative',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      position: 'absolute',
                      top: 0, right: 0, bottom: 0, left: 0,
                      background: isUp ? 'rgba(16, 185, 129, 0.02)' : 'rgba(239, 68, 68, 0.02)',
                      zIndex: 0
                    }} />
                    <div style={{ zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ws-text-2)', lineHeight: 1.2, flex: 1, marginRight: '6px' }}>
                        {sec.name}
                      </span>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: isUp ? 'var(--ws-accent)' : 'var(--ws-red)', flexShrink: 0 }}>
                        {isUp ? '+' : '-'}{Math.abs(sec.avgChange).toFixed(2)}%
                      </span>
                    </div>
                    <div style={{ zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '9px', color: 'var(--ws-text-3)' }}>
                      <span>Top: <b style={{ cursor: 'pointer', color: 'var(--ws-text-2)' }} onClick={() => triggerSpotlight(sec.topStock)}>{sec.topStock}</b></span>
                      <span style={{ color: sec.topChange >= 0 ? 'var(--ws-accent)' : 'var(--ws-red)' }}>
                        {sec.topChange >= 0 ? '+' : '-'}{Math.abs(sec.topChange).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                );
            })}
          </div>
        </div>

        {/* Tab Selector */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--ws-border)', gap: '16px', marginTop: '10px' }}>
          <button
            onClick={() => setActiveTab('movers')}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'movers' ? '2.5px solid var(--ws-accent)' : '2.5px solid transparent',
              color: activeTab === 'movers' ? 'var(--ws-text)' : 'var(--ws-text-3)',
              padding: '8px 12px 10px',
              fontWeight: 800,
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
          >
            DAILY MOVERS PULSE
          </button>
          <button
            onClick={() => setActiveTab('fundamentals')}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'fundamentals' ? '2.5px solid var(--ws-accent)' : '2.5px solid transparent',
              color: activeTab === 'fundamentals' ? 'var(--ws-text)' : 'var(--ws-text-3)',
              padding: '8px 12px 10px',
              fontWeight: 800,
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
          >
            FUNDAMENTAL LEADERS
          </button>
          <button
            onClick={() => setActiveTab('baskets')}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'baskets' ? '2.5px solid var(--ws-accent)' : '2.5px solid transparent',
              color: activeTab === 'baskets' ? 'var(--ws-text)' : 'var(--ws-text-3)',
              padding: '8px 12px 10px',
              fontWeight: 800,
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
          >
            BASKETS
          </button>
        </div>

        {/* Data Cards Grid */}
        {activeTab === 'baskets' ? (
          <div>
            {/* Category pills — two labeled groups, thematic then industry */}
            {[
              { title: 'THEMATIC', items: THEME_CATEGORIES },
              { title: 'INDUSTRIES', items: INDUSTRY_CATEGORIES },
            ].map(group => (
              <div key={group.title} style={{ marginBottom: '10px' }}>
                <div style={{ fontSize: '9px', fontWeight: 800, color: 'var(--ws-text-3)', letterSpacing: '1.5px', marginBottom: '6px' }}>
                  {group.title}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {group.items.map(cat => (
                    <button key={cat.id} onClick={() => setBasketCategory(cat.id)}
                      style={{
                        padding: '5px 10px',
                        fontSize: '11px',
                        fontWeight: basketCategory === cat.id ? 700 : 500,
                        background: basketCategory === cat.id ? 'var(--ws-accent-dim)' : 'var(--ws-bg-1)',
                        border: '1px solid ' + (basketCategory === cat.id ? 'var(--ws-accent)' : 'var(--ws-border)'),
                        color: basketCategory === cat.id ? 'var(--ws-accent)' : 'var(--ws-text-2)',
                        cursor: 'pointer',
                      }}>
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {/* Basket results table */}
            <div className="bg-ws-bg-1 border border-ws-border overflow-hidden" style={{ marginTop: '14px' }}>
              {loadingBasket ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ws-text-3)', fontSize: '11px' }}>
                  LOADING…
                </div>
              ) : (basketCache[basketCategory] || []).length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ws-text-3)', fontSize: '12px' }}>
                  No data available for this basket yet.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'var(--ws-bg-2)' }}>
                      <th style={{ padding: '10px 16px', fontWeight: 700, fontSize: '10px', color: 'var(--ws-text-3)', borderBottom: '2px solid var(--ws-border)' }}>NAME</th>
                      <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, fontSize: '10px', color: 'var(--ws-text-3)', borderBottom: '2px solid var(--ws-border)' }}>PRICE</th>
                      <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, fontSize: '10px', color: 'var(--ws-text-3)', borderBottom: '2px solid var(--ws-border)' }}>CHANGE</th>
                      <th style={{ padding: '10px 16px', width: '40px', borderBottom: '2px solid var(--ws-border)' }} />
                    </tr>
                  </thead>
                  <tbody>
                    {basketCache[basketCategory].map((s, idx) => {
                      const isUp = s.priceChangePct != null && s.priceChangePct >= 0;
                      const inWatchlist = watchlist.includes(s.ticker);
                      return (
                        <tr key={s.ticker} onClick={() => triggerSpotlight(s.ticker)}
                          style={{ cursor: 'pointer', background: idx % 2 === 0 ? 'var(--ws-bg-1)' : 'var(--ws-bg-2)', borderBottom: '1px solid var(--ws-border)' }}>
                          <td style={{ padding: '10px 16px' }}>
                            <span style={{ fontWeight: 800, color: 'var(--ws-text)', marginRight: '8px' }}>{s.ticker}</span>
                            <span style={{ color: 'var(--ws-text-2)', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                          </td>
                          <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--ws-text)' }}>
                            {s.currentPrice != null ? `$${s.currentPrice.toFixed(2)}` : '—'}
                          </td>
                          <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: s.priceChangePct == null ? 'var(--ws-text-3)' : isUp ? 'var(--ws-accent)' : 'var(--ws-red)' }}>
                            {s.priceChangePct != null ? `${isUp ? '+' : ''}${s.priceChangePct.toFixed(2)}%` : '—'}
                          </td>
                          <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleWatchlist(s.ticker); }}
                              title={inWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist'}
                              style={{
                                width: '22px', height: '22px', borderRadius: '4px', border: '1px solid var(--ws-border)',
                                background: inWatchlist ? 'var(--ws-text)' : 'var(--ws-bg-2)',
                                color: inWatchlist ? 'var(--ws-bg)' : 'var(--ws-text)',
                                fontSize: '12px', fontWeight: 700, cursor: 'pointer', lineHeight: 1,
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
          </div>
        ) : activeTab === 'movers' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {/* Top Gainers */}
            <div className="bg-ws-bg-1 border border-ws-border p-4 flex flex-col gap-2.5">
              <div className="flex justify-between items-center border-b border-ws-border pb-2">
                <span className="text-[11px] font-extrabold text-ws-accent tracking-[1px]">TOP GAINERS</span>
                <span className="text-[9px] text-ws-text-3">Fresh Cache</span>
              </div>
              <div className="flex flex-col gap-0.5">
                {(movers?.gainers || []).slice(0, 5).map(s => (
                  <div key={s.ticker} onClick={() => triggerSpotlight(s.ticker)} className="flex items-center justify-between px-1.5 py-2 rounded-[6px] cursor-pointer transition-[background] duration-150" onMouseEnter={e => e.currentTarget.style.background = 'var(--ws-bg-2)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                    <div>
                      <div className="font-extrabold text-xs">{s.ticker}</div>
                      <div style={{ fontSize: '10px', color: 'var(--ws-text-3)', maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="font-bold text-xs">${s.currentPrice?.toFixed(2)}</div>
                      <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--ws-accent)' }}>+{s.priceChangePct?.toFixed(2)}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Losers */}
            <div className="bg-ws-bg-1 border border-ws-border p-4 flex flex-col gap-2.5">
              <div className="flex justify-between items-center border-b border-ws-border pb-2">
                <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--ws-red)', letterSpacing: '1px' }}>TOP LOSERS</span>
                <span className="text-[9px] text-ws-text-3">Fresh Cache</span>
              </div>
              <div className="flex flex-col gap-0.5">
                {(movers?.losers || []).slice(0, 5).map(s => (
                  <div key={s.ticker} onClick={() => triggerSpotlight(s.ticker)} className="flex items-center justify-between px-1.5 py-2 rounded-[6px] cursor-pointer transition-[background] duration-150" onMouseEnter={e => e.currentTarget.style.background = 'var(--ws-bg-2)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                    <div>
                      <div className="font-extrabold text-xs">{s.ticker}</div>
                      <div style={{ fontSize: '10px', color: 'var(--ws-text-3)', maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="font-bold text-xs">${s.currentPrice?.toFixed(2)}</div>
                      <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--ws-red)' }}>{s.priceChangePct?.toFixed(2)}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Heavyweights movers */}
            <div className="bg-ws-bg-1 border border-ws-border p-4 flex flex-col gap-2.5">
              <div className="flex justify-between items-center border-b border-ws-border pb-2">
                <span className="text-[11px] font-extrabold text-ws-accent tracking-[1px]">BIG CAP MOVERS</span>
                <span className="text-[9px] text-ws-text-3">&gt;$10B Cap</span>
              </div>
              <div className="flex flex-col gap-0.5">
                {(movers?.bigCapMovers || []).slice(0, 5).map(s => {
                  const isUp = s.priceChangePct >= 0;
                  return (
                    <div key={s.ticker} onClick={() => triggerSpotlight(s.ticker)} className="flex items-center justify-between px-1.5 py-2 rounded-[6px] cursor-pointer transition-[background] duration-150" onMouseEnter={e => e.currentTarget.style.background = 'var(--ws-bg-2)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                      <div>
                        <div className="font-extrabold text-xs">{s.ticker}</div>
                        <div style={{ fontSize: '10px', color: 'var(--ws-text-3)', maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div className="font-bold text-xs">{fmt(s.marketCap)}</div>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: isUp ? 'var(--ws-accent)' : 'var(--ws-red)' }}>{isUp ? '+' : '-'}{Math.abs(s.priceChangePct)?.toFixed(2)}%</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            {/* Top Score */}
            <div className="bg-ws-bg-1 border border-ws-border p-4 flex flex-col gap-2.5">
              <div className="border-b border-ws-border pb-2">
                <span className="text-[11px] font-extrabold text-ws-accent tracking-[1px]">TRAQCKER SCORE</span>
              </div>
              <div className="flex flex-col gap-0.5">
                {(movers?.topScore || []).slice(0, 5).map(s => (
                  <div key={s.ticker} onClick={() => triggerSpotlight(s.ticker)} className="flex items-center justify-between px-1.5 py-2 rounded-[6px] cursor-pointer transition-[background] duration-150" onMouseEnter={e => e.currentTarget.style.background = 'var(--ws-bg-2)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                    <div>
                      <div className="font-extrabold text-xs">{s.ticker}</div>
                      <div className="text-[10px] text-ws-text-3">{s.sector}</div>
                    </div>
                    <div style={{ fontWeight: 800, color: 'var(--ws-accent)', fontSize: '13px' }}>
                      {s.score ? `${Math.round(s.score * 20)}/100` : '—'}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Quality Score (CBS) */}
            <div className="bg-ws-bg-1 border border-ws-border p-4 flex flex-col gap-2.5">
              <div className="border-b border-ws-border pb-2">
                <span className="text-[11px] font-extrabold text-ws-accent tracking-[1px]">QUALITY SCORE LEADERS</span>
              </div>
              <div className="flex flex-col gap-0.5">
                {(movers?.topQuality || []).slice(0, 5).map(s => (
                  <div key={s.ticker} onClick={() => triggerSpotlight(s.ticker)} className="flex items-center justify-between px-1.5 py-2 rounded-[6px] cursor-pointer transition-[background] duration-150" onMouseEnter={e => e.currentTarget.style.background = 'var(--ws-bg-2)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                    <div>
                      <div className="font-extrabold text-xs">{s.ticker}</div>
                      <div className="text-[10px] text-ws-text-3">{s.sector}</div>
                    </div>
                    <div style={{ fontWeight: 800, color: 'var(--ws-accent)', fontSize: '13px' }}>
                      {s.cbs ? `${Math.round(s.cbs * 20)}/100` : '—'}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top OPPO Score */}
            <div className="bg-ws-bg-1 border border-ws-border p-4 flex flex-col gap-2.5">
              <div className="border-b border-ws-border pb-2">
                <span className="text-[11px] font-extrabold text-ws-accent tracking-[1px]">OPPO SCORE LEADERS</span>
              </div>
              <div className="flex flex-col gap-0.5">
                {(movers?.topOppo || []).slice(0, 5).map(s => (
                  <div key={s.ticker} onClick={() => triggerSpotlight(s.ticker)} className="flex items-center justify-between px-1.5 py-2 rounded-[6px] cursor-pointer transition-[background] duration-150" onMouseEnter={e => e.currentTarget.style.background = 'var(--ws-bg-2)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                    <div>
                      <div className="font-extrabold text-xs">{s.ticker}</div>
                      <div className="text-[10px] text-ws-text-3">{s.sector}</div>
                    </div>
                    <div style={{ fontWeight: 800, color: 'var(--ws-accent)', fontSize: '13px' }}>
                      {s.oppo ? `${Math.round(s.oppo * 20)}/100` : '—'}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top ROIC */}
            <div className="bg-ws-bg-1 border border-ws-border p-4 flex flex-col gap-2.5">
              <div className="border-b border-ws-border pb-2">
                <span className="text-[11px] font-extrabold text-ws-accent tracking-[1px]">TOP ROIC</span>
              </div>
              <div className="flex flex-col gap-0.5">
                {(movers?.topRoic || []).slice(0, 5).map(s => (
                  <div key={s.ticker} onClick={() => triggerSpotlight(s.ticker)} className="flex items-center justify-between px-1.5 py-2 rounded-[6px] cursor-pointer transition-[background] duration-150" onMouseEnter={e => e.currentTarget.style.background = 'var(--ws-bg-2)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                    <div>
                      <div className="font-extrabold text-xs">{s.ticker}</div>
                      <div className="text-[10px] text-ws-text-3">{s.sector}</div>
                    </div>
                    <div style={{ fontWeight: 800, color: 'var(--ws-text)', fontSize: '12px' }}>
                      {fmtP(s.roic)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top FCF Yield */}
            <div className="bg-ws-bg-1 border border-ws-border p-4 flex flex-col gap-2.5">
              <div className="border-b border-ws-border pb-2">
                <span className="text-[11px] font-extrabold text-ws-accent tracking-[1px]">FCF YIELD KINGS</span>
              </div>
              <div className="flex flex-col gap-0.5">
                {(movers?.topFcfYield || []).slice(0, 5).map(s => (
                  <div key={s.ticker} onClick={() => triggerSpotlight(s.ticker)} className="flex items-center justify-between px-1.5 py-2 rounded-[6px] cursor-pointer transition-[background] duration-150" onMouseEnter={e => e.currentTarget.style.background = 'var(--ws-bg-2)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                    <div>
                      <div className="font-extrabold text-xs">{s.ticker}</div>
                      <div className="text-[10px] text-ws-text-3">{s.sector}</div>
                    </div>
                    <div style={{ fontWeight: 800, color: 'var(--ws-text)', fontSize: '12px' }}>
                      {fmtP(s.fcfYield)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Revenue Growth */}
            <div className="bg-ws-bg-1 border border-ws-border p-4 flex flex-col gap-2.5">
              <div className="border-b border-ws-border pb-2">
                <span className="text-[11px] font-extrabold text-ws-accent tracking-[1px]">REVENUE GROWTH</span>
              </div>
              <div className="flex flex-col gap-0.5">
                {(movers?.topRevGrowth || []).slice(0, 5).map(s => (
                  <div key={s.ticker} onClick={() => triggerSpotlight(s.ticker)} className="flex items-center justify-between px-1.5 py-2 rounded-[6px] cursor-pointer transition-[background] duration-150" onMouseEnter={e => e.currentTarget.style.background = 'var(--ws-bg-2)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                    <div>
                      <div className="font-extrabold text-xs">{s.ticker}</div>
                      <div className="text-[10px] text-ws-text-3">{s.sector}</div>
                    </div>
                    <div style={{ fontWeight: 800, color: 'var(--ws-accent)', fontSize: '12px' }}>
                      +{fmtP(s.revGrowth)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right Spotlight Panel Backdrop on Mobile */}
      {spotlightTicker && (
        <div className="radar-spotlight-backdrop" onClick={() => { setSpotlightTicker(null); setSpotlightData(null); }} />
      )}

      {/* Right Spotlight Panel (Side drawer / cockpit analyzer) */}
      <div className={`radar-spotlight-panel ${spotlightTicker ? 'open' : ''}`}>
        {spotlightTicker ? (
          loadingSpotlight ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--ws-text-3)' }}>
              <div style={{ width: '30px', height: '30px', border: '2px solid var(--ws-accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spinLoader 1s linear infinite', marginBottom: '12px' }} />
              <div style={{ fontSize: '11px', fontWeight: 600 }}>SCANNING {spotlightTicker} METRICS…</div>
            </div>
          ) : spotlightData ? (
            <>
              {/* Header Info */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h2 style={{ fontSize: '20px', fontWeight: 900, margin: 0, color: 'var(--ws-text)' }}>{spotlightData.ticker}</h2>
                    <span style={{ fontSize: '9px', color: 'var(--ws-text-3)', background: 'var(--ws-bg-2)', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                      {spotlightData.exchange}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--ws-text-3)', margin: '4px 0 0 0', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {spotlightData.name}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  {/* Save Watchlist Icon Toggle */}
                  <button
                    onClick={() => toggleWatchlist(spotlightData.ticker)}
                    style={{
                      background: 'var(--ws-bg-2)',
                      border: '1px solid var(--ws-border)',
                      borderRadius: '50%',
                      width: '32px',
                      height: '32px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: watchlist.includes(spotlightData.ticker) ? '#f59e0b' : 'var(--ws-text-3)',
                      transition: 'all 0.15s'
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill={watchlist.includes(spotlightData.ticker) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  </button>
                  {/* Close Spotlight */}
                  <button
                    onClick={() => { setSpotlightTicker(null); setSpotlightData(null); }}
                    style={{
                      background: 'var(--ws-bg-2)',
                      border: '1px solid var(--ws-border)',
                      borderRadius: '50%',
                      width: '32px',
                      height: '32px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: 'var(--ws-text-2)',
                      fontWeight: 800
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Price Details */}
              <div style={{ background: 'var(--ws-bg-2)', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '20px', fontWeight: 800 }}>${spotlightData.currentPrice?.toFixed(2) || '—'}</span>
                  <span style={{ fontSize: '11px', fontWeight: 700, marginLeft: '8px', color: spotlightData.priceChangePct >= 0 ? 'var(--ws-accent)' : 'var(--ws-red)' }}>
                    {spotlightData.priceChangePct >= 0 ? '+' : ''}{spotlightData.priceChangePct?.toFixed(2)}%
                  </span>
                </div>
                {spotlightSparkline?.length > 1 && (
                  <Sparkline data={spotlightSparkline} width={75} height={25} />
                )}
              </div>

              {/* Quality Score — same block-bar treatment as the stock detail page */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--ws-border)', borderTop: '1px solid var(--ws-border)' }}>
                <div style={{ fontSize: '9px', fontWeight: 800, color: 'var(--ws-text-3)', letterSpacing: '1.5px', marginBottom: '8px' }}>QUALITY SCORE</div>
                {!spotlightQuality ? (
                  <div style={{ fontSize: '10px', color: 'var(--ws-text-3)', textAlign: 'center', maxWidth: '160px', lineHeight: 1.5 }}>
                    No fundamentals reported yet.
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', color: spotlightQuality.verdictColor, letterSpacing: '1.5px', lineHeight: 1 }}>
                        {'█'.repeat(Math.round(spotlightQuality.score100 / 10))}{'░'.repeat(10 - Math.round(spotlightQuality.score100 / 10))}
                      </span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '22px', fontWeight: 700, color: spotlightQuality.verdictColor, lineHeight: 1 }}>
                        {spotlightQuality.score100}
                      </span>
                    </div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', fontWeight: 700, color: spotlightQuality.verdictColor, letterSpacing: '1px', marginTop: '4px' }}>
                      {spotlightQuality.verdict.toUpperCase()}
                    </div>
                  </>
                )}
              </div>

              {/* Metrics Table */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Sector & Industry */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                  <span className="text-ws-text-3">Sector</span>
                  <span className="font-bold text-ws-text">{spotlightData.sector || '—'}</span>
                </div>

                {/* Valuation */}
                <div>
                  <div style={{ fontSize: '9px', fontWeight: 800, color: 'var(--ws-text-3)', letterSpacing: '1px', marginBottom: '6px' }}>VALUATION</div>
                  <div className="flex flex-col gap-1.5 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-ws-text-3">P/E Ratio</span>
                      <span className="font-bold">{fmtN(spotlightData.pe)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ws-text-3">P/FCF Ratio</span>
                      <span className="font-bold">{fmtN(spotlightData.pfcf)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ws-text-3">EV / EBITDA</span>
                      <span className="font-bold">{fmtN(spotlightData.evEbitda)}</span>
                    </div>
                  </div>
                </div>

                {/* Profitability */}
                <div>
                  <div style={{ fontSize: '9px', fontWeight: 800, color: 'var(--ws-text-3)', letterSpacing: '1px', marginBottom: '6px' }}>PROFITABILITY</div>
                  <div className="flex flex-col gap-1.5 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-ws-text-3">Gross Margin</span>
                      <span className="font-bold text-ws-accent">{fmtP(spotlightData.grossMargin)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ws-text-3">Operating Margin</span>
                      <span className="font-bold">{fmtP(spotlightData.opMargin)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ws-text-3">ROIC</span>
                      <span className="font-bold text-ws-accent">{fmtP(spotlightData.roic)}</span>
                    </div>
                  </div>
                </div>

                {/* Growth */}
                <div>
                  <div style={{ fontSize: '9px', fontWeight: 800, color: 'var(--ws-text-3)', letterSpacing: '1px', marginBottom: '6px' }}>GROWTH & LIQUIDITY</div>
                  <div className="flex flex-col gap-1.5 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-ws-text-3">YoY Growth</span>
                      <span className="font-bold text-ws-accent">+{fmtP(spotlightData.revGrowth)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ws-text-3">EPS CAGR (Est)</span>
                      <span className="font-bold">{spotlightData.epsCagr !== null ? `${spotlightData.epsCagr}%` : '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ws-text-3">Net Debt</span>
                      <span className="font-bold">{fmt(spotlightData.netDebt)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ws-text-3">Debt / Equity</span>
                      <span className="font-bold">{fmtN(spotlightData.debtToEquity)}x</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'auto', paddingTop: '10px' }}>
                <button
                  onClick={() => router.push(`/stock/${spotlightData.ticker}`)}
                  style={{
                    width: '100%',
                    background: 'var(--ws-text)',
                    color: 'var(--ws-bg)',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '12px',
                    padding: '10px 12px',
                    cursor: 'pointer',
                    transition: 'opacity 0.15s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                >
                  Open Analysis Terminal →
                </button>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--ws-text-3)', fontSize: '11px', textAlign: 'center' }}>
              Ticker failed to load. Please try checking another stock.
            </div>
          )
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--ws-text-3)', textAlign: 'center', padding: '0 10px', width: '100%', boxSizing: 'border-box' }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              border: '1.5px dashed rgba(20, 184, 166, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px'
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--ws-accent)" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ws-text-2)', marginBottom: '6px' }}>Terminal Scan Idle</div>
            <div style={{ fontSize: '11px', lineHeight: 1.5, marginBottom: '14px' }}>
              Select any company from the lists or enter a ticker symbol to analyze metrics inside this cockpit.
            </div>

            {/* Quick Search inside Idle Drawer */}
            <div style={{ position: 'relative', width: '100%', maxWidth: '280px' }}>
              <input
                type="text"
                placeholder="Scan ticker... (e.g. AAPL)"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setShowSuggestions(true); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery) {
                    triggerSpotlight(searchQuery);
                  }
                }}
                style={{
                  width: '100%',
                  background: 'var(--ws-bg-2)',
                  border: '1px solid var(--ws-border)',
                  borderRadius: '8px',
                  color: 'var(--ws-text)',
                  fontSize: '12px',
                  padding: '9px 12px 9px 32px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s ease'
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              />
              {/* Search Icon */}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ws-text-3)" strokeWidth="2.5" style={{ position: 'absolute', left: '10px', top: '12px' }}>
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>

              {/* Suggestions Dropdown (Opens upwards inside sidebar) */}
              {showSuggestions && suggestions.length > 0 && (
                <div style={{
                  position: 'absolute',
                  bottom: '42px',
                  left: 0,
                  right: 0,
                  background: 'var(--ws-bg-1)',
                  border: '1px solid var(--ws-border)',
                  boxShadow: '0 -10px 25px rgba(0,0,0,0.5)',
                  zIndex: 10,
                  maxHeight: '160px',
                  overflowY: 'auto'
                }}>
                  {suggestions.map(s => (
                    <div
                      key={s.ticker}
                      onMouseDown={() => triggerSpotlight(s.ticker)}
                      style={{
                        padding: '8px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        borderBottom: '1px solid var(--ws-border)',
                        transition: 'background 0.15s',
                        textAlign: 'left'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--ws-bg-2)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      <div>
                        <span style={{ fontWeight: 800, color: 'var(--ws-accent)', marginRight: '8px' }}>{s.ticker}</span>
                        <span style={{ fontSize: '11px', color: 'var(--ws-text-2)' }}>{s.name}</span>
                      </div>
                      <span className="text-[9px] text-ws-text-3">{s.exchange}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes scanPulse {
          0% { opacity: 0.35; }
          50% { opacity: 1; }
          100% { opacity: 0.35; }
        }
      `}</style>

    </div>
  );
}
