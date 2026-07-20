'use client';
import { useState } from 'react';
import Sparkline from '../../Sparkline';
import ScoreGauge from './ScoreGauge';
import CompanySpiderChart from './CompanySpiderChart';
import { fmt, fmtP as fmtPercent, fmtN } from '../../../../lib/formatters';
import { openInNewTab } from '../../../../lib/openInNewTab';

const fmtP = (v) => fmtPercent(v, { decimals: 1 });

const PillMetricBar = ({ label, formattedValue, score = 50, benchmarkScore = 40, isAccent = false }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
      <span className="text-ws-text-3">{label}</span>
      <span className={`font-bold ${isAccent ? 'text-ws-accent' : 'text-ws-text'}`}>{formattedValue}</span>
    </div>
    <div style={{
      position: 'relative', width: '100%', height: '6px',
      background: 'var(--ws-bg-2)', border: '1px solid var(--ws-border)', overflow: 'hidden'
    }}>
      <div style={{
        height: '100%', width: `${Math.min(Math.max(score, 0), 100)}%`,
        background: isAccent ? 'var(--ws-accent)' : 'var(--ws-text-2)',
        transition: 'width 0.3s ease'
      }} />
      <div style={{
        position: 'absolute', top: 0, bottom: 0, left: `${Math.min(Math.max(benchmarkScore, 0), 100)}%`,
        width: '2px', background: '#f59e0b'
      }} title="Sector Goal / Median Benchmark" />
    </div>
  </div>
);

export default function SpotlightDetail({
  spotlightTicker, loadingSpotlight, spotlightData, spotlightSparkline, spotlightQuality,
  watchlist, onToggleWatchlist, onClose,
  searchQuery, setSearchQuery, suggestions, showSuggestions, setShowSuggestions, onSearch,
}) {
  const [peerQuery, setPeerQuery] = useState('');
  const [peerData, setPeerData] = useState(null);
  const [loadingPeer, setLoadingPeer] = useState(false);

  const handleComparePeer = async (tickerToCompare) => {
    const p = (tickerToCompare || peerQuery).toUpperCase().trim();
    if (!p) { setPeerData(null); return; }
    setLoadingPeer(true);
    try {
      const res = await fetch(`/api/stock?ticker=${p}`);
      const d = await res.json();
      if (!d.error) setPeerData(d);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingPeer(false);
    }
  };

  if (!spotlightTicker) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--ws-text-3)', textAlign: 'center', padding: '24px 10px', width: '100%', boxSizing: 'border-box' }}>
        <div style={{
          width: '80px', height: '80px', border: '1.5px dashed rgba(20, 184, 166, 0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px'
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--ws-accent)" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>
        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ws-text-2)', marginBottom: '6px' }}>Terminal Scan Idle</div>
        <div style={{ fontSize: '11px', lineHeight: 1.5, marginBottom: '14px' }}>
          Select any company from the radar or enter a ticker to analyze it with size-calibrated benchmarks and factor radar.
        </div>
        <div style={{ position: 'relative', width: '100%', maxWidth: '280px' }}>
          <input
            type="text"
            placeholder="Scan ticker... (e.g. IONQ)"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setShowSuggestions(true); }}
            onKeyDown={(e) => { if (e.key === 'Enter' && searchQuery) onSearch(searchQuery); }}
            style={{
              width: '100%', background: 'var(--ws-bg-2)', border: '1px solid var(--ws-border)',
              color: 'var(--ws-text)', fontSize: '12px', padding: '9px 12px 9px 32px', outline: 'none', boxSizing: 'border-box'
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          />
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ws-text-3)" strokeWidth="2.5" style={{ position: 'absolute', left: '10px', top: '12px' }}>
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          {showSuggestions && suggestions.length > 0 && (
            <div style={{
              position: 'absolute', bottom: '42px', left: 0, right: 0, background: 'var(--ws-bg-1)',
              border: '1px solid var(--ws-border)', boxShadow: '0 -10px 25px rgba(0,0,0,0.5)', zIndex: 10,
              maxHeight: '160px', overflowY: 'auto'
            }}>
              {suggestions.map(s => (
                <div key={s.ticker} onMouseDown={() => onSearch(s.ticker)} style={{
                  padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  cursor: 'pointer', borderBottom: '1px solid var(--ws-border)', textAlign: 'left'
                }}>
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
    );
  }

  if (loadingSpotlight) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--ws-text-3)', padding: '40px 0' }}>
        <div style={{ width: '30px', height: '30px', border: '2px solid var(--ws-accent)', borderTopColor: 'transparent', animation: 'spinLoader 1s linear infinite', marginBottom: '12px' }} />
        <div style={{ fontSize: '11px', fontWeight: 600 }}>SCANNING {spotlightTicker} METRICS…</div>
      </div>
    );
  }

  if (!spotlightData) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--ws-text-3)', fontSize: '11px', textAlign: 'center', padding: '40px 0' }}>
        Ticker failed to load. Please try checking another stock.
      </div>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 900, margin: 0, color: 'var(--ws-text)' }}>{spotlightData.ticker}</h2>
            <span style={{ fontSize: '9px', color: 'var(--ws-text-3)', background: 'var(--ws-bg-2)', padding: '2px 6px', fontWeight: 700 }}>
              {spotlightData.exchange}
            </span>
            {spotlightQuality?.capTier && (
              <span style={{
                fontSize: '9px', fontWeight: 800, padding: '2px 7px',
                color: spotlightQuality.capTier.color, background: 'var(--ws-bg-2)', border: `1px solid ${spotlightQuality.capTier.color}`
              }}>
                {spotlightQuality.capTier.label.toUpperCase()}
              </span>
            )}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--ws-text-3)', margin: '4px 0 0 0', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
            {spotlightData.name}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={() => onToggleWatchlist(spotlightData.ticker)} style={{
            background: 'var(--ws-bg-2)', border: '1px solid var(--ws-border)',
            width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: watchlist.includes(spotlightData.ticker) ? '#f59e0b' : 'var(--ws-text-3)'
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill={watchlist.includes(spotlightData.ticker) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </button>
          <button onClick={onClose} style={{
            background: 'var(--ws-bg-2)', border: '1px solid var(--ws-border)',
            width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--ws-text-2)', fontWeight: 800
          }}>
            ✕
          </button>
        </div>
      </div>

      <div style={{ background: 'var(--ws-bg-2)', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: '20px', fontWeight: 800 }}>${spotlightData.currentPrice?.toFixed(2) || '—'}</span>
          <span style={{ fontSize: '11px', fontWeight: 700, marginLeft: '8px', color: spotlightData.priceChangePct >= 0 ? 'var(--ws-accent)' : 'var(--ws-red)' }}>
            {spotlightData.priceChangePct >= 0 ? '+' : ''}{spotlightData.priceChangePct?.toFixed(2)}%
          </span>
        </div>
        {spotlightSparkline?.length > 1 && <Sparkline data={spotlightSparkline} width={75} height={25} />}
      </div>

      {/* Size-calibrated Quality Score & Spider Radar Chart */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 0 4px', borderBottom: '1px solid var(--ws-border)', borderTop: '1px solid var(--ws-border)', gap: '8px' }}>
        <div style={{ fontSize: '9px', fontWeight: 800, color: 'var(--ws-text-3)', letterSpacing: '1.5px' }}>
          QUALITY SCORE {spotlightQuality?.capTier ? `(${spotlightQuality.capTier.short.toUpperCase()}-CAP CALIBRATED)` : ''}
        </div>
        {!spotlightQuality ? (
          <div style={{ fontSize: '10px', color: 'var(--ws-text-3)', textAlign: 'center', maxWidth: '160px', lineHeight: 1.5, padding: '10px 0' }}>
            No fundamentals reported yet.
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <ScoreGauge score={spotlightQuality.score100} color={spotlightQuality.verdictColor} />
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', fontWeight: 700, color: spotlightQuality.verdictColor, letterSpacing: '1px', marginTop: '-6px' }}>
                {spotlightQuality.verdict.toUpperCase()}
              </div>
            </div>
          </div>
        )}

        <div style={{ width: '100%', marginTop: '4px' }}>
          <CompanySpiderChart spotlightData={spotlightData} peerData={peerData} peerTicker={peerData?.ticker} height={210} />
        </div>

        {/* Peer Comparison Selector */}
        <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 0 8px' }}>
          <input
            type="text"
            placeholder="Compare peer (e.g. RDW)..."
            value={peerQuery}
            onChange={e => setPeerQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleComparePeer(); }}
            style={{
              flex: 1, background: 'var(--ws-bg-2)', border: '1px solid var(--ws-border)',
              color: 'var(--ws-text)', fontSize: '10px', padding: '4px 10px', outline: 'none'
            }}
          />
          <button
            onClick={() => handleComparePeer()}
            disabled={loadingPeer}
            style={{
              background: 'var(--ws-bg-2)', border: '1px solid var(--ws-border)',
              padding: '4px 10px', fontSize: '10px', fontWeight: 700, color: '#f59e0b', cursor: 'pointer'
            }}
          >
            {peerData ? 'Clear' : 'Compare'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
          <span className="text-ws-text-3">Sector</span>
          <span className="font-bold text-ws-text">{spotlightData.sector || '—'}</span>
        </div>

        <div>
          <div style={{ fontSize: '9px', fontWeight: 800, color: 'var(--ws-text-3)', letterSpacing: '1px', marginBottom: '8px' }}>VALUATION</div>
          <div className="flex flex-col gap-2.5">
            <PillMetricBar label="P/E Ratio" formattedValue={fmtN(spotlightData.pe)} score={spotlightData.pe ? Math.max(100 - spotlightData.pe * 2, 0) : 50} benchmarkScore={45} />
            <PillMetricBar label="P/FCF Ratio" formattedValue={fmtN(spotlightData.pfcf)} score={spotlightData.pfcf ? Math.max(100 - spotlightData.pfcf * 2, 0) : 50} benchmarkScore={40} />
            <PillMetricBar label="EV / EBITDA" formattedValue={fmtN(spotlightData.evEbitda)} score={spotlightData.evEbitda ? Math.max(100 - spotlightData.evEbitda * 3, 0) : 50} benchmarkScore={50} />
          </div>
        </div>

        <div>
          <div style={{ fontSize: '9px', fontWeight: 800, color: 'var(--ws-text-3)', letterSpacing: '1px', marginBottom: '8px' }}>PROFITABILITY (VS SECTOR)</div>
          <div className="flex flex-col gap-2.5">
            <PillMetricBar label="Gross Margin" formattedValue={fmtP(spotlightData.grossMargin)} score={(spotlightData.grossMargin || 0) * 1.2} benchmarkScore={45} isAccent={true} />
            <PillMetricBar label="Operating Margin" formattedValue={fmtP(spotlightData.opMargin)} score={(spotlightData.opMargin || 0) * 2.5} benchmarkScore={35} />
            <PillMetricBar label="ROIC" formattedValue={fmtP(spotlightData.roic)} score={(spotlightData.roic || 0) * 4} benchmarkScore={40} isAccent={true} />
          </div>
        </div>

        <div>
          <div style={{ fontSize: '9px', fontWeight: 800, color: 'var(--ws-text-3)', letterSpacing: '1px', marginBottom: '8px' }}>GROWTH, RISK & LIQUIDITY</div>
          <div className="flex flex-col gap-2.5">
            <PillMetricBar label="YoY Growth" formattedValue={`+${fmtP(spotlightData.revGrowth)}`} score={((spotlightData.revGrowth || 0) + 10) * 2.5} benchmarkScore={35} isAccent={true} />
            <PillMetricBar label="Beta (Volatility)" formattedValue={fmtN(spotlightData.beta, 2)} score={100 - ((spotlightData.beta || 1) * 40)} benchmarkScore={60} />
            <PillMetricBar label="Debt / Equity" formattedValue={`${fmtN(spotlightData.debtToEquity)}x`} score={100 - ((spotlightData.debtToEquity || 1) * 30)} benchmarkScore={50} />
          </div>
        </div>

      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'auto', paddingTop: '10px' }}>
        <button onClick={() => openInNewTab(`/stock/${spotlightData.ticker}`)} style={{
          width: '100%', background: 'var(--ws-text)', color: 'var(--ws-bg)', border: 'none',
          fontWeight: 700, fontSize: '12px', padding: '10px 12px', cursor: 'pointer'
        }}>
          Open Analysis Terminal →
        </button>
      </div>
    </>
  );
}
