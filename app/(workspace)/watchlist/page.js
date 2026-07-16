'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useUser } from '../../components/AuthProvider';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Sparkline from '../../components/Sparkline';
import MarketStatusDot from '../../components/workspace/MarketStatusDot';
import StockLogo from '../../components/workspace/StockLogo';
import AllocationChart from '../../components/workspace/portfolio/AllocationChart';
import { formatPrice as formatCurrency } from '../../../lib/formatters';
import { getGuestWatchlist, addToGuestWatchlist, removeFromGuestWatchlist, GUEST_WATCHLIST_LIMIT } from '../../../lib/guestWatchlist';
import { computeEasyMode } from '../../../lib/stockScoring';

// Same "is there enough fundamental data to score this" check as the stock detail page
// (app/(workspace)/stock/[ticker]/page.js) — recent IPOs / thinly-covered tickers would
// otherwise get a fabricated-looking score built entirely from neutral-midpoint defaults.
const hasFundamentals = (t) => t.revVal != null || t.niVal != null || t.marketCap != null
  || t.roic != null || t.grossMargin != null || (t.revHistory?.length ?? 0) > 0;

// Same 1-5 -> color mapping as the Quality tab's ScoreBar/grid on the stock detail page.
const scoreColor = (s) => s >= 4 ? 'var(--ws-accent)' : s >= 3 ? 'var(--ws-text)' : 'var(--ws-red)';

export default function WatchlistPage() {
  const { isSignedIn } = useUser();
  const router = useRouter();
  const [tickers, setTickers] = useState([]);
  const [sparklines, setSparklines] = useState({});
  const [loading, setLoading] = useState(true);

  // Search/Add states — the plain "type a symbol, hit Enter" flow stays exactly this
  // simple regardless of Pies; grouping is opt-in, applied after the fact.
  const [searchQuery, setSearchQuery] = useState('');
  const [searchError, setSearchError] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // Pie (themed sub-list) grouping — same idea as Portfolio's Pies. A ticker with no
  // `pie` falls into "General", which always sorts first.
  const [editingPieTicker, setEditingPieTicker] = useState(null);
  const [pieDraft, setPieDraft] = useState('');
  const [showPieSuggestions, setShowPieSuggestions] = useState(false);

  // Pies render as a grid of clickable cards, collapsed by default — the stock table for a
  // pie only shows once you click its card. Doesn't apply when nothing's grouped yet (see
  // `hasPies` below), so the plain add-a-symbol flow still just sees one flat table.
  const [expandedPies, setExpandedPies] = useState(() => new Set());
  const togglePie = (name) => setExpandedPies(prev => {
    const next = new Set(prev);
    if (next.has(name)) next.delete(name); else next.add(name);
    return next;
  });

  const fetchWatchlist = useCallback(async () => {
    setLoading(true);
    try {
      let list = [];
      if (isSignedIn) {
        const res = await fetch('/api/watchlist?full=true');
        const data = await res.json();
        list = data.tickers || [];
      } else {
        const guestTickers = getGuestWatchlist();
        if (guestTickers.length > 0) {
          const res = await fetch(`/api/watchlist?full=true&tickers=${guestTickers.join(',')}`);
          const data = await res.json();
          list = data.tickers || [];
        }
      }
      setTickers(list);
      list.forEach(t => {
        fetch(`/api/sparkline?ticker=${t.ticker}`)
          .then(r => r.json())
          .then(d => setSparklines(prev => ({ ...prev, [t.ticker]: d.candles })))
          .catch(() => {});
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [isSignedIn]);

  useEffect(() => {
    fetchWatchlist();
  }, [fetchWatchlist]);

  // Keep prices reasonably live, same cadence as Portfolio.
  useEffect(() => {
    const interval = setInterval(fetchWatchlist, 60000);
    return () => clearInterval(interval);
  }, [fetchWatchlist]);

  // Picks up tickers added from elsewhere (e.g. the stock detail page) while
  // this page stays mounted, since guests have no server push to rely on.
  useEffect(() => {
    if (isSignedIn) return;
    window.addEventListener('guest-watchlist-changed', fetchWatchlist);
    return () => window.removeEventListener('guest-watchlist-changed', fetchWatchlist);
  }, [isSignedIn, fetchWatchlist]);

  const existingPies = useMemo(
    () => [...new Set(tickers.map(t => t.pie).filter(Boolean))].sort(),
    [tickers]
  );
  const pieSuggestions = existingPies.filter(p =>
    p.toLowerCase().includes(pieDraft.toLowerCase()) && p.toLowerCase() !== pieDraft.toLowerCase()
  );

  const total = tickers.length;

  const sectorChart = useMemo(() => {
    if (total === 0) return [];
    const bySector = {};
    tickers.forEach(t => {
      const key = t.sector || 'Unknown';
      bySector[key] = (bySector[key] || 0) + (1 / total) * 100;
    });
    return Object.entries(bySector).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [tickers, total]);

  const pieChart = useMemo(() => {
    if (total === 0) return [];
    const byPie = {};
    tickers.forEach(t => {
      const key = t.pie || 'General';
      byPie[key] = (byPie[key] || 0) + (1 / total) * 100;
    });
    return Object.entries(byPie)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => a.name === 'General' ? -1 : b.name === 'General' ? 1 : b.value - a.value);
  }, [tickers, total]);

  const groups = useMemo(() => {
    const map = {};
    tickers.forEach(t => { (map[t.pie || 'General'] ||= []).push(t); });
    const names = Object.keys(map).sort((a, b) => a === 'General' ? -1 : b === 'General' ? 1 : a.localeCompare(b));
    return names.map(name => ({ name, items: map[name] }));
  }, [tickers]);

  const hasPies = groups.length > 1 || (groups.length === 1 && groups[0].name !== 'General');
  const hasSectors = sectorChart.length > 1;

  const gainers = tickers.filter(t => (t.priceChangePct ?? 0) > 0).length;
  const losers = tickers.filter(t => (t.priceChangePct ?? 0) < 0).length;

  // Remove ticker
  const removeTicker = async (tickerToRemove) => {
    setTickers(prev => prev.filter(t => t.ticker !== tickerToRemove));
    if (!isSignedIn) { removeFromGuestWatchlist(tickerToRemove); return; }
    await fetch('/api/watchlist', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker: tickerToRemove }),
    });
  };

  // Move a ticker into a different pie (or back to General with an empty value)
  const moveToPie = async (ticker, newPie) => {
    const pie = newPie.trim() || null;
    setTickers(prev => prev.map(t => t.ticker === ticker ? { ...t, pie } : t));
    setEditingPieTicker(null);
    setShowPieSuggestions(false);
    await fetch('/api/watchlist', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker, pie }),
    });
  };

  // Add ticker
  const handleAddStock = async (e) => {
    if (e.key !== 'Enter') return;
    const ticker = searchQuery.trim().toUpperCase();
    if (!ticker) return;

    setIsAdding(true);
    setSearchError('');

    try {
      const res = await fetch(`/api/stock?ticker=${ticker}`);
      const data = await res.json();
      if (data.error) {
        setSearchError('Symbol not found');
        setIsAdding(false);
        return;
      }

      if (!isSignedIn) {
        const { added, atLimit } = addToGuestWatchlist(ticker);
        if (atLimit) {
          setSearchError(`Limit of ${GUEST_WATCHLIST_LIMIT} temporary tickers — sign up for unlimited use`);
        } else if (added) {
          setSearchQuery('');
          fetchWatchlist();
        }
        setIsAdding(false);
        return;
      }

      const addRes = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker }),
      });

      if (addRes.ok) {
        setSearchQuery('');
        fetchWatchlist();
      } else {
        setSearchError('Error adding symbol');
      }
    } catch (err) {
      setSearchError('Connection error');
    } finally {
      setIsAdding(false);
    }
  };

  const renderTable = (items) => (
    <div className="responsive-table-container" style={{ border: '1px solid var(--ws-border)', background: 'var(--ws-bg-1)' }}>
      <table className="responsive-table" style={{ fontSize: '12px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--ws-border)', background: 'var(--ws-bg-1)' }}>
            {[
              { h: 'Stock' }, { h: '1M' }, { h: 'Price' }, { h: 'Day' }, { h: 'P/E' }, { h: 'Div yield' }, { h: 'Sector' },
              { h: 'CBS', title: 'Core Business Score · ROIC · Margins · Liquidity' },
              { h: 'OPPO', title: 'Opportunity Score · P/FCF · FCF Yield' },
              { h: 'GQS', title: 'Growth Quality Score · Revenue · R&D · SBC' },
              { h: 'Quality', title: 'Final Note · Traqcker Score · Weighted composite (CBS 45% · OPPO 30% · GQS 25% · Moat ±20%)' },
              { h: '' },
            ].map(({ h, title }) => (
              <th key={h} title={title} className={h === 'Stock' ? 'sticky-col' : ''} style={{ padding: '9px 12px', textAlign: h === 'Stock' ? 'left' : h === '1M' ? 'center' : 'right', fontWeight: 600, fontSize: '10px', color: 'var(--ws-text-3)' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map(t => {
            const isEditingPie = editingPieTicker === t.ticker;
            const dayChange = t.priceChangePct ?? 0;
            const easyMode = computeEasyMode(t, hasFundamentals(t));
            return (
              <tr key={t.ticker} onClick={() => router.push(`/stock/${t.ticker}`)}
                style={{ borderBottom: '1px solid var(--ws-border)', cursor: 'pointer', background: 'var(--ws-bg-1)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--ws-bg-2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--ws-bg-1)'}>
                <td className="sticky-col" style={{ padding: '10px 12px' }}>
                  <div className="flex items-center gap-2">
                    <StockLogo ticker={t.ticker} size={24} />
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--ws-text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {t.ticker}
                        <MarketStatusDot ticker={t.ticker} />
                      </div>
                      <div style={{ color: 'var(--ws-text-3)', fontSize: '11px' }}>{t.name || '…'}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                  {sparklines[t.ticker] && <Sparkline data={sparklines[t.ticker]} width={64} height={22} />}
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>
                  {t.currentPrice != null ? formatCurrency(t.currentPrice, t.currency || 'USD') : '—'}
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: t.priceChangePct == null ? 'var(--ws-text-3)' : dayChange >= 0 ? 'var(--ws-accent)' : 'var(--ws-red)' }}>
                  {t.priceChangePct != null ? `${dayChange >= 0 ? '+' : ''}${dayChange.toFixed(2)}%` : '—'}
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--ws-text-2)' }}>{t.pe ? t.pe.toFixed(1) : '—'}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--ws-text-2)' }}>{t.dividendYield ? `${t.dividendYield.toFixed(2)}%` : '—'}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--ws-text-2)' }}>{t.sector || '—'}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: easyMode ? scoreColor(easyMode.cbs) : 'var(--ws-text-3)' }}>
                  {easyMode ? Math.round(easyMode.cbs * 20) : '—'}
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: easyMode ? scoreColor(easyMode.oppo) : 'var(--ws-text-3)' }}>
                  {easyMode ? Math.round(easyMode.oppo * 20) : '—'}
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: easyMode ? scoreColor(easyMode.gqs) : 'var(--ws-text-3)' }}>
                  {easyMode ? Math.round(easyMode.gqs * 20) : '—'}
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right' }} title={easyMode ? `Traqcker Score · ${easyMode.verdict}` : 'Not enough fundamentals yet'}>
                  {easyMode ? (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end', whiteSpace: 'nowrap' }}>
                      <span style={{ fontWeight: 700, color: easyMode.verdictColor }}>{easyMode.score100}</span>
                      <span style={{ fontSize: '10px', color: 'var(--ws-text-3)' }}>{easyMode.verdict}</span>
                    </div>
                  ) : (
                    <span style={{ color: 'var(--ws-text-3)' }}>—</span>
                  )}
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                  {isSignedIn && (isEditingPie ? (
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <input
                        autoFocus
                        value={pieDraft}
                        placeholder="General"
                        onChange={e => { setPieDraft(e.target.value); setShowPieSuggestions(true); }}
                        onFocus={() => setShowPieSuggestions(true)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') moveToPie(t.ticker, pieDraft);
                          if (e.key === 'Escape') { setEditingPieTicker(null); setShowPieSuggestions(false); }
                        }}
                        onBlur={() => setTimeout(() => moveToPie(t.ticker, pieDraft), 150)}
                        style={{ width: '110px', fontSize: '10px', padding: '4px 6px', background: 'var(--ws-bg-1)', border: '1px solid var(--ws-accent)', color: 'var(--ws-text)', fontFamily: 'JetBrains Mono, monospace' }}
                      />
                      {showPieSuggestions && pieSuggestions.length > 0 && (
                        <div style={{ position: 'absolute', top: '26px', right: 0, minWidth: '120px', background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', zIndex: 20, textAlign: 'left', boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
                          {pieSuggestions.map(p => (
                            <div key={p} onMouseDown={() => moveToPie(t.ticker, p)}
                              style={{ padding: '6px 8px', fontSize: '10px', cursor: 'pointer', color: 'var(--ws-text)' }}
                              onMouseEnter={e => e.currentTarget.style.background = 'var(--ws-bg-2)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                              {p}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => { setEditingPieTicker(t.ticker); setPieDraft(t.pie || ''); }}
                      title="Move to a different list"
                      style={{ background: 'var(--ws-bg-2)', border: '1px solid var(--ws-border)', color: 'var(--ws-text-3)', fontSize: '9px', fontWeight: 700, padding: '4px 8px', cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'nowrap', marginRight: '8px' }}
                      onMouseEnter={e => { e.currentTarget.style.color = 'var(--ws-accent)'; e.currentTarget.style.borderColor = 'var(--ws-accent)'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--ws-text-3)'; e.currentTarget.style.borderColor = 'var(--ws-border)'; }}>
                      {t.pie || 'General'}
                    </button>
                  ))}
                  <button onClick={() => removeTicker(t.ticker)} title={`Remove ${t.ticker} from watchlist`}
                    style={{ background: 'none', border: 'none', color: 'var(--ws-text-3)', cursor: 'pointer', fontSize: '13px' }}
                    onMouseEnter={e => e.target.style.color = 'var(--ws-red)'}
                    onMouseLeave={e => e.target.style.color = 'var(--ws-text-3)'}>
                    ✕
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ border: '1px solid var(--ws-border)', background: 'var(--ws-bg-1)', marginBottom: '20px', overflow: 'hidden' }}>
        <div className="bg-ws-bg-2 border-b border-ws-border px-4 py-[7px]">
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: 'var(--ws-accent)', fontWeight: 700, letterSpacing: '1px' }}>
            $ traq watchlist
          </span>
        </div>
        <div style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ws-text)' }}>Watchlist</div>
            <div style={{ fontSize: '13px', color: 'var(--ws-text-2)' }}>Track the stocks you're keeping an eye on.</div>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--ws-bg-2)', border: '1px solid var(--ws-border)', padding: '0 10px', height: '34px' }}>
              <span style={{ color: 'var(--ws-text-3)', fontSize: '12px' }}>+</span>
              <input
                type="text"
                placeholder="Add symbol... (Enter)"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setSearchError(''); }}
                onKeyDown={handleAddStock}
                disabled={isAdding}
                style={{ background: 'transparent', border: 'none', color: 'var(--ws-text)', fontSize: '12px', outline: 'none', width: '170px', fontFamily: 'JetBrains Mono, monospace' }}
              />
            </div>
            {searchError && (
              <div style={{ fontSize: '10px', color: 'var(--ws-red)', marginTop: '4px', fontFamily: 'JetBrains Mono, monospace' }}>
                {searchError}
              </div>
            )}
          </div>
        </div>
      </div>

      {!isSignedIn && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          padding: '10px 16px',
          background: 'var(--ws-accent-dim)',
          border: '1px solid var(--ws-border)',
          marginBottom: '20px'
        }}>
          <span style={{ fontSize: '11px', color: 'var(--ws-text-2)', lineHeight: '1.5' }}>
            This watchlist is temporary and clears when you close the tab. Sign up free to save it permanently.
          </span>
          <Link href="/sign-up" style={{
            background: 'var(--ws-accent)',
            color: 'var(--ws-bg-1)',
            borderRadius: '6px',
            padding: '6px 12px',
            fontSize: '11px',
            fontWeight: 700,
            textDecoration: 'none',
            whiteSpace: 'nowrap'
          }}>
            Sign up free
          </Link>
        </div>
      )}

      {loading ? (
        <div style={{ color: 'var(--ws-text-3)', fontSize: '13px', padding: '30px 0' }}>Loading…</div>
      ) : tickers.length === 0 ? (
        <div className="border border-ws-border p-12 text-center">
          <div style={{ color: 'var(--ws-text)', fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>
            {isSignedIn ? 'Your watchlist is empty' : 'Your temporary watchlist is empty'}
          </div>
          <div style={{ color: 'var(--ws-text-3)', fontSize: '12px' }}>Add a symbol above to get started.</div>
        </div>
      ) : (
        <>
          <div className="portfolio-overview-grid">
            <div className="border border-ws-border p-3.5">
              <div style={{ fontSize: '10px', color: 'var(--ws-text-3)', letterSpacing: '0.5px', marginBottom: '4px' }}>TICKERS</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ws-text)' }}>{tickers.length}</div>
            </div>
            <div className="border border-ws-border p-3.5">
              <div style={{ fontSize: '10px', color: 'var(--ws-text-3)', letterSpacing: '0.5px', marginBottom: '4px' }}>GAINERS TODAY</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ws-accent)' }}>{gainers}</div>
            </div>
            <div className="border border-ws-border p-3.5">
              <div style={{ fontSize: '10px', color: 'var(--ws-text-3)', letterSpacing: '0.5px', marginBottom: '4px' }}>LOSERS TODAY</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ws-red)' }}>{losers}</div>
            </div>
          </div>

          <div className="portfolio-allocations-grid" style={{ gridTemplateColumns: `repeat(${1 + (hasPies ? 1 : 0)}, 1fr)` }}>
            <AllocationChart title="ALLOCATION BY SECTOR" data={sectorChart} />
            {hasPies && <AllocationChart title="ALLOCATION BY PIE" data={pieChart} />}
          </div>

          {hasPies ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px', marginBottom: '18px' }}>
                {groups.map(group => {
                  const isOpen = expandedPies.has(group.name);
                  if (group.items.length > 1) {
                    // Each ticker in the group counts equally (watchlist has no dollar weight
                    // to split by) — this is "what's inside this pie", as opposed to the
                    // ALLOCATION BY PIE donut above, which is "how tickers split across pies".
                    const groupChart = group.items.map(t => ({ name: t.ticker, value: (1 / group.items.length) * 100 }));
                    return (
                      <AllocationChart
                        key={group.name}
                        title={`${group.name.toUpperCase()} · ${group.items.length} TICKERS`}
                        data={groupChart}
                        onClick={() => togglePie(group.name)}
                        open={isOpen}
                      />
                    );
                  }
                  // AllocationChart returns null for a single ticker (no meaningful split), so
                  // single-ticker pies get a plain compact clickable card instead.
                  return (
                    <div key={group.name} className="border p-4" onClick={() => togglePie(group.name)}
                      style={{ borderColor: isOpen ? 'var(--ws-accent)' : 'var(--ws-border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ws-text)' }}>{group.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--ws-text-3)' }}>{group.items.length} ticker</div>
                      </div>
                      <span style={{ fontSize: '11px', color: isOpen ? 'var(--ws-accent)' : 'var(--ws-text-3)' }}>{isOpen ? '▾' : '▸'}</span>
                    </div>
                  );
                })}
              </div>

              {groups.filter(g => expandedPies.has(g.name)).map(group => (
                <div key={group.name} style={{ marginBottom: '18px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ws-text-3)', letterSpacing: '1px', marginBottom: '8px' }}>{group.name.toUpperCase()}</div>
                  {renderTable(group.items)}
                </div>
              ))}
            </>
          ) : (
            renderTable(tickers)
          )}
        </>
      )}
    </div>
  );
}
