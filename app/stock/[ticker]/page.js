'use client';
import { useState, useEffect, use } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import PriceChart from './chart';
import StockChart from '../../components/StockChart';
import Sparkline from '../../components/Sparkline';
import SparklineHeader from '../../components/SparklineHeader';
import Topbar from '../../components/Topbar';
import ShareCardComponent from '../../components/ShareCard';
import { useUser } from '@clerk/nextjs';

const fmt = (val) => {
  if (val === null || val === undefined) return 'N/A';
  if (Math.abs(val) >= 1e12) return `$${(val / 1e12).toFixed(1)}T`;
  if (Math.abs(val) >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
  if (Math.abs(val) >= 1e6) return `$${(val / 1e6).toFixed(0)}M`;
  return `$${val.toLocaleString()}`;
};
const fmtP = (v) => v !== null && v !== undefined ? `${v}%` : 'N/A';
const fmtN = (v, d = 2) => v !== null && v !== undefined ? v.toFixed(d) : 'N/A';

const S = {
  page: { background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', fontFamily: 'JetBrains Mono, monospace' },
  topbar: { borderBottom: '1px solid var(--border)', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '12px', position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 10, fontSize: '11px' },
  sidebar: { width: '160px', flexShrink: 0, borderRight: '1px solid var(--border)', minHeight: '100vh', padding: '16px 0', position: 'sticky', top: '33px', alignSelf: 'flex-start' },
  navItem: (active) => ({ display: 'block', width: '100%', textAlign: 'left', padding: '8px 16px', fontSize: '11px', letterSpacing: '0.5px', background: 'none', border: 'none', cursor: 'pointer', color: active ? 'var(--accent)' : 'var(--text-3)', borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent', fontFamily: 'JetBrains Mono, monospace' }),
  content: { flex: 1, padding: '24px', overflow: 'hidden' },
  card: { background: 'var(--bg-1)', border: '1px solid var(--border)', padding: '16px', marginBottom: '1px' },
  label: { color: 'var(--text-3)', fontSize: '10px', letterSpacing: '2px', marginBottom: '4px' },
  val: { fontSize: '22px', fontWeight: 600, marginBottom: '2px' },
  section: { color: 'var(--text-3)', fontSize: '10px', letterSpacing: '2px', borderBottom: '1px solid var(--border)', paddingBottom: '6px', marginBottom: '12px', marginTop: '24px' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '12px' },
  tr: { borderBottom: '1px solid var(--border)' },
  td: { padding: '6px 0', color: 'var(--text-3)' },
  tdVal: { padding: '6px 0', textAlign: 'right', color: 'var(--text)' },
};

const NAV = [
    { key: 'overview', label: 'OVERVIEW' },
    // QUALITY tab hidden from nav (health ring in Overview now summarizes the FINAL NOTE
    // in plain language). Code kept for potential future use - just not shown.
    // { key: 'quality', label: 'QUALITY' },
    { key: 'financials', label: 'FINANCIALS', pro: true },
    // DCF tab hidden from nav (Graham formula now powers the Fair Value bar in Overview).
    // Code kept for potential future use - just not shown.
    // { key: 'dcf', label: 'DCF', pro: true },
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

const MiniBar = ({ data, color = '#F59E0B' }) => {
  const max = Math.max(...data.map(d => Math.abs(d.value)));
  return (
    <ResponsiveContainer width="100%" height={80}>
      <BarChart data={data} barSize={18} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <XAxis dataKey="year" tick={{ fill: '#555', fontSize: 9 }} axisLine={false} tickLine={false} />
        <YAxis hide domain={[0, max * 1.15]} />
        <Tooltip
          formatter={v => [`$${Math.abs(v).toFixed(1)}B`]}
          contentStyle={{ background: 'var(--bg-2)', border: '1px solid var(--border)', fontSize: 10, fontFamily: 'JetBrains Mono' }}
        />
        <Bar dataKey="value" radius={[2, 2, 0, 0]}>
          {data.map((_, i) => <Cell key={i} fill={i === data.length - 1 ? color : color + '55'} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

const MiniLine = ({ data, color = 'var(--accent)' }) => (
  <ResponsiveContainer width="100%" height={60}>
    <LineChart data={data}>
      <XAxis dataKey="year" tick={{ fill: '#555', fontSize: 9 }} axisLine={false} tickLine={false} />
      <Tooltip contentStyle={{ background: 'var(--bg-2)', border: '1px solid var(--border)', fontSize: 10, fontFamily: 'JetBrains Mono' }} />
      <Line type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} dot={{ fill: color, r: 2 }} />
    </LineChart>
  </ResponsiveContainer>
);

const ScoreBox = ({ score, size = 48 }) => {
  const c = score === null ? 'var(--text-3)' : score >= 70 ? 'var(--green)' : score >= 40 ? 'var(--accent)' : 'var(--red)';
  return (
    <div style={{ width: size, height: size, border: `1px solid ${c}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size > 40 ? '16px' : '12px', fontWeight: 600, color: c }}>
      {score ?? '—'}
    </div>
  );
};

export default function StockPage({ params }) {
  const { ticker: rawTicker } = use(params);
  const ticker = rawTicker.toUpperCase();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('overview');
  const [answers, setAnswers] = useState({});
  const [finTab, setFinTab] = useState('income');
  const [evidence, setEvidence] = useState({});
  const [sparklineData, setSparklineData] = useState(null);
  const [isPro, setIsPro] = useState(false);
  const [checkingPro, setCheckingPro] = useState(true);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [userVote, setUserVote] = useState(null);
  const [voteConsensus, setVoteConsensus] = useState({ BUY: 0, HOLD: 0, SELL: 0, total: 0 });
  const [expanded, setExpanded] = useState(false);
  const [sotw, setSotw] = useState(null);
  const { isSignedIn } = useUser();


  useEffect(() => {
    fetch(`/api/stock?ticker=${ticker}`)
      .then(r => r.json())
      .then(d => { if (d.error) { setError(d.error); return; } setData(d); })
      .catch(() => setError('Connection error'))
      .finally(() => setLoading(false));

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

  // Load persisted vote (per ticker) from localStorage, only when signed in.
  // Load user vote and consensus from API
  useEffect(() => {
    fetch(`/api/votes?ticker=${ticker}`)
      .then(r => r.json())
      .then(d => {
        if (d.userVote) setUserVote(d.userVote);
        setVoteConsensus({ ...d.percentages, total: d.total });
      })
      .catch(() => {});
  }, [ticker]);

  // Load stock of the week
  useEffect(() => {
    fetch('/api/stock-of-week')
      .then(r => r.json())
      .then(d => setSotw(d.ticker))
      .catch(() => {});
  }, []);

  const getDimScore = (dim) => {
    const indices = QUESTIONS.map((q, i) => q.dim === dim ? i : -1).filter(i => i >= 0);
    const answered = indices.filter(i => answers[i] === 'YES' || answers[i] === 'NO');
    if (!answered.length) return null;
    return Math.round((answered.filter(i => answers[i] === 'YES').length / answered.length) * 100);
  };
  const totalScore = () => {
    const scores = DIMS.map(d => getDimScore(d)).filter(s => s !== null);
    if (!scores.length) return null;
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  };

  const toggleWatchlist = async () => {
    if (!isSignedIn) { window.location.href = '/sign-in'; return; }
    const method = inWatchlist ? 'DELETE' : 'POST';
    await fetch('/api/watchlist', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker }),
    });
    setInWatchlist(!inWatchlist);
  };

  if (loading) return (
    <div style={{ ...S.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ color: 'var(--accent)', fontSize: '11px', letterSpacing: '2px', marginBottom: '8px' }}>LOADING SEC EDGAR DATA...</div>
        <div style={{ color: 'var(--text-3)', fontSize: '11px' }}>{ticker}</div>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ ...S.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ color: 'var(--red)', fontSize: '11px', marginBottom: '8px' }}>ERROR: {error}</div>
        <a href="/" style={{ color: 'var(--text-3)', fontSize: '11px' }}>← BACK</a>
      </div>
    </div>
  );

  {data?.finnhubFallback && !isPro && !checkingPro && (
            <div style={{ background: 'var(--bg-1)', border: '1px solid var(--accent)', padding: '12px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
              <div>
                <span style={{ color: 'var(--accent)', fontSize: '11px', fontWeight: 700, letterSpacing: '1px' }}>🌍 INTERNATIONAL STOCK</span>
                <span style={{ color: 'var(--text-2)', fontSize: '11px', marginLeft: '12px' }}>Limited data available. Upgrade to Pro for full access to international stocks.</span>
              </div>
              <a href="/pricing" style={{ background: 'var(--accent)', color: '#000', padding: '4px 14px', fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', fontWeight: 700, letterSpacing: '1px', textDecoration: 'none', flexShrink: 0 }}>UPGRADE →</a>
            </div>
          )}

         

  {/* Company header */}

  const score = totalScore();
  const revChart = data.revHistory.map(r => ({ year: r.year, value: +(r.val / 1e9).toFixed(1) }));
  const fcfChart = data.fcfHistory.map(r => ({ year: r.year, value: +(r.val / 1e9).toFixed(1) }));
  const marginChart = (data.marginHistory || []).filter(m => m.margin !== null).map(m => ({ year: m.year, value: m.margin }));

  const price = data.currentPrice;
  const change = data.priceChange;
  const changePct = data.priceChangePct;

  // Easy Mode score (0-100) - same methodology as quality tab, scaled up
  const easyMode = (() => {
    const sector = (data.sector || '').toLowerCase();
    const isFinancial = sector.includes('bank') || sector.includes('insurance') || sector.includes('financial');
    const isTech = sector.includes('tech') || sector.includes('software') || sector.includes('semi');
    const isPharma = sector.includes('pharma') || sector.includes('biotech') || sector.includes('health');
    const roicThreshold = isTech ? 0.25 : isPharma ? 0.20 : 0.15;
    const gmThreshold = isTech ? 0.65 : isPharma ? 0.65 : isFinancial ? 0.30 : 0.35;
    const omThreshold = isTech ? 0.20 : isPharma ? 0.20 : isFinancial ? 0.15 : 0.15;
    const roicScore = data.roic == null ? 2.5 : data.roic/100 >= roicThreshold*2 ? 5 : data.roic/100 >= roicThreshold*1.5 ? 4.5 : data.roic/100 >= roicThreshold ? 4 : data.roic/100 >= roicThreshold*0.7 ? 3 : data.roic/100 >= roicThreshold*0.4 ? 2 : 1;
    const gmScore = data.grossMargin == null ? 2.5 : data.grossMargin/100 >= gmThreshold*1.4 ? 5 : data.grossMargin/100 >= gmThreshold*1.15 ? 4.5 : data.grossMargin/100 >= gmThreshold ? 4 : data.grossMargin/100 >= gmThreshold*0.75 ? 3 : data.grossMargin/100 >= gmThreshold*0.5 ? 2 : 1;
    const omScore = data.opMargin == null ? 2.5 : data.opMargin/100 >= omThreshold*2 ? 5 : data.opMargin/100 >= omThreshold*1.5 ? 4.5 : data.opMargin/100 >= omThreshold ? 4 : data.opMargin/100 >= omThreshold*0.65 ? 3 : data.opMargin/100 > 0 ? 2 : 1;
    const deScore = data.debtToEquity == null ? 2.5 : data.debtToEquity < 0.3 ? 5 : data.debtToEquity < 0.7 ? 4.5 : data.debtToEquity < 1.2 ? 4 : data.debtToEquity < 2 ? 3 : data.debtToEquity < 3 ? 2 : 1;
    const cbs = (roicScore*0.4 + gmScore*0.25 + omScore*0.25 + deScore*0.1);
    const pfcfScore = data.pfcf == null || data.pfcf <= 0 ? 1 : data.pfcf < 12 ? 5 : data.pfcf < 18 ? 4.5 : data.pfcf < 25 ? 4 : data.pfcf < 35 ? 3 : data.pfcf < 50 ? 2 : 1;
    const fcfYieldScore = data.fcfYield == null ? 1 : data.fcfYield > 8 ? 5 : data.fcfYield > 5 ? 4.5 : data.fcfYield > 3 ? 4 : data.fcfYield > 1.5 ? 3 : data.fcfYield > 0 ? 2 : 1;
    const oppo = (pfcfScore*0.55 + fcfYieldScore*0.45);
    const revGrowthScore = data.revGrowth == null ? 2.5 : data.revGrowth > 25 ? 5 : data.revGrowth > 15 ? 4.5 : data.revGrowth > 8 ? 4 : data.revGrowth > 3 ? 3 : data.revGrowth > 0 ? 2 : 1;
    const fcfTrend = data.fcfHistory?.length >= 3 ? data.fcfHistory[data.fcfHistory.length-1]?.val > data.fcfHistory[0]?.val ? 1 : 0 : null;
    const marginTrend = data.marginHistory?.length >= 3 ? (data.marginHistory[data.marginHistory.length-1]?.margin||0) > (data.marginHistory[0]?.margin||0) ? 1 : 0 : null;
    const trendBonus = (fcfTrend===1?0.5:0)+(marginTrend===1?0.5:0);
    const gqs = Math.min(5, revGrowthScore*0.6 + (2.5+trendBonus*2)*0.4);
    const finalNote = (cbs*0.45 + oppo*0.30 + gqs*0.25);
    const score100 = Math.round((finalNote / 5) * 100);

    let verdict, verdictColor;
    if (score100 >= 70) { verdict = 'Solid & steady'; verdictColor = 'var(--green)'; }
    else if (score100 >= 40) { verdict = 'Mixed signals'; verdictColor = 'var(--amber)'; }
    else { verdict = 'Needs caution'; verdictColor = 'var(--red)'; }

    let summary;
    if (data.revGrowth != null && data.fcfVal != null && data.debtToEquity != null) {
      const growthPart = data.revGrowth > 5 ? `grows revenue at a healthy pace` : data.revGrowth > 0 ? `grows revenue slowly` : `has shrinking revenue`;
      const cashPart = data.fcfVal > 0 ? `generates strong cash flow` : `is burning cash`;
      const debtPart = data.debtToEquity < 1.2 ? `carries manageable debt` : `carries significant debt`;
      summary = `${data.name?.split(' ')[0] || 'This company'} ${growthPart}, ${cashPart}, and ${debtPart}.`;
    } else {
      summary = `Not enough data yet to give a full picture for ${data.name || 'this company'}.`;
    }

    return { score100, verdict, verdictColor, summary };
  })();

  // Fair value positioning (0-100% along Cheap -> Fair -> Expensive bar)
  // Graham intrinsic value (base scenario) - same formula as DCF tab
  // V = EPS x (8.5 + 2g) x (4.4/5.5), g = 5Y EPS CAGR (capped 0-20%)
  const grahamValue = (() => {
    if (!data.eps) return null;
    const cagr = data.epsCagr;
    const g = cagr !== null && !isNaN(cagr) ? Math.max(0, Math.min(Number(cagr), 20)) : 7;
    return +(data.eps * (8.5 + 2 * g) * (4.4 / 5.5)).toFixed(2);
  })();

  const fairValue = (() => {
    if (!grahamValue || !price) return null;
    
    // If Graham value is negative (negative EPS), stock is fundamentally overvalued
    // by this metric since price/negativeValue gives a meaningless negative ratio
    if (grahamValue <= 0) {
      return { 
        pct: 98, 
        tag: 'EXPENSIVE', 
        tagColor: 'var(--red)', 
        estimate: grahamValue,
        negative: true 
      };
    }
    
    const ratio = price / grahamValue; // >1 = expensive, <1 = cheap
    // Map ratio 0.5x -> 1.5x onto 0% -> 100%
    const pct = Math.max(2, Math.min(98, ((ratio - 0.5) / 1.0) * 100));
    let tag;
    if (ratio < 0.85) tag = 'UNDERVALUED';
    else if (ratio < 1.05) tag = 'FAIR VALUE';
    else if (ratio < 1.3) tag = 'SLIGHTLY EXPENSIVE';
    else tag = 'EXPENSIVE';
    const tagColor = ratio < 0.85 ? 'var(--green)' : ratio < 1.05 ? 'var(--green)' : ratio < 1.3 ? 'var(--amber)' : 'var(--red)';
    return { pct, tag, tagColor, estimate: grahamValue, negative: false };
  })();

  // Community vote state (local-only placeholder until backend exists)


  return (
    <div style={S.page}>
      <Topbar />
      {/* Stock subbar */}
      <div style={{ borderBottom: '1px solid var(--border)', padding: '6px 16px', display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-1)', fontSize: '11px' }}>
        <span style={{ color: 'var(--text-3)' }}>▸</span>
        <span style={{ color: 'var(--accent)', fontWeight: 700, letterSpacing: '2px' }}>{ticker}</span>
      </div>
      {/* Mobile nav tabs */}
      <div className="mobile-tabs" style={{ display: 'none', borderBottom: '1px solid var(--border)', background: 'var(--bg-1)', overflowX: 'auto', whiteSpace: 'nowrap' }}>
        {NAV.map(n => (
          <button key={n.key}
            onClick={() => setTab(n.key)}
            style={{ display: 'inline-block', padding: '10px 16px', fontSize: '11px', letterSpacing: '1px', background: 'none', border: 'none', color: tab === n.key ? 'var(--accent)' : 'var(--text-3)', borderBottom: tab === n.key ? '2px solid var(--accent)' : '2px solid transparent', fontFamily: 'JetBrains Mono, monospace', cursor: 'pointer' }}>
            {n.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex' }}>
        {/* Sidebar */}
        <div style={S.sidebar} className="stock-sidebar">
          <div style={{ padding: '0 16px', marginBottom: '12px', color: 'var(--text-3)', fontSize: '9px', letterSpacing: '2px' }}>ANALYSIS</div>
          {NAV.map(n => (
            <button key={n.key}
              style={{ ...S.navItem(tab === n.key) }}
              onClick={() => setTab(n.key)}>
              {n.label}{n.pro && !isPro && !checkingPro ? ' 🔒' : ''}
            </button>
          ))}
          {score !== null && (
            <div style={{ margin: '24px 16px 0', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <div style={{ color: 'var(--text-3)', fontSize: '9px', letterSpacing: '2px', marginBottom: '8px' }}>DD SCORE</div>
              <ScoreBox score={score} size={56} />
            </div>
          )}
        </div>

        {/* Main content */}
        <div style={S.content} className="stock-content">

          {/* Company header - compact */}
          <div className="stock-header-compact" style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
            <div className="stock-logo" style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
              <img
                src={`https://img.logo.dev/ticker/${ticker}?token=pk_B4aaLZF6S4G1YbCgqZq2Ug`}
                alt={data.name}
                style={{ width: '36px', height: '36px', objectFit: 'contain' }}
                onError={e => { e.target.style.display = 'none'; e.target.parentElement.innerHTML = `<span style="color:var(--accent);font-weight:600;font-size:14px">${ticker.slice(0,2)}</span>`; e.target.parentElement.style.background = 'var(--bg-2)'; }}
              />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '17px', fontWeight: 600, letterSpacing: '-0.3px', marginBottom: '2px' }}>{data.name}</div>
              <div style={{ color: 'var(--text-3)', fontSize: '11px' }}>
                {ticker} · {data.exchange || 'NASDAQ'} · {data.sector}
              </div>
            </div>
            {price && (
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '20px', fontWeight: 700, letterSpacing: '-0.5px' }}>${price.toFixed(2)}</div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', fontWeight: 600, color: change >= 0 ? 'var(--green)' : 'var(--red)', marginTop: '2px' }}>
                  {change >= 0 ? '+' : ''}{changePct?.toFixed(2)}%
                </div>
              </div>
            )}
          </div>

          {data.finnhubFallback && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: '10px', padding: '8px 12px', marginBottom: '16px' }}>
              <span style={{ color: 'var(--accent)', fontSize: '9px' }}>ℹ</span>
              <span style={{ color: 'var(--text-3)', fontSize: '9px', letterSpacing: '0.5px' }}>Limited data — company reports outside SEC EDGAR. Showing Finnhub data only.</span>
            </div>
          )}


          {data.description && (() => {
            const short = data.description.slice(0, 200);
            const full = data.description;
            return (
              <div style={{ color: 'var(--text-3)', fontSize: '11px', lineHeight: 1.7, marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
                {expanded ? full : `${short}...`}
                {data.description.length > 200 && (
                  <span onClick={() => setExpanded(!expanded)}
                    style={{ color: 'var(--accent)', cursor: 'pointer', marginLeft: '6px', letterSpacing: '0.5px' }}>
                    {expanded ? 'COLLAPSE ↑' : 'READ MORE ↓'}
                  </span>
                )}
              </div>
            );
          })()}

          {/* OVERVIEW TAB */}
          {tab === 'overview' && (
            <div>
              {/* Community vote */}
              <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: '20px', padding: '20px', marginBottom: '16px' }}>
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '15px', marginBottom: '4px' }}>What's your call?</div>
                <div style={{ color: 'var(--text-3)', fontSize: '12px', marginBottom: '16px' }}>
                  {isSignedIn ? "Tap one — we'll remember your call" : 'Sign in to save your call'}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                  {['BUY', 'HOLD', 'SELL'].map(v => {
                    const active = userVote === v;
                    const activeColor = v === 'BUY' ? 'var(--green)' : v === 'SELL' ? 'var(--red)' : 'var(--amber)';
                    const activeDim = v === 'BUY' ? 'var(--green-dim)' : v === 'SELL' ? 'var(--red-dim)' : 'var(--amber-dim)';
                    return (
                      <button key={v} onClick={async () => {
                        if (!isSignedIn) { window.location.href = '/sign-in'; return; }
                        setUserVote(v);
                        // Save to API
                        fetch('/api/votes', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ ticker, vote: v }),
                        }).then(r => r.json()).then(() => {
                          // Refetch consensus to update percentages
                          fetch(`/api/votes?ticker=${ticker}`)
                            .then(r => r.json())
                            .then(d => setVoteConsensus({ ...d.percentages, total: d.total }))
                            .catch(() => {});
                        }).catch(() => {});
                      }}
                        onMouseEnter={e => e.target.style.transform = 'scale(1.05)'}
                        onMouseLeave={e => e.target.style.transform = 'scale(1)'}
                        style={{
                          borderRadius: '14px', padding: '14px 8px', textAlign: 'center',
                          border: `1.5px solid ${active ? activeColor : 'var(--border)'}`,
                          background: active ? activeDim : 'var(--bg-2)',
                          color: active ? activeColor : 'var(--text-2)',
                          fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '13px', letterSpacing: '0.5px',
                          cursor: 'pointer',
                          transition: 'transform 0.2s ease'
                        }}>
                        {v}
                      </button>
                    );
                  })}
                </div>
                <div>
                  <div style={{ display: 'flex', height: '10px', borderRadius: '6px', overflow: 'hidden', marginBottom: '8px' }}>
                    <div style={{ background: `linear-gradient(90deg, var(--green) 0%, rgba(52, 211, 153, 0.7) 100%)`, width: `${voteConsensus.BUY}%` }} />
                    <div style={{ background: `linear-gradient(90deg, var(--amber) 0%, rgba(251, 191, 36, 0.7) 100%)`, width: `${voteConsensus.HOLD}%` }} />
                    <div style={{ background: `linear-gradient(90deg, var(--red) 0%, rgba(248, 113, 113, 0.7) 100%)`, width: `${voteConsensus.SELL}%` }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '11px', color: 'var(--text-3)', fontFamily: 'JetBrains Mono, monospace' }}>
                    <span style={{ color: 'var(--green)' }}>● {voteConsensus.BUY}% Buy</span>
                    <span style={{ color: 'var(--amber)' }}>● {voteConsensus.HOLD}% Hold</span>
                    <span style={{ color: 'var(--red)' }}>● {voteConsensus.SELL}% Sell</span>
                  </div>
                  {voteConsensus.total > 0 && (
                    <div style={{ marginTop: '6px', fontSize: '10px', color: 'var(--text-3)', textAlign: 'center' }}>
                      {voteConsensus.total} {voteConsensus.total === 1 ? 'person' : 'people'} voted
                    </div>
                  )}
                </div>
              </div>

              {/* Easy Mode health ring */}
              <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: '20px', padding: '24px 20px', display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '16px' }}>
                <div style={{ position: 'relative', width: '92px', height: '92px', flexShrink: 0 }}>
                  <svg width="92" height="92" viewBox="0 0 92 92" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="46" cy="46" r="40" fill="none" stroke="var(--bg-3)" strokeWidth="8" />
                    <circle cx="46" cy="46" r="40" fill="none" stroke={easyMode.verdictColor} strokeWidth="8" strokeLinecap="round"
                      strokeDasharray="251.2" strokeDashoffset={251.2 - (251.2 * easyMode.score100 / 100)} />
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '26px', lineHeight: 1 }}>{easyMode.score100}</div>
                    <div style={{ fontSize: '9px', color: 'var(--text-3)', letterSpacing: '1px', marginTop: '2px' }}>/ 100</div>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', letterSpacing: '2px', color: 'var(--text-3)', marginBottom: '6px', fontFamily: 'JetBrains Mono, monospace' }}>EASY MODE</div>
                  <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '17px', color: easyMode.verdictColor, marginBottom: '6px' }}>{easyMode.verdict}</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.4 }}>{easyMode.summary}</div>
                </div>
              </div>

              {/* Fair value bar */}
              {fairValue && (
                <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: '20px', padding: '20px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '14px' }}>
                    <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '15px' }}>Fair value</div>
                    <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '1px', color: fairValue.tagColor, padding: '4px 10px', borderRadius: '8px', backgroundColor: fairValue.tag === 'EXPENSIVE' ? 'var(--red-dim)' : fairValue.tag === 'SLIGHTLY EXPENSIVE' ? 'var(--amber-dim)' : 'var(--green-dim)' }}>{fairValue.tag}</div>
                  </div>
                  <div style={{ position: 'relative', height: '10px', borderRadius: '6px', background: 'linear-gradient(90deg, var(--green) 0%, var(--amber) 50%, var(--red) 100%)', opacity: 0.35 }}>
                    <div style={{ position: 'absolute', top: '-5px', width: '4px', height: '20px', borderRadius: '2px', background: 'var(--text)', left: `${fairValue.pct}%` }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: 'var(--text-3)' }}>
                    <span>Cheap</span><span>Fair</span><span>Expensive</span>
                  </div>
                  <div style={{ textAlign: 'center', marginTop: '14px', fontSize: '13px', color: 'var(--text-2)' }}>
                    {fairValue.negative ? (
                      <>This company has negative earnings, so our model can't estimate a positive fair value. Trading at <b style={{ color: 'var(--text)', fontFamily: 'JetBrains Mono, monospace' }}>${price?.toFixed(2)}</b>.</>
                    ) : (
                      <>Trading at <b style={{ color: 'var(--text)', fontFamily: 'JetBrains Mono, monospace' }}>${price?.toFixed(2)}</b> — our estimate is <b style={{ color: 'var(--text)', fontFamily: 'JetBrains Mono, monospace' }}>${fairValue.estimate.toFixed(2)}</b></>
                    )}
                  </div>
                </div>
              )}

              {/* Stock of the Week - only if this is this week's pick */}
              {sotw === ticker && (
                <div style={{ background: 'linear-gradient(135deg, var(--accent-dim), transparent)', border: '1px solid var(--accent)', borderRadius: '18px', padding: '16px 18px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>🔥</div>
                  <div>
                    <div style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--accent)', fontWeight: 600, fontSize: '12px', letterSpacing: '0.5px' }}>STOCK OF THE WEEK</div>
                    <div style={{ color: 'var(--text-2)', fontSize: '12px', marginTop: '2px' }}>{ticker} is this week's community pick.</div>
                  </div>
                </div>
              )}

              {/* Share Card - Generate beautiful stock image */}
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
              />

              {/* The Numbers, Simplified - meter bars */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-3)', fontSize: '11px', letterSpacing: '2px', marginBottom: '10px', paddingLeft: '4px' }}>THE NUMBERS, SIMPLIFIED</div>
                <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: '20px', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {[
                    { label: 'Revenue is growing', value: data.revGrowth != null ? `${data.revGrowth > 0 ? '+' : ''}${data.revGrowth}% / yr` : 'N/A', pct: data.revGrowth != null ? Math.max(4, Math.min(100, 50 + data.revGrowth * 2)) : 0, color: data.revGrowth > 5 ? 'green' : data.revGrowth > 0 ? 'amber' : 'red' },
                    { label: 'Keeps a healthy slice of profit', value: data.opMargin != null ? `${data.opMargin}% margin` : 'N/A', pct: data.opMargin != null ? Math.max(4, Math.min(100, data.opMargin * 2.5)) : 0, color: data.opMargin > 15 ? 'green' : data.opMargin > 5 ? 'amber' : 'red' },
                    { label: 'Generates real cash, not just paper profit', value: data.fcfVal > 0 ? 'Strong' : data.fcfVal < 0 ? 'Negative' : 'N/A', pct: data.fcfVal > 0 ? 85 : data.fcfVal < 0 ? 15 : 0, color: data.fcfVal > 0 ? 'green' : 'red' },
                    { label: data.debtToEquity > 1.5 ? 'Carries notable debt — worth watching' : 'Debt levels look manageable', value: data.debtToEquity != null ? `${data.debtToEquity.toFixed(2)}x equity` : 'N/A', pct: data.debtToEquity != null ? Math.max(4, Math.min(100, 100 - data.debtToEquity * 30)) : 0, color: data.debtToEquity < 1 ? 'green' : data.debtToEquity < 2 ? 'amber' : 'red' },
                  ].map((m, i) => (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
                        <span style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.3 }}>{m.label}</span>
                        <span style={{ fontSize: '12px', fontWeight: 700, flexShrink: 0, color: `var(--${m.color})`, fontFamily: 'JetBrains Mono, monospace' }}>{m.value}</span>
                      </div>
                      <div style={{ height: '6px', borderRadius: '4px', background: 'var(--bg-3)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: '4px', width: `${m.pct}%`, background: `var(--${m.color})` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Price chart + actions - relocated from header */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-3)', fontSize: '11px', letterSpacing: '2px', marginBottom: '10px', paddingLeft: '4px' }}>PRICE CHART</div>
                <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: '20px', padding: '16px 16px 12px' }}>
                  <div style={{ marginBottom: '6px' }}>
                    <SparklineHeader ticker={ticker} />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <a href={data.cik ? `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${data.cik}&type=10-K` : `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=${encodeURIComponent(data.name)}&type=10-K&dateb=&owner=include&count=10&search_text=&action=getcompany`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ flex: 1, textAlign: 'center', background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text-2)', fontSize: '11px', letterSpacing: '0.5px', textDecoration: 'none', padding: '10px 8px' }}>
                  SEC FILINGS ↗
                </a>
                <button onClick={toggleWatchlist}
                    style={{ flex: 1, background: inWatchlist ? 'var(--accent-dim)' : 'var(--bg-1)', border: `1px solid ${inWatchlist ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '12px', color: inWatchlist ? 'var(--accent)' : 'var(--text-2)', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', padding: '10px 8px', cursor: 'pointer', letterSpacing: '0.5px' }}>
                    {inWatchlist ? '★ WATCHLIST' : '☆ WATCHLIST'}
                </button>
                <button onClick={() => { window.location.href = `/stock/${ticker}?refresh=true`; }}
                  style={{ flex: 1, background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text-2)', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', padding: '10px 8px', cursor: 'pointer', letterSpacing: '0.5px' }}
                  title="Refresh data">
                  ↻ REFRESH
                </button>
              </div>

              {/* Continue research */}
              <div style={{ color: 'var(--text-3)', fontSize: '10px', letterSpacing: '2px', borderBottom: '1px solid var(--border)', paddingBottom: '6px', marginBottom: '12px' }}>CONTINUE RESEARCH</div>
              <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: 'var(--border)', marginBottom: '24px' }}>
                {[
                  { key: 'quality', title: 'QUALITY SCORECARD', desc: 'Is this a high-quality business?' },
                  { key: 'financials', title: 'FINANCIALS', desc: 'Income, cash flow, balance sheet' },
                  { key: 'dcf', title: 'DCF VALUATION', desc: "What's it really worth?" },
                ].map(s => (
                  <button key={s.key} onClick={() => setTab(s.key)}
                    style={{ background: 'var(--bg-1)', border: 'none', padding: '14px 16px', textAlign: 'left', cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-1)'}>
                    <div style={{ color: 'var(--accent)', fontSize: '11px', letterSpacing: '1px', marginBottom: '4px' }}>{s.title}</div>
                    <div style={{ color: 'var(--text-3)', fontSize: '11px' }}>{s.desc}</div>
                  </button>
                ))}
              </div>

              <div style={{ color: 'var(--text-3)', fontSize: '10px', letterSpacing: '1px' }}>
                SOURCE: SEC EDGAR (XBRL) · ALPHA VANTAGE · FINNHUB · NOT INVESTMENT ADVICE
              </div>
            </div>
          )}

          {/* QUALITY TAB */}
          {tab === 'quality' && (
  <div>
    {(() => {
      // CORE BUSINESS SCORE (CBS) — calidad del negocio ajustada por sector
      const sector = (data.sector || '').toLowerCase();
      const isFinancial = sector.includes('bank') || sector.includes('insurance') || sector.includes('financial');
      const isTech = sector.includes('tech') || sector.includes('software') || sector.includes('semi');
      const isPharma = sector.includes('pharma') || sector.includes('biotech') || sector.includes('health');
      const isConsumer = sector.includes('retail') || sector.includes('consumer') || sector.includes('food') || sector.includes('beverage');
      const isEnergy = sector.includes('energy') || sector.includes('oil') || sector.includes('gas');

      // ROIC score
      const roicThreshold = isTech ? 0.25 : isPharma ? 0.20 : isConsumer ? 0.20 : isEnergy ? 0.12 : 0.15;
      const roicScore = data.roic == null ? 2.5
        : data.roic / 100 >= roicThreshold * 2 ? 5
        : data.roic / 100 >= roicThreshold * 1.5 ? 4.5
        : data.roic / 100 >= roicThreshold ? 4
        : data.roic / 100 >= roicThreshold * 0.7 ? 3
        : data.roic / 100 >= roicThreshold * 0.4 ? 2
        : 1;

      // Gross margin score
      const gmThreshold = isTech ? 0.65 : isPharma ? 0.65 : isConsumer ? 0.45 : isFinancial ? 0.30 : isEnergy ? 0.25 : 0.35;
      const gmScore = data.grossMargin == null ? 2.5
        : data.grossMargin / 100 >= gmThreshold * 1.4 ? 5
        : data.grossMargin / 100 >= gmThreshold * 1.15 ? 4.5
        : data.grossMargin / 100 >= gmThreshold ? 4
        : data.grossMargin / 100 >= gmThreshold * 0.75 ? 3
        : data.grossMargin / 100 >= gmThreshold * 0.5 ? 2
        : 1;

      // Op margin score
      const omThreshold = isTech ? 0.20 : isPharma ? 0.20 : isConsumer ? 0.15 : isFinancial ? 0.15 : isEnergy ? 0.12 : 0.15;
      const omScore = data.opMargin == null ? 2.5
        : data.opMargin / 100 >= omThreshold * 2 ? 5
        : data.opMargin / 100 >= omThreshold * 1.5 ? 4.5
        : data.opMargin / 100 >= omThreshold ? 4
        : data.opMargin / 100 >= omThreshold * 0.65 ? 3
        : data.opMargin / 100 > 0 ? 2
        : 1;

      // D/E score
      const deScore = data.debtToEquity == null ? 2.5
        : data.debtToEquity < 0.3 ? 5
        : data.debtToEquity < 0.7 ? 4.5
        : data.debtToEquity < 1.2 ? 4
        : data.debtToEquity < 2 ? 3
        : data.debtToEquity < 3 ? 2
        : 1;

      const cbs = +((roicScore * 0.4 + gmScore * 0.25 + omScore * 0.25 + deScore * 0.1)).toFixed(2);

      // OPPO SCORE — oportunidad de entrada
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

      // GROWTH QUALITY SCORE (GQS) — aproximado
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

      // FINAL NOTE
      const finalNote = +((cbs * 0.45 + oppo * 0.30 + gqs * 0.25)).toFixed(2);

      const scoreColor = (s) => s >= 4 ? 'var(--green)' : s >= 3 ? 'var(--accent)' : 'var(--red)';
      const ScoreBar = ({ score }) => (
        <div style={{ height: '3px', background: 'var(--border-2)', marginTop: '8px', borderRadius: '2px' }}>
          <div style={{ width: `${(score / 5) * 100}%`, height: '100%', background: scoreColor(score), borderRadius: '2px' }} />
        </div>
      );

      return (
        <>
          {/* Score header */}
          <div style={{ position: 'relative', marginBottom: '24px' }}>
  {!isSignedIn && (
    <a href="/sign-in" style={{ position: 'absolute', inset: 0, zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', opacity: 0, transition: 'opacity 0.2s' }}
      onMouseEnter={e => e.currentTarget.style.opacity = '1'}
      onMouseLeave={e => e.currentTarget.style.opacity = '0'}>
      <div style={{ background: 'var(--bg-2)', border: '1px solid var(--accent)', padding: '10px 20px', color: 'var(--accent)', fontSize: '11px', fontWeight: 700, letterSpacing: '2px' }}>
        🔒 SIGN IN TO SEE SCORES
      </div>
    </a>
  )}
  <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', padding: '24px', filter: !isSignedIn ? 'blur(12px)' : 'none', pointerEvents: !isSignedIn ? 'none' : 'auto', userSelect: !isSignedIn ? 'none' : 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1px', background: 'var(--border)' }}>
              {[
                { label: 'CORE BUSINESS', score: cbs, desc: 'ROIC · Margins · Leverage' },
                { label: 'OPPO SCORE', score: oppo, desc: 'P/FCF · FCF Yield' },
                { label: 'GROWTH QUALITY', score: gqs, desc: 'Revenue · FCF trend' },
                { label: 'FINAL NOTE', score: finalNote, desc: 'Weighted composite', highlight: true },
              ].map(s => (
                <div key={s.label} style={{ background: s.highlight ? 'var(--bg-2)' : 'var(--bg-1)', padding: '20px', textAlign: 'center' }}>
                  <div style={{ color: 'var(--text-3)', fontSize: '9px', letterSpacing: '2px', marginBottom: '12px' }}>{s.label}</div>
                  <div style={{ fontSize: s.highlight ? '48px' : '40px', fontWeight: 700, color: scoreColor(s.score), letterSpacing: '-2px', lineHeight: 1 }}>
                    {s.score.toFixed(1)}
                  </div>
                  <div style={{ color: 'var(--text-3)', fontSize: '9px', marginTop: '6px' }}>{s.desc}</div>
                  <ScoreBar score={s.score} />
                </div>
              ))}
            </div>
            <div style={{ color: 'var(--text-3)', fontSize: '10px', letterSpacing: '1px', marginTop: '12px', textAlign: 'center' }}>
              AUTOMATED SCORE · BASED ON SEC EDGAR & FINNHUB · NOT A BUY/SELL SIGNAL · CBS 45% · OPPO 30% · GQS 25%
            </div>
          </div>
        </div>

          {/* CBS breakdown */}
          <div style={{ color: 'var(--accent)', fontSize: '10px', letterSpacing: '2px', borderBottom: '1px solid var(--border)', paddingBottom: '6px', marginBottom: '12px' }}>CORE BUSINESS BREAKDOWN</div>
          <div className="grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: 'var(--border)', marginBottom: '24px' }}>
            {[
              { label: 'ROIC', val: fmtP(data.roic), score: roicScore, desc: `Threshold: ${(roicThreshold * 100).toFixed(0)}% for ${data.sector || 'this sector'}` },
              { label: isFinancial ? 'NET MARGIN' : 'GROSS MARGIN', val: isFinancial ? fmtP(data.netMargin) : fmtP(data.grossMargin), score: gmScore, desc: `Threshold: ${(gmThreshold * 100).toFixed(0)}% for ${data.sector || 'this sector'}` },
              { label: 'OP. MARGIN', val: fmtP(data.opMargin), score: omScore, desc: `Threshold: ${(omThreshold * 100).toFixed(0)}% for ${data.sector || 'this sector'}` },
              { label: 'DEBT/EQUITY', val: fmtN(data.debtToEquity), score: deScore, desc: 'Lower is better' },
            ].map(m => (
              <div key={m.label} style={{ background: 'var(--bg-1)', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--text-3)', fontSize: '10px', letterSpacing: '1px' }}>{m.label}</span>
                  <span style={{ color: scoreColor(m.score), fontSize: '10px' }}>{m.score.toFixed(1)}/5</span>
                </div>
                <div style={{ fontSize: '28px', fontWeight: 600, color: scoreColor(m.score), marginBottom: '4px' }}>{m.val}</div>
                <div style={{ color: 'var(--text-3)', fontSize: '10px' }}>{m.desc}</div>
              </div>
            ))}
          </div>

          {/* OPPO breakdown */}
          <div style={{ color: 'var(--accent)', fontSize: '10px', letterSpacing: '2px', borderBottom: '1px solid var(--border)', paddingBottom: '6px', marginBottom: '12px' }}>OPPORTUNITY BREAKDOWN</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1px', background: 'var(--border)', marginBottom: '24px' }}>
            {[
              { label: 'P/FCF', val: fmtN(data.pfcf), score: pfcfScore, desc: data.pfcf < 20 ? 'Attractive entry' : data.pfcf < 35 ? 'Fair valuation' : 'Expensive' },
              { label: 'FCF YIELD', val: data.fcfYield ? `${data.fcfYield}%` : 'N/A', score: fcfYieldScore, desc: data.fcfYield > 5 ? 'Strong yield' : data.fcfYield > 2 ? 'Moderate yield' : 'Low yield' },
            ].map(m => (
              <div key={m.label} style={{ background: 'var(--bg-1)', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--text-3)', fontSize: '10px', letterSpacing: '1px' }}>{m.label}</span>
                  <span style={{ color: scoreColor(m.score), fontSize: '10px' }}>{m.score.toFixed(1)}/5</span>
                </div>
                <div style={{ fontSize: '28px', fontWeight: 600, color: scoreColor(m.score), marginBottom: '4px' }}>{m.val}</div>
                <div style={{ color: 'var(--text-3)', fontSize: '10px' }}>{m.desc}</div>
              </div>
            ))}
            {/* 52W Range */}
            <div style={{ background: 'var(--bg-1)', padding: '16px' }}>
              <div style={{ color: 'var(--text-3)', fontSize: '10px', letterSpacing: '1px', marginBottom: '8px' }}>52W RANGE</div>
              {data.high52 && data.low52 && data.currentPrice ? (() => {
                const pct = Math.round(((data.currentPrice - data.low52) / (data.high52 - data.low52)) * 100);
                const color = pct < 30 ? 'var(--green)' : pct > 75 ? 'var(--red)' : 'var(--accent)';
                return (
                  <>
                    <div style={{ fontSize: '28px', fontWeight: 600, color, marginBottom: '4px' }}>{pct}%</div>
                    <div style={{ color: 'var(--text-3)', fontSize: '10px', marginBottom: '10px' }}>
                      {pct < 30 ? 'Near 52W low' : pct > 75 ? 'Near 52W high' : 'Mid range'}
                    </div>
                    <div style={{ position: 'relative', height: '3px', background: 'var(--border-2)', borderRadius: '2px', marginBottom: '6px' }}>
                      <div style={{ position: 'absolute', left: `${pct}%`, top: '-3px', width: '2px', height: '9px', background: color, borderRadius: '1px' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-3)' }}>
                      <span>${data.low52}</span>
                      <span>${data.high52}</span>
                    </div>
                  </>
                );
              })() : <div style={{ color: 'var(--text-3)', fontSize: '10px' }}>N/A</div>}
            </div>
          </div>

          {/* GQS breakdown */}
          <div style={{ color: 'var(--accent)', fontSize: '10px', letterSpacing: '2px', borderBottom: '1px solid var(--border)', paddingBottom: '6px', marginBottom: '12px' }}>GROWTH QUALITY BREAKDOWN</div>
          <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: 'var(--border)', marginBottom: '24px' }}>
            {[
              { label: 'REVENUE GROWTH', val: data.revGrowth !== null ? `${data.revGrowth > 0 ? '+' : ''}${data.revGrowth}%` : 'N/A', score: revGrowthScore, chart: revChart },
              { label: 'FCF TREND', val: fcfTrend === 1 ? 'IMPROVING' : fcfTrend === 0 ? 'DECLINING' : 'N/A', score: fcfTrend === 1 ? 4 : fcfTrend === 0 ? 2 : 2.5, chart: fcfChart, color: '#8b5cf6' },
              { label: 'MARGIN TREND', val: marginTrend === 1 ? 'EXPANDING' : marginTrend === 0 ? 'COMPRESSING' : 'N/A', score: marginTrend === 1 ? 4 : marginTrend === 0 ? 2 : 2.5, chart: marginChart, isLine: true },
            ].map(m => (
              <div key={m.label} style={{ background: 'var(--bg-1)', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--text-3)', fontSize: '10px', letterSpacing: '1px' }}>{m.label}</span>
                  <span style={{ color: scoreColor(m.score), fontSize: '10px' }}>{m.score.toFixed(1)}/5</span>
                </div>
                <div style={{ fontSize: '22px', fontWeight: 600, color: scoreColor(m.score), marginBottom: '8px' }}>{m.val}</div>
                <MiniLine data={m.chart} color={m.color || scoreColor(m.score)} />
              </div>
            ))}
          </div>

          <div style={{ color: 'var(--text-3)', fontSize: '10px', letterSpacing: '1px' }}>
            SECTOR-ADJUSTED THRESHOLDS · CBS = ROIC×40% + GROSS MARGIN×25% + OP MARGIN×25% + D/E×10% · OPPO = P/FCF×55% + FCF YIELD×45% · GQS = REV GROWTH×60% + TREND×40%
          </div>
        </>
      );
    })()}
  </div>
)}

          {/* FINANCIALS TAB */}
          {tab === 'financials' && !isPro && !checkingPro && (
            <div style={{ textAlign: 'center', padding: '60px 24px', background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: '20px' }}>
              <div style={{ color: 'var(--accent)', fontSize: '13px', letterSpacing: '2px', marginBottom: '12px' }}>🔒 SIGN IN REQUIRED</div>
              <div style={{ color: 'var(--text-2)', fontSize: '13px', marginBottom: '24px' }}>Create a free account to access Financial Statements.</div>
              <a href="/sign-in" style={{ display: 'inline-block', background: 'var(--accent)', color: '#0B0E14', padding: '12px 28px', borderRadius: '12px', fontFamily: 'Space Grotesk, sans-serif', fontSize: '13px', fontWeight: 700, letterSpacing: '0.3px', textDecoration: 'none' }}>Create free account →</a>
            </div>
          )}
          {tab === 'financials' && isPro && (
  <div>
    {/* Fin tabs */}
    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
      {[['income', 'INCOME'], ['balance', 'BALANCE'], ['cashflow', 'CASH FLOW']].map(([key, label]) => (
        <button key={key} onClick={() => setFinTab(key)}
          style={{ flex: 1, padding: '10px 8px', fontSize: '10px', letterSpacing: '0.5px', borderRadius: '12px', background: finTab === key ? 'var(--accent)' : 'var(--bg-1)', color: finTab === key ? '#0B0E14' : 'var(--text-2)', border: finTab === key ? 'none' : '1px solid var(--border)', cursor: 'pointer', fontFamily: 'Space Grotesk, sans-serif', fontWeight: finTab === key ? 700 : 500 }}>
          {label}
        </button>
      ))}
    </div>

              {/* Metrics Table */}
<div style={{ marginBottom: '16px' }}>
  <div className="grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>

    {/* VALUATION */}
    <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px' }}>
      <div style={{ color: 'var(--accent)', fontSize: '10px', letterSpacing: '2px', marginBottom: '12px' }}>VALUATION</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
        <tbody>
          {[
            { label: 'Market Cap', val: fmt(data.marketCap) },
            { label: 'P/E', val: fmtN(data.pe), color: data.pe > 0 && data.pe < 20 ? 'var(--green)' : data.pe > 40 ? 'var(--red)' : 'var(--text)' },
            { label: 'P/FCF', val: fmtN(data.pfcf), color: data.pfcf > 0 && data.pfcf < 20 ? 'var(--green)' : data.pfcf > 40 ? 'var(--red)' : 'var(--text)' },
            { label: 'EV/EBITDA', val: fmtN(data.evEbitda) },
            { label: 'P/B', val: fmtN(data.priceToBook) },
            { label: 'FCF Yield', val: data.fcfYield ? `${data.fcfYield}%` : 'N/A', color: data.fcfYield > 5 ? 'var(--green)' : data.fcfYield > 0 ? 'var(--accent)' : 'var(--red)' },
            { label: 'Div. Yield', val: data.dividendYield ? `${(+data.dividendYield).toFixed(2)}%` : '—' },
          ].map(r => (
            <tr key={r.label} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '4px 0', color: 'var(--text-3)', fontSize: '10px' }}>{r.label}</td>
              <td style={{ padding: '4px 0', textAlign: 'right', color: r.color || 'var(--text)', fontSize: '11px', fontWeight: 500 }}>{r.val}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {/* PROFITABILITY */}
    <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px' }}>
      <div style={{ color: 'var(--accent)', fontSize: '10px', letterSpacing: '2px', marginBottom: '12px' }}>PROFITABILITY</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
        <tbody>
          {[
            { label: 'Gross Margin', val: fmtP(data.grossMargin), color: data.grossMargin > 50 ? 'var(--green)' : data.grossMargin > 30 ? 'var(--accent)' : 'var(--red)' },
            { label: 'Op. Margin', val: fmtP(data.opMargin), color: data.opMargin > 20 ? 'var(--green)' : data.opMargin > 10 ? 'var(--accent)' : 'var(--red)' },
            { label: 'Net Margin', val: fmtP(data.netMargin), color: data.netMargin > 15 ? 'var(--green)' : data.netMargin > 5 ? 'var(--accent)' : 'var(--red)' },
            { label: 'ROE', val: fmtP(data.roe), color: data.roe > 20 ? 'var(--green)' : data.roe > 10 ? 'var(--accent)' : 'var(--red)' },
            { label: 'ROA', val: fmtP(data.roa), color: data.roa > 10 ? 'var(--green)' : data.roa > 5 ? 'var(--accent)' : 'var(--red)' },
            { label: 'ROIC', val: fmtP(data.roic), color: data.roic > 15 ? 'var(--green)' : data.roic > 8 ? 'var(--accent)' : 'var(--red)' },
            { label: 'SBC', val: fmt(data.sbcVal) },
            { label: 'Dividends Paid', val: fmt(data.dividendsPaidVal) },
          ].map(r => (
            <tr key={r.label} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '4px 0', color: 'var(--text-3)', fontSize: '10px' }}>{r.label}</td>
              <td style={{ padding: '4px 0', textAlign: 'right', color: r.color || 'var(--text)', fontSize: '11px', fontWeight: 500 }}>{r.val}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {/* BALANCE SHEET */}
    <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px' }}>
      <div style={{ color: 'var(--accent)', fontSize: '10px', letterSpacing: '2px', marginBottom: '12px' }}>BALANCE SHEET</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
        <tbody>
          {[
            { label: 'Total Assets', val: fmt(data.assetsVal) },
            { label: 'Total Liabilities', val: fmt(data.totalLiabilitiesVal) },
            { label: 'Equity', val: fmt(data.equityVal) },
            { label: 'Net Debt', val: fmt(data.netDebt), color: data.netDebt < 0 ? 'var(--green)' : 'var(--text)' },
            { label: 'Cash', val: fmt(data.cashVal), color: 'var(--green)' },
            { label: 'LT Debt', val: fmt(data.debtVal) },
            { label: 'D/E Ratio', val: fmtN(data.debtToEquity), color: data.debtToEquity < 1 ? 'var(--green)' : data.debtToEquity < 2 ? 'var(--accent)' : 'var(--red)' },
            { label: 'Current Ratio', val: data.currentAssetsVal && data.currentLiabilitiesVal ? fmtN(data.currentAssetsVal / data.currentLiabilitiesVal) : 'N/A', color: data.currentAssetsVal / data.currentLiabilitiesVal > 2 ? 'var(--green)' : data.currentAssetsVal / data.currentLiabilitiesVal > 1 ? 'var(--accent)' : 'var(--red)' },
          ].map(r => (
            <tr key={r.label} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '4px 0', color: 'var(--text-3)', fontSize: '10px' }}>{r.label}</td>
              <td style={{ padding: '4px 0', textAlign: 'right', color: r.color || 'var(--text)', fontSize: '11px', fontWeight: 500 }}>{r.val}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {/* EFFICIENCY + PER SHARE */}
    <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px' }}>
      <div style={{ color: 'var(--accent)', fontSize: '10px', letterSpacing: '2px', marginBottom: '12px' }}>EFFICIENCY</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
        <tbody>
          {[
            { label: 'Cash Conv. Cycle', val: data.ccc != null ? `${data.ccc}d` : 'N/A', color: data.ccc != null && data.ccc < 30 ? 'var(--green)' : data.ccc != null && data.ccc < 60 ? 'var(--accent)' : data.ccc != null ? 'var(--red)' : 'var(--text-3)' },
{ label: 'Inventory Turnover', val: data.inventoryTurnover != null ? fmtN(data.inventoryTurnover) : 'N/A', color: data.inventoryTurnover > 8 ? 'var(--green)' : data.inventoryTurnover > 4 ? 'var(--accent)' : 'var(--text)' },
{ label: 'DSO', val: data.dso != null ? `${data.dso}d` : 'N/A' },
{ label: 'DIO', val: data.dio != null ? `${data.dio}d` : 'N/A' },
{ label: 'DPO', val: data.dpo != null ? `${data.dpo}d` : 'N/A' },
          ].map(r => (
            <tr key={r.label} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '4px 0', color: 'var(--text-3)', fontSize: '10px' }}>{r.label}</td>
              <td style={{ padding: '4px 0', textAlign: 'right', color: r.color || 'var(--text)', fontSize: '11px', fontWeight: 500 }}>{r.val}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

  </div>
</div>

{/* PER SHARE */}
<div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px', marginBottom: '16px' }}>
  <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px' }}>
    <div style={{ color: 'var(--accent)', fontSize: '10px', letterSpacing: '2px', marginBottom: '12px' }}>PER SHARE & MARKET DATA</div>
    <div className="per-share-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
      {[
        { label: 'EPS (TTM)', val: data.eps ? `$${data.eps}` : 'N/A' },
        { label: 'Shs Outstanding', val: data.sharesOutstanding ? `${(data.sharesOutstanding / 1e6).toFixed(0)}M` : 'N/A' },
        { label: 'Beta', val: fmtN(data.beta) },
        { label: '52W High', val: data.high52 ? `$${data.high52}` : 'N/A' },
        { label: '52W Low', val: data.low52 ? `$${data.low52}` : 'N/A' },
      ].map(r => (
        <div key={r.label} style={{ background: 'var(--bg-2)', borderRadius: '10px', padding: '12px' }}>
          <div style={{ color: 'var(--text-3)', fontSize: '10px', letterSpacing: '1px', marginBottom: '6px' }}>{r.label}</div>
          <div style={{ color: 'var(--text)', fontSize: '13px', fontWeight: 600 }}>{r.val}</div>
        </div>
      ))}
    </div>
  </div>
</div>

              {/* Chart + multiples */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                <div style={{ flex: 1, background: 'var(--bg-1)' }}>
                  <StockChart ticker={ticker} />
                </div>
              </div>

              {/* Metrics grid */}
              <div style={{ color: 'var(--text-3)', fontSize: '10px', letterSpacing: '2px', borderBottom: '1px solid var(--border)', paddingBottom: '6px', marginBottom: '12px' }}>PROFITABILITY & RETURNS</div>
              <div className="grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '16px' }}>
                {[
                  { label: 'REVENUE (TTM)', val: fmt(data.revVal), sub: data.revGrowth !== null ? `${data.revGrowth > 0 ? '+' : ''}${data.revGrowth}% YOY` : null, good: data.revGrowth > 0 },
                  { label: 'NET INCOME (TTM)', val: fmt(data.niVal), sub: data.netMargin !== null ? `${data.netMargin}% NET MARGIN` : null, good: data.netMargin > 10 },
                  { label: 'OP. MARGIN', val: fmtP(data.opMargin), sub: data.opMargin > 15 ? 'ABOVE THRESHOLD' : 'BELOW THRESHOLD', good: data.opMargin > 15 },
                  { label: 'ROE', val: fmtP(data.roe), sub: data.roe > 15 ? 'STRONG RETURN' : 'MODERATE RETURN', good: data.roe > 15 },
                ].map(m => (
                  <div key={m.label} style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: '14px', padding: '14px' }}>
                    <div style={{ color: 'var(--text-3)', fontSize: '10px', letterSpacing: '1px', marginBottom: '6px' }}>{m.label}</div>
                    <div style={{ fontSize: '20px', fontWeight: 600, marginBottom: '4px' }}>{m.val}</div>
                    {m.sub && <div style={{ color: m.good ? 'var(--green)' : 'var(--red)', fontSize: '10px', letterSpacing: '0.5px' }}>{m.sub}</div>}
                  </div>
                ))}
              </div>

              <div style={{ color: 'var(--text-3)', fontSize: '10px', letterSpacing: '2px', borderBottom: '1px solid var(--border)', paddingBottom: '6px', marginBottom: '12px' }}>CASH FLOW & BALANCE SHEET</div>
              <div className="grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '16px' }}>
                {[
                  { label: 'FREE CASH FLOW', val: fmt(data.fcfVal), sub: data.fcfVal > 0 ? 'POSITIVE FCF' : 'NEGATIVE FCF', good: data.fcfVal > 0 },
                  { label: 'OP. CASH FLOW', val: fmt(data.fcfVal), sub: data.fcfVal && data.revVal ? `${((data.fcfVal / data.revVal) * 100).toFixed(1)}% CONVERSION` : null, good: data.fcfVal > 0 },
                  { label: 'NET DEBT', val: fmt(data.netDebt), sub: data.netDebt < 0 ? 'NET CASH POSITION' : 'NET DEBT POSITION', good: data.netDebt < 0 },
                  { label: 'CASH & EQUIV.', val: fmt(data.cashVal), sub: null },
                ].map(m => (
                  <div key={m.label} style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: '14px', padding: '14px' }}>
                    <div style={{ color: 'var(--text-3)', fontSize: '10px', letterSpacing: '1px', marginBottom: '6px' }}>{m.label}</div>
                    <div style={{ fontSize: '20px', fontWeight: 600, marginBottom: '4px' }}>{m.val}</div>
                    {m.sub && <div style={{ color: m.good ? 'var(--green)' : 'var(--red)', fontSize: '10px', letterSpacing: '0.5px' }}>{m.sub}</div>}
                  </div>
                ))}
              </div>

              {/* Charts */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                {[
                  { title: 'REVENUE', chart: revChart, color: 'var(--amber)', type: 'line' },
{ title: 'FREE CASH FLOW', chart: fcfChart, color: '#8b5cf6', type: 'line' },
                ].map(({ title, chart, color, type }) => (
                  <div key={title} style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px' }}>
                    <div style={{ color: 'var(--text-3)', fontSize: '10px', letterSpacing: '2px', marginBottom: '12px' }}>{title}</div>
                    <MiniLine data={chart} color={color} />
                  </div>
                ))}
              </div>
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
        <div style={{ overflowX: 'auto' }}>
          <div style={{ color: 'var(--text-3)', fontSize: '10px', letterSpacing: '1px', marginBottom: '8px' }}>All values in USD · Source: SEC EDGAR</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', minWidth: '700px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '8px 0', textAlign: 'left', fontWeight: 400, fontSize: '10px', letterSpacing: '1px', color: 'var(--text-3)', width: '180px' }}>METRIC</th>
                {years.map(y => <th key={y} style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 400, fontSize: '10px', color: 'var(--text-3)' }}>{y}</th>)}
                <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, fontSize: '10px', color: 'var(--accent)' }}>TTM</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                if (row.divider) return <tr key={i}><td colSpan={years.length + 2} style={{ padding: '4px 0', borderBottom: '1px solid var(--border)' }} /></tr>;
                return (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--bg-1)' }}>
                    <td style={{ padding: '6px 0', paddingLeft: row.indent ? '16px' : '0', color: row.bold ? 'var(--text)' : 'var(--text-3)', fontWeight: row.bold ? 600 : 400, fontSize: '11px' }}>{row.label}</td>
                    {years.map((y, j) => {
                      const h = row.history?.[j];
                      const color = row.green ? 'var(--green)' : row.neg ? 'var(--red)' : 'var(--text)';
                      return <td key={y} style={{ padding: '6px 12px', textAlign: 'right', color: h?.val != null ? color : 'var(--text-3)' }}>{fmtV(h?.val, row)}</td>;
                    })}
                    <td style={{ padding: '6px 12px', textAlign: 'right', color: row.green ? 'var(--accent)' : row.neg ? 'var(--red)' : 'var(--text)', fontWeight: 600 }}>{fmtV(row.ttm, row)}</td>
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
        { label: 'D/E Ratio', val: data.debtToEquity, raw: true, suffix: 'x', color: data.debtToEquity < 1 ? 'var(--green)' : data.debtToEquity < 2 ? 'var(--accent)' : 'var(--red)' },
        { label: 'Current Ratio', val: data.currentAssetsVal && data.currentLiabilitiesVal ? +(data.currentAssetsVal/data.currentLiabilitiesVal).toFixed(2) : null, raw: true, suffix: 'x', color: data.currentAssetsVal/data.currentLiabilitiesVal > 1.5 ? 'var(--green)' : 'var(--accent)' },
        { label: 'Net Debt', val: data.netDebt, color: data.netDebt < 0 ? 'var(--green)' : 'var(--text)' },
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
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '8px 0', textAlign: 'left', fontWeight: 400, fontSize: '10px', color: 'var(--text-3)' }}>METRIC</th>
              <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, fontSize: '10px', color: 'var(--accent)' }}>TTM</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              if (row.section) return <tr key={i}><td colSpan={2} style={{ padding: '10px 0 4px', color: 'var(--accent)', fontSize: '10px', letterSpacing: '2px', borderBottom: '1px solid var(--border)' }}>{row.label}</td></tr>;
              return (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '6px 0', color: row.bold ? 'var(--text)' : 'var(--text-3)', fontWeight: row.bold ? 600 : 400 }}>{row.label}</td>
                  <td style={{ padding: '6px 12px', textAlign: 'right', color: row.color || (row.green ? 'var(--green)' : row.neg ? 'var(--red)' : 'var(--text)'), fontWeight: row.bold ? 600 : 400 }}>{fmtV(row.val, row)}</td>
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
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', minWidth: '700px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '8px 0', textAlign: 'left', fontWeight: 400, fontSize: '10px', color: 'var(--text-3)', width: '200px' }}>METRIC</th>
                {years.map(y => <th key={y} style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 400, fontSize: '10px', color: 'var(--text-3)' }}>{y}</th>)}
                <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, fontSize: '10px', color: 'var(--accent)' }}>TTM</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                if (row.divider) return <tr key={i}><td colSpan={years.length + 2} style={{ padding: '4px 0', borderBottom: '1px solid var(--border)' }} /></tr>;
                return (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--bg-1)' }}>
                    <td style={{ padding: '6px 0', paddingLeft: row.indent ? '16px' : '0', color: row.bold ? 'var(--text)' : 'var(--text-3)', fontWeight: row.bold ? 600 : 400 }}>{row.label}</td>
                    {years.map((y, j) => {
                      const h = row.history?.[j];
                      const color = row.green ? 'var(--green)' : row.neg ? 'var(--red)' : 'var(--text)';
                      return <td key={y} style={{ padding: '6px 12px', textAlign: 'right', color: h?.val != null ? color : 'var(--text-3)' }}>{fmtV(h?.val)}</td>;
                    })}
                    <td style={{ padding: '6px 12px', textAlign: 'right', color: row.green ? 'var(--accent)' : row.neg ? 'var(--red)' : 'var(--text)', fontWeight: 600 }}>{fmtV(row.ttm)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
    })()}

    <div style={{ color: 'var(--text-3)', fontSize: '10px', letterSpacing: '1px', marginTop: '16px' }}>
      SOURCE: SEC EDGAR (XBRL) · FINNHUB · NOT INVESTMENT ADVICE
    </div>
  </div>
)}

          {/* DCF TAB */}
          {tab === 'dcf' && !isPro && !checkingPro && (
            <div style={{ textAlign: 'center', padding: '80px 24px' }}>
              <div style={{ color: 'var(--accent)', fontSize: '13px', letterSpacing: '2px', marginBottom: '12px' }}>🔒 SIGN IN REQUIRED</div>
              <div style={{ color: 'var(--text-2)', fontSize: '12px', marginBottom: '24px' }}>Create a free account to access DCF Valuation.</div>
              <a href="/sign-in" style={{ background: 'var(--accent)', color: '#000', padding: '10px 24px', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textDecoration: 'none' }}>CREATE FREE ACCOUNT →</a>
            </div>
          )}
          {tab === 'dcf' && isPro && (
            <div>
              <div style={S.section}>GRAHAM INTRINSIC VALUE — V = EPS × (8.5 + 2g)</div>

              {data.eps ? (
                <>
                  <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', padding: '16px', marginBottom: '24px', fontSize: '11px', color: 'var(--text-2)', lineHeight: 1.8 }}>
                    <span style={{ color: 'var(--accent)' }}>V = EPS × (8.5 + 2g) × (4.4/5.5)</span> &nbsp;·&nbsp;
                    EPS: <span style={{ color: 'var(--text)' }}>${data.eps}</span> &nbsp;·&nbsp;
                    5Y EPS CAGR (g): <span style={{ color: 'var(--text)' }}>{data.epsCagr !== null ? `${data.epsCagr}%` : 'N/A'}</span> &nbsp;·&nbsp;
                    <span style={{ color: 'var(--text-3)' }}>Benjamin Graham formula · Not investment advice</span>
                  </div>

                  <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: 'var(--border)', marginBottom: '24px' }}>
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
                        <div key={scenario.label} style={{ background: 'var(--bg-1)', padding: '20px' }}>
                          <div style={{ color: 'var(--text-3)', fontSize: '10px', letterSpacing: '2px', marginBottom: '12px' }}>{scenario.label}</div>
                          <div style={{ color: 'var(--text-3)', fontSize: '10px', marginBottom: '4px' }}>g = {g}%</div>
                          <div style={{ fontSize: '32px', fontWeight: 600, color: underval ? 'var(--green)' : 'var(--red)', marginBottom: '4px', letterSpacing: '-1px' }}>
                            ${intrinsic}
                          </div>
                          <div style={{ color: 'var(--text-3)', fontSize: '10px', marginBottom: '12px' }}>{scenario.desc}</div>
                          {diff !== null && (
                            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
                              <div style={{ color: underval ? 'var(--green)' : 'var(--red)', fontSize: '13px', fontWeight: 600 }}>
                                {underval ? '▲' : '▼'} {Math.abs(diff)}% {underval ? 'UPSIDE' : 'DOWNSIDE'}
                              </div>
                              <div style={{ color: 'var(--text-3)', fontSize: '10px', marginTop: '2px' }}>
                                vs current price ${price?.toFixed(2)}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  

                  <div style={{ color: 'var(--text-3)', fontSize: '10px', letterSpacing: '1px' }}>
                    GRAHAM FORMULA (1962) · EPS FROM SEC EDGAR & FINNHUB · GROWTH FROM SEC EDGAR · NOT INVESTMENT ADVICE
                  </div>
                </>
              ) : (
                <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', padding: '40px', textAlign: 'center' }}>
                  <div style={{ color: 'var(--accent)', fontSize: '24px', fontWeight: 600, letterSpacing: '4px', marginBottom: '8px' }}>N/A</div>
                  <div style={{ color: 'var(--text-2)', fontSize: '12px', marginBottom: '4px' }}>EPS DATA NOT AVAILABLE</div>
                  <div style={{ color: 'var(--text-3)', fontSize: '11px' }}>Graham formula requires EPS data from Alpha Vantage.</div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}