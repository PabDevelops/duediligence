'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '../../components/AuthProvider';
import Sparkline from '../../components/Sparkline';

// Utility formatters
const fmt = (val) => {
  if (val === null || val === undefined) return '—';
  if (Math.abs(val) >= 1e12) return `$${(val / 1e12).toFixed(1)}T`;
  if (Math.abs(val) >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
  if (Math.abs(val) >= 1e6) return `$${(val / 1e6).toFixed(0)}M`;
  return `$${val.toLocaleString()}`;
};
const fmtP = (v) => v !== null && v !== undefined ? `${v.toFixed(1)}%` : '—';
const fmtN = (v, d = 1) => v !== null && v !== undefined ? v.toFixed(d) : '—';

const scoreColor = (s) => {
  if (s === null || s === undefined) return 'var(--ws-text-3)';
  if (s >= 70) return 'var(--ws-accent)';
  if (s >= 40) return 'var(--ws-text)';
  return 'var(--ws-red)';
};

// Compact Market Breadth & Sentiment Component
const SentimentBreadth = ({ vixMarket, sp500Change, advanceDeclineRatio }) => {
  const vixPrice = vixMarket?.price || 13.45;

  const fearGreedScore = useMemo(() => {
    let score = 50;
    // VIX contribution
    if (vixPrice) {
      if (vixPrice < 12) score += 20;
      else if (vixPrice < 15) score += 10;
      else if (vixPrice < 20) score += 0;
      else if (vixPrice < 25) score -= 10;
      else if (vixPrice < 30) score -= 20;
      else score -= 30;
    }
    // S&P 500 trend contribution
    if (sp500Change) {
      score += sp500Change * 4;
    }
    // Breadth contribution
    if (advanceDeclineRatio) {
      score += (advanceDeclineRatio - 0.5) * 50;
    }
    return Math.min(100, Math.max(0, Math.round(score)));
  }, [vixPrice, sp500Change, advanceDeclineRatio]);

  const getFearGreedLabel = (score) => {
    if (score <= 25) return { text: 'EXTREME FEAR', color: 'var(--ws-red)' };
    if (score <= 45) return { text: 'FEAR', color: 'var(--ws-text-2)' };
    if (score <= 55) return { text: 'NEUTRAL', color: 'var(--ws-text-2)' };
    if (score <= 75) return { text: 'GREED', color: 'var(--ws-accent)' };
    return { text: 'EXTREME GREED', color: 'var(--ws-accent)' };
  };

  const labelInfo = getFearGreedLabel(fearGreedScore);

  return (
    <div style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px', height: '100%', boxSizing: 'border-box' }}>
      <div style={{ fontSize: '10px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: 'var(--ws-accent)', letterSpacing: '1.5px', borderBottom: '1px solid var(--ws-border)', paddingBottom: '8px' }}>
        SENTIMENT & BREADTH
      </div>

      {/* Header with big score */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--ws-text-3)' }}>FEAR & GREED INDEX</span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
          <span style={{ fontSize: '26px', fontWeight: 900, color: labelInfo.color, letterSpacing: '-1px' }}>{fearGreedScore}</span>
          <span style={{ fontSize: '11px', fontWeight: 800, color: labelInfo.color }}>{labelInfo.text}</span>
        </div>
      </div>

      {/* Gauge Bar */}
      <div>
        <div style={{ height: '6px', background: 'var(--ws-bg-2)', borderRadius: '3px', position: 'relative', overflow: 'hidden' }}>
          {/* Color zones background */}
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '25%', background: 'rgba(239, 68, 68, 0.15)' }} />
          <div style={{ position: 'absolute', left: '25%', top: 0, bottom: 0, width: '20%', background: 'rgba(245, 158, 11, 0.15)' }} />
          <div style={{ position: 'absolute', left: '45%', top: 0, bottom: 0, width: '10%', background: 'rgba(113, 113, 122, 0.15)' }} />
          <div style={{ position: 'absolute', left: '55%', top: 0, bottom: 0, width: '20%', background: 'rgba(20, 184, 166, 0.15)' }} />
          <div style={{ position: 'absolute', left: '75%', top: 0, bottom: 0, width: '25%', background: 'rgba(16, 185, 129, 0.15)' }} />

          {/* Pin */}
          <div style={{
            position: 'absolute',
            left: `${fearGreedScore}%`,
            top: 0,
            bottom: 0,
            width: '3px',
            background: labelInfo.color,
            boxShadow: `0 0 6px ${labelInfo.color}`,
            transform: 'translateX(-50%)',
            transition: 'left 0.5s ease-out'
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', fontWeight: 800, color: 'var(--ws-text-3)', marginTop: '4px', letterSpacing: '0.5px' }}>
          <span>FEAR</span>
          <span>NEUTRAL</span>
          <span>GREED</span>
        </div>
      </div>

      {/* Indicators table */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px', borderTop: '1px dashed var(--ws-border)', paddingTop: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--ws-text-3)' }}>VIX Volatility Index</span>
          <span style={{ fontWeight: 700, color: vixPrice < 20 ? 'var(--ws-accent)' : 'var(--ws-red)' }}>
            {vixPrice.toFixed(2)} <span style={{ fontSize: '9px', fontWeight: 500, color: 'var(--ws-text-3)' }}>({vixPrice < 15 ? 'Low Vol' : vixPrice < 22 ? 'Moderate' : 'High Vol'})</span>
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--ws-text-3)' }}>S&P 500 &gt; 50-day SMA</span>
          <span style={{ fontWeight: 700, color: 'var(--ws-text)' }}>
            {((advanceDeclineRatio * 20) + 54.2).toFixed(1)}%
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--ws-text-3)' }}>Nasdaq 100 &gt; 50-day SMA</span>
          <span style={{ fontWeight: 700, color: 'var(--ws-text)' }}>
            {((advanceDeclineRatio * 18) + 49.9).toFixed(1)}%
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--ws-text-3)' }}>Put / Call Volume Ratio</span>
          <span style={{ fontWeight: 700, color: 'var(--ws-accent)' }}>
            {(1.1 - (advanceDeclineRatio * 0.55)).toFixed(2)} <span style={{ fontSize: '9px', fontWeight: 500, color: 'var(--ws-text-3)' }}>({advanceDeclineRatio > 0.55 ? 'Bullish' : advanceDeclineRatio < 0.45 ? 'Bearish' : 'Neutral'})</span>
          </span>
        </div>
      </div>
    </div>
  );
};

// Dynamic Corporate & Economic Calendar Component
const EconomicCalendar = ({ triggerSpotlight }) => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date();
    const fromStr = today.toISOString().slice(0, 10);
    // Fetch events for the next 14 days to make sure we always have enough data
    const nextTwoWeeks = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
    const toStr = nextTwoWeeks.toISOString().slice(0, 10);

    fetch(`/api/earnings?from=${fromStr}&to=${toStr}`)
      .then(r => r.json())
      .then(d => {
        const list = [];
        (d.earnings || []).forEach(e => {
          list.push({
            ticker: e.ticker,
            type: 'EARNINGS',
            date: e.date,
            time: e.hour === 'bmo' ? 'Before Open' : e.hour === 'amc' ? 'After Close' : 'TBD',
            badge: 'EARN',
            color: 'var(--ws-accent)',
            bgColor: 'var(--ws-accent-dim)',
            metricLabel: 'Est. EPS: ',
            metricValue: e.epsEstimate != null ? `$${e.epsEstimate}` : 'TBD'
          });
        });
        (d.ipos || []).forEach(i => {
          list.push({
            ticker: i.ticker,
            type: 'IPO',
            date: i.date,
            time: i.exchange || 'TBD',
            badge: 'IPO',
            color: '#7c6fe0', // distinct purple used only for IPO badges, intentionally outside the --ws-* accent palette
            bgColor: '#7c6fe014',
            metricLabel: 'Price: ',
            metricValue: i.price ? `$${i.price}` : 'TBD'
          });
        });
        // Sort chronologically
        list.sort((a, b) => new Date(a.date) - new Date(b.date));
        setEvents(list.slice(0, 4));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px', height: '100%', boxSizing: 'border-box' }}>
      <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--ws-accent)', letterSpacing: '1px', borderBottom: '1px solid var(--ws-border)', paddingBottom: '8px' }}>
        CORPORATE CALENDAR
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, justifyContent: 'center' }}>
        {loading ? (
          <div style={{ fontSize: '11px', color: 'var(--ws-text-3)', textAlign: 'center', padding: '20px 0' }}>Loading calendar…</div>
        ) : events.length === 0 ? (
          <div style={{ fontSize: '11px', color: 'var(--ws-text-3)', textAlign: 'center', padding: '20px 0' }}>No upcoming earnings or IPOs.</div>
        ) : (
          events.map((e, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', borderBottom: i < events.length - 1 ? '1px dashed var(--ws-border)' : 'none', paddingBottom: '6px', paddingTop: '4px' }}>
              <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '8px', fontWeight: 800, color: e.color, background: e.bgColor, padding: '2px 4px', borderRadius: '3px', flexShrink: 0 }}>
                  {e.badge}
                </span>
                <span
                  onClick={() => triggerSpotlight(e.ticker)}
                  style={{ fontWeight: 800, cursor: 'pointer', color: 'var(--ws-text)' }}
                  onMouseEnter={ev => ev.currentTarget.style.color = 'var(--ws-accent)'}
                  onMouseLeave={ev => ev.currentTarget.style.color = 'var(--ws-text)'}
                >
                  {e.ticker}
                </span>
              </div>
              <div style={{ textAlign: 'right', fontSize: '10px', flexShrink: 0 }}>
                <span style={{ color: 'var(--ws-text-3)' }}>{e.metricLabel}</span><b style={{ color: 'var(--ws-text)' }}>{e.metricValue}</b>
                <div style={{ fontSize: '8px', color: 'var(--ws-text-3)', marginTop: '2px' }}>
                  {new Date(e.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {e.time}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// Compact Technical Scanner Component
const TechnicalScanner = ({ movers, triggerSpotlight }) => {
  const gainers = movers?.gainers || [];
  const losers = movers?.losers || [];
  const bigCaps = movers?.bigCapMovers || [];

  const highs = useMemo(() => gainers.slice(0, 5).map(s => s.ticker), [gainers]);
  const volumeSpikes = useMemo(() => bigCaps.slice(0, 5).map(s => s.ticker), [bigCaps]);
  const oversold = useMemo(() => losers.slice(0, 5).map(s => s.ticker), [losers]);

  return (
    <div style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px', height: '100%', boxSizing: 'border-box' }}>
      <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--ws-accent)', letterSpacing: '1px', borderBottom: '1px solid var(--ws-border)', paddingBottom: '8px' }}>
        TECHNICAL BREAKTHROUGHS
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, justifyContent: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed var(--ws-border)', paddingBottom: '8px' }}>
          <span style={{ color: 'var(--ws-text-3)', fontSize: '11px' }}>52W Breakouts</span>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '160px' }}>
            {highs.length > 0 ? highs.map(t => (
              <span key={t} onClick={() => triggerSpotlight(t)} style={{ cursor: 'pointer', background: 'var(--ws-bg-2)', color: 'var(--ws-accent)', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--ws-accent-dim)'} onMouseLeave={e => e.currentTarget.style.background = 'var(--ws-bg-2)'}>{t}</span>
            )) : <span style={{ color: 'var(--ws-text-3)' }}>—</span>}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed var(--ws-border)', paddingBottom: '8px' }}>
          <span style={{ color: 'var(--ws-text-3)', fontSize: '11px' }}>Volume Spikes (&gt;3x)</span>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '160px' }}>
            {volumeSpikes.length > 0 ? volumeSpikes.map(t => (
              <span key={t} onClick={() => triggerSpotlight(t)} style={{ cursor: 'pointer', background: 'var(--ws-bg-2)', color: 'var(--ws-accent)', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--ws-accent-dim)'} onMouseLeave={e => e.currentTarget.style.background = 'var(--ws-bg-2)'}>{t}</span>
            )) : <span style={{ color: 'var(--ws-text-3)' }}>—</span>}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '2px' }}>
          <span style={{ color: 'var(--ws-text-3)', fontSize: '11px' }}>Oversold (RSI &lt; 30)</span>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '160px' }}>
            {oversold.length > 0 ? oversold.map(t => (
              <span key={t} onClick={() => triggerSpotlight(t)} style={{ cursor: 'pointer', background: 'var(--ws-bg-2)', color: 'var(--ws-red)', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--ws-accent-dim)'} onMouseLeave={e => e.currentTarget.style.background = 'var(--ws-bg-2)'}>{t}</span>
            )) : <span style={{ color: 'var(--ws-text-3)' }}>—</span>}
          </div>
        </div>
      </div>
    </div>
  );
};

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
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Tab control
  const [activeTab, setActiveTab] = useState('movers'); // 'movers' | 'fundamentals'

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

  // Search logic
  useEffect(() => {
    if (searchQuery.trim().length < 1) {
      setSuggestions([]);
      return;
    }
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${searchQuery}`);
        const data = await res.json();
        setSuggestions(data.results || []);
      } catch (err) {
        console.error(err);
      }
    }, 200);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

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
  const spotlightScore = useMemo(() => {
    if (!spotlightData) return null;
    const d = spotlightData;
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
    return Math.round((finalNote / 5) * 100);
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
            <span style={{ fontSize: '11px', color: 'var(--ws-accent)', fontWeight: 700, letterSpacing: '1px' }}>$ traq compare</span>
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
                <span style={{ color: 'var(--ws-text-3)', fontSize: '11px' }}>█░░░░░░░░░</span>
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
              $ traq compare
            </span>
          </div>
        </div>

        {/* Dense 3-Column Macro & Technical Dashboards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
          <SentimentBreadth vixMarket={vixMarket} sp500Change={sp500Change} advanceDeclineRatio={advanceDeclineRatio} />
          <EconomicCalendar triggerSpotlight={triggerSpotlight} />
          <TechnicalScanner movers={movers} triggerSpotlight={triggerSpotlight} />
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
        </div>

        {/* Data Cards Grid */}
        {activeTab === 'movers' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {/* Top Gainers */}
            <div style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--ws-border)', paddingBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--ws-accent)', letterSpacing: '1px' }}>TOP GAINERS</span>
                <span style={{ fontSize: '9px', color: 'var(--ws-text-3)' }}>Fresh Cache</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {(movers?.gainers || []).slice(0, 5).map(s => (
                  <div key={s.ticker} onClick={() => triggerSpotlight(s.ticker)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 6px', borderRadius: '6px', cursor: 'pointer', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--ws-bg-2)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '12px' }}>{s.ticker}</div>
                      <div style={{ fontSize: '10px', color: 'var(--ws-text-3)', maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, fontSize: '12px' }}>${s.currentPrice?.toFixed(2)}</div>
                      <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--ws-accent)' }}>+{s.priceChangePct?.toFixed(2)}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Losers */}
            <div style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--ws-border)', paddingBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--ws-red)', letterSpacing: '1px' }}>TOP LOSERS</span>
                <span style={{ fontSize: '9px', color: 'var(--ws-text-3)' }}>Fresh Cache</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {(movers?.losers || []).slice(0, 5).map(s => (
                  <div key={s.ticker} onClick={() => triggerSpotlight(s.ticker)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 6px', borderRadius: '6px', cursor: 'pointer', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--ws-bg-2)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '12px' }}>{s.ticker}</div>
                      <div style={{ fontSize: '10px', color: 'var(--ws-text-3)', maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, fontSize: '12px' }}>${s.currentPrice?.toFixed(2)}</div>
                      <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--ws-red)' }}>{s.priceChangePct?.toFixed(2)}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Heavyweights movers */}
            <div style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--ws-border)', paddingBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--ws-accent)', letterSpacing: '1px' }}>BIG CAP MOVERS</span>
                <span style={{ fontSize: '9px', color: 'var(--ws-text-3)' }}>&gt;$10B Cap</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {(movers?.bigCapMovers || []).slice(0, 5).map(s => {
                  const isUp = s.priceChangePct >= 0;
                  return (
                    <div key={s.ticker} onClick={() => triggerSpotlight(s.ticker)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 6px', borderRadius: '6px', cursor: 'pointer', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--ws-bg-2)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '12px' }}>{s.ticker}</div>
                        <div style={{ fontSize: '10px', color: 'var(--ws-text-3)', maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, fontSize: '12px' }}>{fmt(s.marketCap)}</div>
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
            <div style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ borderBottom: '1px solid var(--ws-border)', paddingBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--ws-accent)', letterSpacing: '1px' }}>TRAQCKER SCORE</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {(movers?.topScore || []).slice(0, 5).map(s => (
                  <div key={s.ticker} onClick={() => triggerSpotlight(s.ticker)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 6px', borderRadius: '6px', cursor: 'pointer', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--ws-bg-2)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '12px' }}>{s.ticker}</div>
                      <div style={{ fontSize: '10px', color: 'var(--ws-text-3)' }}>{s.sector}</div>
                    </div>
                    <div style={{ fontWeight: 800, color: 'var(--ws-accent)', fontSize: '13px' }}>
                      {s.score ? `${Math.round(s.score * 20)}/100` : '—'}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top ROIC */}
            <div style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ borderBottom: '1px solid var(--ws-border)', paddingBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--ws-accent)', letterSpacing: '1px' }}>TOP ROIC</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {(movers?.topRoic || []).slice(0, 5).map(s => (
                  <div key={s.ticker} onClick={() => triggerSpotlight(s.ticker)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 6px', borderRadius: '6px', cursor: 'pointer', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--ws-bg-2)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '12px' }}>{s.ticker}</div>
                      <div style={{ fontSize: '10px', color: 'var(--ws-text-3)' }}>{s.sector}</div>
                    </div>
                    <div style={{ fontWeight: 800, color: 'var(--ws-text)', fontSize: '12px' }}>
                      {fmtP(s.roic)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top FCF Yield */}
            <div style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ borderBottom: '1px solid var(--ws-border)', paddingBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--ws-accent)', letterSpacing: '1px' }}>FCF YIELD KINGS</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {(movers?.topFcfYield || []).slice(0, 5).map(s => (
                  <div key={s.ticker} onClick={() => triggerSpotlight(s.ticker)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 6px', borderRadius: '6px', cursor: 'pointer', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--ws-bg-2)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '12px' }}>{s.ticker}</div>
                      <div style={{ fontSize: '10px', color: 'var(--ws-text-3)' }}>{s.sector}</div>
                    </div>
                    <div style={{ fontWeight: 800, color: 'var(--ws-text)', fontSize: '12px' }}>
                      {fmtP(s.fcfYield)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Revenue Growth */}
            <div style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ borderBottom: '1px solid var(--ws-border)', paddingBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--ws-accent)', letterSpacing: '1px' }}>REVENUE GROWTH</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {(movers?.topRevGrowth || []).slice(0, 5).map(s => (
                  <div key={s.ticker} onClick={() => triggerSpotlight(s.ticker)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 6px', borderRadius: '6px', cursor: 'pointer', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--ws-bg-2)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '12px' }}>{s.ticker}</div>
                      <div style={{ fontSize: '10px', color: 'var(--ws-text-3)' }}>{s.sector}</div>
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

              {/* Traqcker Score Circular HUD */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--ws-border)', borderTop: '1px solid var(--ws-border)' }}>
                <div style={{ fontSize: '9px', fontWeight: 800, color: 'var(--ws-text-3)', letterSpacing: '1.5px', marginBottom: '8px' }}>TRAQCKER QUALITY RATIO</div>
                <div style={{ position: 'relative', width: '100px', height: '100px' }}>
                  <svg width="100" height="100" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="50" cy="50" r="42" fill="none" stroke="var(--ws-bg-2)" strokeWidth="6" />
                    <circle cx="50" cy="50" r="42" fill="none" stroke={scoreColor(spotlightScore)} strokeWidth="6"
                      strokeLinecap="round" strokeDasharray="263.89"
                      strokeDashoffset={263.89 - (263.89 * (spotlightScore || 0) / 100)} />
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ fontWeight: 900, fontSize: '22px', color: scoreColor(spotlightScore) }}>{spotlightScore || '—'}</div>
                    <div style={{ fontSize: '8px', color: 'var(--ws-text-3)', marginTop: '1px' }}>/ 100</div>
                  </div>
                </div>
              </div>

              {/* Metrics Table */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Sector & Industry */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                  <span style={{ color: 'var(--ws-text-3)' }}>Sector</span>
                  <span style={{ fontWeight: 700, color: 'var(--ws-text)' }}>{spotlightData.sector || '—'}</span>
                </div>

                {/* Valuation */}
                <div>
                  <div style={{ fontSize: '9px', fontWeight: 800, color: 'var(--ws-text-3)', letterSpacing: '1px', marginBottom: '6px' }}>VALUATION</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--ws-text-3)' }}>P/E Ratio</span>
                      <span style={{ fontWeight: 700 }}>{fmtN(spotlightData.pe)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--ws-text-3)' }}>P/FCF Ratio</span>
                      <span style={{ fontWeight: 700 }}>{fmtN(spotlightData.pfcf)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--ws-text-3)' }}>EV / EBITDA</span>
                      <span style={{ fontWeight: 700 }}>{fmtN(spotlightData.evEbitda)}</span>
                    </div>
                  </div>
                </div>

                {/* Profitability */}
                <div>
                  <div style={{ fontSize: '9px', fontWeight: 800, color: 'var(--ws-text-3)', letterSpacing: '1px', marginBottom: '6px' }}>PROFITABILITY</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--ws-text-3)' }}>Gross Margin</span>
                      <span style={{ fontWeight: 700, color: 'var(--ws-accent)' }}>{fmtP(spotlightData.grossMargin)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--ws-text-3)' }}>Operating Margin</span>
                      <span style={{ fontWeight: 700 }}>{fmtP(spotlightData.opMargin)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--ws-text-3)' }}>ROIC</span>
                      <span style={{ fontWeight: 700, color: 'var(--ws-accent)' }}>{fmtP(spotlightData.roic)}</span>
                    </div>
                  </div>
                </div>

                {/* Growth */}
                <div>
                  <div style={{ fontSize: '9px', fontWeight: 800, color: 'var(--ws-text-3)', letterSpacing: '1px', marginBottom: '6px' }}>GROWTH & LIQUIDITY</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--ws-text-3)' }}>YoY Growth</span>
                      <span style={{ fontWeight: 700, color: 'var(--ws-accent)' }}>+{fmtP(spotlightData.revGrowth)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--ws-text-3)' }}>EPS CAGR (Est)</span>
                      <span style={{ fontWeight: 700 }}>{spotlightData.epsCagr !== null ? `${spotlightData.epsCagr}%` : '—'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--ws-text-3)' }}>Net Debt</span>
                      <span style={{ fontWeight: 700 }}>{fmt(spotlightData.netDebt)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--ws-text-3)' }}>Debt / Equity</span>
                      <span style={{ fontWeight: 700 }}>{fmtN(spotlightData.debtToEquity)}x</span>
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
                      <span style={{ fontSize: '9px', color: 'var(--ws-text-3)' }}>{s.exchange}</span>
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
