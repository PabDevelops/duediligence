'use client';
import { useState, useEffect, useMemo } from 'react';
import { fmt, fmtP as fmtPercent } from '../../../../lib/formatters';
const fmtP = (v) => fmtPercent(v, { decimals: 1 });

// Curated thematic/industry baskets — originally from the standalone Explore page, then
// carried into the standalone Radar page, now folded into Home. Explore's other categories
// (market movers, high/low P/E, volatility, upcoming earnings, watchlist) were cut entirely:
// movers and fundamentals already have dedicated tabs right here, and the dynamic screens
// duplicated what the Screener page does properly. These curated collections were the one
// thing Explore had that nothing else in the app covers.
const THEME_CATEGORIES = [
  { id: 'bigtech', label: 'Big Tech' },
  { id: 'ai', label: 'AI & Semiconductors' },
  { id: 'defence', label: 'Defence' },
  { id: 'quantum', label: 'Quantum Computing' },
  { id: 'evs', label: 'EVs' },
  { id: 'banks', label: 'Banks & Financials' },
  { id: 'dividends', label: 'Dividend Aristocrats' },
  { id: 'cybersecurity', label: 'Cybersecurity' },
  { id: 'biotech', label: 'Biotech & Drugs' },
  { id: 'energy', label: 'Oil & Gas' },
];

const INDUSTRY_CATEGORIES = [
  { id: 'bigpharma', label: 'Big Pharma' },
  { id: 'reit', label: 'REIT' },
  { id: 'airlines', label: 'Airlines' },
  { id: 'automotive', label: 'Automotive' },
  { id: 'chipmakers', label: 'Chipmakers' },
  { id: 'insurance', label: 'Insurance Giants' },
  { id: 'hotels', label: 'Hotels' },
  { id: 'restaurants', label: 'Restaurants' },
  { id: 'regionalbanks', label: 'Regional Banks' },
  { id: 'mining', label: 'Mining Prospects' },
  { id: 'chemicals', label: 'Chemical Manufacturing' },
  { id: 'railroads', label: 'Railroads' },
  { id: 'motionpictures', label: 'Motion Pictures' },
  { id: 'broadcasting', label: 'Broadcasting & Cable' },
  { id: 'grocery', label: 'Grocery Stores' },
  { id: 'footwear', label: 'Footwear' },
  { id: 'fashion', label: 'Fashion' },
  { id: 'robotics', label: 'Robotics' },
  { id: 'crypto', label: 'Crypto & Blockchain' },
  { id: 'spac', label: 'SPAC-Born' },
];

export default function MarketDiscovery({ movers, watchlistSet, onToggleWatchlist, onSelectTicker }) {
  // Tab control
  const [activeTab, setActiveTab] = useState('movers'); // 'movers' | 'fundamentals' | 'baskets'

  // Baskets tab state — fetched lazily per category, cached so re-selecting is instant
  const [basketCategory, setBasketCategory] = useState('bigtech');
  const [basketCache, setBasketCache] = useState({});
  const [loadingBasket, setLoadingBasket] = useState(false);

  // Load the selected basket, on demand, once per category
  useEffect(() => {
    if (activeTab !== 'baskets' || basketCache[basketCategory]) return;
    setLoadingBasket(true);
    fetch(`/api/explore?category=${basketCategory}`)
      .then(r => r.json())
      .then(data => {
        setBasketCache(prev => ({ ...prev, [basketCategory]: data.stocks || [] }));
        // Seed any tickers the cache didn't have yet, same on-demand pattern the ETF
        // screener's search bar uses — next visit to this category will show them.
        (data.missing || []).forEach(ticker => { fetch(`/api/stock?ticker=${ticker}`).catch(() => {}); });
      })
      .catch(() => setBasketCache(prev => ({ ...prev, [basketCategory]: [] })))
      .finally(() => setLoadingBasket(false));
  }, [activeTab, basketCategory, basketCache]);

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Sectors performance matrix */}
      {sectorPulse.length > 0 && (
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
                    <span>Top: <b style={{ cursor: 'pointer', color: 'var(--ws-text-2)' }} onClick={() => onSelectTicker(sec.topStock)}>{sec.topStock}</b></span>
                    <span style={{ color: sec.topChange >= 0 ? 'var(--ws-accent)' : 'var(--ws-red)' }}>
                      {sec.topChange >= 0 ? '+' : '-'}{Math.abs(sec.topChange).toFixed(1)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab Selector */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--ws-border)', gap: '16px' }}>
        <button
          onClick={() => setActiveTab('movers')}
          style={{
            background: 'none', border: 'none',
            borderBottom: activeTab === 'movers' ? '2.5px solid var(--ws-accent)' : '2.5px solid transparent',
            color: activeTab === 'movers' ? 'var(--ws-text)' : 'var(--ws-text-3)',
            padding: '8px 12px 10px', fontWeight: 800, fontSize: '12px', cursor: 'pointer', transition: 'all 0.15s'
          }}
        >
          DAILY MOVERS PULSE
        </button>
        <button
          onClick={() => setActiveTab('fundamentals')}
          style={{
            background: 'none', border: 'none',
            borderBottom: activeTab === 'fundamentals' ? '2.5px solid var(--ws-accent)' : '2.5px solid transparent',
            color: activeTab === 'fundamentals' ? 'var(--ws-text)' : 'var(--ws-text-3)',
            padding: '8px 12px 10px', fontWeight: 800, fontSize: '12px', cursor: 'pointer', transition: 'all 0.15s'
          }}
        >
          FUNDAMENTAL LEADERS
        </button>
        <button
          onClick={() => setActiveTab('baskets')}
          style={{
            background: 'none', border: 'none',
            borderBottom: activeTab === 'baskets' ? '2.5px solid var(--ws-accent)' : '2.5px solid transparent',
            color: activeTab === 'baskets' ? 'var(--ws-text)' : 'var(--ws-text-3)',
            padding: '8px 12px 10px', fontWeight: 800, fontSize: '12px', cursor: 'pointer', transition: 'all 0.15s'
          }}
        >
          BASKETS
        </button>
      </div>

      {/* Data Cards Grid */}
      {activeTab === 'baskets' ? (
        <div>
          {/* Category pills — two labeled groups, thematic then industry */}
          {[
            { title: 'THEMATIC', items: THEME_CATEGORIES },
            { title: 'INDUSTRIES', items: INDUSTRY_CATEGORIES },
          ].map(group => (
            <div key={group.title} style={{ marginBottom: '10px' }}>
              <div style={{ fontSize: '9px', fontWeight: 800, color: 'var(--ws-text-3)', letterSpacing: '1.5px', marginBottom: '6px' }}>
                {group.title}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {group.items.map(cat => (
                  <button key={cat.id} onClick={() => setBasketCategory(cat.id)}
                    style={{
                      padding: '5px 10px',
                      fontSize: '11px',
                      fontWeight: basketCategory === cat.id ? 700 : 500,
                      background: basketCategory === cat.id ? 'var(--ws-accent-dim)' : 'var(--ws-bg-1)',
                      border: '1px solid ' + (basketCategory === cat.id ? 'var(--ws-accent)' : 'var(--ws-border)'),
                      color: basketCategory === cat.id ? 'var(--ws-accent)' : 'var(--ws-text-2)',
                      cursor: 'pointer',
                    }}>
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* Basket results table */}
          <div className="bg-ws-bg-1 border border-ws-border overflow-hidden" style={{ marginTop: '14px' }}>
            {loadingBasket ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ws-text-3)', fontSize: '11px' }}>
                LOADING…
              </div>
            ) : (basketCache[basketCategory] || []).length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ws-text-3)', fontSize: '12px' }}>
                No data available for this basket yet.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--ws-bg-2)' }}>
                    <th style={{ padding: '10px 16px', fontWeight: 700, fontSize: '10px', color: 'var(--ws-text-3)', borderBottom: '2px solid var(--ws-border)' }}>NAME</th>
                    <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, fontSize: '10px', color: 'var(--ws-text-3)', borderBottom: '2px solid var(--ws-border)' }}>PRICE</th>
                    <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, fontSize: '10px', color: 'var(--ws-text-3)', borderBottom: '2px solid var(--ws-border)' }}>CHANGE</th>
                    <th style={{ padding: '10px 16px', width: '40px', borderBottom: '2px solid var(--ws-border)' }} />
                  </tr>
                </thead>
                <tbody>
                  {basketCache[basketCategory].map((s, idx) => {
                    const isUp = s.priceChangePct != null && s.priceChangePct >= 0;
                    const inWatchlist = watchlistSet.has(s.ticker);
                    return (
                      <tr key={s.ticker} onClick={() => onSelectTicker(s.ticker)}
                        style={{ cursor: 'pointer', background: idx % 2 === 0 ? 'var(--ws-bg-1)' : 'var(--ws-bg-2)', borderBottom: '1px solid var(--ws-border)' }}>
                        <td style={{ padding: '10px 16px' }}>
                          <span style={{ fontWeight: 800, color: 'var(--ws-text)', marginRight: '8px' }}>{s.ticker}</span>
                          <span style={{ color: 'var(--ws-text-2)', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                        </td>
                        <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--ws-text)' }}>
                          {s.currentPrice != null ? `$${s.currentPrice.toFixed(2)}` : '—'}
                        </td>
                        <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: s.priceChangePct == null ? 'var(--ws-text-3)' : isUp ? 'var(--ws-accent)' : 'var(--ws-red)' }}>
                          {s.priceChangePct != null ? `${isUp ? '+' : ''}${s.priceChangePct.toFixed(2)}%` : '—'}
                        </td>
                        <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                          <button
                            onClick={(e) => { e.stopPropagation(); onToggleWatchlist(s.ticker); }}
                            title={inWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist'}
                            style={{
                              width: '22px', height: '22px', borderRadius: '4px', border: '1px solid var(--ws-border)',
                              background: inWatchlist ? 'var(--ws-text)' : 'var(--ws-bg-2)',
                              color: inWatchlist ? 'var(--ws-bg)' : 'var(--ws-text)',
                              fontSize: '12px', fontWeight: 700, cursor: 'pointer', lineHeight: 1,
                            }}>
                            {inWatchlist ? '✓' : '+'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : activeTab === 'movers' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          {/* Top Gainers */}
          <div className="bg-ws-bg-1 border border-ws-border p-4 flex flex-col gap-2.5">
            <div className="flex justify-between items-center border-b border-ws-border pb-2">
              <span className="text-[11px] font-extrabold text-ws-accent tracking-[1px]">TOP GAINERS</span>
              <span className="text-[9px] text-ws-text-3">Fresh Cache</span>
            </div>
            <div className="flex flex-col gap-0.5">
              {(movers?.gainers || []).slice(0, 5).map(s => (
                <div key={s.ticker} onClick={() => onSelectTicker(s.ticker)} className="flex items-center justify-between px-1.5 py-2 rounded-[6px] cursor-pointer transition-[background] duration-150" onMouseEnter={e => e.currentTarget.style.background = 'var(--ws-bg-2)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                  <div>
                    <div className="font-extrabold text-xs">{s.ticker}</div>
                    <div style={{ fontSize: '10px', color: 'var(--ws-text-3)', maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="font-bold text-xs">${s.currentPrice?.toFixed(2)}</div>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--ws-accent)' }}>+{s.priceChangePct?.toFixed(2)}%</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Losers */}
          <div className="bg-ws-bg-1 border border-ws-border p-4 flex flex-col gap-2.5">
            <div className="flex justify-between items-center border-b border-ws-border pb-2">
              <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--ws-red)', letterSpacing: '1px' }}>TOP LOSERS</span>
              <span className="text-[9px] text-ws-text-3">Fresh Cache</span>
            </div>
            <div className="flex flex-col gap-0.5">
              {(movers?.losers || []).slice(0, 5).map(s => (
                <div key={s.ticker} onClick={() => onSelectTicker(s.ticker)} className="flex items-center justify-between px-1.5 py-2 rounded-[6px] cursor-pointer transition-[background] duration-150" onMouseEnter={e => e.currentTarget.style.background = 'var(--ws-bg-2)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                  <div>
                    <div className="font-extrabold text-xs">{s.ticker}</div>
                    <div style={{ fontSize: '10px', color: 'var(--ws-text-3)', maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="font-bold text-xs">${s.currentPrice?.toFixed(2)}</div>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--ws-red)' }}>{s.priceChangePct?.toFixed(2)}%</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Heavyweights movers */}
          <div className="bg-ws-bg-1 border border-ws-border p-4 flex flex-col gap-2.5">
            <div className="flex justify-between items-center border-b border-ws-border pb-2">
              <span className="text-[11px] font-extrabold text-ws-accent tracking-[1px]">BIG CAP MOVERS</span>
              <span className="text-[9px] text-ws-text-3">&gt;$10B Cap</span>
            </div>
            <div className="flex flex-col gap-0.5">
              {(movers?.bigCapMovers || []).slice(0, 5).map(s => {
                const isUp = s.priceChangePct >= 0;
                return (
                  <div key={s.ticker} onClick={() => onSelectTicker(s.ticker)} className="flex items-center justify-between px-1.5 py-2 rounded-[6px] cursor-pointer transition-[background] duration-150" onMouseEnter={e => e.currentTarget.style.background = 'var(--ws-bg-2)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                    <div>
                      <div className="font-extrabold text-xs">{s.ticker}</div>
                      <div style={{ fontSize: '10px', color: 'var(--ws-text-3)', maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="font-bold text-xs">{fmt(s.marketCap)}</div>
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
          <div className="bg-ws-bg-1 border border-ws-border p-4 flex flex-col gap-2.5">
            <div className="border-b border-ws-border pb-2">
              <span className="text-[11px] font-extrabold text-ws-accent tracking-[1px]">TRAQCKER SCORE</span>
            </div>
            <div className="flex flex-col gap-0.5">
              {(movers?.topScore || []).slice(0, 5).map(s => (
                <div key={s.ticker} onClick={() => onSelectTicker(s.ticker)} className="flex items-center justify-between px-1.5 py-2 rounded-[6px] cursor-pointer transition-[background] duration-150" onMouseEnter={e => e.currentTarget.style.background = 'var(--ws-bg-2)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                  <div>
                    <div className="font-extrabold text-xs">{s.ticker}</div>
                    <div className="text-[10px] text-ws-text-3">{s.sector}</div>
                  </div>
                  <div style={{ fontWeight: 800, color: 'var(--ws-accent)', fontSize: '13px' }}>
                    {s.score ? `${Math.round(s.score * 20)}/100` : '—'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Quality Score (CBS) */}
          <div className="bg-ws-bg-1 border border-ws-border p-4 flex flex-col gap-2.5">
            <div className="border-b border-ws-border pb-2">
              <span className="text-[11px] font-extrabold text-ws-accent tracking-[1px]">QUALITY SCORE LEADERS</span>
            </div>
            <div className="flex flex-col gap-0.5">
              {(movers?.topQuality || []).slice(0, 5).map(s => (
                <div key={s.ticker} onClick={() => onSelectTicker(s.ticker)} className="flex items-center justify-between px-1.5 py-2 rounded-[6px] cursor-pointer transition-[background] duration-150" onMouseEnter={e => e.currentTarget.style.background = 'var(--ws-bg-2)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                  <div>
                    <div className="font-extrabold text-xs">{s.ticker}</div>
                    <div className="text-[10px] text-ws-text-3">{s.sector}</div>
                  </div>
                  <div style={{ fontWeight: 800, color: 'var(--ws-accent)', fontSize: '13px' }}>
                    {s.cbs ? `${Math.round(s.cbs * 20)}/100` : '—'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top OPPO Score */}
          <div className="bg-ws-bg-1 border border-ws-border p-4 flex flex-col gap-2.5">
            <div className="border-b border-ws-border pb-2">
              <span className="text-[11px] font-extrabold text-ws-accent tracking-[1px]">OPPO SCORE LEADERS</span>
            </div>
            <div className="flex flex-col gap-0.5">
              {(movers?.topOppo || []).slice(0, 5).map(s => (
                <div key={s.ticker} onClick={() => onSelectTicker(s.ticker)} className="flex items-center justify-between px-1.5 py-2 rounded-[6px] cursor-pointer transition-[background] duration-150" onMouseEnter={e => e.currentTarget.style.background = 'var(--ws-bg-2)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                  <div>
                    <div className="font-extrabold text-xs">{s.ticker}</div>
                    <div className="text-[10px] text-ws-text-3">{s.sector}</div>
                  </div>
                  <div style={{ fontWeight: 800, color: 'var(--ws-accent)', fontSize: '13px' }}>
                    {s.oppo ? `${Math.round(s.oppo * 20)}/100` : '—'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top ROIC */}
          <div className="bg-ws-bg-1 border border-ws-border p-4 flex flex-col gap-2.5">
            <div className="border-b border-ws-border pb-2">
              <span className="text-[11px] font-extrabold text-ws-accent tracking-[1px]">TOP ROIC</span>
            </div>
            <div className="flex flex-col gap-0.5">
              {(movers?.topRoic || []).slice(0, 5).map(s => (
                <div key={s.ticker} onClick={() => onSelectTicker(s.ticker)} className="flex items-center justify-between px-1.5 py-2 rounded-[6px] cursor-pointer transition-[background] duration-150" onMouseEnter={e => e.currentTarget.style.background = 'var(--ws-bg-2)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                  <div>
                    <div className="font-extrabold text-xs">{s.ticker}</div>
                    <div className="text-[10px] text-ws-text-3">{s.sector}</div>
                  </div>
                  <div style={{ fontWeight: 800, color: 'var(--ws-text)', fontSize: '12px' }}>
                    {fmtP(s.roic)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top FCF Yield */}
          <div className="bg-ws-bg-1 border border-ws-border p-4 flex flex-col gap-2.5">
            <div className="border-b border-ws-border pb-2">
              <span className="text-[11px] font-extrabold text-ws-accent tracking-[1px]">FCF YIELD KINGS</span>
            </div>
            <div className="flex flex-col gap-0.5">
              {(movers?.topFcfYield || []).slice(0, 5).map(s => (
                <div key={s.ticker} onClick={() => onSelectTicker(s.ticker)} className="flex items-center justify-between px-1.5 py-2 rounded-[6px] cursor-pointer transition-[background] duration-150" onMouseEnter={e => e.currentTarget.style.background = 'var(--ws-bg-2)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                  <div>
                    <div className="font-extrabold text-xs">{s.ticker}</div>
                    <div className="text-[10px] text-ws-text-3">{s.sector}</div>
                  </div>
                  <div style={{ fontWeight: 800, color: 'var(--ws-text)', fontSize: '12px' }}>
                    {fmtP(s.fcfYield)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Revenue Growth */}
          <div className="bg-ws-bg-1 border border-ws-border p-4 flex flex-col gap-2.5">
            <div className="border-b border-ws-border pb-2">
              <span className="text-[11px] font-extrabold text-ws-accent tracking-[1px]">REVENUE GROWTH</span>
            </div>
            <div className="flex flex-col gap-0.5">
              {(movers?.topRevGrowth || []).slice(0, 5).map(s => (
                <div key={s.ticker} onClick={() => onSelectTicker(s.ticker)} className="flex items-center justify-between px-1.5 py-2 rounded-[6px] cursor-pointer transition-[background] duration-150" onMouseEnter={e => e.currentTarget.style.background = 'var(--ws-bg-2)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                  <div>
                    <div className="font-extrabold text-xs">{s.ticker}</div>
                    <div className="text-[10px] text-ws-text-3">{s.sector}</div>
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
  );
}
