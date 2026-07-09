'use client';
import { useState, useEffect, useMemo, use } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import PriceChart from './chart';
import StockChart from '../../../components/StockChart';
import Sparkline from '../../../components/Sparkline';
import SparklineHeader from '../../../components/SparklineHeader';
import OnboardingBanner from '../../../components/OnboardingBanner';
import ShareCardComponent from '../../../components/ShareCard';
import AchievementToast from '../../../components/AchievementToast';
import MarketStatusDot from '../../../components/workspace/MarketStatusDot';
import { useUser } from '../../../components/AuthProvider';
import { fmt as sharedFmt, fmtP as sharedFmtP, fmtN as sharedFmtN } from '../../../../lib/formatters';
import { useStockData } from '../../../../lib/hooks/useStockData';
import {
  getDimScore as sharedGetDimScore,
  totalScore as sharedTotalScore,
  computeEasyMode,
  computeGrahamValue,
  computeFairValue,
} from '../../../../lib/stockScoring';

// This page shows 'N/A' for missing values instead of the shared '—' fallback.
const fmt = (val) => sharedFmt(val, 'N/A');
const fmtP = (v) => sharedFmtP(v, { fallback: 'N/A' });
const fmtN = (v, d = 2) => sharedFmtN(v, d, 'N/A');

const CURRENCY_SYMBOLS = { USD: '$', EUR: '€', GBP: '£', JPY: '¥', CNY: '¥', CHF: 'CHF ', CAD: 'C$', AUD: 'A$', HKD: 'HK$', INR: '₹', KRW: '₩', SEK: 'kr', NOK: 'kr', DKK: 'kr' };
const curSym = (code) => !code || code === 'USD' ? '$' : (CURRENCY_SYMBOLS[code] || `${code} `);

// SEC Form 4 transaction codes — P/S are genuine open-market trades, everything else
// (grants, exercises, tax withholding, gifts...) moves shares for administrative reasons.
const TXN_CODE_LABELS = {
  P: 'BUY', S: 'SELL', A: 'GRANT', M: 'EXERCISE', F: 'TAX WITHHOLD', G: 'GIFT', C: 'CONVERSION',
};


const NAV = [
    { key: 'overview', label: 'OVERVIEW' },
    { key: 'quality', label: 'QUALITY' },
    { key: 'financials', label: 'FINANCIALS' },
    { key: 'dcf', label: 'DCF' },
    { key: 'insiders', label: 'INSIDERS' },
  ];

const QUESTIONS = [
  { dim: 'Management', text: 'Has management consistently met quarterly guidance?' },
  { dim: 'Management', text: 'Is exec compensation aligned with long-term metrics?' },
  { dim: 'Management', text: 'Were there significant C-suite changes in 12 months?' },
  { dim: 'Concentration', text: 'Does top-3 customers represent <30% of revenue?' },
  { dim: 'Concentration', text: 'Does the company operate in multiple geographies?' },
  { dim: 'Concentration', text: 'Does main product represent <50% of revenue?' },
  { dim: 'Op. Trend', text: 'Did operating margin improve over last 3 years?' },
  { dim: 'Op. Trend', text: 'Did FCF/share grow >8% CAGR over last 5 years?' },
  { dim: 'Op. Trend', text: 'Does ROIC exceed estimated WACC?' },
  { dim: 'Earn. Quality', text: 'Does FCF/Net Income exceed 0.8x on 3yr average?' },
  { dim: 'Earn. Quality', text: 'Are accruals as % of assets below 5%?' },
  { dim: 'Earn. Quality', text: 'Does receivables growth not exceed 2x revenue growth?' },
  { dim: 'Transparency', text: 'Does the company provide quantitative quarterly guidance?' },
  { dim: 'Transparency', text: 'Does the 10-K include specific material risk factors?' },
  { dim: 'Transparency', text: 'Do segments allow margin calculation by business unit?' },
];
const DIMS = ['Management', 'Concentration', 'Op. Trend', 'Earn. Quality', 'Transparency'];

const MiniBar = ({ data, color = 'var(--ws-text-2)' }) => {
  const max = Math.max(...data.map(d => Math.abs(d.value)));
  return (
    <ResponsiveContainer width="100%" height={80}>
      <BarChart data={data} barSize={18} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <XAxis dataKey="year" tick={{ fill: 'var(--ws-text-3)', fontSize: 9 }} axisLine={false} tickLine={false} />
        <YAxis hide domain={[0, max * 1.15]} />
        <Tooltip
          formatter={v => [`$${Math.abs(v).toFixed(1)}B`]}
          contentStyle={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', fontSize: 10 }}
        />
        <Bar dataKey="value" radius={[2, 2, 0, 0]}>
          {data.map((_, i) => <Cell key={i} fill={i === data.length - 1 ? color : color + '55'} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

const MiniLine = ({ data, color = 'var(--ws-accent)' }) => (
  <ResponsiveContainer width="100%" height={60}>
    <LineChart data={data}>
      <XAxis dataKey="year" tick={{ fill: 'var(--ws-text-3)', fontSize: 9 }} axisLine={false} tickLine={false} />
      <Tooltip contentStyle={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', fontSize: 10 }} />
      <Line type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} dot={{ fill: color, r: 2 }} />
    </LineChart>
  </ResponsiveContainer>
);

const ScoreBox = ({ score, size = 48 }) => {
  const c = score === null ? 'var(--ws-text-3)' : score >= 70 ? 'var(--ws-accent)' : score >= 40 ? 'var(--ws-text)' : 'var(--ws-red)';
  return (
    <div style={{ width: size, height: size, border: `1px solid ${c}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size > 40 ? '16px' : '12px', fontWeight: 600, color: c }}>
      {score ?? '—'}
    </div>
  );
};

export default function StockPage({ params }) {
  const { ticker: rawTicker } = use(params);
  const ticker = rawTicker.toUpperCase();
  const { data, error, loading } = useStockData(ticker);
  const [tab, setTab] = useState('overview');
  const [insiderTrades, setInsiderTrades] = useState(null);
  const [insiderLoading, setInsiderLoading] = useState(false);
  const [insiderChart, setInsiderChart] = useState(null);
  const [insiderDateFilter, setInsiderDateFilter] = useState('ALL');
  const [insiderTypeFilter, setInsiderTypeFilter] = useState('ALL');
  const [insiderRoleFilter, setInsiderRoleFilter] = useState('ALL');
  const [selectedInsiderName, setSelectedInsiderName] = useState(null);
  const [answers, setAnswers] = useState({});
  const [finTab, setFinTab] = useState('snapshot');
  const [evidence, setEvidence] = useState({});
  const [sparklineData, setSparklineData] = useState(null);
  const [isPro, setIsPro] = useState(false);
  const [checkingPro, setCheckingPro] = useState(true);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [userVote, setUserVote] = useState(null);
  const [voteConsensus, setVoteConsensus] = useState({ BUY: 0, HOLD: 0, SELL: 0, total: 0, source: 'none' });
  const [expanded, setExpanded] = useState(false);
  const [sotw, setSotw] = useState(null);
  const [achievementToast, setAchievementToast] = useState(null);
  const [relatedPosts, setRelatedPosts] = useState([]);
  const [news, setNews] = useState([]);
  const [upcomingEvent, setUpcomingEvent] = useState(null);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const { isSignedIn, user } = useUser();

  useEffect(() => {
    fetch(`/api/earnings?ticker=${ticker}`)
      .then(r => r.json())
      .then(d => {
        if (d.earnings && d.earnings.length > 0) {
          const sorted = d.earnings.sort((a, b) => new Date(a.date) - new Date(b.date));
          const todayStr = new Date().toISOString().slice(0, 10);
          const nextEvent = sorted.find(e => e.date >= todayStr) || sorted[sorted.length - 1];
          setUpcomingEvent(nextEvent || null);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingEvent(false));
  }, [ticker]);

  useEffect(() => {
    fetch(`/api/blog?ticker=${ticker}`).then(r => r.json()).then(d => setRelatedPosts(d.posts || [])).catch(() => {});
  }, [ticker]);

  useEffect(() => {
    fetch(`/api/filings?tickers=${ticker}`).then(r => r.json()).then(d => setNews(d.holdingsNews || [])).catch(() => {});
  }, [ticker]);

  useEffect(() => {
    if (tab !== 'insiders' || insiderTrades !== null) return;
    setInsiderLoading(true);
    fetch(`/api/insider-trades?ticker=${ticker}&limit=25`)
      .then(r => r.json())
      .then(d => setInsiderTrades(d.transactions || []))
      .catch(() => setInsiderTrades([]))
      .finally(() => setInsiderLoading(false));

    fetch(`/api/sparkline?ticker=${ticker}&range=1y`)
      .then(r => r.json())
      .then(d => setInsiderChart(d.candles || []))
      .catch(() => setInsiderChart([]));
  }, [tab, ticker, insiderTrades]);

  // Filters apply to both the table and the summary metrics so they stay consistent.
  const filteredInsiderTrades = useMemo(() => {
    if (!insiderTrades) return [];
    let rows = insiderTrades;
    if (insiderDateFilter === '30D') {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      const cutoffStr = cutoff.toISOString().slice(0, 10);
      rows = rows.filter(t => t.date >= cutoffStr);
    }
    if (insiderTypeFilter !== 'ALL') rows = rows.filter(t => t.type === insiderTypeFilter);
    if (insiderRoleFilter === 'EXEC') rows = rows.filter(t => t.isOfficer);
    if (insiderRoleFilter === 'OWNER10') rows = rows.filter(t => t.isTenPercentOwner);
    if (selectedInsiderName) rows = rows.filter(t => t.insider === selectedInsiderName);
    return rows;
  }, [insiderTrades, insiderDateFilter, insiderTypeFilter, insiderRoleFilter, selectedInsiderName]);

  // Sentiment metrics only count genuine open-market buys/sells (code P/S) — option
  // exercises, tax withholding, and gifts move shares but don't reflect a bet on the stock.
  const insiderSummary = useMemo(() => {
    const openMarket = filteredInsiderTrades.filter(t => t.isOpenMarket && t.value != null);
    if (openMarket.length === 0) return null;

    const netShares = openMarket.reduce((s, t) => s + (t.type === 'BUY' ? t.shares : -t.shares), 0);
    const netValue = openMarket.reduce((s, t) => s + (t.type === 'BUY' ? t.value : -t.value), 0);
    const totalValue = openMarket.reduce((s, t) => s + t.value, 0);

    const bySellerValue = {};
    const byBuyerValue = {};
    openMarket.forEach(t => {
      const bucket = t.type === 'SELL' ? bySellerValue : byBuyerValue;
      bucket[t.insider] = (bucket[t.insider] || 0) + t.value;
    });
    const topOf = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1])[0] || null;
    const largestSeller = topOf(bySellerValue);
    const largestBuyer = topOf(byBuyerValue);

    const ratio = totalValue > 0 ? netValue / totalValue : 0;
    const signal = ratio > 0.2
      ? { label: 'BULLISH', color: 'var(--ws-accent)' }
      : ratio < -0.2
        ? { label: 'BEARISH', color: 'var(--ws-red)' }
        : { label: 'MIXED', color: 'var(--ws-text-2)' };

    return { netShares, netValue, largestSeller, largestBuyer, signal };
  }, [filteredInsiderTrades]);

  const insiderChartData = useMemo(() => {
    if (!insiderChart?.length) return [];
    const rows = insiderChart.filter(c => c.date).map(c => ({ date: c.date, price: c.c }));
    const dateIndex = new Map(rows.map((r, i) => [r.date, i]));
    filteredInsiderTrades.forEach(t => {
      let idx = dateIndex.get(t.date);
      if (idx === undefined) idx = rows.findIndex(r => r.date >= t.date);
      if (idx === undefined || idx === -1) return;
      if (t.type === 'BUY') rows[idx].buy = rows[idx].price;
      else rows[idx].sell = rows[idx].price;
    });
    return rows;
  }, [insiderChart, filteredInsiderTrades]);

  useEffect(() => {
    if (isSignedIn && user?.id) {
      const key = `viewed_stocks_${user.id}`;
      const viewed = new Set(JSON.parse(localStorage.getItem(key) || '[]'));
      viewed.add(ticker);
      localStorage.setItem(key, JSON.stringify([...viewed]));
      if (viewed.size >= 20) unlockAchievement('stock_explorer');
    }
  }, [isSignedIn, user?.id, ticker]);

  useEffect(() => {
    fetch(`/api/sparkline?ticker=${ticker}`)
      .then(r => r.json())
      .then(d => setSparklineData(d.candles || null))
      .catch(() => {});

    fetch('/api/watchlist')
      .then(r => r.json())
      .then(d => {
        const tickers = d.tickers?.map(t => t.ticker) || [];
        setInWatchlist(tickers.includes(ticker));
      })
      .catch(() => {});

    if (isSignedIn) {
      fetch('/api/subscription')
        .then(r => r.json())
        .then(d => {
          setIsPro(d.isPro);
          setCheckingPro(false);
        })
        .catch(() => setCheckingPro(false));
    } else {
      setCheckingPro(false);
    }
  }, [ticker, isSignedIn]);

  useEffect(() => {
    fetch(`/api/votes?ticker=${ticker}`)
      .then(r => r.json())
      .then(d => {
        if (d.userVote) setUserVote(d.userVote);
        setVoteConsensus({ ...d.percentages, total: d.total, source: d.source || 'none' });
      })
      .catch(() => {});
  }, [ticker]);

  useEffect(() => {
    fetch('/api/stock-of-week')
      .then(r => r.json())
      .then(d => setSotw(d.ticker))
      .catch(() => {});
  }, []);

  const getDimScore = (dim) => sharedGetDimScore(dim, QUESTIONS, answers);
  const totalScore = () => sharedTotalScore(DIMS, QUESTIONS, answers);

  const unlockAchievement = (key) => {
    if (!user?.id) return;
    fetch('/api/achievements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, achievementKey: key }),
    })
    .then(r => r.json())
    .then(data => { if (data.unlocked) setAchievementToast(data.achievement); })
    .catch(() => {});
  };

  const toggleWatchlist = async () => {
    if (!isSignedIn) { window.location.href = '/sign-in'; return; }
    const method = inWatchlist ? 'DELETE' : 'POST';
    const res = await fetch('/api/watchlist', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker }),
    });
    if (method === 'POST') {
      const data = await res.json();
      if (data.watchlistCount >= 5) unlockAchievement('watchlist_builder');
    }
    setInWatchlist(!inWatchlist);
  };

  if (loading) return (
    <div style={{ padding: '24px', fontFamily: "'JetBrains Mono', monospace" }}>
      <div style={{ border: '1px solid var(--ws-border)', background: 'var(--ws-bg-1)', overflow: 'hidden', marginBottom: '16px' }}>
        <div style={{ background: 'var(--ws-bg-2)', borderBottom: '1px solid var(--ws-border)', padding: '7px 16px' }}>
          <span style={{ fontSize: '10px', color: 'var(--ws-accent)', letterSpacing: '1px' }}>$ traq {ticker}</span>
        </div>
        <div className="p-6">
          <div className="flex flex-col gap-2">
            {['CONNECTING TO SEC EDGAR...', 'FETCHING FINANCIALS...', 'COMPUTING QUALITY SCORE...'].map((line, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: 'var(--ws-accent)', fontSize: '11px' }}>▶</span>
                <span style={{ color: 'var(--ws-text-3)', fontSize: '11px', letterSpacing: '1px' }}>{line}</span>
              </div>
            ))}
            <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: 'var(--ws-text-3)', fontSize: '11px' }}>█░░░░░░░░░</span>
              <span className="text-ws-text-3 text-[10px] tracking-[1px]">LOADING {ticker}...</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ padding: '24px', fontFamily: "'JetBrains Mono', monospace" }}>
      <div style={{ border: '1px solid var(--ws-border)', background: 'var(--ws-bg-1)', overflow: 'hidden', maxWidth: '560px' }}>
        <div style={{ background: 'var(--ws-bg-2)', borderBottom: '1px solid var(--ws-border)', padding: '7px 16px' }}>
          <span style={{ fontSize: '10px', color: 'var(--ws-red)', letterSpacing: '1px' }}>$ traq {ticker} — ERROR</span>
        </div>
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <span style={{ color: 'var(--ws-red)', fontSize: '11px', marginTop: '1px' }}>✗</span>
            <span style={{ color: 'var(--ws-text-3)', fontSize: '11px', letterSpacing: '0.5px', lineHeight: 1.7 }}>
              TICKER <strong className="text-ws-text">{ticker}</strong> NOT FOUND IN SEC EDGAR OR FINNHUB.{'\n'}
              CHECK THE SYMBOL AND TRY AGAIN.
            </span>
          </div>
          <div style={{ borderTop: '1px solid var(--ws-border)', paddingTop: '16px', display: 'flex', gap: '8px' }}>
            <a href="/" style={{ textDecoration: 'none', fontSize: '11px', letterSpacing: '1px', background: 'var(--ws-text)', color: 'var(--ws-bg)', border: 'none', fontWeight: 700, padding: '8px 16px' }}>
              NEW SEARCH
            </a>
            <a href="/screener" style={{ textDecoration: 'none', fontSize: '11px', letterSpacing: '1px', background: 'transparent', border: '1px solid var(--ws-border)', color: 'var(--ws-text-2)', padding: '8px 16px' }}>
              SCREENER
            </a>
          </div>
        </div>
      </div>
    </div>
  );

  const score = totalScore();
  const revChart = data.revHistory.map(r => ({ year: r.year, value: +(r.val / 1e9).toFixed(1) }));
  const fcfChart = data.fcfHistory.map(r => ({ year: r.year, value: +(r.val / 1e9).toFixed(1) }));
  const marginChart = (data.marginHistory || []).filter(m => m.margin !== null).map(m => ({ year: m.year, value: m.margin }));

  const price = data.currentPrice;
  const change = data.priceChange;
  const changePct = data.priceChangePct;

  // Recent IPOs (and thinly-covered tickers) have no SEC/Finnhub fundamentals at all —
  // computing a Quality Score or "Numbers, Simplified" bars in that case just produces a
  // plausible-looking but entirely made-up result, since every input defaults to a neutral
  // midpoint. Show price-only instead of a wall of fabricated/N/A metrics.
  const hasFundamentals = data.revVal != null || data.niVal != null || data.marketCap != null
    || data.roic != null || data.grossMargin != null || (data.revHistory?.length ?? 0) > 0;

  const easyMode = computeEasyMode(data, hasFundamentals);
  const grahamValue = computeGrahamValue(data);
  const fairValue = computeFairValue(grahamValue, price);

  return (
    <div className="p-6">

      <OnboardingBanner />

      {/* TERMINAL HERO */}
      <div style={{ border: '1px solid var(--ws-border)', background: 'var(--ws-bg-1)', marginBottom: '20px', overflow: 'hidden' }}>
        {/* Terminal title bar */}
        <div style={{ background: 'var(--ws-bg-2)', borderBottom: '1px solid var(--ws-border)', padding: '7px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: 'var(--ws-accent)', fontWeight: 700, letterSpacing: '1px' }}>
            $ traq {ticker}
          </span>
          {data.finnhubFallback && (
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '9px', color: 'var(--ws-text-3)', letterSpacing: '1px' }}>
              [LIMITED DATA]
            </span>
          )}
        </div>

        {/* Terminal output body */}
        <div style={{ padding: '20px 24px' }}>
          <div className="stock-hero" style={{ padding: 0 }}>
            {/* Left: identity + price */}
            <div className="stock-hero-left" style={{ gap: '16px' }}>
              <div style={{ width: '72px', height: '72px', background: 'white', border: '1px solid var(--ws-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                <img
                  src={`https://img.logo.dev/ticker/${ticker}?token=pk_B4aaLZF6S4G1YbCgqZq2Ug`}
                  alt={data.name}
                  style={{ width: '54px', height: '54px', objectFit: 'contain' }}
                  onError={e => { e.target.style.display = 'none'; e.target.parentElement.innerHTML = `<span style="color:var(--ws-accent);font-weight:700;font-size:22px;font-family:'JetBrains Mono',monospace">${ticker.slice(0,2)}</span>`; e.target.parentElement.style.background = 'var(--ws-bg-2)'; }}
                />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', color: 'var(--ws-text-3)', letterSpacing: '1.5px', marginBottom: '5px' }}>
                  {ticker} · {data.exchange || 'NASDAQ'}{data.sector ? ` · ${data.sector.toUpperCase()}` : ''}
                </div>
                <h1 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.5px', marginBottom: '10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.2, color: 'var(--ws-text)' }}>{data.name}</h1>
                {price && (
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '28px', fontWeight: 700, letterSpacing: '-1px', color: 'var(--ws-text)' }}>{curSym(data.currency)}{price.toFixed(2)}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', fontWeight: 700, color: change >= 0 ? 'var(--ws-accent)' : 'var(--ws-red)' }}>
                      {change >= 0 ? '+' : ''}{changePct?.toFixed(2)}%
                    </span>
                    <MarketStatusDot ticker={ticker} showLabel />
                  </div>
                )}
              </div>
            </div>

            {/* Middle: price chart */}
            <div className="stock-hero-chart">
              <SparklineHeader ticker={ticker} currency={data?.currency} />
            </div>

            {/* Right: terminal score block */}
            <div className="stock-hero-score" style={{ alignItems: 'flex-start', gap: '10px' }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '9px', letterSpacing: '2px', color: 'var(--ws-text-3)', fontWeight: 700 }}>QUALITY SCORE</div>
              {!easyMode ? (
                <div style={{ fontSize: '11px', color: 'var(--ws-text-3)', maxWidth: '200px', lineHeight: 1.6, borderLeft: '2px solid var(--ws-border)', paddingLeft: '10px', marginTop: '2px' }}>
                  No fundamentals reported yet — likely a recent IPO or thin data coverage. Price and chart are still live.
                </div>
              ) : (
              <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '16px', color: easyMode.verdictColor, letterSpacing: '2px', lineHeight: 1 }}>
                  {'█'.repeat(Math.round(easyMode.score100 / 10))}{'░'.repeat(10 - Math.round(easyMode.score100 / 10))}
                </span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '28px', fontWeight: 700, color: easyMode.verdictColor, lineHeight: 1 }}>
                  {easyMode.score100}
                </span>
              </div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 700, color: easyMode.verdictColor, letterSpacing: '1px' }}>
                {easyMode.verdict.toUpperCase()}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--ws-text-3)', maxWidth: '200px', lineHeight: 1.6, borderLeft: '2px solid var(--ws-border)', paddingLeft: '10px', marginTop: '2px' }}>
                {easyMode.summary}
              </div>
              </>
              )}
            </div>
          </div>
        </div>
      </div>{/* end terminal hero */}

      <div style={{ padding: '0 0 40px' }}>

        {/* TERMINAL TAB NAV */}
        <div className="stock-tab-nav" style={{ display: 'flex', borderBottom: '1px solid var(--ws-border)', marginBottom: '24px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {NAV.map(n => (
            <button key={n.key} onClick={() => { setTab(n.key); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              style={{
                padding: '8px 20px',
                border: 'none',
                borderBottom: tab === n.key ? '2px solid var(--ws-accent)' : '2px solid transparent',
                background: 'transparent',
                color: tab === n.key ? 'var(--ws-text)' : 'var(--ws-text-3)',
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: tab === n.key ? 700 : 500,
                fontSize: '11px',
                letterSpacing: '1.5px',
                cursor: 'pointer',
                transition: 'all 0.15s',
                marginBottom: '-1px',
                flexShrink: 0,
                whiteSpace: 'nowrap',
              }}>
              {n.label}{n.pro && !isPro && !checkingPro ? ' [PRO]' : ''}
            </button>
          ))}
        </div>

        {/* OVERVIEW TAB — 2-column layout */}
        {tab === 'overview' && (
          <div className="stock-overview-grid">

            {/* Left column: vote + numbers + chart */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Community vote */}
              <div style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', padding: '20px' }}>
                <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '6px', color: 'var(--ws-text)' }}>Your vote</div>
                <div style={{ color: 'var(--ws-text-3)', fontSize: '11px', marginBottom: '14px' }}>
                  {isSignedIn ? 'Choose your call' : 'Sign in to vote'}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                  {['BUY', 'HOLD', 'SELL'].map(v => {
                    const active = userVote === v;
                    const activeColor = v === 'BUY' ? 'var(--ws-accent)' : v === 'SELL' ? 'var(--ws-red)' : 'var(--ws-text-2)';
                    const activeDim = v === 'BUY' ? 'var(--ws-accent-dim)' : v === 'SELL' ? 'var(--ws-bg-2)' : 'var(--ws-bg-2)';
                    return (
                      <button key={v} onClick={async () => {
                        if (!isSignedIn) { window.location.href = '/sign-in'; return; }
                        setUserVote(v);
                        fetch('/api/votes', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ ticker, vote: v }),
                        }).then(r => r.json()).then(async (voteData) => {
                          fetch(`/api/votes?ticker=${ticker}`)
                            .then(r => r.json())
                            .then(d => setVoteConsensus({ ...d.percentages, total: d.total }))
                            .catch(() => {});
                          if (user?.id && voteData.voteCount) {
                            const voteCount = voteData.voteCount;
                            if (voteData.isNewVote && voteCount === 1) unlockAchievement('first_vote');
                            if (voteCount >= 5) unlockAchievement('serial_voter');
                            fetch(`/api/votes?ticker=${ticker}`)
                              .then(r => r.json())
                              .then(d => {
                                const majorityVote = Object.keys(d.percentages).reduce((a, b) => d.percentages[a] > d.percentages[b] ? a : b);
                                if (v !== majorityVote && d.percentages[v] < 25) unlockAchievement('contrarian');
                              }).catch(() => {});
                          }
                        }).catch(() => {});
                      }}
                        style={{ padding: '14px 8px', textAlign: 'center', border: `1px solid ${active ? activeColor : 'var(--ws-border)'}`, background: active ? activeDim : 'var(--ws-bg-2)', color: active ? activeColor : 'var(--ws-text-2)', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
                        {v}
                      </button>
                    );
                  })}
                </div>
                {voteConsensus.source === 'none' ? (
                  <div style={{ fontSize: '11px', color: 'var(--ws-text-3)', textAlign: 'center', padding: '8px 0' }}>
                    No votes or analyst coverage yet — be the first to weigh in.
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', height: '10px', overflow: 'hidden', marginBottom: '8px' }}>
                      <div style={{ background: 'var(--ws-accent)', width: `${voteConsensus.BUY}%` }} />
                      <div style={{ background: 'var(--ws-text-3)', width: `${voteConsensus.HOLD}%` }} />
                      <div style={{ background: 'var(--ws-red)', width: `${voteConsensus.SELL}%` }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--ws-text-3)', fontWeight: 600 }}>
                      <span style={{ color: 'var(--ws-accent)' }}>● {voteConsensus.BUY}% Buy</span>
                      <span style={{ color: 'var(--ws-text-2)' }}>● {voteConsensus.HOLD}% Hold</span>
                      <span style={{ color: 'var(--ws-red)' }}>● {voteConsensus.SELL}% Sell</span>
                    </div>
                    <div style={{ marginTop: '6px', fontSize: '10px', color: 'var(--ws-text-3)', textAlign: 'center' }}>
                      {voteConsensus.source === 'analysts'
                        ? `Analyst consensus · ${voteConsensus.total} analysts`
                        : `${voteConsensus.total} ${voteConsensus.total === 1 ? 'person' : 'people'} voted`}
                    </div>
                  </>
                )}
              </div>

              {/* Numbers, Simplified */}
              {hasFundamentals && (
              <div>
                <div style={{ color: 'var(--ws-text-3)', fontSize: '10px', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1.5px', marginBottom: '10px', fontWeight: 700 }}>THE NUMBERS, SIMPLIFIED</div>
                <div style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {[
                    {
                      label: data.revGrowth == null ? 'Revenue data unavailable' : data.revGrowth > 0 ? 'Revenue is growing' : 'Revenue is shrinking',
                      value: data.revGrowth != null ? `${data.revGrowth > 0 ? '+' : ''}${data.revGrowth}% / yr` : 'N/A',
                      pct: data.revGrowth != null ? Math.max(4, Math.min(100, 50 + data.revGrowth * 2)) : 0,
                      color: data.revGrowth == null ? 'var(--ws-text-3)' : data.revGrowth > 5 ? 'var(--ws-accent)' : data.revGrowth > 0 ? 'var(--ws-text-2)' : 'var(--ws-red)',
                    },
                    {
                      label: data.opMargin == null ? 'Margin data unavailable' : data.opMargin > 15 ? 'Keeps a healthy slice of profit' : data.opMargin > 5 ? 'Keeps a modest slice of profit' : data.opMargin > 0 ? 'Thin operating margin' : 'Operating at a loss',
                      value: data.opMargin != null ? `${data.opMargin}% margin` : 'N/A',
                      pct: data.opMargin != null ? Math.max(4, Math.min(100, data.opMargin * 2.5)) : 0,
                      color: data.opMargin == null ? 'var(--ws-text-3)' : data.opMargin > 15 ? 'var(--ws-accent)' : data.opMargin > 5 ? 'var(--ws-text-2)' : 'var(--ws-red)',
                    },
                    {
                      label: data.fcfVal == null ? 'Cash flow data unavailable' : data.fcfVal > 0 ? 'Generates real cash, not just paper profit' : 'Burning cash, not generating profit',
                      value: data.fcfVal > 0 ? 'Strong' : data.fcfVal < 0 ? 'Negative' : 'N/A',
                      pct: data.fcfVal > 0 ? 85 : data.fcfVal < 0 ? 15 : 0,
                      color: data.fcfVal == null ? 'var(--ws-text-3)' : data.fcfVal > 0 ? 'var(--ws-accent)' : 'var(--ws-red)',
                    },
                    {
                      label: data.debtToEquity == null ? 'Debt levels unavailable' : data.debtToEquity < 0 ? 'Negative equity — high risk' : data.debtToEquity > 1.5 ? 'Carries notable debt — worth watching' : 'Debt levels look manageable',
                      value: data.debtToEquity != null ? `${data.debtToEquity.toFixed(2)}x equity` : 'N/A',
                      pct: data.debtToEquity != null ? Math.max(4, Math.min(100, 100 - data.debtToEquity * 30)) : 0,
                      color: data.debtToEquity == null ? 'var(--ws-text-3)' : data.debtToEquity < 0 ? 'var(--ws-red)' : data.debtToEquity < 1 ? 'var(--ws-accent)' : data.debtToEquity < 2 ? 'var(--ws-text-2)' : 'var(--ws-red)',
                    },
                  ].map((m, i) => (
                    <div key={i} className="flex flex-col gap-2">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
                        <span style={{ fontSize: '13px', color: 'var(--ws-text-2)', lineHeight: 1.3 }}>{m.label}</span>
                        <span style={{ fontSize: '12px', fontWeight: 700, flexShrink: 0, color: m.color }}>{m.value}</span>
                      </div>
                      <div style={{ height: '6px', background: 'var(--ws-bg-2)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${m.pct}%`, background: m.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              )}

              {/* NEWS */}
              {news.length > 0 && (
                <div>
                  <div style={{ color: 'var(--ws-text-3)', fontSize: '10px', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1.5px', marginBottom: '10px', fontWeight: 700 }}>NEWS</div>
                  <div style={{ display: 'flex', gap: '14px', overflowX: 'auto', paddingBottom: '6px' }}>
                    {news.slice(0, 5).map((n, i) => (
                      <a key={n.id || i} href={n.url} target="_blank" rel="noopener noreferrer"
                        style={{
                          flex: '0 0 220px', width: '220px', display: 'flex', flexDirection: 'column',
                          textDecoration: 'none', border: '1px solid var(--ws-border)', background: 'var(--ws-bg-1)', overflow: 'hidden',
                        }}>
                        {n.image && (
                          <img src={n.image} alt="" style={{ width: '100%', height: '120px', objectFit: 'cover', flexShrink: 0 }} />
                        )}
                        <div style={{ padding: '10px 12px' }}>
                          <div style={{
                            fontSize: '12px', fontWeight: 600, color: 'var(--ws-text)', lineHeight: 1.4, marginBottom: '8px',
                            display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                          }}>{n.title}</div>
                          <div style={{ fontSize: '10px', color: 'var(--ws-text-3)' }}>{n.source} · {n.time}</div>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Related reading */}
              {relatedPosts.length > 0 && (
                <div>
                  <div style={{ color: 'var(--ws-text-3)', fontSize: '10px', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1.5px', marginBottom: '10px', fontWeight: 700 }}>RELATED READING</div>
                  <div style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {relatedPosts.map(post => {
                      const dotColor = post.sentiment === 'positive' ? 'var(--ws-accent)' : post.sentiment === 'negative' ? 'var(--ws-red)' : 'var(--ws-text-2)';
                      return (
                        <a key={post.slug} href={`/blog/${post.slug}`}
                          style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', color: 'var(--ws-text-2)', fontSize: '12px', fontWeight: 600, lineHeight: 1.5, textDecoration: 'none' }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor, flexShrink: 0, marginTop: '4px' }} />
                          {post.title}
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>

            {/* Right column: about + fair value + share + actions + continue */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

              {/* About */}
              {data.description && (() => {
                const LIMIT = 240;
                const short = data.description.slice(0, LIMIT);
                return (
                  <div className="bg-ws-bg-1 border border-ws-border px-[18px] py-4">
                    <div style={{ fontSize: '10px', color: 'var(--ws-text-3)', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1.5px', fontWeight: 700, marginBottom: '8px' }}>ABOUT</div>
                    <div style={{ color: 'var(--ws-text-2)', fontSize: '12px', lineHeight: 1.75 }}>
                      {expanded ? data.description : `${short}${data.description.length > LIMIT ? '…' : ''}`}
                      {data.description.length > LIMIT && (
                        <span onClick={() => setExpanded(!expanded)}
                          style={{ color: 'var(--ws-accent)', cursor: 'pointer', marginLeft: '6px', fontWeight: 700, fontSize: '11px' }}>
                          {expanded ? 'Show less' : 'Read more'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Fair value */}
              {fairValue && (
                <div className="bg-ws-bg-1 border border-ws-border px-[18px] py-4">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
                    <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--ws-text)' }}>Fair value</div>
                    <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '1px', color: fairValue.tagColor, padding: '3px 8px', backgroundColor: 'var(--ws-bg-2)' }}>{fairValue.tag}</div>
                  </div>
                  <div style={{ position: 'relative', height: '10px', background: 'var(--ws-bg-2)' }}>
                    <div style={{ position: 'absolute', top: '-5px', width: '4px', height: '20px', borderRadius: '2px', background: 'var(--ws-text)', left: `${fairValue.pct}%` }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '10px', color: 'var(--ws-text-3)' }}>
                    <span>Cheap</span><span>Fair</span><span>Expensive</span>
                  </div>
                  <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--ws-text-2)', lineHeight: 1.6 }}>
                    {fairValue.negative ? (
                      <>Negative earnings — no positive estimate. Price: <b className="text-ws-text">{curSym(data.currency)}{price?.toFixed(2)}</b></>
                    ) : (
                      <>Price: <b className="text-ws-text">{curSym(data.currency)}{price?.toFixed(2)}</b> · Estimate: <b className="text-ws-text">{curSym(data.currency)}{fairValue.estimate.toFixed(2)}</b></>
                    )}
                  </div>
                </div>
              )}

              {/* Upcoming Event */}
              {(!loadingEvent || upcomingEvent) && (
                <div className="bg-ws-bg-1 border border-ws-border px-[18px] py-4">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ fontSize: '10px', color: 'var(--ws-text-3)', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1.5px', fontWeight: 700 }}>UPCOMING EVENT</div>
                    {upcomingEvent && (() => {
                      const daysDiff = Math.ceil((new Date(upcomingEvent.date + 'T00:00:00') - new Date().setHours(0,0,0,0)) / (1000 * 60 * 60 * 24));
                      let badgeText = '';
                      let badgeBg = 'var(--ws-bg-2)';
                      let badgeColor = 'var(--ws-text-2)';
                      if (daysDiff === 0) {
                        badgeText = 'TODAY';
                        badgeBg = 'var(--ws-accent-dim)';
                        badgeColor = 'var(--ws-accent)';
                      } else if (daysDiff === 1) {
                        badgeText = 'TOMORROW';
                        badgeBg = 'var(--ws-accent-dim)';
                        badgeColor = 'var(--ws-accent)';
                      } else if (daysDiff > 1) {
                        badgeText = `IN ${daysDiff} DAYS`;
                        badgeBg = 'var(--ws-accent-dim)';
                        badgeColor = 'var(--ws-accent)';
                      } else if (daysDiff === -1) {
                        badgeText = 'YESTERDAY';
                        badgeBg = 'rgba(239, 68, 68, 0.1)';
                        badgeColor = 'var(--ws-red)';
                      } else if (daysDiff < -1) {
                        badgeText = `${Math.abs(daysDiff)} DAYS AGO`;
                        badgeBg = 'var(--ws-bg-2)';
                        badgeColor = 'var(--ws-text-3)';
                      }
                      return (
                        <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.5px', background: badgeBg, color: badgeColor, padding: '2px 6px', borderRadius: '3px' }}>
                          {badgeText}
                        </div>
                      );
                    })()}
                  </div>
                  {upcomingEvent ? (
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ws-text)' }}>
                        Earnings Report
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--ws-text-2)', marginTop: '4px', lineHeight: 1.4 }}>
                        <span>
                          {new Date(upcomingEvent.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                        <span className="text-ws-text-3"> · </span>
                        <span>
                          {upcomingEvent.hour === 'bmo' ? 'Before Open' : upcomingEvent.hour === 'amc' ? 'After Close' : 'Time TBD'}
                        </span>
                        {upcomingEvent.epsEstimate != null && (
                          <>
                            <span className="text-ws-text-3"> · </span>
                            <span>Est. EPS: ${upcomingEvent.epsEstimate.toFixed(2)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: '12px', color: 'var(--ws-text-3)' }}>
                      No earnings events scheduled in the next 90 days.
                    </div>
                  )}
                </div>
              )}

              {/* Stock of the week */}
              {sotw === ticker && (
                <div style={{ background: 'var(--ws-accent-dim)', border: '1px solid var(--ws-accent)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div>
                    <div style={{ color: 'var(--ws-accent)', fontWeight: 700, fontSize: '11px', letterSpacing: '0.5px' }}>STOCK OF THE WEEK</div>
                    <div style={{ color: 'var(--ws-text-2)', fontSize: '12px', marginTop: '2px' }}>{ticker} is this week's community pick.</div>
                  </div>
                </div>
              )}

              {/* Share */}
              <div className="bg-ws-bg-1 border border-ws-border px-[18px] py-4">
                <div style={{ fontSize: '10px', color: 'var(--ws-text-3)', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1.5px', fontWeight: 700, marginBottom: '12px' }}>SHARE</div>
                 <ShareCardComponent
                  ticker={ticker}
                  name={data?.name || 'N/A'}
                  price={data?.currentPrice || 0}
                  priceChange={data?.priceChangePct || 0}
                  metrics={[
                    { label: 'P/E', value: fmtN(data?.peRatio) },
                    { label: 'Rev Growth', value: fmtP(data?.revenueGrowth) },
                    { label: 'Op Margin', value: fmtP(data?.operatingMargin) },
                    { label: 'FCF Yield', value: fmtP(data?.fcfYield) }
                  ]}
                  score={easyMode?.score100 ?? 50}
                  verdict={easyMode?.verdict ?? 'HOLD'}
                  fairValue={fairValue?.estimate ?? null}
                  fairValueNegative={fairValue?.negative ?? false}
                  consensus={voteConsensus}
                  userVote={userVote}
                  currency={data?.currency}
                />
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2">
                <a href={data.cik ? `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${data.cik}&type=10-K` : `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=${encodeURIComponent(data.name)}&type=10-K&dateb=&owner=include&count=10&search_text=&action=getcompany`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ textAlign: 'center', fontSize: '12px', padding: '10px 8px', background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', color: 'var(--ws-text)', textDecoration: 'none' }}>
                  SEC Filings ↗
                </a>
                <button onClick={toggleWatchlist}
                  style={inWatchlist
                    ? { fontSize: '12px', padding: '10px 8px', width: '100%', background: 'var(--ws-text)', color: 'var(--ws-bg)', border: 'none', fontWeight: 600, cursor: 'pointer' }
                    : { fontSize: '12px', padding: '10px 8px', width: '100%', background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', color: 'var(--ws-text)', cursor: 'pointer' }}>
                  {inWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist'}
                </button>
                <button onClick={() => { window.location.href = `/stock/${ticker}?refresh=true`; }}
                  style={{ fontSize: '12px', padding: '10px 8px', width: '100%', background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', color: 'var(--ws-text)', cursor: 'pointer' }}>
                  ↻ Refresh data
                </button>
              </div>

              <div style={{ color: 'var(--ws-text-3)', fontSize: '10px', letterSpacing: '1px', paddingTop: '4px' }}>
                SOURCE: SEC EDGAR (XBRL) · ALPHA VANTAGE · FINNHUB · NOT INVESTMENT ADVICE
              </div>

            </div>
          </div>
        )}

        {/* QUALITY TAB */}
        {tab === 'quality' && (
  <div>
    {(() => {
      const sector = (data.sector || '').toLowerCase();
      const isFinancial = sector.includes('bank') || sector.includes('insurance') || sector.includes('financial');
      const isTech = sector.includes('tech') || sector.includes('software') || sector.includes('semi');
      const isPharma = sector.includes('pharma') || sector.includes('biotech') || sector.includes('health');
      const isConsumer = sector.includes('retail') || sector.includes('consumer') || sector.includes('food') || sector.includes('beverage');
      const isEnergy = sector.includes('energy') || sector.includes('oil') || sector.includes('gas');

      const roicThreshold = isTech ? 0.25 : isPharma ? 0.20 : isConsumer ? 0.20 : isEnergy ? 0.12 : 0.15;
      const roicScore = data.roic == null ? 2.5
        : data.roic / 100 >= roicThreshold * 2 ? 5
        : data.roic / 100 >= roicThreshold * 1.5 ? 4.5
        : data.roic / 100 >= roicThreshold ? 4
        : data.roic / 100 >= roicThreshold * 0.7 ? 3
        : data.roic / 100 >= roicThreshold * 0.4 ? 2
        : 1;

      const gmThreshold = isTech ? 0.65 : isPharma ? 0.65 : isConsumer ? 0.45 : isFinancial ? 0.30 : isEnergy ? 0.25 : 0.35;
      const gmScore = data.grossMargin == null ? 2.5
        : data.grossMargin / 100 >= gmThreshold * 1.4 ? 5
        : data.grossMargin / 100 >= gmThreshold * 1.15 ? 4.5
        : data.grossMargin / 100 >= gmThreshold ? 4
        : data.grossMargin / 100 >= gmThreshold * 0.75 ? 3
        : data.grossMargin / 100 >= gmThreshold * 0.5 ? 2
        : 1;

      const omThreshold = isTech ? 0.20 : isPharma ? 0.20 : isConsumer ? 0.15 : isFinancial ? 0.15 : isEnergy ? 0.12 : 0.15;
      const omScore = data.opMargin == null ? 2.5
        : data.opMargin / 100 >= omThreshold * 2 ? 5
        : data.opMargin / 100 >= omThreshold * 1.5 ? 4.5
        : data.opMargin / 100 >= omThreshold ? 4
        : data.opMargin / 100 >= omThreshold * 0.65 ? 3
        : data.opMargin / 100 > 0 ? 2
        : 1;

      const deScore = data.debtToEquity == null ? 2.5
        : data.debtToEquity < 0.3 ? 5
        : data.debtToEquity < 0.7 ? 4.5
        : data.debtToEquity < 1.2 ? 4
        : data.debtToEquity < 2 ? 3
        : data.debtToEquity < 3 ? 2
        : 1;

      const cbs = +((roicScore * 0.4 + gmScore * 0.25 + omScore * 0.25 + deScore * 0.1)).toFixed(2);

      const pfcfScore = data.pfcf == null || data.pfcf <= 0 ? 1
        : data.pfcf < 12 ? 5
        : data.pfcf < 18 ? 4.5
        : data.pfcf < 25 ? 4
        : data.pfcf < 35 ? 3
        : data.pfcf < 50 ? 2
        : 1;

      const fcfYieldScore = data.fcfYield == null ? 1
        : data.fcfYield > 8 ? 5
        : data.fcfYield > 5 ? 4.5
        : data.fcfYield > 3 ? 4
        : data.fcfYield > 1.5 ? 3
        : data.fcfYield > 0 ? 2
        : 1;

      const oppo = +((pfcfScore * 0.55 + fcfYieldScore * 0.45)).toFixed(2);

      const revGrowthScore = data.revGrowth == null ? 2.5
        : data.revGrowth > 25 ? 5
        : data.revGrowth > 15 ? 4.5
        : data.revGrowth > 8 ? 4
        : data.revGrowth > 3 ? 3
        : data.revGrowth > 0 ? 2
        : 1;

      const fcfTrend = data.fcfHistory?.length >= 3
        ? data.fcfHistory[data.fcfHistory.length - 1]?.val > data.fcfHistory[0]?.val ? 1 : 0
        : null;

      const marginTrend = data.marginHistory?.length >= 3
        ? (data.marginHistory[data.marginHistory.length - 1]?.margin || 0) > (data.marginHistory[0]?.margin || 0) ? 1 : 0
        : null;

      const trendBonus = (fcfTrend === 1 ? 0.5 : 0) + (marginTrend === 1 ? 0.5 : 0);
      const gqs = Math.min(5, +((revGrowthScore * 0.6 + (2.5 + trendBonus * 2) * 0.4)).toFixed(2));

      const finalNote = +((cbs * 0.45 + oppo * 0.30 + gqs * 0.25)).toFixed(2);

      const scoreColor = (s) => s >= 4 ? 'var(--ws-accent)' : s >= 3 ? 'var(--ws-text)' : 'var(--ws-red)';
      const ScoreBar = ({ score }) => (
        <div style={{ height: '3px', background: 'var(--ws-border)', marginTop: '8px', borderRadius: '2px' }}>
          <div style={{ width: `${(score / 5) * 100}%`, height: '100%', background: scoreColor(score), borderRadius: '2px' }} />
        </div>
      );

      return (
        <>
          <div style={{ position: 'relative', marginBottom: '24px' }}>
  {!isSignedIn && (
    <a href="/sign-in" style={{ position: 'absolute', inset: 0, zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', opacity: 0, transition: 'opacity 0.2s' }}
      onMouseEnter={e => e.currentTarget.style.opacity = '1'}
      onMouseLeave={e => e.currentTarget.style.opacity = '0'}>
      <div style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-accent)', padding: '10px 20px', color: 'var(--ws-accent)', fontSize: '11px', fontWeight: 700, letterSpacing: '2px' }}>
        SIGN IN TO SEE SCORES
      </div>
    </a>
  )}
  <div style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', padding: '24px', filter: !isSignedIn ? 'blur(12px)' : 'none', pointerEvents: !isSignedIn ? 'none' : 'auto', userSelect: !isSignedIn ? 'none' : 'auto', overflow: 'hidden' }}>
            <div className="quality-score-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1px', background: 'var(--ws-border)' }}>
              {[
                { label: 'CORE BUSINESS', score: cbs, desc: 'ROIC · Margins · Leverage' },
                { label: 'OPPO SCORE', score: oppo, desc: 'P/FCF · FCF Yield' },
                { label: 'GROWTH QUALITY', score: gqs, desc: 'Revenue · FCF trend' },
                { label: 'FINAL NOTE', score: finalNote, desc: 'Weighted composite', highlight: true },
              ].map(s => (
                <div key={s.label} style={{ background: s.highlight ? 'var(--ws-bg-2)' : 'var(--ws-bg-1)', padding: '12px 8px', textAlign: 'center' }}>
                  <div style={{ color: 'var(--ws-text-3)', fontSize: '8px', letterSpacing: '1px', marginBottom: '8px', lineHeight: 1.3 }}>{s.label}</div>
                  <div style={{ fontSize: s.highlight ? '36px' : '30px', fontWeight: 700, color: scoreColor(s.score), letterSpacing: '-1px', lineHeight: 1 }}>
                    {s.score.toFixed(1)}
                  </div>
                  <div style={{ color: 'var(--ws-text-3)', fontSize: '8px', marginTop: '4px', lineHeight: 1.3 }}>{s.desc}</div>
                  <ScoreBar score={s.score} />
                </div>
              ))}
            </div>
            <div style={{ color: 'var(--ws-text-3)', fontSize: '10px', letterSpacing: '1px', marginTop: '12px', textAlign: 'center' }}>
              AUTOMATED SCORE · BASED ON SEC EDGAR & FINNHUB · NOT A BUY/SELL SIGNAL · CBS 45% · OPPO 30% · GQS 25%
            </div>
          </div>
        </div>

          <div className="text-ws-text-3 text-[10px] tracking-[2px] border-b border-ws-border pb-1.5 mb-3">CORE BUSINESS BREAKDOWN</div>
          <div className="grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: 'var(--ws-border)', marginBottom: '24px' }}>
            {[
              { label: 'ROIC', val: fmtP(data.roic), score: roicScore, desc: `Threshold: ${(roicThreshold * 100).toFixed(0)}% for ${data.sector || 'this sector'}` },
              { label: isFinancial ? 'NET MARGIN' : 'GROSS MARGIN', val: isFinancial ? fmtP(data.netMargin) : fmtP(data.grossMargin), score: gmScore, desc: `Threshold: ${(gmThreshold * 100).toFixed(0)}% for ${data.sector || 'this sector'}` },
              { label: 'OP. MARGIN', val: fmtP(data.opMargin), score: omScore, desc: `Threshold: ${(omThreshold * 100).toFixed(0)}% for ${data.sector || 'this sector'}` },
              { label: 'DEBT/EQUITY', val: fmtN(data.debtToEquity), score: deScore, desc: 'Lower is better' },
            ].map(m => (
              <div key={m.label} className="bg-ws-bg-1 p-4">
                <div className="flex justify-between mb-2">
                  <span className="text-ws-text-3 text-[10px] tracking-[1px]">{m.label}</span>
                  <span style={{ color: scoreColor(m.score), fontSize: '10px' }}>{m.score.toFixed(1)}/5</span>
                </div>
                <div style={{ fontSize: '28px', fontWeight: 600, color: scoreColor(m.score), marginBottom: '4px' }}>{m.val}</div>
                <div className="text-ws-text-3 text-[10px]">{m.desc}</div>
              </div>
            ))}
          </div>

          <div className="text-ws-text-3 text-[10px] tracking-[2px] border-b border-ws-border pb-1.5 mb-3">OPPORTUNITY BREAKDOWN</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1px', background: 'var(--ws-border)', marginBottom: '24px' }}>
            {[
              { label: 'P/FCF', val: fmtN(data.pfcf), score: pfcfScore, desc: data.pfcf < 20 ? 'Attractive entry' : data.pfcf < 35 ? 'Fair valuation' : 'Expensive' },
              { label: 'FCF YIELD', val: data.fcfYield ? `${data.fcfYield}%` : 'N/A', score: fcfYieldScore, desc: data.fcfYield > 5 ? 'Strong yield' : data.fcfYield > 2 ? 'Moderate yield' : 'Low yield' },
            ].map(m => (
              <div key={m.label} className="bg-ws-bg-1 p-4">
                <div className="flex justify-between mb-2">
                  <span className="text-ws-text-3 text-[10px] tracking-[1px]">{m.label}</span>
                  <span style={{ color: scoreColor(m.score), fontSize: '10px' }}>{m.score.toFixed(1)}/5</span>
                </div>
                <div style={{ fontSize: '28px', fontWeight: 600, color: scoreColor(m.score), marginBottom: '4px' }}>{m.val}</div>
                <div className="text-ws-text-3 text-[10px]">{m.desc}</div>
              </div>
            ))}
            <div className="bg-ws-bg-1 p-4">
              <div style={{ color: 'var(--ws-text-3)', fontSize: '10px', letterSpacing: '1px', marginBottom: '8px' }}>52W RANGE</div>
              {data.high52 && data.low52 && data.currentPrice ? (() => {
                const pct = Math.round(((data.currentPrice - data.low52) / (data.high52 - data.low52)) * 100);
                const color = pct < 30 ? 'var(--ws-accent)' : pct > 75 ? 'var(--ws-red)' : 'var(--ws-text)';
                return (
                  <>
                    <div style={{ fontSize: '28px', fontWeight: 600, color, marginBottom: '4px' }}>{pct}%</div>
                    <div style={{ color: 'var(--ws-text-3)', fontSize: '10px', marginBottom: '10px' }}>
                      {pct < 30 ? 'Near 52W low' : pct > 75 ? 'Near 52W high' : 'Mid range'}
                    </div>
                    <div style={{ position: 'relative', height: '3px', background: 'var(--ws-border)', borderRadius: '2px', marginBottom: '6px' }}>
                      <div style={{ position: 'absolute', left: `${pct}%`, top: '-3px', width: '2px', height: '9px', background: color, borderRadius: '1px' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--ws-text-3)' }}>
                      <span>${data.low52}</span>
                      <span>${data.high52}</span>
                    </div>
                  </>
                );
              })() : <div className="text-ws-text-3 text-[10px]">N/A</div>}
            </div>
          </div>

          <div className="text-ws-text-3 text-[10px] tracking-[2px] border-b border-ws-border pb-1.5 mb-3">GROWTH QUALITY BREAKDOWN</div>
          <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: 'var(--ws-border)', marginBottom: '24px' }}>
            {[
              { label: 'REVENUE GROWTH', val: data.revGrowth !== null ? `${data.revGrowth > 0 ? '+' : ''}${data.revGrowth}%` : 'N/A', score: revGrowthScore, chart: revChart },
              { label: 'FCF TREND', val: fcfTrend === 1 ? 'IMPROVING' : fcfTrend === 0 ? 'DECLINING' : 'N/A', score: fcfTrend === 1 ? 4 : fcfTrend === 0 ? 2 : 2.5, chart: fcfChart, color: 'var(--ws-text-2)' },
              { label: 'MARGIN TREND', val: marginTrend === 1 ? 'EXPANDING' : marginTrend === 0 ? 'COMPRESSING' : 'N/A', score: marginTrend === 1 ? 4 : marginTrend === 0 ? 2 : 2.5, chart: marginChart, isLine: true },
            ].map(m => (
              <div key={m.label} className="bg-ws-bg-1 p-4">
                <div className="flex justify-between mb-2">
                  <span className="text-ws-text-3 text-[10px] tracking-[1px]">{m.label}</span>
                  <span style={{ color: scoreColor(m.score), fontSize: '10px' }}>{m.score.toFixed(1)}/5</span>
                </div>
                <div style={{ fontSize: '22px', fontWeight: 600, color: scoreColor(m.score), marginBottom: '8px' }}>{m.val}</div>
                <MiniLine data={m.chart} color={m.color || scoreColor(m.score)} />
              </div>
            ))}
          </div>

          <div className="text-ws-text-3 text-[10px] tracking-[1px]">
            SECTOR-ADJUSTED THRESHOLDS · CBS = ROIC×40% + GROSS MARGIN×25% + OP MARGIN×25% + D/E×10% · OPPO = P/FCF×55% + FCF YIELD×45% · GQS = REV GROWTH×60% + TREND×40%
          </div>
        </>
      );
    })()}
  </div>
)}

        {/* FINANCIALS TAB */}
        {tab === 'financials' && (
  <div>
    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
      {[['snapshot', 'SNAPSHOT'], ['income', 'INCOME'], ['balance', 'BALANCE'], ['cashflow', 'CASH FLOW']].map(([key, label]) => (
        <button key={key} onClick={() => setFinTab(key)}
          style={{ flex: 1, padding: '10px 8px', fontSize: '13px', letterSpacing: '0.3px', background: finTab === key ? 'var(--ws-text)' : 'var(--ws-bg-1)', color: finTab === key ? 'var(--ws-bg)' : 'var(--ws-text-2)', border: finTab === key ? 'none' : '1px solid var(--ws-border)', cursor: 'pointer', fontWeight: 600 }}>
          {label}
        </button>
      ))}
    </div>

    {finTab === 'snapshot' && <div>
              <div style={{ marginBottom: '16px' }}>
  <div className="grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>

    <div className="bg-ws-bg-1 border border-ws-border p-4">
      <div className="text-ws-text-3 text-[10px] tracking-[2px] mb-3">VALUATION</div>
      <table className="w-full border-collapse text-[11px]">
        <tbody>
          {[
            { label: 'Market Cap', val: fmt(data.marketCap) },
            { label: 'P/E', val: fmtN(data.pe), color: data.pe > 0 && data.pe < 20 ? 'var(--ws-accent)' : data.pe > 40 ? 'var(--ws-red)' : 'var(--ws-text)' },
            { label: 'P/FCF', val: fmtN(data.pfcf), color: data.pfcf > 0 && data.pfcf < 20 ? 'var(--ws-accent)' : data.pfcf > 40 ? 'var(--ws-red)' : 'var(--ws-text)' },
            { label: 'EV/EBITDA', val: fmtN(data.evEbitda) },
            { label: 'P/B', val: fmtN(data.priceToBook) },
            { label: 'FCF Yield', val: data.fcfYield ? `${data.fcfYield}%` : 'N/A', color: data.fcfYield > 5 ? 'var(--ws-accent)' : data.fcfYield > 0 ? 'var(--ws-text-2)' : 'var(--ws-red)' },
            { label: 'Div. Yield', val: data.dividendYield ? `${(+data.dividendYield).toFixed(2)}%` : '—' },
          ].map(r => (
            <tr key={r.label} className="border-b border-ws-border">
              <td className="py-1 text-ws-text-3 text-[10px]">{r.label}</td>
              <td style={{ padding: '4px 0', textAlign: 'right', color: r.color || 'var(--ws-text)', fontSize: '11px', fontWeight: 500 }}>{r.val}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    <div className="bg-ws-bg-1 border border-ws-border p-4">
      <div className="text-ws-text-3 text-[10px] tracking-[2px] mb-3">PROFITABILITY</div>
      <table className="w-full border-collapse text-[11px]">
        <tbody>
          {[
            { label: 'Gross Margin', val: fmtP(data.grossMargin), color: data.grossMargin > 50 ? 'var(--ws-accent)' : data.grossMargin > 30 ? 'var(--ws-text-2)' : 'var(--ws-red)' },
            { label: 'Op. Margin', val: fmtP(data.opMargin), color: data.opMargin > 20 ? 'var(--ws-accent)' : data.opMargin > 10 ? 'var(--ws-text-2)' : 'var(--ws-red)' },
            { label: 'Net Margin', val: fmtP(data.netMargin), color: data.netMargin > 15 ? 'var(--ws-accent)' : data.netMargin > 5 ? 'var(--ws-text-2)' : 'var(--ws-red)' },
            { label: 'ROE', val: fmtP(data.roe), color: data.roe > 20 ? 'var(--ws-accent)' : data.roe > 10 ? 'var(--ws-text-2)' : 'var(--ws-red)' },
            { label: 'ROA', val: fmtP(data.roa), color: data.roa > 10 ? 'var(--ws-accent)' : data.roa > 5 ? 'var(--ws-text-2)' : 'var(--ws-red)' },
            { label: 'ROIC', val: fmtP(data.roic), color: data.roic > 15 ? 'var(--ws-accent)' : data.roic > 8 ? 'var(--ws-text-2)' : 'var(--ws-red)' },
            { label: 'SBC', val: fmt(data.sbcVal) },
            { label: 'Dividends Paid', val: fmt(data.dividendsPaidVal) },
          ].map(r => (
            <tr key={r.label} className="border-b border-ws-border">
              <td className="py-1 text-ws-text-3 text-[10px]">{r.label}</td>
              <td style={{ padding: '4px 0', textAlign: 'right', color: r.color || 'var(--ws-text)', fontSize: '11px', fontWeight: 500 }}>{r.val}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    <div className="bg-ws-bg-1 border border-ws-border p-4">
      <div className="text-ws-text-3 text-[10px] tracking-[2px] mb-3">BALANCE SHEET</div>
      <table className="w-full border-collapse text-[11px]">
        <tbody>
          {[
            { label: 'Total Assets', val: fmt(data.assetsVal) },
            { label: 'Total Liabilities', val: fmt(data.totalLiabilitiesVal) },
            { label: 'Equity', val: fmt(data.equityVal) },
            { label: 'Net Debt', val: fmt(data.netDebt), color: data.netDebt < 0 ? 'var(--ws-accent)' : 'var(--ws-text)' },
            { label: 'Cash', val: fmt(data.cashVal), color: 'var(--ws-accent)' },
            { label: 'LT Debt', val: fmt(data.debtVal) },
            { label: 'D/E Ratio', val: fmtN(data.debtToEquity), color: data.debtToEquity < 1 ? 'var(--ws-accent)' : data.debtToEquity < 2 ? 'var(--ws-text-2)' : 'var(--ws-red)' },
            { label: 'Current Ratio', val: data.currentAssetsVal && data.currentLiabilitiesVal ? fmtN(data.currentAssetsVal / data.currentLiabilitiesVal) : 'N/A', color: data.currentAssetsVal / data.currentLiabilitiesVal > 2 ? 'var(--ws-accent)' : data.currentAssetsVal / data.currentLiabilitiesVal > 1 ? 'var(--ws-text-2)' : 'var(--ws-red)' },
          ].map(r => (
            <tr key={r.label} className="border-b border-ws-border">
              <td className="py-1 text-ws-text-3 text-[10px]">{r.label}</td>
              <td style={{ padding: '4px 0', textAlign: 'right', color: r.color || 'var(--ws-text)', fontSize: '11px', fontWeight: 500 }}>{r.val}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    <div className="bg-ws-bg-1 border border-ws-border p-4">
      <div className="text-ws-text-3 text-[10px] tracking-[2px] mb-3">EFFICIENCY</div>
      <table className="w-full border-collapse text-[11px]">
        <tbody>
          {[
            { label: 'Cash Conv. Cycle', val: data.ccc != null ? `${data.ccc}d` : 'N/A', color: data.ccc != null && data.ccc < 30 ? 'var(--ws-accent)' : data.ccc != null && data.ccc < 60 ? 'var(--ws-text-2)' : data.ccc != null ? 'var(--ws-red)' : 'var(--ws-text-3)' },
            { label: 'Inventory Turnover', val: data.inventoryTurnover != null ? fmtN(data.inventoryTurnover) : 'N/A', color: data.inventoryTurnover > 8 ? 'var(--ws-accent)' : data.inventoryTurnover > 4 ? 'var(--ws-text-2)' : 'var(--ws-text)' },
            { label: 'DSO', val: data.dso != null ? `${data.dso}d` : 'N/A' },
            { label: 'DIO', val: data.dio != null ? `${data.dio}d` : 'N/A' },
            { label: 'DPO', val: data.dpo != null ? `${data.dpo}d` : 'N/A' },
          ].map(r => (
            <tr key={r.label} className="border-b border-ws-border">
              <td className="py-1 text-ws-text-3 text-[10px]">{r.label}</td>
              <td style={{ padding: '4px 0', textAlign: 'right', color: r.color || 'var(--ws-text)', fontSize: '11px', fontWeight: 500 }}>{r.val}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

  </div>
</div>

<div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px', marginBottom: '16px' }}>
  <div className="bg-ws-bg-1 border border-ws-border p-4">
    <div className="text-ws-text-3 text-[10px] tracking-[2px] mb-3">PER SHARE & MARKET DATA</div>
    <div className="per-share-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
      {[
        { label: 'EPS (TTM)', val: data.eps ? `${curSym(data.currency)}${data.eps}` : 'N/A' },
        { label: 'Shs Outstanding', val: data.sharesOutstanding ? `${(data.sharesOutstanding / 1e6).toFixed(0)}M` : 'N/A' },
        { label: 'Beta', val: fmtN(data.beta) },
        { label: '52W High', val: data.high52 ? `${curSym(data.currency)}${data.high52}` : 'N/A' },
        { label: '52W Low', val: data.low52 ? `${curSym(data.currency)}${data.low52}` : 'N/A' },
      ].map(r => (
        <div key={r.label} style={{ background: 'var(--ws-bg-2)', padding: '12px' }}>
          <div className="text-ws-text-3 text-[10px] tracking-[1px] mb-1.5">{r.label}</div>
          <div style={{ color: 'var(--ws-text)', fontSize: '13px', fontWeight: 600 }}>{r.val}</div>
        </div>
      ))}
    </div>
  </div>
</div>

              <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                <div style={{ flex: 1, background: 'var(--ws-bg-1)' }}>
                  <StockChart ticker={ticker} currency={data?.currency} />
                </div>
              </div>

              <div className="text-ws-text-3 text-[10px] tracking-[2px] border-b border-ws-border pb-1.5 mb-3">PROFITABILITY & RETURNS</div>
              <div className="grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '16px' }}>
                {[
                  { label: 'REVENUE (TTM)', val: fmt(data.revVal), sub: data.revGrowth !== null ? `${data.revGrowth > 0 ? '+' : ''}${data.revGrowth}% YOY` : null, good: data.revGrowth > 0 },
                  { label: 'NET INCOME (TTM)', val: fmt(data.niVal), sub: data.netMargin !== null ? `${data.netMargin}% NET MARGIN` : null, good: data.netMargin > 10 },
                  { label: 'OP. MARGIN', val: fmtP(data.opMargin), sub: data.opMargin > 15 ? 'ABOVE THRESHOLD' : 'BELOW THRESHOLD', good: data.opMargin > 15 },
                  { label: 'ROE', val: fmtP(data.roe), sub: data.roe > 15 ? 'STRONG RETURN' : 'MODERATE RETURN', good: data.roe > 15 },
                ].map(m => (
                  <div key={m.label} style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', padding: '14px' }}>
                    <div className="text-ws-text-3 text-[10px] tracking-[1px] mb-1.5">{m.label}</div>
                    <div style={{ fontSize: '20px', fontWeight: 600, marginBottom: '4px', color: 'var(--ws-text)' }}>{m.val}</div>
                    {m.sub && <div style={{ color: m.good ? 'var(--ws-accent)' : 'var(--ws-red)', fontSize: '10px', letterSpacing: '0.5px' }}>{m.sub}</div>}
                  </div>
                ))}
              </div>

              <div className="text-ws-text-3 text-[10px] tracking-[2px] border-b border-ws-border pb-1.5 mb-3">CASH FLOW & BALANCE SHEET</div>
              <div className="grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '16px' }}>
                {[
                  { label: 'FREE CASH FLOW', val: fmt(data.fcfVal), sub: data.fcfVal > 0 ? 'POSITIVE FCF' : 'NEGATIVE FCF', good: data.fcfVal > 0 },
                  { label: 'OP. CASH FLOW', val: fmt(data.fcfVal), sub: data.fcfVal && data.revVal ? `${((data.fcfVal / data.revVal) * 100).toFixed(1)}% CONVERSION` : null, good: data.fcfVal > 0 },
                  { label: 'NET DEBT', val: fmt(data.netDebt), sub: data.netDebt < 0 ? 'NET CASH POSITION' : 'NET DEBT POSITION', good: data.netDebt < 0 },
                  { label: 'CASH & EQUIV.', val: fmt(data.cashVal), sub: null },
                ].map(m => (
                  <div key={m.label} style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', padding: '14px' }}>
                    <div className="text-ws-text-3 text-[10px] tracking-[1px] mb-1.5">{m.label}</div>
                    <div style={{ fontSize: '20px', fontWeight: 600, marginBottom: '4px', color: 'var(--ws-text)' }}>{m.val}</div>
                    {m.sub && <div style={{ color: m.good ? 'var(--ws-accent)' : 'var(--ws-red)', fontSize: '10px', letterSpacing: '0.5px' }}>{m.sub}</div>}
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                {[
                  { title: 'REVENUE', chart: revChart, color: 'var(--ws-text-2)', type: 'line' },
                  { title: 'FREE CASH FLOW', chart: fcfChart, color: 'var(--ws-accent)', type: 'line' },
                ].map(({ title, chart, color, type }) => (
                  <div key={title} className="bg-ws-bg-1 border border-ws-border p-4">
                    <div className="text-ws-text-3 text-[10px] tracking-[2px] mb-3">{title}</div>
                    <MiniLine data={chart} color={color} />
                  </div>
                ))}
              </div>
    </div>}

    {finTab === 'income' && (() => {
      const years = data.revHistory?.map(r => r.year) || [];
      const rows = [
        { label: 'Revenue', history: data.revHistory, ttm: data.revVal, bold: true },
        { label: 'Cost of Revenue', history: data.cogsHistory, ttm: data.cogsVal, indent: true, neg: true },
        { label: 'Gross Profit', history: data.revHistory?.map((r, i) => ({ year: r.year, val: data.cogsHistory?.[i] ? r.val - data.cogsHistory[i].val : null })), ttm: data.revVal && data.cogsVal ? data.revVal - data.cogsVal : null, bold: true, green: true },
        { label: 'SG&A', history: data.sgaHistory, ttm: data.sgaVal, indent: true, neg: true },
        { label: 'R&D', history: data.rdHistory, ttm: data.rdVal, indent: true, neg: true },
        { label: 'Operating Income', history: data.oiHistory, ttm: data.oiVal, bold: true, green: true },
        { label: 'Interest Expense', history: [], ttm: data.interestVal, indent: true, neg: true },
        { label: 'EBT', history: data.ebtHistory, ttm: data.ebtVal, bold: true },
        { label: 'Income Tax', history: data.taxHistory, ttm: data.taxVal, indent: true, neg: true },
        { label: 'Net Income', history: data.niHistory, ttm: data.niVal, bold: true, green: true },
        { label: '---', divider: true },
        { label: 'EPS (Diluted)', history: data.sharesDilutedHistory?.map((s, i) => ({ year: s.year, val: data.niHistory?.[i] && s.val ? +(data.niHistory[i].val / s.val).toFixed(2) : null })), ttm: data.eps, prefix: '$' },
        { label: 'Shares Diluted', history: data.sharesDilutedHistory, ttm: data.sharesDilutedVal, shares: true },
        { label: 'SBC', history: [], ttm: data.sbcVal, indent: true },
      ];
      const fmtV = (v, row) => {
        if (v === null || v === undefined) return '—';
        if (row?.prefix) return `$${v}`;
        if (row?.shares) return Math.abs(v) >= 1e9 ? `${(v/1e9).toFixed(2)}B` : `${(v/1e6).toFixed(0)}M`;
        return Math.abs(v) >= 1e9 ? `$${(v/1e9).toFixed(1)}B` : Math.abs(v) >= 1e6 ? `$${(v/1e6).toFixed(0)}M` : `$${v.toLocaleString()}`;
      };
      return (
        <div className="overflow-x-auto">
          <div style={{ color: 'var(--ws-text-3)', fontSize: '10px', letterSpacing: '1px', marginBottom: '8px' }}>All values in USD · Source: SEC EDGAR</div>
          <table className="w-full border-collapse text-[11px] min-w-[700px]">
            <thead>
              <tr className="border-b border-ws-border">
                <th style={{ padding: '8px 0', textAlign: 'left', fontWeight: 400, fontSize: '10px', letterSpacing: '1px', color: 'var(--ws-text-3)', width: '180px' }}>METRIC</th>
                {years.map(y => <th key={y} style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 400, fontSize: '10px', color: 'var(--ws-text-3)' }}>{y}</th>)}
                <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, fontSize: '10px', color: 'var(--ws-accent)' }}>TTM</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                if (row.divider) return <tr key={i}><td colSpan={years.length + 2} className="py-1 border-b border-ws-border" /></tr>;
                return (
                  <tr key={i} style={{ borderBottom: '1px solid var(--ws-border)', background: i % 2 === 0 ? 'transparent' : 'var(--ws-bg-1)' }}>
                    <td style={{ padding: '6px 0', paddingLeft: row.indent ? '16px' : '0', color: row.bold ? 'var(--ws-text)' : 'var(--ws-text-3)', fontWeight: row.bold ? 600 : 400, fontSize: '11px' }}>{row.label}</td>
                    {years.map((y, j) => {
                      const h = row.history?.[j];
                      const color = row.green ? 'var(--ws-accent)' : row.neg ? 'var(--ws-red)' : 'var(--ws-text)';
                      return <td key={y} style={{ padding: '6px 12px', textAlign: 'right', color: h?.val != null ? color : 'var(--ws-text-3)' }}>{fmtV(h?.val, row)}</td>;
                    })}
                    <td style={{ padding: '6px 12px', textAlign: 'right', color: row.green ? 'var(--ws-accent)' : row.neg ? 'var(--ws-red)' : 'var(--ws-text)', fontWeight: 600 }}>{fmtV(row.ttm, row)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
    })()}

    {finTab === 'balance' && (() => {
      const rows = [
        { label: 'ASSETS', section: true },
        { label: 'Current Assets', val: data.currentAssetsVal, green: true },
        { label: 'Total Assets', val: data.assetsVal, bold: true },
        { label: 'LIABILITIES', section: true },
        { label: 'Current Liabilities', val: data.currentLiabilitiesVal, neg: true },
        { label: 'Long-term Debt', val: data.debtVal, neg: true },
        { label: 'Total Liabilities', val: data.totalLiabilitiesVal, neg: true, bold: true },
        { label: 'EQUITY', section: true },
        { label: "Stockholders' Equity", val: data.equityVal, bold: true, green: true },
        { label: 'Retained Earnings', val: data.retainedEarningsVal },
        { label: 'RATIOS', section: true },
        { label: 'D/E Ratio', val: data.debtToEquity, raw: true, suffix: 'x', color: data.debtToEquity < 1 ? 'var(--ws-accent)' : data.debtToEquity < 2 ? 'var(--ws-text-2)' : 'var(--ws-red)' },
        { label: 'Current Ratio', val: data.currentAssetsVal && data.currentLiabilitiesVal ? +(data.currentAssetsVal/data.currentLiabilitiesVal).toFixed(2) : null, raw: true, suffix: 'x', color: data.currentAssetsVal/data.currentLiabilitiesVal > 1.5 ? 'var(--ws-accent)' : 'var(--ws-text-2)' },
        { label: 'Net Debt', val: data.netDebt, color: data.netDebt < 0 ? 'var(--ws-accent)' : 'var(--ws-text)' },
        { label: 'Cash & Equivalents', val: data.cashVal, green: true },
      ];
      const fmtV = (v, row) => {
        if (v === null || v === undefined) return '—';
        if (row?.raw) return `${v.toFixed(2)}${row.suffix || ''}`;
        return Math.abs(v) >= 1e9 ? `$${(v/1e9).toFixed(1)}B` : Math.abs(v) >= 1e6 ? `$${(v/1e6).toFixed(0)}M` : `$${v.toLocaleString()}`;
      };
      return (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', maxWidth: '500px' }}>
          <thead>
            <tr className="border-b border-ws-border">
              <th style={{ padding: '8px 0', textAlign: 'left', fontWeight: 400, fontSize: '10px', color: 'var(--ws-text-3)' }}>METRIC</th>
              <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, fontSize: '10px', color: 'var(--ws-accent)' }}>TTM</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              if (row.section) return <tr key={i}><td colSpan={2} style={{ padding: '10px 0 4px', color: 'var(--ws-accent)', fontSize: '10px', letterSpacing: '2px', borderBottom: '1px solid var(--ws-border)' }}>{row.label}</td></tr>;
              return (
                <tr key={i} className="border-b border-ws-border">
                  <td style={{ padding: '6px 0', color: row.bold ? 'var(--ws-text)' : 'var(--ws-text-3)', fontWeight: row.bold ? 600 : 400 }}>{row.label}</td>
                  <td style={{ padding: '6px 12px', textAlign: 'right', color: row.color || (row.green ? 'var(--ws-accent)' : row.neg ? 'var(--ws-red)' : 'var(--ws-text)'), fontWeight: row.bold ? 600 : 400 }}>{fmtV(row.val, row)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      );
    })()}

    {finTab === 'cashflow' && (() => {
      const years = data.operatingCFHistory?.map(r => r.year) || [];
      const rows = [
        { label: 'Operating Cash Flow', history: data.operatingCFHistory, ttm: data.operatingCFVal, bold: true, green: true },
        { label: 'Capital Expenditures', history: data.capexHistory, ttm: data.capexVal, indent: true, neg: true },
        { label: 'Free Cash Flow', history: data.fcfHistory, ttm: data.fcfVal, bold: true, green: true },
        { label: '---', divider: true },
        { label: 'Investing Cash Flow', history: data.investingCFHistory, ttm: data.investingCFVal, neg: data.investingCFVal < 0 },
        { label: 'Financing Cash Flow', history: data.financingCFHistory, ttm: data.financingCFVal, neg: data.financingCFVal < 0 },
        { label: 'Dividends Paid', history: [], ttm: data.dividendsPaidVal, indent: true, neg: true },
        { label: 'SBC', history: [], ttm: data.sbcVal, indent: true },
      ];
      const fmtV = (v) => {
        if (v === null || v === undefined) return '—';
        return Math.abs(v) >= 1e9 ? `$${(v/1e9).toFixed(1)}B` : Math.abs(v) >= 1e6 ? `$${(v/1e6).toFixed(0)}M` : `$${v.toLocaleString()}`;
      };
      return (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[11px] min-w-[700px]">
            <thead>
              <tr className="border-b border-ws-border">
                <th style={{ padding: '8px 0', textAlign: 'left', fontWeight: 400, fontSize: '10px', color: 'var(--ws-text-3)', width: '200px' }}>METRIC</th>
                {years.map(y => <th key={y} style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 400, fontSize: '10px', color: 'var(--ws-text-3)' }}>{y}</th>)}
                <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, fontSize: '10px', color: 'var(--ws-accent)' }}>TTM</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                if (row.divider) return <tr key={i}><td colSpan={years.length + 2} className="py-1 border-b border-ws-border" /></tr>;
                return (
                  <tr key={i} style={{ borderBottom: '1px solid var(--ws-border)', background: i % 2 === 0 ? 'transparent' : 'var(--ws-bg-1)' }}>
                    <td style={{ padding: '6px 0', paddingLeft: row.indent ? '16px' : '0', color: row.bold ? 'var(--ws-text)' : 'var(--ws-text-3)', fontWeight: row.bold ? 600 : 400 }}>{row.label}</td>
                    {years.map((y, j) => {
                      const h = row.history?.[j];
                      const color = row.green ? 'var(--ws-accent)' : row.neg ? 'var(--ws-red)' : 'var(--ws-text)';
                      return <td key={y} style={{ padding: '6px 12px', textAlign: 'right', color: h?.val != null ? color : 'var(--ws-text-3)' }}>{fmtV(h?.val)}</td>;
                    })}
                    <td style={{ padding: '6px 12px', textAlign: 'right', color: row.green ? 'var(--ws-accent)' : row.neg ? 'var(--ws-red)' : 'var(--ws-text)', fontWeight: 600 }}>{fmtV(row.ttm)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
    })()}

    <div style={{ color: 'var(--ws-text-3)', fontSize: '10px', letterSpacing: '1px', marginTop: '16px' }}>
      SOURCE: SEC EDGAR (XBRL) · FINNHUB · NOT INVESTMENT ADVICE
    </div>
  </div>
)}

        {/* DCF TAB */}
        {tab === 'dcf' && (
          <div>
            <div className="text-ws-text-3 text-[10px] tracking-[2px] border-b border-ws-border pb-1.5 mb-3 mt-6">GRAHAM INTRINSIC VALUE — V = EPS × (8.5 + 2g)</div>

            {data.eps ? (
              <>
                <div style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', padding: '16px', marginBottom: '24px', fontSize: '11px', color: 'var(--ws-text-2)', lineHeight: 1.8 }}>
                  <span style={{ color: 'var(--ws-accent)' }}>V = EPS × (8.5 + 2g) × (4.4/5.5)</span> &nbsp;·&nbsp;
                  EPS: <span className="text-ws-text">{curSym(data.currency)}{data.eps}</span> &nbsp;·&nbsp;
                  5Y EPS CAGR (g): <span className="text-ws-text">{data.epsCagr !== null ? `${data.epsCagr}%` : 'N/A'}</span> &nbsp;·&nbsp;
                  <span className="text-ws-text-3">Benjamin Graham formula · Not investment advice</span>
                </div>

                <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: 'var(--ws-border)', marginBottom: '24px' }}>
                  {[
                    { label: 'CONSERVATIVE', g: data.epsCagr !== null && !isNaN(data.epsCagr) ? Math.min(+(data.epsCagr * 0.5).toFixed(1), 15) : 3, desc: '50% of 5Y EPS CAGR (max 15%)' },
                    { label: 'BASE', g: data.epsCagr !== null && !isNaN(data.epsCagr) ? Math.min(+Number(data.epsCagr).toFixed(1), 20) : 7, desc: '5Y EPS CAGR historical (max 20%)' },
                    { label: 'OPTIMISTIC', g: data.epsCagr !== null && !isNaN(data.epsCagr) ? Math.min(+(data.epsCagr * 1.5).toFixed(1), 25) : 12, desc: '150% of 5Y EPS CAGR (max 25%)' },
                  ].map(scenario => {
                    const g = Math.max(0, Math.min(scenario.g, 25));
                    const intrinsic = +(data.eps * (8.5 + 2 * g) * (4.4 / 5.5)).toFixed(2);
                    const diff = price ? (((intrinsic - price) / price) * 100).toFixed(1) : null;
                    const underval = price ? intrinsic > price : null;
                    return (
                      <div key={scenario.label} style={{ background: 'var(--ws-bg-1)', padding: '20px' }}>
                        <div className="text-ws-text-3 text-[10px] tracking-[2px] mb-3">{scenario.label}</div>
                        <div style={{ color: 'var(--ws-text-3)', fontSize: '10px', marginBottom: '4px' }}>g = {g}%</div>
                        <div style={{ fontSize: '32px', fontWeight: 600, color: underval ? 'var(--ws-accent)' : 'var(--ws-red)', marginBottom: '4px', letterSpacing: '-1px' }}>
                          {curSym(data.currency)}{intrinsic}
                        </div>
                        <div style={{ color: 'var(--ws-text-3)', fontSize: '10px', marginBottom: '12px' }}>{scenario.desc}</div>
                        {diff !== null && (
                          <div style={{ borderTop: '1px solid var(--ws-border)', paddingTop: '10px' }}>
                            <div style={{ color: underval ? 'var(--ws-accent)' : 'var(--ws-red)', fontSize: '13px', fontWeight: 600 }}>
                              {underval ? '+' : '-'} {Math.abs(diff)}% {underval ? 'UPSIDE' : 'DOWNSIDE'}
                            </div>
                            <div style={{ color: 'var(--ws-text-3)', fontSize: '10px', marginTop: '2px' }}>
                              vs current price {curSym(data.currency)}{price?.toFixed(2)}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="text-ws-text-3 text-[10px] tracking-[1px]">
                  GRAHAM FORMULA (1962) · EPS FROM SEC EDGAR & FINNHUB · GROWTH FROM SEC EDGAR · NOT INVESTMENT ADVICE
                </div>
              </>
            ) : (
              <div style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', padding: '40px', textAlign: 'center' }}>
                <div style={{ color: 'var(--ws-accent)', fontSize: '24px', fontWeight: 600, letterSpacing: '4px', marginBottom: '8px' }}>N/A</div>
                <div style={{ color: 'var(--ws-text-2)', fontSize: '12px', marginBottom: '4px' }}>EPS DATA NOT AVAILABLE</div>
                <div style={{ color: 'var(--ws-text-3)', fontSize: '11px' }}>Graham formula requires EPS data from Alpha Vantage.</div>
              </div>
            )}
          </div>
        )}

        {/* INSIDERS TAB — Form 3/4/5 buy/sell activity, SEC EDGAR primary / Finnhub fallback */}
        {tab === 'insiders' && (
          <div>
            <div className="text-ws-text-3 text-[10px] tracking-[2px] border-b border-ws-border pb-1.5 mb-3 mt-6">
              INSIDER TRANSACTIONS — LAST REPORTED FORM 4 FILINGS
            </div>

            {insiderLoading ? (
              <div style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', padding: '40px', textAlign: 'center', color: 'var(--ws-text-3)', fontSize: '11px' }}>
                LOADING INSIDER ACTIVITY…
              </div>
            ) : !insiderTrades || insiderTrades.length === 0 ? (
              <div style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', padding: '40px', textAlign: 'center' }}>
                <div style={{ color: 'var(--ws-accent)', fontSize: '24px', fontWeight: 600, letterSpacing: '4px', marginBottom: '8px' }}>N/A</div>
                <div style={{ color: 'var(--ws-text-2)', fontSize: '12px', marginBottom: '4px' }}>NO INSIDER DATA AVAILABLE</div>
                <div style={{ color: 'var(--ws-text-3)', fontSize: '11px' }}>No reported Form 3/4/5 filings for this ticker.</div>
              </div>
            ) : (
              <>
                {/* Summary metrics — computed from genuine open-market buys/sells only */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', padding: '14px' }}>
                    <div style={{ fontSize: '9px', fontWeight: 800, color: 'var(--ws-text-3)', letterSpacing: '1px', marginBottom: '8px' }}>NET OPEN-MARKET BUYING</div>
                    {insiderSummary ? (
                      <>
                        <div style={{ fontSize: '18px', fontWeight: 800, color: insiderSummary.netValue >= 0 ? 'var(--ws-accent)' : 'var(--ws-red)' }}>
                          {insiderSummary.netValue >= 0 ? '+' : '-'}{fmt(Math.abs(insiderSummary.netValue))}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--ws-text-3)', marginTop: '2px' }}>
                          {insiderSummary.netShares >= 0 ? '+' : ''}{insiderSummary.netShares.toLocaleString()} shares
                        </div>
                      </>
                    ) : <div style={{ fontSize: '11px', color: 'var(--ws-text-3)' }}>No open-market trades</div>}
                  </div>

                  <div style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', padding: '14px' }}>
                    <div style={{ fontSize: '9px', fontWeight: 800, color: 'var(--ws-text-3)', letterSpacing: '1px', marginBottom: '8px' }}>SIGNAL</div>
                    {insiderSummary ? (
                      <div style={{ fontSize: '18px', fontWeight: 800, color: insiderSummary.signal.color, letterSpacing: '1px' }}>
                        {insiderSummary.signal.label}
                      </div>
                    ) : <div style={{ fontSize: '11px', color: 'var(--ws-text-3)' }}>—</div>}
                  </div>

                  <div style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', padding: '14px' }}>
                    <div style={{ fontSize: '9px', fontWeight: 800, color: 'var(--ws-text-3)', letterSpacing: '1px', marginBottom: '8px' }}>LARGEST SELLER</div>
                    {insiderSummary?.largestSeller ? (
                      <>
                        <div style={{ fontSize: '13px', fontWeight: 700 }}>{insiderSummary.largestSeller[0]}</div>
                        <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--ws-red)', marginTop: '2px' }}>-{fmt(insiderSummary.largestSeller[1])}</div>
                      </>
                    ) : <div style={{ fontSize: '11px', color: 'var(--ws-text-3)' }}>—</div>}
                  </div>

                  <div style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', padding: '14px' }}>
                    <div style={{ fontSize: '9px', fontWeight: 800, color: 'var(--ws-text-3)', letterSpacing: '1px', marginBottom: '8px' }}>LARGEST BUYER</div>
                    {insiderSummary?.largestBuyer ? (
                      <>
                        <div style={{ fontSize: '13px', fontWeight: 700 }}>{insiderSummary.largestBuyer[0]}</div>
                        <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--ws-accent)', marginTop: '2px' }}>+{fmt(insiderSummary.largestBuyer[1])}</div>
                      </>
                    ) : <div style={{ fontSize: '11px', color: 'var(--ws-text-3)' }}>—</div>}
                  </div>
                </div>

                {/* Price vs insider activity */}
                {insiderChartData.length > 1 && (
                  <div style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', padding: '14px', marginBottom: '16px' }}>
                    <div style={{ fontSize: '9px', fontWeight: 800, color: 'var(--ws-text-3)', letterSpacing: '1px', marginBottom: '4px' }}>PRICE VS INSIDER ACTIVITY (1Y)</div>
                    <ResponsiveContainer width="100%" height={160}>
                      <LineChart data={insiderChartData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                        <XAxis dataKey="date" tick={{ fill: 'var(--ws-text-3)', fontSize: 9 }} axisLine={false} tickLine={false} minTickGap={40} />
                        <YAxis hide domain={['dataMin', 'dataMax']} />
                        <Tooltip contentStyle={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', fontSize: 10 }} />
                        <Line type="monotone" dataKey="price" stroke="var(--ws-text-3)" strokeWidth={1.25} dot={false} />
                        <Line dataKey="buy" stroke="none" dot={{ r: 4, fill: 'var(--ws-accent)' }} isAnimationActive={false} />
                        <Line dataKey="sell" stroke="none" dot={{ r: 4, fill: 'var(--ws-red)' }} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Filters */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px', alignItems: 'center' }}>
                  {[
                    { key: 'ALL', label: 'All time', state: insiderDateFilter, set: setInsiderDateFilter, val: 'ALL' },
                    { key: '30D', label: 'Last 30 days', state: insiderDateFilter, set: setInsiderDateFilter, val: '30D' },
                  ].map(f => (
                    <button key={f.label} onClick={() => f.set(f.val)}
                      style={{ padding: '6px 12px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.5px', border: '1px solid var(--ws-border)', background: f.state === f.val ? 'var(--ws-text)' : 'var(--ws-bg-1)', color: f.state === f.val ? 'var(--ws-bg)' : 'var(--ws-text-2)', cursor: 'pointer' }}>
                      {f.label}
                    </button>
                  ))}
                  <span style={{ width: '1px', height: '16px', background: 'var(--ws-border)' }} />
                  {[
                    { label: 'All types', val: 'ALL' },
                    { label: 'Buys', val: 'BUY' },
                    { label: 'Sells', val: 'SELL' },
                  ].map(f => (
                    <button key={f.label} onClick={() => setInsiderTypeFilter(f.val)}
                      style={{ padding: '6px 12px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.5px', border: '1px solid var(--ws-border)', background: insiderTypeFilter === f.val ? 'var(--ws-text)' : 'var(--ws-bg-1)', color: insiderTypeFilter === f.val ? 'var(--ws-bg)' : 'var(--ws-text-2)', cursor: 'pointer' }}>
                      {f.label}
                    </button>
                  ))}
                  <span style={{ width: '1px', height: '16px', background: 'var(--ws-border)' }} />
                  {[
                    { label: 'All roles', val: 'ALL' },
                    { label: 'Only executives', val: 'EXEC' },
                    { label: 'Owners >10%', val: 'OWNER10' },
                  ].map(f => (
                    <button key={f.label} onClick={() => setInsiderRoleFilter(f.val)}
                      style={{ padding: '6px 12px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.5px', border: '1px solid var(--ws-border)', background: insiderRoleFilter === f.val ? 'var(--ws-text)' : 'var(--ws-bg-1)', color: insiderRoleFilter === f.val ? 'var(--ws-bg)' : 'var(--ws-text-2)', cursor: 'pointer' }}>
                      {f.label}
                    </button>
                  ))}
                  {selectedInsiderName && (
                    <button onClick={() => setSelectedInsiderName(null)}
                      style={{ padding: '6px 12px', fontSize: '10px', fontWeight: 700, border: '1px solid var(--ws-accent)', background: 'var(--ws-bg-1)', color: 'var(--ws-accent)', cursor: 'pointer' }}>
                      {selectedInsiderName} ✕
                    </button>
                  )}
                </div>

                {filteredInsiderTrades.length === 0 ? (
                  <div style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', padding: '30px', textAlign: 'center', color: 'var(--ws-text-3)', fontSize: '11px' }}>
                    No transactions match this filter.
                  </div>
                ) : (
                  <div style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--ws-border)' }}>
                          {['DATE', 'INSIDER', 'TYPE', 'SHARES', 'PRICE', 'VALUE', 'OWNERSHIP'].map(h => (
                            <th key={h} style={{ textAlign: h === 'DATE' || h === 'INSIDER' ? 'left' : 'right', padding: '10px 14px', color: 'var(--ws-text-3)', fontSize: '10px', letterSpacing: '1px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredInsiderTrades.slice(0, 40).map((t, i) => {
                          const isBuy = t.type === 'BUY';
                          // Only P (open-market buy) and S (open-market sell) reflect a real discretionary
                          // bet — grants, option exercises, tax withholding and gifts move shares for
                          // administrative reasons and shouldn't read as the same signal as a BUY/SELL.
                          const label = TXN_CODE_LABELS[t.code] || (isBuy ? 'ACQUIRED' : 'DISPOSED');
                          const isCeoCfo = t.role && /chief executive|chief financial|\bceo\b|\bcfo\b/i.test(t.role);
                          const isLargeSell = t.isOpenMarket && !isBuy && t.value != null && t.value > 1_000_000;
                          const highlightValue = (t.isOpenMarket && isBuy && isCeoCfo) || isLargeSell;
                          const ownershipPct = t.sharesOwnedAfter && data.sharesOutstanding
                            ? (t.sharesOwnedAfter / data.sharesOutstanding) * 100 : null;

                          return (
                            <tr key={i} style={{ borderBottom: '1px solid var(--ws-border)' }}>
                              <td style={{ padding: '9px 14px', color: 'var(--ws-text-2)', whiteSpace: 'nowrap' }}>{t.date}</td>
                              <td style={{ padding: '9px 14px', textAlign: 'left' }}>
                                <span
                                  onClick={() => setSelectedInsiderName(t.insider)}
                                  style={{ fontWeight: 700, cursor: 'pointer' }}
                                  onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                                  onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                                >
                                  {t.insider}
                                </span>
                                {t.role && <div style={{ fontSize: '10px', color: 'var(--ws-text-3)', marginTop: '1px' }}>{t.role}{isCeoCfo ? ' ★' : ''}</div>}
                              </td>
                              <td style={{ padding: '9px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                <span
                                  title={t.code ? `SEC transaction code: ${t.code}${t.isOpenMarket ? ' (open market)' : ' (not an open-market trade)'}` : undefined}
                                  style={{ fontWeight: 800, color: t.isOpenMarket ? (isBuy ? '#059669' : '#dc2626') : 'var(--ws-text-3)' }}
                                >
                                  {isBuy ? '▲' : '▼'} {label}
                                </span>
                              </td>
                              <td style={{ padding: '9px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>{t.shares.toLocaleString()}</td>
                              <td style={{ padding: '9px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>{t.price ? `${curSym(data.currency)}${t.price.toFixed(2)}` : '—'}</td>
                              <td style={{ padding: '9px 14px', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: highlightValue ? 800 : 600, color: highlightValue ? (isBuy ? '#059669' : '#dc2626') : 'var(--ws-text)' }}>
                                {t.value ? fmt(t.value) : '—'}
                              </td>
                              <td style={{ padding: '9px 14px', textAlign: 'right', whiteSpace: 'nowrap', color: 'var(--ws-text-3)' }}>
                                {ownershipPct != null ? `${ownershipPct.toFixed(2)}%` : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            <div className="text-ws-text-3 text-[10px] tracking-[1px]" style={{ marginTop: '16px' }}>
              SOURCE: SEC EDGAR FORM 4 (PRIMARY) · FINNHUB (FALLBACK FOR NON-SEC TICKERS) · ★ = OFFICER TITLE MATCHES CEO/CFO · GRAY LABELS (GRANT/EXERCISE/TAX WITHHOLD/GIFT) ARE NOT OPEN-MARKET TRADES · NOT INVESTMENT ADVICE
            </div>
          </div>
        )}

      </div>

      {achievementToast && (
        <AchievementToast
          achievement={achievementToast}
          onClose={() => setAchievementToast(null)}
        />
      )}
    </div>
  );
}
