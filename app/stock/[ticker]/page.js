'use client';
import { useState, useEffect, use } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import PriceChart from './chart';

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
  page: { background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', fontFamily: 'IBM Plex Mono, monospace' },
  topbar: { borderBottom: '1px solid var(--border)', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '12px', position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 10, fontSize: '11px' },
  sidebar: { width: '160px', flexShrink: 0, borderRight: '1px solid var(--border)', minHeight: '100vh', padding: '16px 0', position: 'sticky', top: '33px', alignSelf: 'flex-start' },
  navItem: (active) => ({ display: 'block', width: '100%', textAlign: 'left', padding: '8px 16px', fontSize: '11px', letterSpacing: '0.5px', background: 'none', border: 'none', cursor: 'pointer', color: active ? 'var(--accent)' : 'var(--text-3)', borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent', fontFamily: 'IBM Plex Mono, monospace' }),
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
  { key: 'quality', label: 'QUALITY' },
  { key: 'financials', label: 'FINANCIALS' },
  { key: 'dcf', label: 'DCF' },
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

const MiniBar = ({ data, color = 'var(--accent)' }) => (
  <ResponsiveContainer width="100%" height={60}>
    <BarChart data={data} barSize={20}>
      <XAxis dataKey="year" tick={{ fill: '#555', fontSize: 9 }} axisLine={false} tickLine={false} />
      <Tooltip formatter={v => [`$${Math.abs(v)}B`]} contentStyle={{ background: 'var(--bg-2)', border: '1px solid var(--border)', fontSize: 10, fontFamily: 'IBM Plex Mono' }} />
      <Bar dataKey="value" radius={[1, 1, 0, 0]}>
        {data.map((_, i) => <Cell key={i} fill={i === data.length - 1 ? color : `${color}55`} />)}
      </Bar>
    </BarChart>
  </ResponsiveContainer>
);

const MiniLine = ({ data, color = 'var(--accent)' }) => (
  <ResponsiveContainer width="100%" height={60}>
    <LineChart data={data}>
      <XAxis dataKey="year" tick={{ fill: '#555', fontSize: 9 }} axisLine={false} tickLine={false} />
      <Tooltip contentStyle={{ background: 'var(--bg-2)', border: '1px solid var(--border)', fontSize: 10, fontFamily: 'IBM Plex Mono' }} />
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
  const [evidence, setEvidence] = useState({});

  useEffect(() => {
    fetch(`/api/stock?ticker=${ticker}`)
      .then(r => r.json())
      .then(d => { if (d.error) { setError(d.error); return; } setData(d); })
      .catch(() => setError('Connection error'))
      .finally(() => setLoading(false));
  }, [ticker]);

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

  const score = totalScore();
  const revChart = data.revHistory.map(r => ({ year: r.year, value: +(r.val / 1e9).toFixed(1) }));
  const fcfChart = data.fcfHistory.map(r => ({ year: r.year, value: +(r.val / 1e9).toFixed(1) }));
  const marginChart = (data.marginHistory || []).filter(m => m.margin !== null).map(m => ({ year: m.year, value: m.margin }));

  const price = data.currentPrice;
  const change = data.priceChange;
  const changePct = data.priceChangePct;
  const fcfPerShare = data.fcfVal && data.sharesOutstanding ? data.fcfVal / data.sharesOutstanding : null;
  const intrinsicValue = fcfPerShare ? +(fcfPerShare * 20).toFixed(2) : null;
  const undervalued = intrinsicValue && price ? intrinsicValue > price : null;

  return (
    <div style={S.page}>
      {/* Topbar */}
      <div style={S.topbar}>
        <a href="/" style={{ color: 'var(--accent)', fontWeight: 600, letterSpacing: '2px', textDecoration: 'none' }}>TERMINAL</a>
        <span style={{ color: 'var(--border-2)' }}>/</span>
        <a href="/" style={{ color: 'var(--text-3)', textDecoration: 'none' }}>HOME</a>
        <span style={{ color: 'var(--border-2)' }}>/</span>
        <span style={{ color: 'var(--text)' }}>{ticker}</span>
        <div style={{ flex: 1 }}>
          <form onSubmit={e => { e.preventDefault(); const t = e.target.search.value.toUpperCase().trim(); if (t) window.location.href = `/stock/${t}`; }}>
            <input name="search" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', padding: '4px 10px', width: '220px', outline: 'none', letterSpacing: '1px' }} placeholder="SEARCH TICKER..." />
          </form>
        </div>
      </div>

      <div style={{ display: 'flex' }}>
        {/* Sidebar */}
        <div style={S.sidebar}>
          <div style={{ padding: '0 16px', marginBottom: '12px', color: 'var(--text-3)', fontSize: '9px', letterSpacing: '2px' }}>ANALYSIS</div>
          {NAV.map(n => (
            <button key={n.key} style={S.navItem(tab === n.key)} onClick={() => setTab(n.key)}>{n.label}</button>
          ))}
          {score !== null && (
            <div style={{ margin: '24px 16px 0', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <div style={{ color: 'var(--text-3)', fontSize: '9px', letterSpacing: '2px', marginBottom: '8px' }}>DD SCORE</div>
              <ScoreBox score={score} size={56} />
            </div>
          )}
        </div>

        {/* Main content */}
        <div style={S.content}>

          {/* Company header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
              <div style={{ width: '48px', height: '48px', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                <img
                  src={`https://img.logo.dev/${data.name.toLowerCase().replace(/\binc\b|\bcorp\b|\bltd\b|\bplc\b|\bco\b|\bllc\b|\bgroup\b|\bholdings\b|\binternational\b|\bthe\b/g, '').trim().split(/\s+/)[0].replace(/[^a-z0-9]/g, '')}.com?token=pk_B4aaLZF6S4G1YbCgqZq2Ug`}
                  alt={data.name}
                  style={{ width: '32px', height: '32px', objectFit: 'contain' }}
                  onError={e => { e.target.style.display = 'none'; e.target.parentElement.innerHTML = `<span style="color:var(--accent);font-weight:600;font-size:14px">${ticker.slice(0,2)}</span>`; e.target.parentElement.style.background = 'var(--bg-2)'; }}
                />
              </div>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 600, letterSpacing: '-0.5px', marginBottom: '4px' }}>{data.name}</div>
                <div style={{ color: 'var(--text-3)', fontSize: '11px', marginBottom: '6px' }}>
                  {ticker} {data.exchange && `· ${data.exchange}`} {data.sector && `· ${data.sector}`}
                </div>
                {data.description && (
                  <div style={{ color: 'var(--text-2)', fontSize: '11px', maxWidth: '560px', lineHeight: 1.6 }}>
                    {data.description.slice(0, 180)}...
                  </div>
                )}
                <a href={`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${data.cik}&type=10-K`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ color: 'var(--text-3)', fontSize: '10px', letterSpacing: '1px', textDecoration: 'none', borderBottom: '1px solid var(--border)', paddingBottom: '1px', marginTop: '8px', display: 'inline-block' }}>
                  SEC FILINGS ↗
                </a>
              </div>
            </div>

            {/* Price block */}
            <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '24px' }}>
              {price ? (
                <>
                  <div style={{ fontSize: '36px', fontWeight: 600, letterSpacing: '-1px' }}>${price.toFixed(2)}</div>
                  <div style={{ color: change >= 0 ? 'var(--green)' : 'var(--red)', fontSize: '13px', marginBottom: '4px' }}>
                    {change >= 0 ? '+' : ''}{change?.toFixed(2)} ({changePct?.toFixed(2)}%)
                  </div>
                  <div style={{ color: 'var(--text-3)', fontSize: '10px', letterSpacing: '1px' }}>LIVE · FINNHUB</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: '28px', fontWeight: 600 }}>{fmt(data.marketCap)}</div>
                  <div style={{ color: 'var(--text-3)', fontSize: '10px' }}>MARKET CAP</div>
                </>
              )}
              
            </div>
          </div>

          {/* OVERVIEW TAB */}
          {tab === 'overview' && (
            <div>
              {/* Status pills */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: 'var(--border)', marginBottom: '24px' }}>
                {[
                  { label: 'PROFITABILITY', val: data.grossMargin > 50 ? 'STRONG MARGINS' : data.grossMargin > 30 ? 'SOLID MARGINS' : 'THIN MARGINS', good: data.grossMargin > 40 },
                  { label: 'GROWTH', val: data.revGrowth > 20 ? 'ACCELERATING' : data.revGrowth > 5 ? 'STEADY' : 'SLOW', good: data.revGrowth > 10 },
                  { label: 'CASH FLOW', val: data.fcfVal > 0 ? 'POSITIVE FCF' : 'NEGATIVE FCF', good: data.fcfVal > 0 },
                  { label: 'VALUATION', val: data.pe > 40 ? 'NOT CHEAP' : data.pe > 20 ? 'FAIR VALUE' : data.pe > 0 ? 'ATTRACTIVE' : 'N/A', good: data.pe > 0 && data.pe < 25 },
                ].map(p => (
                  <div key={p.label} style={{ background: 'var(--bg-1)', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-3)', fontSize: '10px', letterSpacing: '1px' }}>{p.label}</span>
                    <span style={{ color: p.good ? 'var(--green)' : p.good === false ? 'var(--red)' : 'var(--accent)', fontSize: '10px', fontWeight: 600, letterSpacing: '0.5px' }}>{p.val}</span>
                  </div>
                ))}
              </div>

              {/* Insight boxes */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'var(--border)', marginBottom: '24px' }}>
                {[
                  { label: 'WHAT STANDS OUT', color: 'var(--green)', text: data.grossMargin > 50 ? `Gross margin of ${data.grossMargin}% signals strong pricing power. Positive ROIC spread.` : `Revenue grew ${data.revGrowth}% YoY with operating margin of ${data.opMargin}%.` },
                  { label: "WHAT'S CHANGING", color: 'var(--blue)', text: data.revGrowth > 0 ? `Revenue growing at ${data.revGrowth}% YoY. ${data.opMargin > 15 ? 'Operating margins remain solid.' : 'Margins showing expansion.'}` : `Revenue contracting ${data.revGrowth}% YoY. Monitor margin evolution closely.` },
                  { label: 'WHAT DESERVES CAUTION', color: 'var(--accent)', text: data.pe > 35 ? `P/E of ${data.pe}x leaves limited room for execution misses or growth deceleration.` : data.debtToEquity > 2 ? `Debt/equity of ${data.debtToEquity}x warrants attention in high-rate environment.` : `Monitor margin evolution and free cash flow generation going forward.` },
                  { label: 'VALUATION CONTEXT', color: '#a855f7', text: data.pe ? `${data.pe}x earnings. ${data.pe > 30 ? 'Quality is already priced in.' : 'Reasonable valuation given the business profile.'} ${data.analystTarget ? `Analyst target: $${data.analystTarget}.` : ''}` : `No P/E available. EV/EBITDA: ${fmtN(data.evEbitda)}x.` },
                ].map(b => (
                  <div key={b.label} style={{ background: 'var(--bg-1)', padding: '14px 16px' }}>
                    <div style={{ color: b.color, fontSize: '10px', letterSpacing: '1.5px', marginBottom: '8px' }}>{b.label}</div>
                    <div style={{ color: 'var(--text-2)', fontSize: '12px', lineHeight: 1.6 }}>{b.text}</div>
                  </div>
                ))}
              </div>

              {/* Metrics Table */}
<div style={{ marginBottom: '24px' }}>
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: 'var(--border)' }}>

    {/* VALUATION */}
    <div style={{ background: 'var(--bg-1)', padding: '16px' }}>
      <div style={{ color: 'var(--accent)', fontSize: '10px', letterSpacing: '2px', marginBottom: '12px' }}>VALUATION</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
        <tbody>
          {[
            { label: 'Market Cap', val: fmt(data.marketCap) },
            { label: 'P/E', val: fmtN(data.pe), color: data.pe > 0 && data.pe < 20 ? 'var(--green)' : data.pe > 40 ? 'var(--red)' : 'var(--text)' },
            { label: 'Forward P/E', val: fmtN(data.forwardPE) },
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
    <div style={{ background: 'var(--bg-1)', padding: '16px' }}>
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
    <div style={{ background: 'var(--bg-1)', padding: '16px' }}>
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
    <div style={{ background: 'var(--bg-1)', padding: '16px' }}>
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

      <div style={{ color: 'var(--accent)', fontSize: '10px', letterSpacing: '2px', margin: '12px 0 8px' }}>PER SHARE</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
        <tbody>
          {[
            { label: 'EPS (TTM)', val: data.eps ? `$${data.eps}` : 'N/A' },
            { label: 'Shs Outstanding', val: data.sharesOutstanding ? `${(data.sharesOutstanding / 1e6).toFixed(0)}M` : 'N/A' },
            { label: 'Beta', val: fmtN(data.beta) },
            { label: '52W High', val: data.high52 ? `$${data.high52}` : 'N/A' },
            { label: '52W Low', val: data.low52 ? `$${data.low52}` : 'N/A' },
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

              {/* Chart + multiples */}
              <div style={{ display: 'flex', gap: '1px', background: 'var(--border)', marginBottom: '24px' }}>
                <div style={{ flex: 1, background: 'var(--bg-1)' }}>
                  <PriceChart ticker={ticker} />
                </div>
                <div style={{ width: '220px', background: 'var(--bg-1)', padding: '16px', flexShrink: 0 }}>
                  <div style={{ color: 'var(--text-3)', fontSize: '10px', letterSpacing: '2px', marginBottom: '12px' }}>VALUATION & MULTIPLES</div>
                  <table style={S.table}>
                    <tbody>
                      {[
                        { label: 'Market Cap', val: fmt(data.marketCap) },
                        { label: 'EPS', val: data.eps ? `$${data.eps}` : 'N/A' },
                        { label: 'P/E', val: fmtN(data.pe), color: data.pe > 30 ? 'var(--red)' : 'var(--green)' },
                        { label: 'P/FCF', val: data.fcfVal && data.marketCap ? fmtN(data.marketCap / data.fcfVal) : 'N/A' },
                        { label: 'EV/EBITDA', val: fmtN(data.evEbitda) },
                        { label: 'FCF Yield', val: data.fcfVal && data.marketCap ? `${((data.fcfVal / data.marketCap) * 100).toFixed(1)}%` : 'N/A' },
                        { label: 'Div. Yield', val: data.dividendYield ? `${(+data.dividendYield).toFixed(2)}%` : '—' },
                        { label: 'Beta', val: fmtN(data.beta) },
                      ].map(r => (
                        <tr key={r.label} style={S.tr}>
                          <td style={S.td}>{r.label}</td>
                          <td style={{ ...S.tdVal, color: r.color || 'var(--text)' }}>{r.val}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {data.low52 && data.high52 && (
                    <div style={{ marginTop: '16px' }}>
                      <div style={{ color: 'var(--text-3)', fontSize: '10px', letterSpacing: '1px', marginBottom: '6px' }}>52W RANGE</div>
                      <div style={{ height: '3px', background: 'var(--border-2)', position: 'relative', marginBottom: '4px' }}>
                        <div style={{ position: 'absolute', height: '3px', background: 'var(--accent)', width: `${Math.min(100, Math.max(0, ((data.analystTarget - data.low52) / (data.high52 - data.low52)) * 100))}%` }}></div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-3)', fontSize: '10px' }}>
                        <span>${data.low52}</span><span>${data.high52}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Metrics grid */}
              <div style={{ color: 'var(--text-3)', fontSize: '10px', letterSpacing: '2px', borderBottom: '1px solid var(--border)', paddingBottom: '6px', marginBottom: '12px' }}>PROFITABILITY & RETURNS</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: 'var(--border)', marginBottom: '24px' }}>
                {[
                  { label: 'REVENUE (TTM)', val: fmt(data.revVal), sub: data.revGrowth !== null ? `${data.revGrowth > 0 ? '+' : ''}${data.revGrowth}% YOY` : null, good: data.revGrowth > 0 },
                  { label: 'NET INCOME (TTM)', val: fmt(data.niVal), sub: data.netMargin !== null ? `${data.netMargin}% NET MARGIN` : null, good: data.netMargin > 10 },
                  { label: 'OP. MARGIN', val: fmtP(data.opMargin), sub: data.opMargin > 15 ? 'ABOVE THRESHOLD' : 'BELOW THRESHOLD', good: data.opMargin > 15 },
                  { label: 'ROE', val: fmtP(data.roe), sub: data.roe > 15 ? 'STRONG RETURN' : 'MODERATE RETURN', good: data.roe > 15 },
                ].map(m => (
                  <div key={m.label} style={{ background: 'var(--bg-1)', padding: '14px' }}>
                    <div style={{ color: 'var(--text-3)', fontSize: '10px', letterSpacing: '1px', marginBottom: '6px' }}>{m.label}</div>
                    <div style={{ fontSize: '20px', fontWeight: 600, marginBottom: '4px' }}>{m.val}</div>
                    {m.sub && <div style={{ color: m.good ? 'var(--green)' : 'var(--red)', fontSize: '10px', letterSpacing: '0.5px' }}>{m.sub}</div>}
                  </div>
                ))}
              </div>

              <div style={{ color: 'var(--text-3)', fontSize: '10px', letterSpacing: '2px', borderBottom: '1px solid var(--border)', paddingBottom: '6px', marginBottom: '12px' }}>CASH FLOW & BALANCE SHEET</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: 'var(--border)', marginBottom: '24px' }}>
                {[
                  { label: 'FREE CASH FLOW', val: fmt(data.fcfVal), sub: data.fcfVal > 0 ? 'POSITIVE FCF' : 'NEGATIVE FCF', good: data.fcfVal > 0 },
                  { label: 'OP. CASH FLOW', val: fmt(data.fcfVal), sub: data.fcfVal && data.revVal ? `${((data.fcfVal / data.revVal) * 100).toFixed(1)}% CONVERSION` : null, good: data.fcfVal > 0 },
                  { label: 'NET DEBT', val: fmt(data.netDebt), sub: data.netDebt < 0 ? 'NET CASH POSITION' : 'NET DEBT POSITION', good: data.netDebt < 0 },
                  { label: 'CASH & EQUIV.', val: fmt(data.cashVal), sub: null },
                ].map(m => (
                  <div key={m.label} style={{ background: 'var(--bg-1)', padding: '14px' }}>
                    <div style={{ color: 'var(--text-3)', fontSize: '10px', letterSpacing: '1px', marginBottom: '6px' }}>{m.label}</div>
                    <div style={{ fontSize: '20px', fontWeight: 600, marginBottom: '4px' }}>{m.val}</div>
                    {m.sub && <div style={{ color: m.good ? 'var(--green)' : 'var(--red)', fontSize: '10px', letterSpacing: '0.5px' }}>{m.sub}</div>}
                  </div>
                ))}
              </div>

              {/* Charts */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'var(--border)', marginBottom: '24px' }}>
                {[
                  { title: 'REVENUE', chart: revChart, color: 'var(--green)', type: 'bar' },
                  { title: 'FREE CASH FLOW', chart: fcfChart, color: '#8b5cf6', type: 'bar' },
                ].map(({ title, chart, color, type }) => (
                  <div key={title} style={{ background: 'var(--bg-1)', padding: '16px' }}>
                    <div style={{ color: 'var(--text-3)', fontSize: '10px', letterSpacing: '2px', marginBottom: '12px' }}>{title}</div>
                    <MiniBar data={chart} color={color} />
                  </div>
                ))}
              </div>

              {/* Continue research */}
              <div style={{ color: 'var(--text-3)', fontSize: '10px', letterSpacing: '2px', borderBottom: '1px solid var(--border)', paddingBottom: '6px', marginBottom: '12px' }}>CONTINUE RESEARCH</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: 'var(--border)', marginBottom: '24px' }}>
                {[
                  { key: 'quality', title: 'QUALITY SCORECARD', desc: 'Is this a high-quality business?' },
                  { key: 'financials', title: 'FINANCIALS', desc: 'Income, cash flow, balance sheet' },
                  { key: 'dcf', title: 'DCF VALUATION', desc: "What's it really worth?" },
                ].map(s => (
                  <button key={s.key} onClick={() => setTab(s.key)}
                    style={{ background: 'var(--bg-1)', border: 'none', padding: '14px 16px', textAlign: 'left', cursor: 'pointer', fontFamily: 'IBM Plex Mono, monospace' }}
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
              {/* Score header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '24px', padding: '20px', background: 'var(--bg-1)', border: '1px solid var(--border)', marginBottom: '24px' }}>
                <ScoreBox score={score} size={72} />
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>
                    {score !== null ? score >= 70 ? 'HIGH-QUALITY BUSINESS' : score >= 40 ? 'MODERATE QUALITY' : 'RED FLAGS DETECTED' : 'AUTOMATED QUALITY SCORE'}
                  </div>
                  <div style={{ color: 'var(--text-2)', fontSize: '11px', marginBottom: '4px' }}>
                    {score !== null ? `Score based on ${Object.keys(answers).filter(k => answers[k]).length} of 15 questions from SEC filings.` : 'Score calculated from SEC EDGAR fundamentals.'}
                  </div>
                  <div style={{ color: 'var(--text-3)', fontSize: '10px', letterSpacing: '1px' }}>BROAD-MARKET HEURISTICS · NOT A BUY/SELL SIGNAL</div>
                </div>
              </div>

              {/* Valuation section */}
              <div style={S.section}>VALUATION</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'var(--border)', marginBottom: '24px' }}>
                {[
                  { label: 'EARNINGS MULTIPLE', val: data.pe ? `${data.pe}x` : 'N/A', score: data.pe ? data.pe < 15 ? 100 : data.pe < 20 ? 80 : data.pe < 25 ? 60 : data.pe < 35 ? 40 : 20 : null, desc: data.pe < 15 ? 'Below 15x, attractively priced' : data.pe < 20 ? 'Below 20x, reasonably priced' : data.pe < 25 ? 'Fair value range' : data.pe < 35 ? 'Paying a growth premium' : 'Above 35x, expensive' },
                  { label: 'CASH FLOW MULTIPLE', val: data.fcfVal && data.marketCap ? `${(data.marketCap / data.fcfVal).toFixed(1)}x` : 'N/A', score: data.fcfVal && data.marketCap ? (data.marketCap / data.fcfVal) < 15 ? 100 : (data.marketCap / data.fcfVal) < 25 ? 60 : 20 : null, desc: 'Price to free cash flow ratio' },
                ].map(m => {
                  const c = m.score >= 80 ? 'var(--green)' : m.score >= 60 ? 'var(--accent)' : m.score !== null ? 'var(--red)' : 'var(--text-3)';
                  return (
                    <div key={m.label} style={{ background: 'var(--bg-1)', padding: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ color: 'var(--text-3)', fontSize: '10px', letterSpacing: '1px' }}>{m.label}</span>
                        {m.score !== null && <span style={{ color: c, fontSize: '10px' }}>{m.score}/100</span>}
                      </div>
                      <div style={{ color: c, fontSize: '28px', fontWeight: 600, marginBottom: '4px' }}>{m.val}</div>
                      <div style={{ color: 'var(--text-3)', fontSize: '11px' }}>{m.desc}</div>
                    </div>
                  );
                })}
              </div>

              {/* Growth section */}
              <div style={S.section}>GROWTH</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'var(--border)', marginBottom: '24px' }}>
                {[
                  { label: 'REVENUE GROWTH', val: data.revGrowth !== null ? `${data.revGrowth > 0 ? '+' : ''}${data.revGrowth}%` : 'N/A', score: data.revGrowth > 20 ? 100 : data.revGrowth > 10 ? 80 : data.revGrowth > 5 ? 60 : data.revGrowth > 0 ? 40 : 20, chart: revChart, desc: data.revGrowth > 10 ? 'Above 10% CAGR, strong compounder' : 'Below 10% threshold' },
                  { label: 'CASH FLOW GROWTH', val: (() => { const f = data.fcfHistory[0]?.val; const l = data.fcfHistory[data.fcfHistory.length-1]?.val; return f && l ? `${(((l-f)/Math.abs(f))*100).toFixed(1)}%` : 'N/A'; })(), score: (() => { const f = data.fcfHistory[0]?.val; const l = data.fcfHistory[data.fcfHistory.length-1]?.val; const g = f && l ? ((l-f)/Math.abs(f))*100 : null; return g > 20 ? 100 : g > 10 ? 80 : g > 0 ? 60 : 20; })(), chart: fcfChart, color: '#8b5cf6', desc: 'Free cash flow growth trend' },
                ].map(m => {
                  const c = m.score >= 80 ? 'var(--green)' : m.score >= 60 ? 'var(--accent)' : 'var(--red)';
                  return (
                    <div key={m.label} style={{ background: 'var(--bg-1)', padding: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ color: 'var(--text-3)', fontSize: '10px', letterSpacing: '1px' }}>{m.label}</span>
                        <span style={{ color: c, fontSize: '10px' }}>{m.score}/100</span>
                      </div>
                      <div style={{ color: c, fontSize: '28px', fontWeight: 600, marginBottom: '4px' }}>{m.val}</div>
                      <div style={{ color: 'var(--text-3)', fontSize: '11px', marginBottom: '8px' }}>{m.desc}</div>
                      <MiniBar data={m.chart} color={m.color || 'var(--green)'} />
                    </div>
                  );
                })}
              </div>

              {/* Business Quality section */}
              <div style={S.section}>BUSINESS QUALITY & CAPITAL ALLOCATION</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'var(--border)', marginBottom: '24px' }}>
                {/* Margin Trend */}
                {(() => {
                  const margins = (data.marginHistory || []).filter(m => m.margin !== null);
                  const first = margins[0]?.margin;
                  const last = margins[margins.length - 1]?.margin;
                  const trend = first !== null && last !== null ? +(last - first).toFixed(1) : null;
                  const score = trend > 5 ? 100 : trend > 2 ? 80 : trend > 0 ? 60 : trend > -2 ? 40 : 20;
                  const c = score >= 80 ? 'var(--green)' : score >= 60 ? 'var(--accent)' : 'var(--red)';
                  return (
                    <div style={{ background: 'var(--bg-1)', padding: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ color: 'var(--text-3)', fontSize: '10px', letterSpacing: '1px' }}>MARGIN TREND</span>
                        {trend !== null && <span style={{ color: c, fontSize: '10px' }}>{score}/100</span>}
                      </div>
                      <div style={{ color: c, fontSize: '28px', fontWeight: 600, marginBottom: '4px' }}>{trend !== null ? `${trend > 0 ? '+' : ''}${trend}pp` : 'N/A'}</div>
                      <div style={{ color: 'var(--text-3)', fontSize: '11px', marginBottom: '8px' }}>{trend > 3 ? 'Expanded 3+pp, strong improvement' : trend > 0 ? 'Slight expansion' : 'Compressed'}</div>
                      <MiniLine data={marginChart} color={c} />
                    </div>
                  );
                })()}

                {/* Capital Structure */}
                {(() => {
                  const nd = data.netDebt;
                  const fcf = data.fcfVal;
                  const ratio = nd && fcf && fcf > 0 ? +(nd / fcf).toFixed(1) : null;
                  const score = nd < 0 ? 100 : ratio < 1 ? 80 : ratio < 2 ? 60 : ratio < 3 ? 40 : 20;
                  const c = score >= 80 ? 'var(--green)' : score >= 60 ? 'var(--accent)' : 'var(--red)';
                  return (
                    <div style={{ background: 'var(--bg-1)', padding: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ color: 'var(--text-3)', fontSize: '10px', letterSpacing: '1px' }}>CAPITAL STRUCTURE</span>
                        <span style={{ color: c, fontSize: '10px' }}>{score}/100</span>
                      </div>
                      <div style={{ color: c, fontSize: '28px', fontWeight: 600, marginBottom: '4px' }}>{fmt(nd)}</div>
                      <div style={{ color: 'var(--text-3)', fontSize: '11px', marginBottom: '12px' }}>{nd < 0 ? 'Net cash position' : `Net debt/FCF: ${ratio}x`}</div>
                      <table style={{ ...S.table, fontSize: '11px' }}>
                        <tbody>
                          <tr><td style={S.td}>Cash</td><td style={{ ...S.tdVal, color: 'var(--green)' }}>{fmt(data.cashVal)}</td></tr>
                          <tr><td style={S.td}>LT Debt</td><td style={{ ...S.tdVal, color: 'var(--red)' }}>{fmt(data.debtVal)}</td></tr>
                          <tr><td style={S.td}>D/E Ratio</td><td style={S.tdVal}>{fmtN(data.debtToEquity)}</td></tr>
                        </tbody>
                      </table>
                    </div>
                  );
                })()}

                {/* Return on Capital */}
                {(() => {
                  const roic = data.roe;
                  const score = roic > 25 ? 100 : roic > 20 ? 80 : roic > 15 ? 60 : roic > 10 ? 40 : 20;
                  const c = score >= 80 ? 'var(--green)' : score >= 60 ? 'var(--accent)' : 'var(--red)';
                  return (
                    <div style={{ background: 'var(--bg-1)', padding: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ color: 'var(--text-3)', fontSize: '10px', letterSpacing: '1px' }}>RETURN ON CAPITAL</span>
                        {roic !== null && <span style={{ color: c, fontSize: '10px' }}>{score}/100</span>}
                      </div>
                      <div style={{ color: c, fontSize: '28px', fontWeight: 600, marginBottom: '4px' }}>{roic !== null ? `${roic}%` : 'N/A'}</div>
                      <div style={{ color: 'var(--text-3)', fontSize: '11px' }}>{roic > 20 ? 'Above 20%, exceptional efficiency' : roic > 15 ? 'Strong returns' : roic > 10 ? 'Respectable returns' : 'Weak capital allocation'}</div>
                    </div>
                  );
                })()}

                {/* Share Dilution */}
                {(() => {
                  const d = data.shareDilution;
                  const score = d === null ? null : d < -2 ? 100 : d < 0 ? 80 : d < 2 ? 60 : d < 5 ? 40 : 0;
                  const c = score >= 80 ? 'var(--green)' : score >= 60 ? 'var(--accent)' : score !== null ? 'var(--red)' : 'var(--text-3)';
                  const sharesChart = (data.sharesHistory || []).map(r => ({ year: r.year, value: +(r.val / 1e6).toFixed(0) }));
                  return (
                    <div style={{ background: 'var(--bg-1)', padding: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ color: 'var(--text-3)', fontSize: '10px', letterSpacing: '1px' }}>SHARE DILUTION</span>
                        {score !== null && <span style={{ color: c, fontSize: '10px' }}>{score}/100</span>}
                      </div>
                      <div style={{ color: c, fontSize: '28px', fontWeight: 600, marginBottom: '4px' }}>{d !== null ? `${d > 0 ? '+' : ''}${d}%` : 'N/A'}</div>
                      <div style={{ color: 'var(--text-3)', fontSize: '11px', marginBottom: '8px' }}>{d < -2 ? 'Active buybacks' : d < 0 ? 'Mild buybacks' : d < 2 ? 'Mild dilution' : 'Heavy dilution'}</div>
                      {sharesChart.length > 0 && <MiniBar data={sharesChart} color='var(--accent)' />}
                    </div>
                  );
                })()}
              </div>

              {/* DD Checklist */}
              <div style={S.section}>DUE DILIGENCE CHECKLIST</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1px', background: 'var(--border)', marginBottom: '24px' }}>
                {DIMS.map(dim => (
                  <div key={dim} style={{ background: 'var(--bg-1)', padding: '12px', textAlign: 'center' }}>
                    <ScoreBox score={getDimScore(dim)} size={40} />
                    <div style={{ color: 'var(--text-3)', fontSize: '9px', letterSpacing: '1px', marginTop: '6px' }}>{dim.toUpperCase()}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--border)' }}>
                {QUESTIONS.map((q, qi) => (
                  <div key={qi} style={{ background: 'var(--bg-1)', padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                      <span style={{ color: 'var(--text-3)', fontSize: '10px', minWidth: '20px' }}>Q{qi + 1}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ color: 'var(--text-2)', fontSize: '11px', marginBottom: '8px' }}>{q.text}</div>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {['YES', 'NO', 'N/A'].map(opt => (
                            <button key={opt} onClick={() => setAnswers(prev => ({ ...prev, [qi]: opt }))}
                              style={{
                                padding: '3px 10px', fontSize: '10px', letterSpacing: '1px', cursor: 'pointer', fontFamily: 'IBM Plex Mono, monospace',
                                background: answers[qi] === opt ? (opt === 'YES' ? 'var(--green)' : opt === 'NO' ? 'var(--red)' : 'var(--text-3)') : 'none',
                                color: answers[qi] === opt ? '#000' : 'var(--text-3)',
                                border: `1px solid ${answers[qi] === opt ? 'transparent' : 'var(--border-2)'}`,
                              }}>
                              {opt}
                            </button>
                          ))}
                        </div>
                        {answers[qi] && (
                          <input
                            style={{ marginTop: '6px', width: '100%', background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--text-2)', fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', padding: '4px 8px', outline: 'none' }}
                            placeholder="Evidence from filing (exact quote)..."
                            value={evidence[qi] || ''}
                            onChange={e => setEvidence(prev => ({ ...prev, [qi]: e.target.value }))}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* FINANCIALS TAB */}
          {tab === 'financials' && (
            <div>
              <div style={S.section}>INCOME STATEMENT</div>
              <table style={{ ...S.table, marginBottom: '24px' }}>
                <thead>
                  <tr style={S.tr}>
                    <th style={{ ...S.td, textAlign: 'left', fontWeight: 400, letterSpacing: '1px', fontSize: '10px' }}>METRIC</th>
                    {data.revHistory.map(r => <th key={r.year} style={{ ...S.tdVal, fontWeight: 400, fontSize: '10px', letterSpacing: '1px' }}>{r.year}</th>)}
                    <th style={{ ...S.tdVal, color: 'var(--accent)', fontWeight: 400, fontSize: '10px', letterSpacing: '1px' }}>TTM</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'Revenue', history: data.revHistory, latest: data.revVal },
                    { label: 'Net Income', history: data.niHistory, latest: data.niVal },
                    { label: 'Op. Cash Flow', history: data.fcfHistory, latest: data.fcfVal },
                  ].map(row => (
                    <tr key={row.label} style={S.tr}>
                      <td style={S.td}>{row.label}</td>
                      {row.history.map((r, i) => <td key={i} style={S.tdVal}>{fmt(r.val)}</td>)}
                      <td style={{ ...S.tdVal, color: 'var(--accent)' }}>{fmt(row.latest)}</td>
                    </tr>
                  ))}
                  {[
                    { label: 'Gross Margin', ttm: fmtP(data.grossMargin) },
                    { label: 'Op. Margin', ttm: fmtP(data.opMargin) },
                    { label: 'Net Margin', ttm: fmtP(data.netMargin) },
                  ].map(row => (
                    <tr key={row.label} style={S.tr}>
                      <td style={S.td}>{row.label}</td>
                      {data.revHistory.map((_, i) => <td key={i} style={{ ...S.tdVal, color: 'var(--text-3)' }}>—</td>)}
                      <td style={{ ...S.tdVal, color: 'var(--accent)' }}>{row.ttm}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: 'var(--border)' }}>
                {[
                  { title: 'REVENUE', chart: revChart, color: 'var(--green)' },
                  { title: 'NET INCOME', chart: data.niHistory.map(r => ({ year: r.year, value: +(r.val / 1e9).toFixed(1) })), color: 'var(--blue)' },
                  { title: 'CASH FLOW', chart: fcfChart, color: '#8b5cf6' },
                ].map(({ title, chart, color }) => (
                  <div key={title} style={{ background: 'var(--bg-1)', padding: '16px' }}>
                    <div style={{ color: 'var(--text-3)', fontSize: '10px', letterSpacing: '2px', marginBottom: '8px' }}>{title}</div>
                    <MiniBar data={chart} color={color} />
                  </div>
                ))}
              </div>
              <div style={{ color: 'var(--text-3)', fontSize: '10px', letterSpacing: '1px', marginTop: '16px' }}>SOURCE: SEC EDGAR (XBRL) · ALPHA VANTAGE · NOT INVESTMENT ADVICE</div>
            </div>
          )}

          {/* DCF TAB */}
          {tab === 'dcf' && (
            <div>
              <div style={S.section}>GRAHAM INTRINSIC VALUE — V = EPS × (8.5 + 2g)</div>

              {data.eps ? (
                <>
                  <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', padding: '16px', marginBottom: '24px', fontSize: '11px', color: 'var(--text-2)', lineHeight: 1.8 }}>
                    <span style={{ color: 'var(--accent)' }}>V = EPS × (8.5 + 2g)</span> &nbsp;·&nbsp;
                    EPS: <span style={{ color: 'var(--text)' }}>${data.eps}</span> &nbsp;·&nbsp;
                    5Y EPS CAGR (g): <span style={{ color: 'var(--text)' }}>{data.epsCagr !== null ? `${data.epsCagr}%` : 'N/A'}</span> &nbsp;·&nbsp;
                    <span style={{ color: 'var(--text-3)' }}>Benjamin Graham formula · Not investment advice</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: 'var(--border)', marginBottom: '24px' }}>
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

                  {price && (
                    <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', padding: '20px', marginBottom: '24px' }}>
                      <div style={{ color: 'var(--text-3)', fontSize: '10px', letterSpacing: '2px', marginBottom: '32px' }}>PRICE VS INTRINSIC VALUE RANGE</div>
                      {(() => {
                        const gCons = Math.max(0, Math.min(data.revGrowth !== null ? data.revGrowth * 0.5 : 3, 25));
                        const gOpt = Math.max(0, Math.min(data.revGrowth !== null ? data.revGrowth * 1.5 : 12, 25));
                        const low = +(data.eps * (8.5 + 2 * gCons)).toFixed(2);
                        const high = +(data.eps * (8.5 + 2 * gOpt)).toFixed(2);
                        const rangeMin = Math.min(low, high, price) * 0.9;
                        const rangeMax = Math.max(low, high, price) * 1.1;
                        const pct = v => ((v - rangeMin) / (rangeMax - rangeMin)) * 100;
                        return (
                          <div style={{ position: 'relative', height: '48px' }}>
                            <div style={{ position: 'absolute', top: '18px', left: `${Math.min(pct(low), pct(high))}%`, width: `${Math.abs(pct(high) - pct(low))}%`, height: '12px', background: 'var(--accent)', opacity: 0.25 }}></div>
                            {[
                              { val: low, label: `$${low}`, color: 'var(--green)', top: true },
                              { val: high, label: `$${high}`, color: 'var(--green)', top: true },
                              { val: price, label: `$${price.toFixed(2)}`, color: 'var(--text)', top: false },
                            ].map((m, i) => (
                              <div key={i} style={{ position: 'absolute', left: `${pct(m.val)}%`, transform: 'translateX(-50%)', top: 0 }}>
                                {m.top && <div style={{ color: m.color, fontSize: '10px', whiteSpace: 'nowrap', textAlign: 'center', marginBottom: '4px' }}>{m.label}</div>}
                                <div style={{ width: '1px', height: m.top ? '24px' : '48px', background: m.color, margin: '0 auto', marginTop: m.top ? '0' : '-48px' }}></div>
                                {!m.top && <div style={{ color: m.color, fontSize: '10px', whiteSpace: 'nowrap', textAlign: 'center', marginTop: '2px' }}>{m.label}</div>}
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-3)', fontSize: '10px', marginTop: '8px' }}>
                        <span>CONSERVATIVE</span>
                        <span>CURRENT PRICE</span>
                        <span>OPTIMISTIC</span>
                      </div>
                    </div>
                  )}

                  <div style={{ color: 'var(--text-3)', fontSize: '10px', letterSpacing: '1px' }}>
                    GRAHAM FORMULA (1962) · EPS FROM ALPHA VANTAGE · GROWTH FROM SEC EDGAR · NOT INVESTMENT ADVICE
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