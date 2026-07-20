'use client';
import { useState, useMemo } from 'react';
import { getCapTier } from '../../../../lib/marketCap';

function fmtCap(cap) {
  if (cap == null) return '—';
  if (cap >= 1e9) return `$${(cap / 1e9).toFixed(2)}B`;
  if (cap >= 1e6) return `$${(cap / 1e6).toFixed(0)}M`;
  return `$${cap}`;
}

export default function SmallCapsExploreTable({ radarData, loading, onSelect }) {
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [sortField, setSortField] = useState('marketCap');
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const rawUniverse = radarData?.universe;
  const rawFlags = radarData?.riskFlags || [];
  const rawLeaderboards = radarData?.leaderboards;

  // Build stock list from Supabase data (real SEC/Finnhub data)
  const allStocks = useMemo(() => {
    // Preferred path: the full small/micro/nano universe from stock_cache (every tracked
    // ticker, not just the ones that happen to have a risk flag or a leaderboard placement —
    // see app/api/small-caps/radar/route.js's `universeRows`). Falls back to the old
    // flags+leaderboards union only for a radar payload from before that field existed.
    if (rawUniverse) {
      return rawUniverse.map(s => ({
        ticker: s.ticker,
        name: s.name || s.ticker,
        marketCap: s.marketCap,
        capTier: getCapTier(s.marketCap),
        riskCount: s.flagCount || 0,
        flags: s.flags || [],
        sector: s.sector || null,
        exchange: s.exchange || null,
        grossMargin: s.grossMargin ?? null,
        insiderOwnership: s.insiderOwnershipPct ?? null,
        cashRunway: s.cashRunwayYears ?? null,
      }));
    }

    const map = new Map();

    // 1. Add backend risk flags (populated from Finnhub/SEC data in Supabase)
    rawFlags.forEach(r => {
      map.set(r.ticker, {
        ticker: r.ticker,
        name: r.name || r.ticker,
        marketCap: r.marketCap,
        capTier: getCapTier(r.marketCap),
        riskCount: r.flagCount || 0,
        flags: r.flags || [],
        sector: r.sector || null,
        exchange: r.exchange || null,
        // Only show real data; null = not yet loaded
        grossMargin: r.grossMargin ?? null,
        insiderOwnership: r.insiderOwnershipPct ?? null,
        cashRunway: r.cashRunwayYears ?? null,
      });
    });

    // 2. Add leaderboard stocks (also real data)
    if (rawLeaderboards) {
      ['leastDiluted', 'longestRunway', 'highestInsiderOwnership'].forEach(k => {
        (rawLeaderboards[k] || []).forEach(s => {
          if (!map.has(s.ticker)) {
            map.set(s.ticker, {
              ticker: s.ticker,
              name: s.name || s.ticker,
              marketCap: s.marketCap,
              capTier: getCapTier(s.marketCap),
              riskCount: 0,
              flags: [],
              sector: s.sector || null,
              exchange: s.exchange || null,
              grossMargin: s.grossMargin ?? null,
              insiderOwnership: s.insiderOwnershipPct ?? null,
              cashRunway: s.cashRunwayYears != null ? Math.round(s.cashRunwayYears) : null,
            });
          }
        });
      });
    }

    return Array.from(map.values());
  }, [rawUniverse, rawFlags, rawLeaderboards]);

  // Filter & Sort
  const filteredStocks = useMemo(() => {
    return allStocks.filter(s => {
      const matchesSearch = !search || s.ticker.toLowerCase().includes(search.toLowerCase()) || (s.name || '').toLowerCase().includes(search.toLowerCase());
      const matchesTier = tierFilter === 'all' || s.capTier?.id === tierFilter;
      return matchesSearch && matchesTier;
    }).sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];
      // Handle nulls: push to bottom
      if (valA == null && valB == null) return 0;
      if (valA == null) return 1;
      if (valB == null) return -1;
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [allStocks, search, tierFilter, sortField, sortAsc]);

  // Paginated rows
  const paginatedStocks = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredStocks.slice(start, start + pageSize);
  }, [filteredStocks, page]);

  const totalPages = Math.ceil(filteredStocks.length / pageSize);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const SortArrow = ({ field }) => {
    if (sortField !== field) return null;
    return <span style={{ marginLeft: '4px', opacity: 0.6 }}>{sortAsc ? '▲' : '▼'}</span>;
  };

  return (
    <div style={{
      background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)',
      display: 'flex', flexDirection: 'column', flex: 1, minHeight: '600px', boxSizing: 'border-box'
    }}>
      {/* Top Filter Bar */}
      <div style={{
        padding: '16px 20px', borderBottom: '1px solid var(--ws-border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--ws-accent)', letterSpacing: '1px' }}>
            EXPLORE SMALL & MICRO CAP UNIVERSE
          </span>
          <span style={{
            fontSize: '10px', fontWeight: 800, padding: '2px 8px',
            background: 'var(--ws-bg-2)', border: '1px solid var(--ws-border)', color: 'var(--ws-text-2)',
            fontFamily: "'JetBrains Mono', monospace"
          }}>
            {filteredStocks.length.toLocaleString()} stocks
          </span>
        </div>

        {/* Filter Inputs & Cap Tier Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Search ticker or name..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            style={{
              background: 'var(--ws-bg-2)', border: '1px solid var(--ws-border)',
              color: 'var(--ws-text)', fontSize: '11px', padding: '6px 12px', outline: 'none', width: '200px',
              maxWidth: '100%', boxSizing: 'border-box'
            }}
          />

          <div style={{ display: 'flex', gap: '2px', background: 'var(--ws-bg-2)', padding: '2px', border: '1px solid var(--ws-border)' }}>
            {['all', 'small', 'micro', 'nano'].map(t => (
              <button key={t} onClick={() => { setTierFilter(t); setPage(1); }} style={{
                background: tierFilter === t ? (t === 'nano' ? '#ef4444' : 'var(--ws-accent)') : 'transparent',
                color: tierFilter === t ? 'var(--ws-bg-1)' : 'var(--ws-text-3)',
                border: 'none', padding: '3px 10px', fontSize: '9px', fontWeight: 800, cursor: 'pointer',
                textTransform: 'uppercase'
              }}>
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Explore Screener Table */}
      <div style={{ flex: 1, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'var(--ws-bg-2)', borderBottom: '1px solid var(--ws-border)', color: 'var(--ws-text-3)', fontFamily: "'JetBrains Mono', monospace" }}>
              <th onClick={() => handleSort('ticker')} style={{ padding: '10px 16px', cursor: 'pointer' }}>TICKER<SortArrow field="ticker" /></th>
              <th onClick={() => handleSort('name')} style={{ padding: '10px 16px', cursor: 'pointer' }}>COMPANY NAME<SortArrow field="name" /></th>
              <th onClick={() => handleSort('marketCap')} style={{ padding: '10px 16px', cursor: 'pointer' }}>MARKET CAP<SortArrow field="marketCap" /></th>
              <th style={{ padding: '10px 16px' }}>TIER</th>
              <th onClick={() => handleSort('sector')} style={{ padding: '10px 16px', cursor: 'pointer' }}>SECTOR<SortArrow field="sector" /></th>
              <th onClick={() => handleSort('grossMargin')} style={{ padding: '10px 16px', cursor: 'pointer' }}>GROSS MARGIN<SortArrow field="grossMargin" /></th>
              <th onClick={() => handleSort('insiderOwnership')} style={{ padding: '10px 16px', cursor: 'pointer' }}>INSIDER OWNED<SortArrow field="insiderOwnership" /></th>
              <th style={{ padding: '10px 16px', textAlign: 'right' }}>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: 'var(--ws-text-3)' }}>
                  Loading stocks from database...
                </td>
              </tr>
            ) : paginatedStocks.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: 'var(--ws-text-3)' }}>
                  No companies found matching your search.
                </td>
              </tr>
            ) : (
              paginatedStocks.map(s => (
                <tr
                  key={s.ticker}
                  onClick={() => onSelect(s.ticker)}
                  style={{ borderBottom: '1px solid var(--ws-border)', cursor: 'pointer', transition: 'background 0.15s ease' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--ws-bg-2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  <td style={{ padding: '10px 16px', fontWeight: 900, color: 'var(--ws-accent)', fontFamily: "'JetBrains Mono', monospace" }}>
                    {s.ticker}
                  </td>
                  <td style={{ padding: '10px 16px', color: 'var(--ws-text)', fontWeight: 600, maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.name}
                  </td>
                  <td style={{ padding: '10px 16px', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
                    {fmtCap(s.marketCap)}
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{
                      fontSize: '9px', fontWeight: 800, padding: '2px 6px',
                      background: 'var(--ws-bg-2)', border: `1px solid ${s.capTier?.color || 'var(--ws-border)'}`,
                      color: s.capTier?.color || 'var(--ws-text-2)', fontFamily: "'JetBrains Mono', monospace"
                    }}>
                      {s.capTier?.short?.toUpperCase() || '—'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: '10px', color: 'var(--ws-text-2)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.sector || '—'}
                  </td>
                  <td style={{ padding: '10px 16px', fontFamily: "'JetBrains Mono', monospace" }}>
                    {s.grossMargin != null ? `${s.grossMargin}%` : <span style={{ color: 'var(--ws-text-3)' }}>—</span>}
                  </td>
                  <td style={{ padding: '10px 16px', fontFamily: "'JetBrains Mono', monospace" }}>
                    {s.insiderOwnership != null ? `${Number(s.insiderOwnership).toFixed(1)}%` : <span style={{ color: 'var(--ws-text-3)' }}>—</span>}
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                    <span style={{
                      fontSize: '9px', fontWeight: 800, padding: '3px 8px',
                      background: 'var(--ws-accent)', color: 'var(--ws-bg-1)', fontFamily: "'JetBrains Mono', monospace"
                    }}>
                      Scan &rarr;
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div style={{
        padding: '12px 20px', borderTop: '1px solid var(--ws-border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--ws-bg-2)'
      }}>
        <span style={{ fontSize: '10px', color: 'var(--ws-text-3)', fontFamily: "'JetBrains Mono', monospace" }}>
          Showing {filteredStocks.length > 0 ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, filteredStocks.length)} of {filteredStocks.length.toLocaleString()} companies
        </span>

        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            disabled={page === 1}
            onClick={() => setPage(prev => Math.max(prev - 1, 1))}
            style={{
              background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)',
              color: page === 1 ? 'var(--ws-text-3)' : 'var(--ws-text)',
              padding: '4px 10px', fontSize: '10px', fontWeight: 700, cursor: page === 1 ? 'default' : 'pointer'
            }}
          >
            &larr; Previous
          </button>
          <span style={{ padding: '4px 8px', fontSize: '10px', fontWeight: 800, fontFamily: "'JetBrains Mono', monospace" }}>
            Page {page} of {totalPages || 1}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(prev => Math.min(prev + 1, totalPages))}
            style={{
              background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)',
              color: page >= totalPages ? 'var(--ws-text-3)' : 'var(--ws-text)',
              padding: '4px 10px', fontSize: '10px', fontWeight: 700, cursor: page >= totalPages ? 'default' : 'pointer'
            }}
          >
            Next &rarr;
          </button>
        </div>
      </div>
    </div>
  );
}
