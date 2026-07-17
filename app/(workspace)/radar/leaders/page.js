'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '../../../components/AuthProvider';
import Sparkline from '../../../components/Sparkline';

// Utility formatters and hooks
import { fmt, fmtP as fmtPercent, fmtN } from '../../../../lib/formatters';
import { useTickerSearch } from '../../../../lib/hooks/useTickerSearch';
import { computeEasyMode } from '../../../../lib/stockScoring';

const fmtP = (v) => fmtPercent(v, { decimals: 1 });

export default function LeadersPage() {
  const router = useRouter();
  const { isSignedIn } = useUser();
  
  // Data State
  const [moversData, setMoversData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [watchlist, setWatchlist] = useState([]);
  
  // Interactive UI State - default sorting by 'score' desc
  const [sortKey, setSortKey] = useState('score');
  const [sortDir, setSortDir] = useState('desc');
  const [filterQuery, setFilterQuery] = useState('');
  
  // Spotlight Sidebar State
  const [spotlightTicker, setSpotlightTicker] = useState(null);
  const [spotlightData, setSpotlightData] = useState(null);
  const [loadingSpotlight, setLoadingSpotlight] = useState(false);
  const [spotlightSparkline, setSpotlightSparkline] = useState(null);
  
  // Search state inside spotlight idle view
  const [searchQuery, setSearchQuery] = useState('');
  const { suggestions } = useTickerSearch(searchQuery);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Fetch Full Leaderboards
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/movers?full=true');
        const data = await res.json();
        setMoversData(data);
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
        .catch(() => {});
    }
  }, [isSignedIn]);

  // Spotlight triggering logic
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

  // Compute local Traqcker Score 100 for Spotlight details
  const spotlightQuality = useMemo(() => {
    if (!spotlightData) return null;
    const hasFundamentals = spotlightData.revVal != null || spotlightData.niVal != null || spotlightData.marketCap != null
      || spotlightData.roic != null || spotlightData.grossMargin != null || (spotlightData.revHistory?.length ?? 0) > 0;
    return computeEasyMode(spotlightData, hasFundamentals);
  }, [spotlightData]);

  // Sort and Filter active list
  const leadersList = useMemo(() => {
    if (!moversData || !moversData.leaders) return [];
    
    // 1. Client-side text filtering
    let list = [...moversData.leaders];
    if (filterQuery) {
      const query = filterQuery.toLowerCase();
      list = list.filter(s => 
        s.ticker.toLowerCase().includes(query) || 
        (s.name || '').toLowerCase().includes(query) ||
        (s.sector || '').toLowerCase().includes(query)
      );
    }

    // 2. Sort by active key
    list.sort((a, b) => {
      const valA = a[sortKey] ?? -Infinity;
      const valB = b[sortKey] ?? -Infinity;
      
      if (sortDir === 'desc') {
        return valB - valA;
      } else {
        return valA - valB;
      }
    });

    // 3. Slice top 100
    return list.slice(0, 100);
  }, [moversData, sortKey, sortDir, filterQuery]);

  // Handle Sort Change
  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const renderSortArrow = (key) => {
    if (sortKey !== key) return null;
    return sortDir === 'desc' ? ' ▼' : ' ▲';
  };

  return (
    <div style={{ display: 'flex', width: '100%', minHeight: '100vh', background: 'var(--ws-bg)', color: 'var(--ws-text)', fontFamily: 'Inter, sans-serif' }}>
      
      {/* Main Content Area */}
      <div style={{ flex: 1, minWidth: 0, padding: '24px', boxSizing: 'border-box', overflowY: 'auto' }}>
        
        {/* Back Link & Header */}
        <div style={{ marginBottom: '24px' }}>
          <Link href="/radar" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: 'var(--ws-accent)', textDecoration: 'none', marginBottom: '14px', letterSpacing: '0.5px' }}>
            ← BACK TO RADAR
          </Link>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: 900, margin: 0, letterSpacing: '-0.5px' }}>Fundamental Leaderboard (Top 100)</h1>
              <p style={{ fontSize: '13px', color: 'var(--ws-text-3)', margin: '6px 0 0 0', maxWidth: '640px', lineHeight: 1.5 }}>
                Unified rankings based on institutional quality algorithms. Click column headers to sort by Traqcker Score, Core Business (CBS), Opportunity (Oppo), or Growth Quality (GQS).
              </p>
            </div>
            
            {/* Local List Filter */}
            <div style={{ position: 'relative', width: '220px' }}>
              <input
                type="text"
                placeholder="Filter leaderboard..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--ws-bg-1)',
                  border: '1px solid var(--ws-border)',
                  borderRadius: '6px',
                  color: 'var(--ws-text)',
                  fontSize: '12px',
                  padding: '8px 12px 8px 30px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ws-text-3)" strokeWidth="2.5" style={{ position: 'absolute', left: '10px', top: '11px' }}>
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
          </div>
        </div>

        {/* Table Container */}
        <div style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--ws-text-3)' }}>
              <div style={{ width: '32px', height: '32px', border: '2px solid var(--ws-accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spinLoader 1s linear infinite', margin: '0 auto 16px' }} />
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', letterSpacing: '1px' }}>COMPILING FULL DATASET...</div>
            </div>
          ) : leadersList.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ws-text-3)', fontSize: '13px' }}>
              No matches found on this leaderboard.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--ws-bg-2)', borderBottom: '1px solid var(--ws-border)' }}>
                    <th style={{ padding: '12px 16px', fontWeight: 800, fontSize: '10px', color: 'var(--ws-text-3)', width: '60px' }}>RANK</th>
                    <th style={{ padding: '12px 16px', fontWeight: 800, fontSize: '10px', color: 'var(--ws-text-3)' }}>TICKER / COMPANY</th>
                    <th style={{ padding: '12px 16px', fontWeight: 800, fontSize: '10px', color: 'var(--ws-text-3)' }}>SECTOR</th>
                    
                    {/* Sortable Column Headers */}
                    <th 
                      onClick={() => handleSort('score')} 
                      style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, fontSize: '10px', color: sortKey === 'score' ? 'var(--ws-accent)' : 'var(--ws-text-3)', cursor: 'pointer', userSelect: 'none', width: '130px' }}
                    >
                      TRAQCKER SCORE{renderSortArrow('score')}
                    </th>
                    <th 
                      onClick={() => handleSort('cbs')} 
                      style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, fontSize: '10px', color: sortKey === 'cbs' ? 'var(--ws-accent)' : 'var(--ws-text-3)', cursor: 'pointer', userSelect: 'none', width: '120px' }}
                    >
                      QUALITY (CBS){renderSortArrow('cbs')}
                    </th>
                    <th 
                      onClick={() => handleSort('oppo')} 
                      style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, fontSize: '10px', color: sortKey === 'oppo' ? 'var(--ws-accent)' : 'var(--ws-text-3)', cursor: 'pointer', userSelect: 'none', width: '120px' }}
                    >
                      OPPORTUNITY{renderSortArrow('oppo')}
                    </th>
                    <th 
                      onClick={() => handleSort('gqs')} 
                      style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, fontSize: '10px', color: sortKey === 'gqs' ? 'var(--ws-accent)' : 'var(--ws-text-3)', cursor: 'pointer', userSelect: 'none', width: '120px' }}
                    >
                      GROWTH (GQS){renderSortArrow('gqs')}
                    </th>
                    
                    <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, fontSize: '10px', color: 'var(--ws-text-3)', width: '100px' }}>ROIC</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, fontSize: '10px', color: 'var(--ws-text-3)', width: '100px' }}>FCF YIELD</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, fontSize: '10px', color: 'var(--ws-text-3)', width: '100px' }}>REV GROWTH</th>
                  </tr>
                </thead>
                <tbody>
                  {leadersList.map((s, index) => {
                    const isSelected = spotlightTicker === s.ticker;
                    return (
                      <tr
                        key={s.ticker}
                        onClick={() => triggerSpotlight(s.ticker)}
                        style={{
                          cursor: 'pointer',
                          background: isSelected ? 'var(--ws-bg-2)' : (index % 2 === 0 ? 'var(--ws-bg-1)' : 'rgba(255,255,255,0.015)'),
                          borderBottom: '1px solid var(--ws-border)',
                          transition: 'background 0.15s ease'
                        }}
                        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--ws-bg-2)'; }}
                        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = index % 2 === 0 ? 'var(--ws-bg-1)' : 'rgba(255,255,255,0.015)'; }}
                      >
                        <td style={{ padding: '12px 16px', fontWeight: 800, color: index < 3 ? 'var(--ws-accent)' : 'var(--ws-text-3)' }}>
                          #{index + 1}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ fontWeight: 800, color: 'var(--ws-text)', marginRight: '8px' }}>{s.ticker}</span>
                          <span style={{ color: 'var(--ws-text-2)', fontSize: '12px' }}>{s.name || '—'}</span>
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--ws-text-2)', fontSize: '12px' }}>
                          {s.sector || '—'}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: 'var(--ws-accent)' }}>
                          {s.score ? `${Math.round(s.score * 20)}/100` : '—'}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--ws-text)' }}>
                          {s.cbs ? `${Math.round(s.cbs * 20)}/100` : '—'}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--ws-text)' }}>
                          {s.oppo ? `${Math.round(s.oppo * 20)}/100` : '—'}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--ws-text)' }}>
                          {s.gqs ? `${Math.round(s.gqs * 20)}/100` : '—'}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: s.roic > 20 ? 'var(--ws-accent)' : 'var(--ws-text-2)' }}>
                          {fmtP(s.roic)}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: s.fcfYield > 8 ? 'var(--ws-accent)' : 'var(--ws-text-2)' }}>
                          {fmtP(s.fcfYield)}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: s.revGrowth > 25 ? 'var(--ws-accent)' : 'var(--ws-text-2)' }}>
                          {s.revGrowth != null ? `+${fmtP(s.revGrowth)}` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Right Spotlight Panel Backdrop on Mobile */}
      {spotlightTicker && (
        <div className="radar-spotlight-backdrop" onClick={() => { setSpotlightTicker(null); setSpotlightData(null); }} />
      )}

      {/* Right Spotlight Panel (Cockpit sidebar) */}
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

              {/* Quality Score Bar */}
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

                {/* Growth & Liquidity */}
                <div>
                  <div style={{ fontSize: '9px', fontWeight: 800, color: 'var(--ws-text-3)', letterSpacing: '1px', marginBottom: '6px' }}>GROWTH & LIQUIDITY</div>
                  <div className="flex flex-col gap-1.5 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-ws-text-3">YoY Growth</span>
                      <span className="font-bold text-ws-accent">+{fmtP(spotlightData.revGrowth)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ws-text-3">EPS CAGR (Est)</span>
                      <span className="font-bold">{spotlightData.epsCagrEst != null ? `${spotlightData.epsCagrEst}%` : '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ws-text-3">Net Debt</span>
                      <span className="font-bold">{spotlightData.netDebt != null ? `$${fmt(spotlightData.netDebt)}` : '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ws-text-3">Debt / Equity</span>
                      <span className="font-bold">{spotlightData.debtToEquity != null ? `${spotlightData.debtToEquity.toFixed(2)}x` : '—'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div style={{ marginTop: 'auto', paddingTop: '16px' }}>
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
              Select any company from the list to analyze metrics inside this cockpit.
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
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ws-text-3)" strokeWidth="2.5" style={{ position: 'absolute', left: '10px', top: '12px' }}>
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>

              {/* Suggestions Dropdown */}
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
        @keyframes spinLoader {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
