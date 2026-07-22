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
import RiskTriage from '../../components/workspace/smallCaps/RiskTriage';
import TierMigrationPanel from '../../components/workspace/smallCaps/TierMigrationPanel';

// Mirrors app/api/small-caps/radar/route.js's buildHealthMetrics/buildRiskDistribution, but
// run client-side over whichever cap-tier slice of universeMetrics.allList is active — the
// API only ever computes these over the whole universe, which is why the gauge used to show
// the same numbers no matter which of ALL/SMALL/MICRO/NANO was selected.
const HEALTHY_GROSS_MARGIN_PCT = 40;

// Below this many reporting stocks, a ratio is too noisy to show as a percentage — real data
// showed cash-runway ratios computed over as few as 14 stocks (out of thousands tracked), where
// one company's earnings swinging the sample by a few points reads as a real universe-wide
// trend. Gates both the displayed % and the headline score's average, not just the display, so
// a low-n ratio can't quietly still move the score it's hidden from.
const MIN_HEALTH_SAMPLE = 20;

function computeHealthMetrics(rows) {
  const pct = (n, d) => (d > 0 ? +((n / d) * 100).toFixed(1) : null);
  const withFcf = rows.filter(s => s.fcfVal != null);
  const withGm = rows.filter(s => s.grossMargin != null);
  const withDebt = rows.filter(s => s.netDebt != null);
  const fcfPositive = withFcf.filter(s => s.fcfVal >= 0).length;
  const healthyGm = withGm.filter(s => s.grossMargin > HEALTHY_GROSS_MARGIN_PCT).length;
  const lowDebt = withDebt.filter(s => s.netDebt <= 0).length;
  return {
    fcfPositive: { pct: pct(fcfPositive, withFcf.length), n: withFcf.length, count: fcfPositive },
    healthyGrossMargin: { pct: pct(healthyGm, withGm.length), n: withGm.length, count: healthyGm },
    lowDebt: { pct: pct(lowDebt, withDebt.length), n: withDebt.length, count: lowDebt },
  };
}

function computeRiskDistribution(rows) {
  const total = rows.length;
  const pct = (n) => (total > 0 ? +((n / total) * 100).toFixed(1) : 0);
  const flagged = rows.filter(s => s.flagCount >= 2).length;
  const watchlist = rows.filter(s => s.flagCount === 1).length;
  const optimal = total - flagged - watchlist;
  return {
    flaggedPct: pct(flagged), flaggedCount: flagged,
    watchlistPct: pct(watchlist), watchlistCount: watchlist,
    optimalPct: pct(optimal), optimalCount: optimal,
    total,
  };
}

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

  // Dynamic Engine reading live Supabase small/micro/nano dataset. Sourced from
  // radarData.universe (every small/micro/nano ticker in stock_cache) rather than the
  // risk-flags/leaderboards union — that union only contains tickers with a computed
  // dilution/runway/ownership signal, which used to make this badge and the Explore tab
  // disagree wildly (badge showing the hardcoded 3,784 placeholder while Explore, built off
  // the same narrow union, listed barely a dozen).
  const universeMetrics = useMemo(() => {
    const universe = radarData?.universe;

    if (!universe || universe.length === 0) {
      // Loading, or before the first radar fetch resolves — placeholder so the dashboard
      // doesn't flash zeros; overwritten the moment real data arrives.
      return {
        total: 0, small: 0, micro: 0, nano: 0,
        smallCap: 0, microCap: 0, nanoCap: 0,
        totalCapFormatted: '$0', allList: [],
      };
    }

    let small = 0, micro = 0, nano = 0;
    let smallCap = 0, microCap = 0, nanoCap = 0;
    let totalCap = 0;

    universe.forEach(s => {
      const tier = getCapTier(s.marketCap);
      const cap = s.marketCap || 0;
      if (tier?.id === 'small') { small++; smallCap += cap; }
      else if (tier?.id === 'micro') { micro++; microCap += cap; }
      else if (tier?.id === 'nano') { nano++; nanoCap += cap; }
      totalCap += cap;
    });

    const capFormatted = totalCap > 0 ? `$${(totalCap / 1e9).toFixed(2)}B` : '$0';

    return {
      total: universe.length,
      small, micro, nano,
      smallCap, microCap, nanoCap,
      totalCapFormatted: capFormatted,
      allList: universe
    };
  }, [radarData]);

  // Health ratios + risk distribution, recomputed client-side over whichever cap-tier slice
  // is active (universeMetrics.allList already carries the per-row fcfVal/grossMargin/netDebt/
  // flagCount fields needed for this — see computeHealthMetrics/computeRiskDistribution above).
  // The API's own healthMetrics/riskDistribution (universe-wide) are left as the loading-state
  // fallback only, so the gauge shows *something* before the first radar fetch resolves.
  const gaugeData = useMemo(() => {
    const allRows = universeMetrics.allList;
    if (!allRows || allRows.length === 0) {
      return { score: 0, healthRatios: [], riskDist: { optimalPct: 0, watchlistPct: 0, flaggedPct: 0 } };
    }

    const rows = capTierFilter === 'all'
      ? allRows
      : allRows.filter(s => getCapTier(s.marketCap)?.id === capTierFilter);

    const hm = computeHealthMetrics(rows);
    const rd = computeRiskDistribution(rows);

    const events = radarData?.feed?.events || [];
    const tierEvents = capTierFilter === 'all' ? events : events.filter(e => e.cap_tier === capTierFilter);
    const insiderBuys = tierEvents.filter(e => e.type === 'BUY').length;
    hm.insiderBuying = {
      pct: tierEvents.length > 0 ? +((insiderBuys / tierEvents.length) * 100).toFixed(1) : null,
      n: tierEvents.length, count: insiderBuys,
    };

    const healthRatios = [
      { label: 'FCF Positive Ratio', pct: hm.fcfPositive.pct, n: hm.fcfPositive.n, count: hm.fcfPositive.count, color: 'var(--ws-accent)' },
      { label: 'Gross Margin > 40%', pct: hm.healthyGrossMargin.pct, n: hm.healthyGrossMargin.n, count: hm.healthyGrossMargin.count, color: 'var(--ws-accent)' },
      { label: 'Low Debt / Solvent', pct: hm.lowDebt.pct, n: hm.lowDebt.n, count: hm.lowDebt.count, color: '#f59e0b' },
      { label: 'Insider Buying Activity', pct: hm.insiderBuying.pct, n: hm.insiderBuying.n, count: hm.insiderBuying.count, color: '#a855f7' },
    ].map(r => (r.n < MIN_HEALTH_SAMPLE ? { ...r, pct: null } : r));

    // null (not 0) when every ratio is below MIN_HEALTH_SAMPLE — a segment with no reliable
    // data isn't the same thing as a segment that's actually unhealthy, and a numeric 0 next to
    // a red "WATCH" label reads as the latter (verified against real data: NANO's 13-17-stock
    // samples all fall under the floor, and 0/WATCH there looked like "nano caps are unhealthy"
    // rather than the true "we don't know yet").
    const available = healthRatios.filter(r => r.pct != null);
    const score = available.length > 0 ? Math.round(available.reduce((sum, r) => sum + r.pct, 0) / available.length) : null;

    return { score, healthRatios, riskDist: rd };
  }, [radarData, capTierFilter, universeMetrics.allList]);

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
                score={gaugeData.score}
                totalTracked={universeMetrics.total}
                smallCount={universeMetrics.small}
                microCount={universeMetrics.micro}
                nanoCount={universeMetrics.nano}
                activeFilter={capTierFilter}
                onFilterChange={(tier) => setCapTierFilter(tier)}
                healthRatios={gaugeData.healthRatios}
                riskDist={gaugeData.riskDist}
              />
            </div>
            <div style={{ gridColumn: 'span 8' }}>
              <PerformanceAreaChart
                totalCapFormatted={universeMetrics.totalCapFormatted}
                totalCount={universeMetrics.total}
                small={universeMetrics.small} micro={universeMetrics.micro} nano={universeMetrics.nano}
                smallCap={universeMetrics.smallCap} microCap={universeMetrics.microCap} nanoCap={universeMetrics.nanoCap}
                trackingSince={radarData?.trackingSince}
              />
            </div>

            {/* Row 2: Bottom-Left Insider Cluster Buys (4 cols) + Bottom-Center Sectors (4 cols) + Bottom-Right Equalizer (4 cols) */}
            <div style={{ gridColumn: 'span 4' }}>
              <InsiderClusterFeed feed={radarData?.feed} loading={radarLoading} onSelect={triggerSpotlight} />
            </div>
            <div style={{ gridColumn: 'span 4' }}>
              <TopSectorsCard sectorDistribution={radarData?.sectorDistribution} countryDistribution={radarData?.countryDistribution} loading={radarLoading} />
            </div>
            <div style={{ gridColumn: 'span 4' }}>
              <QuarterlyEqualizer fcfConsistency={radarData?.fcfConsistency} loading={radarLoading} />
            </div>

          </div>
        )}

        {/* Tab 2: Explore Table View */}
        {activeTab === 'explore' && (
          <div style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <SmallCapsExploreTable radarData={radarData} loading={radarLoading} onSelect={triggerSpotlight} targetTotalCount={universeMetrics.total} />
          </div>
        )}

        {/* Tab 3: Insider Feed */}
        {activeTab === 'insiders' && (
          <div style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <InsiderClusterFeed feed={radarData?.feed} loading={radarLoading} onSelect={triggerSpotlight} fullPage />
          </div>
        )}

        {/* Tab 4: Risk Triage */}
        {activeTab === 'risk' && (
          <div style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <RiskTriage riskFlags={radarData?.riskFlags} loading={radarLoading} onSelect={triggerSpotlight} fullPage />
            <TierMigrationPanel
              migrations={radarData?.migrations}
              trackingSince={radarData?.trackingSince}
              daysTracking={radarData?.trackingSince ? Math.floor((Date.now() - new Date(radarData.trackingSince)) / 86400000) : 0}
              loading={radarLoading}
              onSelect={triggerSpotlight}
            />
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
