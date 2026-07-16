'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Sparkline from '../../Sparkline';
import { fmt, fmtN, fmtP as fmtPercent } from '../../../../lib/formatters';
import { useTickerSearch } from '../../../../lib/hooks/useTickerSearch';

const fmtP = (v) => fmtPercent(v, { decimals: 1 });

// Sticky right-hand cockpit — ported from the old standalone Radar page. Any list on
// Home (movers, sectors, baskets, calendar, insider activity...) calls onSelect(ticker)
// to pop a quick quote + Quality Score preview here without leaving the page.
export default function SpotlightPanel({ ticker, data, loading, sparkline, quality, onSelect, onClose, watchlistSet, onToggleWatchlist }) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const { suggestions } = useTickerSearch(searchQuery);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const handleSelect = (t) => {
    onSelect(t);
    setShowSuggestions(false);
    setSearchQuery('');
  };

  return (
    <>
      {ticker && (
        <div className="spotlight-backdrop" onClick={onClose} />
      )}

      <div className={`spotlight-panel ${ticker ? 'open' : ''}`}>
        {ticker ? (
          loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--ws-text-3)' }}>
              <div style={{ width: '30px', height: '30px', border: '2px solid var(--ws-accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spinLoader 1s linear infinite', marginBottom: '12px' }} />
              <div style={{ fontSize: '11px', fontWeight: 600 }}>SCANNING {ticker} METRICS…</div>
            </div>
          ) : data ? (
            <>
              {/* Header Info */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h2 style={{ fontSize: '20px', fontWeight: 900, margin: 0, color: 'var(--ws-text)' }}>{data.ticker}</h2>
                    <span style={{ fontSize: '9px', color: 'var(--ws-text-3)', background: 'var(--ws-bg-2)', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                      {data.exchange}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--ws-text-3)', margin: '4px 0 0 0', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {data.name}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  {/* Save Watchlist Icon Toggle */}
                  <button
                    onClick={() => onToggleWatchlist(data.ticker)}
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
                      color: watchlistSet.has(data.ticker) ? '#f59e0b' : 'var(--ws-text-3)',
                      transition: 'all 0.15s'
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill={watchlistSet.has(data.ticker) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  </button>
                  {/* Close Spotlight */}
                  <button
                    onClick={onClose}
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
                  <span style={{ fontSize: '20px', fontWeight: 800 }}>${data.currentPrice?.toFixed(2) || '—'}</span>
                  <span style={{ fontSize: '11px', fontWeight: 700, marginLeft: '8px', color: data.priceChangePct >= 0 ? 'var(--ws-accent)' : 'var(--ws-red)' }}>
                    {data.priceChangePct >= 0 ? '+' : ''}{data.priceChangePct?.toFixed(2)}%
                  </span>
                </div>
                {sparkline?.length > 1 && (
                  <Sparkline data={sparkline} width={75} height={25} />
                )}
              </div>

              {/* Quality Score — same block-bar treatment as the stock detail page */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--ws-border)', borderTop: '1px solid var(--ws-border)' }}>
                <div style={{ fontSize: '9px', fontWeight: 800, color: 'var(--ws-text-3)', letterSpacing: '1.5px', marginBottom: '8px' }}>QUALITY SCORE</div>
                {!quality ? (
                  <div style={{ fontSize: '10px', color: 'var(--ws-text-3)', textAlign: 'center', maxWidth: '160px', lineHeight: 1.5 }}>
                    No fundamentals reported yet.
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', color: quality.verdictColor, letterSpacing: '1.5px', lineHeight: 1 }}>
                        {'█'.repeat(Math.round(quality.score100 / 10))}{'░'.repeat(10 - Math.round(quality.score100 / 10))}
                      </span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '22px', fontWeight: 700, color: quality.verdictColor, lineHeight: 1 }}>
                        {quality.score100}
                      </span>
                    </div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', fontWeight: 700, color: quality.verdictColor, letterSpacing: '1px', marginTop: '4px' }}>
                      {quality.verdict.toUpperCase()}
                    </div>
                  </>
                )}
              </div>

              {/* Metrics Table */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Sector & Industry */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                  <span className="text-ws-text-3">Sector</span>
                  <span className="font-bold text-ws-text">{data.sector || '—'}</span>
                </div>

                {/* Valuation */}
                <div>
                  <div style={{ fontSize: '9px', fontWeight: 800, color: 'var(--ws-text-3)', letterSpacing: '1px', marginBottom: '6px' }}>VALUATION</div>
                  <div className="flex flex-col gap-1.5 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-ws-text-3">P/E Ratio</span>
                      <span className="font-bold">{fmtN(data.pe)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ws-text-3">P/FCF Ratio</span>
                      <span className="font-bold">{fmtN(data.pfcf)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ws-text-3">EV / EBITDA</span>
                      <span className="font-bold">{fmtN(data.evEbitda)}</span>
                    </div>
                  </div>
                </div>

                {/* Profitability */}
                <div>
                  <div style={{ fontSize: '9px', fontWeight: 800, color: 'var(--ws-text-3)', letterSpacing: '1px', marginBottom: '6px' }}>PROFITABILITY</div>
                  <div className="flex flex-col gap-1.5 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-ws-text-3">Gross Margin</span>
                      <span className="font-bold text-ws-accent">{fmtP(data.grossMargin)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ws-text-3">Operating Margin</span>
                      <span className="font-bold">{fmtP(data.opMargin)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ws-text-3">ROIC</span>
                      <span className="font-bold text-ws-accent">{fmtP(data.roic)}</span>
                    </div>
                  </div>
                </div>

                {/* Growth */}
                <div>
                  <div style={{ fontSize: '9px', fontWeight: 800, color: 'var(--ws-text-3)', letterSpacing: '1px', marginBottom: '6px' }}>GROWTH & LIQUIDITY</div>
                  <div className="flex flex-col gap-1.5 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-ws-text-3">YoY Growth</span>
                      <span className="font-bold text-ws-accent">+{fmtP(data.revGrowth)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ws-text-3">EPS CAGR (Est)</span>
                      <span className="font-bold">{data.epsCagr !== null ? `${data.epsCagr}%` : '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ws-text-3">Net Debt</span>
                      <span className="font-bold">{fmt(data.netDebt)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ws-text-3">Debt / Equity</span>
                      <span className="font-bold">{fmtN(data.debtToEquity)}x</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'auto', paddingTop: '10px' }}>
                <button
                  onClick={() => router.push(`/stock/${data.ticker}`)}
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
                    handleSelect(searchQuery);
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
                      onMouseDown={() => handleSelect(s.ticker)}
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
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
