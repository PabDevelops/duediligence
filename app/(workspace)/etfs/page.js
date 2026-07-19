'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { parseAUM, parsePercent, parseVolume } from '../../../lib/formatters';

const SortHeader = ({ field, label, align = 'right', sortField, sortAsc, onSort }) => (
  <th onClick={() => onSort(field)}
    style={{
      padding: '10px 12px',
      textAlign: align,
      fontWeight: 700,
      fontSize: '10px',
      letterSpacing: '0.6px',
      color: sortField === field ? 'var(--ws-accent)' : 'var(--ws-text-3)',
      cursor: 'pointer',
      whiteSpace: 'nowrap',
      userSelect: 'none',
      borderBottom: '2px solid var(--ws-border)'
    }}>
    {label} {sortField === field && (sortAsc ? '▲' : '▼')}
  </th>
);

const CATEGORIES = [
  { id: 'all', label: 'All Funds' },
  { id: 'equity', label: 'US Equity' },
  { id: 'sector', label: 'Sector Specific' },
  { id: 'international', label: 'International' },
  { id: 'fixed', label: 'Bonds & Gold' }
];

export default function ETFsPage() {
  const router = useRouter();
  const [etfsList, setEtfsList] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [sortField, setSortField] = useState('aum');
  const [sortAsc, setSortAsc] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 25;

  const [maxExpense, setMaxExpense] = useState('');
  const [minYield, setMinYield] = useState('');
  const [minAUM, setMinAUM] = useState('');

  const [loadingList, setLoadingList] = useState(true);

  // Load global user-inserted ETFs on mount
  useEffect(() => {
    fetch('/api/etfs')
      .then(res => res.json())
      .then(data => {
        if (data.etfs && data.etfs.length > 0) {
          setEtfsList(data.etfs);
        }
      })
      .catch(err => console.error('Error loading global ETFs:', err))
      .finally(() => {
        setLoadingList(false);
      });
  }, []);

  // Reset page when tab, sort or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, sortField, sortAsc, maxExpense, minYield, minAUM]);

  const goToTicker = (ticker) => router.push(`/etfs/${ticker}`);

  const handleSearchSubmit = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const cleanTicker = searchQuery.trim().toUpperCase();

    // If it's already in the list, go straight there
    if (etfsList.some(item => item.ticker === cleanTicker)) {
      goToTicker(cleanTicker);
      return;
    }

    // Otherwise, confirm it's a real ticker before navigating (fetches & caches it server-side)
    setSearching(true);
    setSearchError(null);
    try {
      const res = await fetch('/api/etfs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: cleanTicker })
      });
      const d = await res.json();
      if (d.error) {
        setSearchError(d.error);
      } else {
        goToTicker(d.ticker);
      }
    } catch (err) {
      setSearchError('Failed to fetch pricing');
    } finally {
      setSearching(false);
    }
  };

  // Sorting & Filtering logic
  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const filteredETFs = useMemo(() => {
    let list = [...etfsList];

    // Filter by Tab
    if (activeTab !== 'all') {
      list = list.filter(item => item.category === activeTab);
    }

    // Filter by optional numeric thresholds
    if (maxExpense !== '') {
      const max = parseFloat(maxExpense);
      list = list.filter(item => parsePercent(item.expenseRatio) <= max);
    }
    if (minYield !== '') {
      const min = parseFloat(minYield);
      list = list.filter(item => parsePercent(item.yield) >= min);
    }
    if (minAUM !== '') {
      const min = parseFloat(minAUM);
      list = list.filter(item => parseAUM(item.aum) >= min);
    }

    // Sort list
    list.sort((a, b) => {
      let valA, valB;
      if (sortField === 'aum') {
        valA = parseAUM(a.aum);
        valB = parseAUM(b.aum);
      } else if (sortField === 'expense') {
        valA = parsePercent(a.expenseRatio);
        valB = parsePercent(b.expenseRatio);
      } else if (sortField === 'yield') {
        valA = parsePercent(a.yield);
        valB = parsePercent(b.yield);
      } else if (sortField === 'volume') {
        valA = parseVolume(a.volume);
        valB = parseVolume(b.volume);
      } else {
        valA = a[sortField]?.toUpperCase() || '';
        valB = b[sortField]?.toUpperCase() || '';
      }

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });

    return list;
  }, [etfsList, activeTab, sortField, sortAsc, maxExpense, minYield, minAUM]);

  const totalPages = Math.ceil(filteredETFs.length / ITEMS_PER_PAGE);
  const paginatedETFs = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredETFs.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredETFs, currentPage]);

  if (loadingList) {
    return (
      <div style={{ padding: '24px', fontFamily: "'JetBrains Mono', monospace" }}>
        <div style={{ border: '1px solid var(--ws-border)', background: 'var(--ws-bg-1)', overflow: 'hidden' }}>
          <div style={{ background: 'var(--ws-bg-2)', borderBottom: '1px solid var(--ws-border)', padding: '7px 16px' }}>
            <span style={{ fontSize: '11px', color: 'var(--ws-accent)', fontWeight: 700, letterSpacing: '1px' }}>$ traq etfs</span>
          </div>
          <div style={{ padding: '24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {['CONNECTING TO ETF DATABASE...', 'FETCHING REAL-TIME QUOTES...'].map((line, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ color: 'var(--ws-accent)', fontSize: '11px' }}>▶</span>
                  <span style={{ color: 'var(--ws-text-3)', fontSize: '11px', letterSpacing: '1px' }}>{line}</span>
                </div>
              ))}
              <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: 'var(--ws-text-3)', fontSize: '11px' }}>█░░░░░░░░░</span>
                <span style={{ color: 'var(--ws-text-3)', fontSize: '10px', letterSpacing: '1px' }}>LOADING ETF TERMINAL...</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', minHeight: 'calc(100vh - var(--topbar-height))', boxSizing: 'border-box' }}>

      {/* Terminal title bar */}
      <div style={{ border: '1px solid var(--ws-border)', background: 'var(--ws-bg-1)', overflow: 'hidden' }}>
        <div style={{ background: 'var(--ws-bg-2)', borderBottom: '1px solid var(--ws-border)', padding: '7px 16px' }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: 'var(--ws-accent)', fontWeight: 700, letterSpacing: '1px' }}>
            $ traq etfs
          </span>
        </div>
      </div>

      {/* HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: 'var(--ws-text)', letterSpacing: '-0.75px', marginBottom: '4px' }}>ETF Directory & Screener</h1>
          <p style={{ fontSize: '12px', color: 'var(--ws-text-3)' }}>Institutional-grade ETF screener. Click any fund for expense ratios, yields, quality score, holdings, and side-by-side comparison.</p>
        </div>

        {/* SEARCH BAR */}
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px' }}>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search any ETF (e.g. SDY, EEM, SSLN.L)..."
            style={{
              height: '38px',
              padding: '0 14px',
              fontSize: '13px',
              fontFamily: "'JetBrains Mono', monospace",
              border: '1px solid var(--ws-border)',
              borderRadius: '8px',
              background: 'var(--ws-bg-2)',
              color: 'var(--ws-text)',
              outline: 'none',
              width: '280px'
            }}
          />
          <button
            type="submit"
            disabled={searching}
            style={{
              height: '38px',
              padding: '0 18px',
              fontSize: '12px',
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 700,
              background: 'var(--ws-text)',
              color: 'var(--ws-bg)',
              border: 'none',
              borderRadius: '6px',
              cursor: searching ? 'not-allowed' : 'pointer',
              opacity: searching ? 0.6 : 1,
            }}
          >
            {searching ? '...' : 'GO'}
          </button>
        </form>
      </div>

      {/* ERROR STATUS */}
      {searchError && (
        <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid var(--ws-red)', padding: '16px', borderRadius: '6px', color: 'var(--ws-red)', fontSize: '13px', fontFamily: "'JetBrains Mono', monospace" }}>
          [ERROR] Ticker &quot;{searchQuery.trim().toUpperCase()}&quot; was not found or failed to load. Make sure it is a valid US or international ETF symbol.
        </div>
      )}

      {/* SCREENER CARD */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', padding: '16px', boxSizing: 'border-box' }}>

        {/* CATEGORY TABS */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', borderBottom: '1px solid var(--ws-border)', paddingBottom: '12px' }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveTab(cat.id)}
              style={{
                padding: '4px 12px',
                fontSize: '11px',
                fontWeight: 700,
                background: activeTab === cat.id ? 'var(--ws-accent)' : 'var(--ws-bg-2)',
                border: activeTab === cat.id ? 'none' : '1px solid var(--ws-border)',
                color: activeTab === cat.id ? 'var(--ws-bg-1)' : 'var(--ws-text-2)',
                borderRadius: '20px',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* NUMERIC FILTERS */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {[
            { label: 'Max Expense %', value: maxExpense, setter: setMaxExpense, placeholder: 'e.g. 0.20' },
            { label: 'Min Yield %', value: minYield, setter: setMinYield, placeholder: 'e.g. 1.5' },
            { label: 'Min AUM $B', value: minAUM, setter: setMinAUM, placeholder: 'e.g. 1' },
          ].map(f => (
            <label key={f.label} style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '9px', color: 'var(--ws-text-3)', fontWeight: 700, letterSpacing: '0.5px' }}>
              {f.label}
              <input
                type="number"
                value={f.value}
                onChange={(e) => f.setter(e.target.value)}
                placeholder={f.placeholder}
                style={{
                  height: '28px',
                  width: '90px',
                  padding: '0 8px',
                  fontSize: '11px',
                  fontFamily: "'JetBrains Mono', monospace",
                  border: '1px solid var(--ws-border)',
                  borderRadius: '4px',
                  background: 'var(--ws-bg-2)',
                  color: 'var(--ws-text)',
                  outline: 'none'
                }}
              />
            </label>
          ))}
        </div>

        {/* SCREENER LIST TABLE */}
        <div className="responsive-table-container">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
            <thead style={{ position: 'sticky', top: 0, background: 'var(--ws-bg-2)', zIndex: 1 }}>
              <tr>
                <th onClick={() => handleSort('ticker')} style={{ padding: '10px 12px', fontWeight: 700, fontSize: '10px', color: sortField === 'ticker' ? 'var(--ws-accent)' : 'var(--ws-text-3)', cursor: 'pointer', borderBottom: '2px solid var(--ws-border)' }}>
                  TICKER {sortField === 'ticker' && (sortAsc ? '▲' : '▼')}
                </th>
                <th style={{ padding: '10px 12px', fontWeight: 700, fontSize: '10px', color: 'var(--ws-text-3)', borderBottom: '2px solid var(--ws-border)' }}>NAME</th>
                <SortHeader field="aum" label="AUM" sortField={sortField} sortAsc={sortAsc} onSort={handleSort} />
                <SortHeader field="expense" label="EXP" sortField={sortField} sortAsc={sortAsc} onSort={handleSort} />
                <SortHeader field="yield" label="YIELD" sortField={sortField} sortAsc={sortAsc} onSort={handleSort} />
                <SortHeader field="volume" label="VOL" sortField={sortField} sortAsc={sortAsc} onSort={handleSort} />
              </tr>
            </thead>
            <tbody>
              {paginatedETFs.map((item, idx) => (
                <tr
                  key={item.ticker}
                  onClick={() => goToTicker(item.ticker)}
                  style={{
                    cursor: 'pointer',
                    background: idx % 2 === 0 ? 'var(--ws-bg-1)' : 'var(--ws-bg-2)',
                    borderBottom: '1px solid var(--ws-border)',
                    transition: 'background 0.15s ease'
                  }}
                >
                  <td style={{ padding: '10px 12px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, color: 'var(--ws-text)' }}>
                    {item.ticker}
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--ws-text-2)', fontWeight: 600, maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.name}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: 'var(--ws-text)' }}>
                    {item.aum}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", color: 'var(--ws-text-3)' }}>
                    {item.expenseRatio}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", color: 'var(--ws-text-3)' }}>
                    {item.yield}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", color: 'var(--ws-text-3)' }}>
                    {item.volume}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {paginatedETFs.length === 0 && (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ws-text-3)', fontSize: '12px' }}>
              No ETFs in this category yet.
            </div>
          )}
        </div>

        {/* PAGINATION CONTROLS */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '14px', borderTop: '1px solid var(--ws-border)', fontSize: '11px', fontFamily: "'JetBrains Mono', monospace" }}>
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              style={{
                padding: '6px 12px',
                background: 'var(--ws-bg-1)',
                border: '1px solid var(--ws-border)',
                borderRadius: '6px',
                color: currentPage === 1 ? 'var(--ws-text-3)' : 'var(--ws-text)',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                opacity: currentPage === 1 ? 0.5 : 1,
                transition: 'all 0.15s ease'
              }}
            >
              ← Prev
            </button>
            <span style={{ color: 'var(--ws-text-2)', fontWeight: 600 }}>PAGE {currentPage} OF {totalPages}</span>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              style={{
                padding: '6px 12px',
                background: 'var(--ws-bg-1)',
                border: '1px solid var(--ws-border)',
                borderRadius: '6px',
                color: currentPage === totalPages ? 'var(--ws-text-3)' : 'var(--ws-text)',
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                opacity: currentPage === totalPages ? 0.5 : 1,
                transition: 'all 0.15s ease'
              }}
            >
              Next →
            </button>
          </div>
        )}

      </div>

    </div>
  );
}
