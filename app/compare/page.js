'use client';
import { useState, useEffect } from 'react';
import Sparkline from '../components/Sparkline';

const fmt = (val) => {
  if (val === null || val === undefined) return '—';
  if (Math.abs(val) >= 1e12) return `$${(val / 1e12).toFixed(1)}T`;
  if (Math.abs(val) >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
  if (Math.abs(val) >= 1e6) return `$${(val / 1e6).toFixed(0)}M`;
  return `$${val.toLocaleString()}`;
};
const fmtP = (v) => v !== null && v !== undefined ? `${v}%` : '—';
const fmtN = (v, d = 1) => v !== null && v !== undefined ? v.toFixed(d) : '—';

const calcEvEbitda = (d) => {
  if (!d || !d.marketCap || !d.oiVal) return null;
  const ev = d.marketCap + (d.netDebt || 0);
  // EBITDA ≈ Operating Income (sin depreciation disponible en SEC data)
  const ebitda = d.oiVal;
  if (ebitda <= 0) return null;
  return +(ev / ebitda).toFixed(1);
};

const calcScore = (data) => {
  if (!data) return { cbs: null, oppo: null, final: null };
  const sector = (data.sector || '').toLowerCase();
  const isFinancial = sector.includes('bank') || sector.includes('insurance') || sector.includes('financial');
  const isTech = sector.includes('tech') || sector.includes('software') || sector.includes('semi');
  const isPharma = sector.includes('pharma') || sector.includes('biotech') || sector.includes('health');
  const roicT = isTech ? 0.25 : isPharma ? 0.20 : 0.15;
  const gmT = isTech ? 0.65 : isPharma ? 0.65 : isFinancial ? 0.30 : 0.35;
  const omT = isTech ? 0.20 : isPharma ? 0.20 : 0.15;
  const roicS = data.roic == null ? 2.5 : data.roic/100 >= roicT*2 ? 5 : data.roic/100 >= roicT*1.5 ? 4.5 : data.roic/100 >= roicT ? 4 : data.roic/100 >= roicT*0.7 ? 3 : 2;
  const gmS = data.grossMargin == null ? 2.5 : data.grossMargin/100 >= gmT*1.4 ? 5 : data.grossMargin/100 >= gmT*1.15 ? 4.5 : data.grossMargin/100 >= gmT ? 4 : data.grossMargin/100 >= gmT*0.75 ? 3 : 2;
  const omS = data.opMargin == null ? 2.5 : data.opMargin/100 >= omT*2 ? 5 : data.opMargin/100 >= omT*1.5 ? 4.5 : data.opMargin/100 >= omT ? 4 : data.opMargin/100 >= omT*0.65 ? 3 : 2;
  const deS = data.debtToEquity == null ? 2.5 : data.debtToEquity < 0.3 ? 5 : data.debtToEquity < 0.7 ? 4.5 : data.debtToEquity < 1.2 ? 4 : data.debtToEquity < 2 ? 3 : 2;
  const cbs = +(roicS*0.4 + gmS*0.25 + omS*0.25 + deS*0.1).toFixed(2);
  const pfcfS = data.pfcf == null || data.pfcf <= 0 ? 1 : data.pfcf < 12 ? 5 : data.pfcf < 18 ? 4.5 : data.pfcf < 25 ? 4 : data.pfcf < 35 ? 3 : 2;
  const fcfYS = data.fcfYield == null ? 1 : data.fcfYield > 8 ? 5 : data.fcfYield > 5 ? 4.5 : data.fcfYield > 3 ? 4 : data.fcfYield > 1.5 ? 3 : 2;
  const oppo = +(pfcfS*0.55 + fcfYS*0.45).toFixed(2);
  const revGS = data.revGrowth == null ? 2.5 : data.revGrowth > 25 ? 5 : data.revGrowth > 15 ? 4.5 : data.revGrowth > 8 ? 4 : data.revGrowth > 3 ? 3 : 2;
  const gqs = Math.min(5, revGS*0.6 + 3*0.4);
  const final = +((cbs*0.45 + oppo*0.30 + gqs*0.25)).toFixed(1);
  return { cbs, oppo, gqs: +gqs.toFixed(2), final };
};

const scoreColor = (s) => s >= 4 ? 'var(--green)' : s >= 3 ? 'var(--accent)' : s !== null ? 'var(--red)' : 'var(--text-3)';

const METRICS = [
  { section: 'PRICE & VALUATION' },
  { label: 'Price', fn: d => d.currentPrice ? `$${d.currentPrice.toFixed(2)}` : '—' },
  { label: 'Market Cap', fn: d => fmt(d.marketCap) },
  { label: 'P/E', fn: d => fmtN(d.pe), color: d => d.pe > 0 && d.pe < 20 ? 'var(--green)' : d.pe > 35 ? 'var(--red)' : 'var(--text)', winner: 'min', winnerFn: d => d.pe > 0 ? d.pe : null },
  { label: 'P/FCF', fn: d => fmtN(d.pfcf), color: d => d.pfcf > 0 && d.pfcf < 20 ? 'var(--green)' : d.pfcf > 40 ? 'var(--red)' : 'var(--text)', winner: 'min', winnerFn: d => d.pfcf > 0 ? d.pfcf : null },
  { label: 'FCF Yield', fn: d => d.fcfYield ? `${d.fcfYield}%` : '—', color: d => d.fcfYield > 5 ? 'var(--green)' : d.fcfYield > 2 ? 'var(--accent)' : 'var(--text)', winner: 'max', winnerFn: d => d.fcfYield },
  { label: 'EV/EBITDA', fn: d => fmtN(calcEvEbitda(d)), winner: 'min', winnerFn: d => calcEvEbitda(d) },
  { section: 'PROFITABILITY' },
  { label: 'Gross Margin', fn: d => fmtP(d.grossMargin), color: d => d.grossMargin > 50 ? 'var(--green)' : d.grossMargin > 30 ? 'var(--accent)' : 'var(--red)', winner: 'max', winnerFn: d => d.grossMargin },
  { label: 'Op. Margin', fn: d => fmtP(d.opMargin), color: d => d.opMargin > 20 ? 'var(--green)' : d.opMargin > 10 ? 'var(--accent)' : 'var(--red)', winner: 'max', winnerFn: d => d.opMargin },
  { label: 'Net Margin', fn: d => fmtP(d.netMargin), color: d => d.netMargin > 15 ? 'var(--green)' : d.netMargin > 5 ? 'var(--accent)' : 'var(--red)', winner: 'max', winnerFn: d => d.netMargin },
  { label: 'ROE', fn: d => fmtP(d.roe), color: d => d.roe > 20 ? 'var(--green)' : d.roe > 10 ? 'var(--accent)' : 'var(--red)', winner: 'max', winnerFn: d => d.roe },
  { label: 'ROA', fn: d => fmtP(d.roa), color: d => d.roa > 10 ? 'var(--green)' : d.roa > 5 ? 'var(--accent)' : 'var(--red)', winner: 'max', winnerFn: d => d.roa },
  { label: 'ROIC', fn: d => fmtP(d.roic), color: d => d.roic > 15 ? 'var(--green)' : d.roic > 8 ? 'var(--accent)' : 'var(--red)', winner: 'max', winnerFn: d => d.roic },
  { section: 'GROWTH' },
  { label: 'Rev. Growth YoY', fn: d => d.revGrowth !== null ? `${d.revGrowth > 0 ? '+' : ''}${d.revGrowth}%` : '—', color: d => d.revGrowth > 10 ? 'var(--green)' : d.revGrowth > 0 ? 'var(--accent)' : 'var(--red)', winner: 'max', winnerFn: d => d.revGrowth },
  { label: 'EPS CAGR', fn: d => d.epsCagr !== null ? `${d.epsCagr}%` : '—', color: d => d.epsCagr > 15 ? 'var(--green)' : d.epsCagr > 5 ? 'var(--accent)' : 'var(--red)', winner: 'max', winnerFn: d => d.epsCagr },
  { section: 'BALANCE SHEET' },
  { label: 'Net Debt', fn: d => fmt(d.netDebt), color: d => d.netDebt < 0 ? 'var(--green)' : 'var(--text)', winner: 'min', winnerFn: d => d.netDebt },
  { label: 'D/E Ratio', fn: d => fmtN(d.debtToEquity), color: d => d.debtToEquity < 1 ? 'var(--green)' : d.debtToEquity < 2 ? 'var(--accent)' : 'var(--red)', winner: 'min', winnerFn: d => d.debtToEquity },
  { label: 'Current Ratio', fn: d => d.currentAssetsVal && d.currentLiabilitiesVal ? fmtN(d.currentAssetsVal / d.currentLiabilitiesVal) : '—', winner: 'max', winnerFn: d => d.currentAssetsVal && d.currentLiabilitiesVal ? d.currentAssetsVal / d.currentLiabilitiesVal : null },
  { label: 'Cash', fn: d => fmt(d.cashVal), color: () => 'var(--green)', winner: 'max', winnerFn: d => d.cashVal },
  { section: 'TRAQCKER SCORE' },
  { label: 'Core Business', fn: d => { const s = calcScore(d); return s.cbs?.toFixed(1) || '—'; }, color: d => { const s = calcScore(d); return scoreColor(s.cbs); }, winnerFn: d => calcScore(d).cbs, winner: 'max' },
  { label: 'Oppo Score', fn: d => { const s = calcScore(d); return s.oppo?.toFixed(1) || '—'; }, color: d => { const s = calcScore(d); return scoreColor(s.oppo); }, winnerFn: d => calcScore(d).oppo, winner: 'max' },
  { label: 'Final Note', fn: d => { const s = calcScore(d); return s.final?.toFixed(1) || '—'; }, color: d => { const s = calcScore(d); return scoreColor(s.final); }, winnerFn: d => calcScore(d).final, winner: 'max', bold: true },
];

const N = 3;

export default function Compare() {
  const [tickers, setTickers] = useState(Array(N).fill(''));
  const [stocks, setStocks] = useState(Array(N).fill(null));
  const [loading, setLoading] = useState(Array(N).fill(false));
  const [inputs, setInputs] = useState(Array(N).fill(''));
  const [sparklines, setSparklines] = useState(Array(N).fill(null));

  const fetchSparkline = async (index, ticker) => {
    try {
      const res = await fetch(`/api/sparkline?ticker=${ticker}`);
      const data = await res.json();
      setSparklines(prev => { const n = [...prev]; n[index] = data.candles || null; return n; });
    } catch (e) {
      setSparklines(prev => { const n = [...prev]; n[index] = null; return n; });
    }
  };

  const fetchStock = async (index, ticker) => {
    if (!ticker) return;
    const t = ticker.toUpperCase();
    setLoading(prev => { const n = [...prev]; n[index] = true; return n; });
    try {
      const res = await fetch(`/api/stock?ticker=${t}`);
      const data = await res.json();
      setStocks(prev => { const n = [...prev]; n[index] = data.error ? null : data; return n; });
      setTickers(prev => { const n = [...prev]; n[index] = data.error ? '' : t; return n; });
      if (!data.error) fetchSparkline(index, t);
    } catch (e) {
      setStocks(prev => { const n = [...prev]; n[index] = null; return n; });
    }
    setLoading(prev => { const n = [...prev]; n[index] = false; return n; });
  };

  const removeStock = (index) => {
    setStocks(prev => { const n = [...prev]; n[index] = null; return n; });
    setTickers(prev => { const n = [...prev]; n[index] = ''; return n; });
    setInputs(prev => { const n = [...prev]; n[index] = ''; return n; });
    setSparklines(prev => { const n = [...prev]; n[index] = null; return n; });
  };

  const getWinners = (metric) => {
    if (!metric.winner || !metric.winnerFn) return [];
    const vals = stocks.map((s, i) => ({ i, v: s ? metric.winnerFn(s) : null }));
    const valid = vals.filter(x => x.v !== null && x.v !== undefined && stocks[x.i] !== null);
    if (valid.length < 2) return [];
    const best = metric.winner === 'max'
      ? Math.max(...valid.map(x => x.v))
      : Math.min(...valid.map(x => x.v));
    return valid.filter(x => x.v === best).map(x => x.i);
  };

  const logoUrl = (s) => {
    if (!s?.name) return null;
    const domain = s.name.toLowerCase()
      .replace(/\binc\b|\bcorp\b|\bltd\b|\bplc\b|\bco\b|\bllc\b/g, '')
      .trim().split(/\s+/)[0].replace(/[^a-z0-9]/g, '');
    return `https://img.logo.dev/${domain}.com?token=pk_B4aaLZF6S4G1YbCgqZq2Ug`;
  };

  const hasAny = stocks.some(s => s !== null);

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', fontFamily: 'IBM Plex Mono, monospace' }}>

      {/* Topbar */}
      <div style={{ borderBottom: '1px solid var(--border)', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '12px', position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 10, fontSize: '11px' }}>
        <a href="/" style={{ textDecoration: 'none' }}>
          <img src="/logo.png" alt="Traqcker" style={{ height: '20px', objectFit: 'contain' }} />
        </a>
        <span style={{ color: 'var(--border-2)' }}>/</span>
        <a href="/" style={{ color: 'var(--text-3)', textDecoration: 'none' }}>HOME</a>
        <span style={{ color: 'var(--border-2)' }}>/</span>
        <span style={{ color: 'var(--text)' }}>COMPARE</span>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>

        {/* Stock slots */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: 'var(--border)', marginBottom: '24px' }}>
          {Array.from({ length: N }, (_, i) => (
            <div key={i} style={{ background: 'var(--bg-1)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

              {/* Slot label + clear */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ color: 'var(--text-3)', fontSize: '9px', letterSpacing: '3px' }}>STOCK {i + 1}</div>
                {stocks[i] && (
                  <button onClick={() => removeStock(i)} style={{ background: 'none', border: 'none', color: 'var(--text-3)', fontFamily: 'IBM Plex Mono, monospace', fontSize: '9px', cursor: 'pointer', letterSpacing: '1px', padding: 0 }}>
                    ✕ CLEAR
                  </button>
                )}
              </div>

              {/* Search */}
              <form onSubmit={e => { e.preventDefault(); fetchStock(i, inputs[i]); }} style={{ display: 'flex', gap: '0' }}>
                <input
                  value={inputs[i]}
                  onChange={e => setInputs(prev => { const n = [...prev]; n[i] = e.target.value.toUpperCase(); return n; })}
                  style={{ flex: 1, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRight: 'none', color: 'var(--text)', fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', padding: '8px 10px', outline: 'none', letterSpacing: '2px' }}
                  placeholder="TICKER..."
                />
                <button type="submit"
                  style={{ padding: '8px 14px', background: 'var(--accent)', border: 'none', color: '#000', fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', fontWeight: 700, cursor: 'pointer', letterSpacing: '1px', whiteSpace: 'nowrap' }}>
                  {loading[i] ? '...' : 'ADD'}
                </button>
              </form>

              {/* Stock info */}
              {stocks[i] && (() => {
                const s = stocks[i];
                const sc = calcScore(s);
                const up = s.priceChangePct >= 0;
                return (
                  <>
                    {/* Logo + name + meta */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <img
                        src={logoUrl(s)}
                        alt=""
                        style={{ width: 36, height: 36, objectFit: 'contain', background: 'white', padding: 3, flexShrink: 0 }}
                        onError={e => e.target.style.display = 'none'}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: 700, letterSpacing: '2px' }}>{tickers[i]}</div>
                        <div style={{ fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                        <div style={{ fontSize: '9px', color: 'var(--text-3)', letterSpacing: '1px', marginTop: '2px' }}>
                          {s.exchange} · {s.sector}
                        </div>
                      </div>
                    </div>

                    {/* Price + sparkline */}
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '8px' }}>
                      <div>
                        <div style={{ fontSize: '22px', fontWeight: 600, letterSpacing: '-1px' }}>${s.currentPrice?.toFixed(2)}</div>
                        <div style={{ fontSize: '10px', color: up ? 'var(--green)' : 'var(--red)', marginTop: '2px', letterSpacing: '1px' }}>
                          {up ? '▲' : '▼'} {Math.abs(s.priceChangePct)?.toFixed(2)}% TODAY
                        </div>
                      </div>
                      {sparklines[i] && sparklines[i].length > 1 && (
                        <Sparkline data={sparklines[i]} width={90} height={36} />
                      )}
                    </div>

                    {/* Score strip */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1px', background: 'var(--border)', borderTop: '1px solid var(--border)', marginTop: '4px' }}>
                      {[
                        { label: 'CORE', val: sc.cbs },
                        { label: 'OPPO', val: sc.oppo },
                        { label: 'FINAL', val: sc.final },
                      ].map(({ label, val }) => (
                        <div key={label} style={{ background: 'var(--bg-2)', padding: '8px 10px', textAlign: 'center' }}>
                          <div style={{ fontSize: '8px', color: 'var(--text-3)', letterSpacing: '2px' }}>{label}</div>
                          <div style={{ fontSize: '16px', fontWeight: 700, letterSpacing: '-1px', marginTop: '3px', color: scoreColor(val) }}>
                            {val?.toFixed(1) || '—'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>
          ))}
        </div>

        {/* Comparison table */}
        {hasAny && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', tableLayout: 'fixed' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '8px 0', textAlign: 'left', fontWeight: 400, fontSize: '9px', color: 'var(--text-3)', width: '170px', letterSpacing: '1px' }}>METRIC</th>
                {Array.from({ length: N }, (_, i) => (
                  <th key={i} style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, fontSize: '11px', letterSpacing: '2px', color: stocks[i] ? 'var(--accent)' : 'var(--text-3)' }}>
                    {tickers[i] || `—`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {METRICS.map((m, idx) => {
                if (m.section) return (
                  <tr key={idx}>
                    <td colSpan={N + 1} style={{ padding: '14px 0 4px', color: 'var(--accent)', fontSize: '9px', letterSpacing: '3px', borderBottom: '1px solid var(--border)' }}>
                      {m.section}
                    </td>
                  </tr>
                );
                const winners = getWinners(m);
                return (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border)', background: idx % 2 === 0 ? 'transparent' : 'var(--bg-1)' }}>
                    <td style={{ padding: '7px 0', color: 'var(--text-3)', fontSize: '10px', fontWeight: m.bold ? 600 : 400 }}>{m.label}</td>
                    {Array.from({ length: N }, (_, i) => {
                      const isWinner = winners.includes(i) && stocks[i] !== null;
                      const color = stocks[i] && m.color ? m.color(stocks[i]) : 'var(--text)';
                      return (
                        <td key={i} style={{ padding: '7px 12px', textAlign: 'right', color: stocks[i] ? color : 'var(--text-3)', fontWeight: m.bold ? 700 : 400, fontSize: m.bold ? '13px' : '11px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', justifyContent: 'flex-end' }}>
                            {stocks[i] ? m.fn(stocks[i]) : '—'}
                            {isWinner && (
                              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, display: 'inline-block' }} title="Best" />
                            )}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {!hasAny && (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-3)', fontSize: '10px', letterSpacing: '3px' }}>
            ADD UP TO THREE TICKERS TO COMPARE
          </div>
        )}
      </div>
    </div>
  );
}