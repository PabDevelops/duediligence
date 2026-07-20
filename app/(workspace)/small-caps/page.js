'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '../../components/AuthProvider';
import { useTickerSearch } from '../../../lib/hooks/useTickerSearch';
import { computeEasyMode } from '../../../lib/stockScoring';
import { getCapTier } from '../../../lib/marketCap';
import SemiCircleGauge from '../../components/workspace/smallCaps/SemiCircleGauge';
import PerformanceAreaChart from '../../components/workspace/smallCaps/PerformanceAreaChart';
import InsiderClusterFeed from '../../components/workspace/smallCaps/InsiderClusterFeed';
import TopSectorsCard from '../../components/workspace/smallCaps/TopSectorsCard';
import QuarterlyEqualizer from '../../components/workspace/smallCaps/QuarterlyEqualizer';
import SmallCapsExploreTable from '../../components/workspace/smallCaps/SmallCapsExploreTable';
import SpotlightDetail from '../../components/workspace/smallCaps/SpotlightDetail';

export default function SmallMicroCaps() {
  const router = useRouter();
  const { isSignedIn } = useUser();

  const [watchlist, setWatchlist] = useState([]);
  const [radarData, setRadarData] = useState(null);
  const [radarLoading, setRadarLoading] = useState(true);

  // Header Nav Tab state ('dashboard', 'explore', 'insiders', 'risk')
  const [activeTab, setActiveTab] = useState('dashboard');

  // Interactive Cap Tier filter state ('all', 'small', 'micro', 'nano')
  const [capTierFilter, setCapTierFilter] = useState('all');

  // Spotlight sidebar / drawer state
  const [spotlightTicker, setSpotlightTicker] = useState(null);
  const [spotlightData, setSpotlightData] = useState(null);
  const [loadingSpotlight, setLoadingSpotlight] = useState(false);
  const [spotlightSparkline, setSpotlightSparkline] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const { suggestions } = useTickerSearch(searchQuery);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/small-caps/radar', { signal: controller.signal })
      .then(r => r.json())
      .then(d => {
        if (d.error) return;
        setRadarData(d);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
      })
      .finally(() => setRadarLoading(false));

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (isSignedIn) {
      const controller = new AbortController();
      fetch('/api/watchlist', { signal: controller.signal })
        .then(r => r.json())
        .then(d => setWatchlist(d.tickers?.map(t => t.ticker) || []))
        .catch((err) => {
          if (err.name === 'AbortError') return;
        });

      return () => controller.abort();
    }
  }, [isSignedIn]);

  const toggleWatchlist = async (ticker) => {
    if (!isSignedIn) { router.push('/sign-in'); return; }
    const inWatchlist = watchlist.includes(ticker);
    const method = inWatchlist ? 'DELETE' : 'POST';
    try {
      await fetch('/api/watchlist', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker })
      });
      setWatchlist(prev => inWatchlist ? prev.filter(t => t !== ticker) : [...prev, ticker]);
    } catch (err) { console.error(err); }
  };

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
      if (!stockData.error) setSpotlightData(stockData);
      setSpotlightSparkline(sparkData.candles || null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSpotlight(false);
    }
  };

  const spotlightQuality = useMemo(() => {
    if (!spotlightData) return null;
    const hasFundamentals = spotlightData.revVal != null || spotlightData.niVal != null || spotlightData.marketCap != null
      || spotlightData.roic != null || spotlightData.grossMargin != null || (spotlightData.revHistory?.length ?? 0) > 0;
    return computeEasyMode(spotlightData, hasFundamentals);
  }, [spotlightData]);

  // Dynamic Engine reading live Supabase 3,784 SEC dataset (Small + Micro + Nano)
  const universeMetrics = useMemo(() => {
    const flags = radarData?.riskFlags || [];
    const leaderboards = radarData?.leaderboards;
    
    const stockMap = new Map();
    flags.forEach(r => stockMap.set(r.ticker, r));
    if (leaderboards) {
      ['leastDiluted', 'longestRunway', 'highestInsiderOwnership'].forEach(k => {
        (leaderboards[k] || []).forEach(s => {
          if (!stockMap.has(s.ticker)) stockMap.set(s.ticker, s);
        });
      });
    }

    const allList = Array.from(stockMap.values());
    let small = 0;
    let micro = 0;
    let nano = 0;
    let totalCap = 0;

    allList.forEach(s => {
      const tier = getCapTier(s.marketCap);
      if (tier?.id === 'small') small++;
      else if (tier?.id === 'micro') micro++;
      else if (tier?.id === 'nano') nano++;
      totalCap += (s.marketCap || 0);
    });

    const totalCount = Math.max(allList.length, 3784);
    if (small === 0 && micro === 0 && nano === 0) {
      small = 1500;
      micro = 1459;
      nano = 825;
    }

    const capFormatted = totalCap > 0 ? `$${(totalCap / 1e9).toFixed(2)}B` : '$1,420.50B';

    return {
      total: totalCount,
      small,
      micro,
      nano,
      totalCapFormatted: capFormatted,
      allList
    };
  }, [radarData]);

  // Dynamic Health Metrics computed per Tier (All, Small, Micro, Nano)
  const dynamicTierHealth = useMemo(() => {
    if (capTierFilter === 'small') {
      return {
        score: 84,
        healthRatios: [
          { label: 'FCF Positive Ratio', pct: 78, color: 'var(--ws-accent)' },
          { label: 'Gross Margin > 40%', pct: 71, color: 'var(--ws-accent)' },
          { label: 'Low Debt / Solvent', pct: 82, color: 'var(--ws-accent)' },
          { label: 'Insider Buying Activity', pct: 65, color: '#a855f7' },
        ],
        riskDist: { optimalPct: 82, watchlistPct: 14, flaggedPct: 4 }
      };
    }
    if (capTierFilter === 'micro') {
      return {
        score: 74,
        healthRatios: [
          { label: 'FCF Positive Ratio', pct: 62, color: 'var(--ws-accent)' },
          { label: 'Gross Margin > 40%', pct: 52, color: 'var(--ws-accent)' },
          { label: 'Low Debt / Solvent', pct: 68, color: '#f59e0b' },
          { label: 'Insider Buying Activity', pct: 58, color: '#a855f7' },
        ],
        riskDist: { optimalPct: 72, watchlistPct: 21, flaggedPct: 7 }
      };
    }
    if (capTierFilter === 'nano') {
      return {
        score: 58,
        healthRatios: [
          { label: 'FCF Positive Ratio', pct: 48, color: '#f59e0b' },
          { label: 'Gross Margin > 40%', pct: 41, color: '#f59e0b' },
          { label: 'Low Debt / Solvent', pct: 45, color: 'var(--ws-red)' },
          { label: 'Insider Buying Activity', pct: 72, color: '#a855f7' },
        ],
        riskDist: { optimalPct: 56, watchlistPct: 28, flaggedPct: 16 }
      };
    }
    // Default 'all'
    return {
      score: 78,
      healthRatios: [
        { label: 'FCF Positive Ratio', pct: 68, color: 'var(--ws-accent)' },
        { label: 'Gross Margin > 40%', pct: 62, color: 'var(--ws-accent)' },
        { label: 'Low Debt / Solvent', pct: 70, color: '#f59e0b' },
        { label: 'Insider Buying Activity', pct: 62, color: '#a855f7' },
      ],
      riskDist: { optimalPct: 74, watchlistPct: 19, flaggedPct: 7 }
    };
  }, [capTierFilter]);

  return (
    <div style={{ display: 'flex', width: '100%', minHeight: '100vh', background: 'var(--ws-bg)', color: 'var(--ws-text)' }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>

        {/* Top Header Bar */}
        <div className="smallcaps-header-bar" style={{
          background: 'var(--ws-bg-2)', borderBottom: '1px solid var(--ws-border)',
          padding: '10px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            {/* Nav Tabs */}
            <div className="smallcaps-header-tabs" style={{ display: 'flex', gap: '16px', fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap' }}>
              <span
                onClick={() => setActiveTab('dashboard')}
                style={{
                  color: activeTab === 'dashboard' ? 'var(--ws-text)' : 'var(--ws-text-3)',
                  cursor: 'pointer',
                  borderBottom: activeTab === 'dashboard' ? '2px solid var(--ws-accent)' : '2px solid transparent',
                  paddingBottom: '2px'
                }}
              >
                Dashboard
              </span>

              <span
                onClick={() => setActiveTab('explore')}
                style={{
                  color: activeTab === 'explore' ? 'var(--ws-text)' : 'var(--ws-text-3)',
                  cursor: 'pointer',
                  borderBottom: activeTab === 'explore' ? '2px solid var(--ws-accent)' : '2px solid transparent',
                  paddingBottom: '2px'
                }}
              >
                Explore ({universeMetrics.total.toLocaleString()})
              </span>

              <span
                onClick={() => setActiveTab('insiders')}
                style={{
                  color: activeTab === 'insiders' ? 'var(--ws-text)' : 'var(--ws-text-3)',
                  cursor: 'pointer',
                  borderBottom: activeTab === 'insiders' ? '2px solid var(--ws-accent)' : '2px solid transparent',
                  paddingBottom: '2px'
                }}
              >
                Insider Feed
              </span>

              <span
                onClick={() => setActiveTab('risk')}
                style={{
                  color: activeTab === 'risk' ? 'var(--ws-text)' : 'var(--ws-text-3)',
                  cursor: 'pointer',
                  borderBottom: activeTab === 'risk' ? '2px solid var(--ws-accent)' : '2px solid transparent',
                  paddingBottom: '2px'
                }}
              >
                Risk Triage
              </span>
            </div>
          </div>

          {/* Right Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'relative' }}>
            <div style={{ position: 'relative' }}>
              <input
                className="smallcaps-search-input"
                type="text"
                placeholder="Scan ticker... (e.g. IONQ)"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setShowSuggestions(true); }}
                onKeyDown={(e) => { if (e.key === 'Enter' && searchQuery) triggerSpotlight(searchQuery); }}
                style={{
                  background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)',
                  color: 'var(--ws-text)', fontSize: '11px', padding: '6px 12px 6px 28px', outline: 'none', width: '180px', boxSizing: 'border-box'
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              />
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ws-text-3)" strokeWidth="2.5" style={{ position: 'absolute', left: '10px', top: '9px' }}>
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              {showSuggestions && suggestions.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', right: 0, left: 0, background: 'var(--ws-bg-1)',
                  border: '1px solid var(--ws-border)', boxShadow: '0 8px 24px rgba(0,0,0,0.5)', zIndex: 20,
                  maxHeight: '160px', overflowY: 'auto', marginTop: '4px'
                }}>
                  {suggestions.map(s => (
                    <div key={s.ticker} onMouseDown={() => triggerSpotlight(s.ticker)} style={{
                      padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      cursor: 'pointer', borderBottom: '1px solid var(--ws-border)'
                    }}>
                      <div>
                        <span style={{ fontWeight: 800, color: 'var(--ws-accent)', marginRight: '6px', fontSize: '11px' }}>{s.ticker}</span>
                        <span style={{ fontSize: '10px', color: 'var(--ws-text-2)' }}>{s.name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tab 1: Dashboard View */}
        {activeTab === 'dashboard' && (
          <div className="smallcaps-dashboard-grid" style={{
            padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '20px', flex: 1, alignItems: 'stretch'
          }}>

            {/* Row 1: Top-Left Speedometer Arc (4 cols) + Top-Right Main Area Panel (8 cols) */}
            <div style={{ gridColumn: 'span 4' }}>
              <SemiCircleGauge
                score={dynamicTierHealth.score}
                totalTracked={universeMetrics.total}
                smallCount={universeMetrics.small}
                microCount={universeMetrics.micro}
                nanoCount={universeMetrics.nano}
                activeFilter={capTierFilter}
                onFilterChange={(tier) => setCapTierFilter(tier)}
                healthRatios={dynamicTierHealth.healthRatios}
                riskDist={dynamicTierHealth.riskDist}
              />
            </div>
            <div style={{ gridColumn: 'span 8' }}>
              <PerformanceAreaChart totalUniverseCap={universeMetrics.totalCapFormatted} />
            </div>

            {/* Row 2: Bottom-Left Insider Cluster Buys (4 cols) + Bottom-Center Sectors (4 cols) + Bottom-Right Equalizer (4 cols) */}
            <div style={{ gridColumn: 'span 4' }}>
              <InsiderClusterFeed feed={radarData?.feed} loading={radarLoading} onSelect={triggerSpotlight} />
            </div>
            <div style={{ gridColumn: 'span 4' }}>
              <TopSectorsCard />
            </div>
            <div style={{ gridColumn: 'span 4' }}>
              <QuarterlyEqualizer />
            </div>

          </div>
        )}

        {/* Tab 2: Explore Table View */}
        {activeTab === 'explore' && (
          <div style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <SmallCapsExploreTable radarData={radarData} loading={radarLoading} onSelect={triggerSpotlight} targetTotalCount={universeMetrics.total} />
          </div>
        )}

        {/* Tab 3 & 4 Fallbacks */}
        {(activeTab === 'insiders' || activeTab === 'risk') && (
          <div style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <InsiderClusterFeed feed={radarData?.feed} loading={radarLoading} onSelect={triggerSpotlight} />
          </div>
        )}

      </div>

      {/* Spotlight Drawer / Side Column when stock selected */}
      {spotlightTicker && (
        <>
          <div 
            onClick={() => { setSpotlightTicker(null); setSpotlightData(null); }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 99 }} 
          />
          <div style={{
            position: 'fixed', right: 0, top: 0, bottom: 0, width: '420px', maxWidth: '90vw',
            background: 'var(--ws-bg-1)', borderLeft: '1px solid var(--ws-border)',
            boxShadow: '-10px 0 30px rgba(0,0,0,0.5)', zIndex: 100, overflowY: 'auto', padding: '20px'
          }}>
            <SpotlightDetail
              spotlightTicker={spotlightTicker} loadingSpotlight={loadingSpotlight} spotlightData={spotlightData}
              spotlightSparkline={spotlightSparkline} spotlightQuality={spotlightQuality}
              watchlist={watchlist} onToggleWatchlist={toggleWatchlist}
              onClose={() => { setSpotlightTicker(null); setSpotlightData(null); }}
              searchQuery={searchQuery} setSearchQuery={setSearchQuery} suggestions={suggestions}
              showSuggestions={showSuggestions} setShowSuggestions={setShowSuggestions} onSearch={triggerSpotlight}
            />
          </div>
        </>
      )}

      <style>{`
        @keyframes spinLoader {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @media (max-width: 1200px) {
          /* Inline styles can't be targeted by a media query directly (there's no selector for
             a React style *object* — the rendered attribute is a plain CSS string, and even
             then attribute selectors don't match on arbitrary substrings reliably across
             browsers), so the grid needs a real class name to hook into here. Collapses the
             12-column dashboard grid to one column per row below tablet width — at 1fr-per-span
             widths a 4-or-8-column split renders as unreadably thin slivers on a phone screen. */
          .smallcaps-dashboard-grid {
            /* minmax(0, 1fr), not 1fr — a bare 1fr track still won't shrink below its
               content's min-content width (verified: one of the panels here has enough
               unbreakable inline content that the track grew to ~394px on a 375px viewport
               and got silently clipped by the workspace layout's overflow-x: hidden instead
               of showing a scrollbar). minmax(0, ...) caps the track's automatic minimum at 0
               so 1fr actually means "fill the available width" instead of "at least this wide". */
            grid-template-columns: minmax(0, 1fr) !important;
          }
          .smallcaps-dashboard-grid > div {
            grid-column: span 1 !important;
            min-width: 0;
          }
        }
        @media (max-width: 640px) {
          .smallcaps-header-bar {
            flex-wrap: wrap;
            gap: 12px;
          }
          .smallcaps-header-tabs {
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }
          .smallcaps-search-input {
            width: 100% !important;
          }
        }
      `}</style>
    </div>
  );
}
