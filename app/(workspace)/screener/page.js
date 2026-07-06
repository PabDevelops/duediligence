'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '../../components/AuthProvider';
import Sparkline from '../../components/Sparkline';

const fmt = (val) => {
  if (val === null || val === undefined) return '—';
  if (Math.abs(val) >= 1e12) return `$${(val / 1e12).toFixed(1)}T`;
  if (Math.abs(val) >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
  if (Math.abs(val) >= 1e6) return `$${(val / 1e6).toFixed(0)}M`;
  return `$${val.toLocaleString()}`;
};
const fmtP = (v) => v !== null && v !== undefined ? `${v}%` : '—';
const fmtN = (v, d = 1) => v !== null && v !== undefined ? v.toFixed(d) : '—';

const MOCK_GUEST_STOCKS = [
  { ticker: 'AAPL', name: 'Apple Inc.', sector: 'Technology', currentPrice: 175.50, marketCap: 2750000000000, pe: 28.2, revGrowth: 8.5, opMargin: 30.2, fcfYield: 4.8, roe: 145.4, grossMargin: 44.3, netDebt: 65000000000, eps: 6.13 },
  { ticker: 'MSFT', name: 'Microsoft Corporation', sector: 'Technology', currentPrice: 415.20, marketCap: 3100000000000, pe: 35.8, revGrowth: 15.2, opMargin: 43.6, fcfYield: 3.5, roe: 38.5, grossMargin: 68.9, netDebt: 45000000000, eps: 11.60 },
  { ticker: 'NVDA', name: 'NVIDIA Corporation', sector: 'Technology', currentPrice: 875.00, marketCap: 2200000000000, pe: 72.4, revGrowth: 125.8, opMargin: 54.1, fcfYield: 2.8, roe: 91.2, grossMargin: 76.2, netDebt: -12000000000, eps: 12.08 },
  { ticker: 'AMZN', name: 'Amazon.com, Inc.', sector: 'Consumer Cyclical', currentPrice: 180.10, marketCap: 1870000000000, pe: 41.5, revGrowth: 12.1, opMargin: 9.8, fcfYield: 5.2, roe: 20.3, grossMargin: 46.5, netDebt: 35000000000, eps: 4.32 },
  { ticker: 'GOOGL', name: 'Alphabet Inc.', sector: 'Technology', currentPrice: 152.30, marketCap: 1900000000000, pe: 25.4, revGrowth: 13.4, opMargin: 27.8, fcfYield: 4.9, roe: 27.2, grossMargin: 56.8, netDebt: -65000000000, eps: 5.80 },
  { ticker: 'META', name: 'Meta Platforms, Inc.', sector: 'Technology', currentPrice: 495.80, marketCap: 1250000000000, pe: 24.1, revGrowth: 25.3, opMargin: 38.2, fcfYield: 4.5, roe: 28.4, grossMargin: 81.1, netDebt: -32000000000, eps: 14.87 }
];

const PRESETS = {
  all: { label: 'All Stocks', filters: { minMargin: '', maxPE: '', minFCFYield: '', minRevGrowth: '', minROE: '', minGrossMargin: '' } },
  tech: { label: 'Tech Growth', filters: { minMargin: '20', maxPE: '50', minFCFYield: '', minRevGrowth: '15', minROE: '', minGrossMargin: '30' } },
  value: { label: 'Value Gems', filters: { minMargin: '', maxPE: '18', minFCFYield: '5', minRevGrowth: '', minROE: '15', minGrossMargin: '' } },
  cash: { label: 'Cash Cows', filters: { minMargin: '15', maxPE: '', minFCFYield: '7', minRevGrowth: '', minROE: '', minGrossMargin: '' } },
  quality: { label: 'High Quality', filters: { minMargin: '25', maxPE: '', minFCFYield: '', minRevGrowth: '', minROE: '20', minGrossMargin: '40' } },
};

export default function WorkspaceScreener() {
  const router = useRouter();
  const { user, isLoaded, isSignedIn } = useUser();
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sector, setSector] = useState('All');
  const [sortBy, setSortBy] = useState('marketCap');
  const [sortDir, setSortDir] = useState('desc');
  const [sparklines, setSparklines] = useState({});
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [isPro, setIsPro] = useState(false);
  const [activePreset, setActivePreset] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const tableRef = useRef(null);
  const PAGE_SIZE = 50;

  const [filters, setFilters] = useState({
    minMargin: '',
    maxPE: '',
    minFCFYield: '',
    minRevGrowth: '',
    minROE: '',
    minGrossMargin: ''
  });

  // Load user data / subscription
  useEffect(() => {
    if (isSignedIn) {
      fetch('/api/subscription').then(r => r.json()).then(d => setIsPro(d.isPro)).catch(() => {});
      fetch('/api/screener').then(r => r.json()).then(d => { setStocks(d.stocks || []); setLoading(false); }).catch(() => setLoading(false));
    } else {
      // For guests, use mock list
      setStocks(MOCK_GUEST_STOCKS);
      setLoading(false);
    }
  }, [isSignedIn]);

  useEffect(() => {
    if (tableRef.current) tableRef.current.scrollTop = 0;
  }, [search, sector, filters]);

  const loadSparkline = async (ticker) => {
    if (sparklines[ticker]) return;
    try {
      const res = await fetch(`/api/sparkline?ticker=${ticker}`);
      const data = await res.json();
      setSparklines(prev => ({ ...prev, [ticker]: data.candles || [] }));
    } catch (err) {
      console.error(err);
    }
  };

  const applyPreset = (key) => {
    setActivePreset(key);
    setFilters(PRESETS[key].filters);
    setPage(1);
  };

  const resetFilters = () => {
    setActivePreset('all');
    setFilters({
      minMargin: '',
      maxPE: '',
      minFCFYield: '',
      minRevGrowth: '',
      minROE: '',
      minGrossMargin: ''
    });
    setSector('All');
    setSearch('');
    setPage(1);
  };

  // Compute sector counts
  const sectorCounts = useMemo(() => {
    const counts = {};
    stocks.forEach(s => {
      if (s.sector) {
        counts[s.sector] = (counts[s.sector] || 0) + 1;
      }
    });
    return counts;
  }, [stocks]);

  const filtered = useMemo(() => {
    return stocks
      .filter(s => sector === 'All' || s.sector === sector)
      .filter(s => !search || s.ticker.includes(search.toUpperCase()) || s.name?.toUpperCase().includes(search.toUpperCase()))
      .filter(s => filters.minMargin === '' || (s.opMargin !== null && s.opMargin >= Number(filters.minMargin)))
      .filter(s => filters.maxPE === '' || (s.pe !== null && s.pe > 0 && s.pe <= Number(filters.maxPE)))
      .filter(s => filters.minFCFYield === '' || (s.fcfYield !== null && s.fcfYield >= Number(filters.minFCFYield)))
      .filter(s => filters.minRevGrowth === '' || (s.revGrowth !== null && s.revGrowth >= Number(filters.minRevGrowth)))
      .filter(s => filters.minROE === '' || (s.roe !== null && s.roe >= Number(filters.minROE)))
      .filter(s => filters.minGrossMargin === '' || (s.grossMargin !== null && s.grossMargin >= Number(filters.minGrossMargin)))
      .sort((a, b) => {
        const av = a[sortBy] ?? (sortDir === 'desc' ? -Infinity : Infinity);
        const bv = b[sortBy] ?? (sortDir === 'desc' ? -Infinity : Infinity);
        return sortDir === 'desc' ? bv - av : av - bv;
      });
  }, [stocks, sector, search, filters, sortBy, sortDir]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = useMemo(() => {
    return filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }, [filtered, page]);

  // Auto-load sparklines for currently visible paginated stocks
  useEffect(() => {
    paginated.forEach(s => {
      if (!sparklines[s.ticker]) {
        loadSparkline(s.ticker);
      }
    });
  }, [paginated, sparklines]);

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortBy(col); setSortDir('desc'); }
  };

  const ColHeader = ({ col, label }) => (
    <th onClick={() => toggleSort(col)}
      style={{
        padding: '12px 14px',
        textAlign: 'right',
        fontWeight: 700,
        fontSize: '10px',
        letterSpacing: '0.6px',
        color: sortBy === col ? 'var(--ws-accent)' : 'var(--ws-text-3)',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        userSelect: 'none',
        borderBottom: '2px solid var(--ws-border)',
        transition: 'color 0.15s ease'
      }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        {label}
        {sortBy === col && (
          <span style={{ fontSize: '9px', color: 'var(--ws-accent)' }}>
            {sortDir === 'desc' ? '▼' : '▲'}
          </span>
        )}
      </div>
    </th>
  );

  const gated = (content) => isPro ? content : (
    <span onClick={(e) => { e.stopPropagation(); router.push('/pricing'); }}
      style={{
        fontSize: '9px',
        fontWeight: 700,
        color: '#f59e0b', // Pro-gate amber badge, intentionally distinct from the theme accent
        background: 'rgba(245, 158, 11, 0.1)',
        border: '1px solid rgba(245, 158, 11, 0.2)',
        borderRadius: '4px',
        padding: '2px 6px',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px'
      }}>
      Unlock Pro
    </span>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - var(--topbar-height))', overflow: 'hidden' }}>

      {/* Terminal title bar */}
      <div style={{ background: 'var(--ws-bg-2)', borderBottom: '1px solid var(--ws-border)', padding: '7px 16px', flexShrink: 0 }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: 'var(--ws-accent)', fontWeight: 700, letterSpacing: '1px' }}>
          $ traq screener
        </span>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

      {/* Filters Sidebar Backdrop on Mobile */}
      {showFilters && (
        <div className="screener-filters-backdrop" onClick={() => setShowFilters(false)} />
      )}

      {/* Filters Sidebar */}
      <div className={`screener-filters-sidebar ${showFilters ? 'open' : ''}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ color: 'var(--ws-text)', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 700, letterSpacing: '1.5px' }}>
            SCREENER FILTERS
          </div>
          <button onClick={resetFilters} style={{
            background: 'none',
            border: 'none',
            color: 'var(--ws-accent)',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer'
          }}>
            Reset
          </button>
        </div>

        {/* Sectors list */}
        <div>
          <div style={{ color: 'var(--ws-text-3)', fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', fontWeight: 700, letterSpacing: '1.5px', marginBottom: '8px', textTransform: 'uppercase' }}>
            SECTORS
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <button onClick={() => setSector('All')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                padding: '6px 10px',
                fontSize: '11px',
                background: sector === 'All' ? 'var(--ws-accent-dim)' : 'none',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: sector === 'All' ? 700 : 500,
                color: sector === 'All' ? 'var(--ws-accent)' : 'var(--ws-text-2)',
                textAlign: 'left',
                transition: 'all 0.15s ease'
              }}>
              <span>All Sectors</span>
              <span style={{ opacity: 0.6, fontSize: '10px' }}>({stocks.length})</span>
            </button>
            {Object.keys(sectorCounts).sort().map(sec => (
              <button key={sec} onClick={() => setSector(sec)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '6px 10px',
                  fontSize: '11px',
                  background: sector === sec ? 'var(--ws-accent-dim)' : 'none',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: sector === sec ? 700 : 500,
                  color: sector === sec ? 'var(--ws-accent)' : 'var(--ws-text-2)',
                  textAlign: 'left',
                  transition: 'all 0.15s ease'
                }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '6px' }}>{sec}</span>
                <span style={{ opacity: 0.6, fontSize: '10px' }}>({sectorCounts[sec]})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Numeric Filters */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid var(--ws-border)', paddingTop: '16px' }}>
          <div style={{ color: 'var(--ws-text-3)', fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', fontWeight: 700, letterSpacing: '1.5px', marginBottom: '4px', textTransform: 'uppercase' }}>
            METRIC THRESHOLDS
          </div>

          {[
            { key: 'maxPE', label: 'Max P/E Ratio', placeholder: 'e.g. 25' },
            { key: 'minMargin', label: 'Min Operating Margin %', placeholder: 'e.g. 15' },
            { key: 'minGrossMargin', label: 'Min Gross Margin %', placeholder: 'e.g. 40' },
            { key: 'minFCFYield', label: 'Min FCF Yield %', placeholder: 'e.g. 5' },
            { key: 'minRevGrowth', label: 'Min Revenue Growth %', placeholder: 'e.g. 10' },
            { key: 'minROE', label: 'Min ROE %', placeholder: 'e.g. 15' },
          ].map(f => (
            <div key={f.key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ color: 'var(--ws-text-2)', fontSize: '11px', fontWeight: 600 }}>{f.label}</span>
                {filters[f.key] && (
                  <span style={{ color: 'var(--ws-accent)', fontSize: '10px', fontWeight: 700 }}>
                    {filters[f.key]}
                  </span>
                )}
              </div>
              <input 
                type="number" 
                placeholder={f.placeholder} 
                value={filters[f.key]} 
                onChange={e => setFilters(prev => ({ ...prev, [f.key]: e.target.value }))}
                style={{
                  width: '100%',
                  background: 'var(--ws-bg-1)',
                  border: '1px solid var(--ws-border)',
                  borderRadius: '6px',
                  color: 'var(--ws-text)',
                  fontSize: '11px',
                  padding: '6px 10px',
                  outline: 'none',
                  transition: 'border-color 0.15s ease'
                }}
                onFocus={e => e.target.style.borderColor = 'var(--ws-accent)'}
                onBlur={e => e.target.style.borderColor = 'var(--ws-border)'}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Main Grid View */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
        
        {/* Guest Lock Overlay */}
        {!isSignedIn && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(9, 9, 11, 0.7)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            padding: '24px'
          }}>
            <div style={{
              background: 'var(--ws-bg-2)',
              border: '1px solid var(--ws-border)',
              borderRadius: '12px',
              padding: '28px',
              maxWidth: '400px',
              width: '100%',
              boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              gap: '14px'
            }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--ws-text)', margin: 0 }}>Unlock Stock Screener</h3>
              <p style={{ fontSize: '11px', color: 'var(--ws-text-3)', lineHeight: '1.6', margin: 0 }}>
                Sign in or register to filters & explore over 100+ global companies, interactive sparklines, and premium valuation metrics.
              </p>
              <div style={{ display: 'flex', gap: '8px', width: '100%', marginTop: '6px' }}>
                <button onClick={() => router.push('/sign-in')} style={{
                  flex: 1,
                  background: 'var(--ws-accent)',
                  color: 'var(--ws-bg-1)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '9px 12px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}>
                  Sign In
                </button>
                <button onClick={() => router.push('/sign-up')} style={{
                  flex: 1,
                  background: 'none',
                  border: '1px solid var(--ws-border)',
                  color: 'var(--ws-text)',
                  borderRadius: '6px',
                  padding: '9px 12px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}>
                  Register
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Top Control Bar */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--ws-border)',
          background: 'var(--ws-bg)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
            <input 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              placeholder="Search ticker or company name..."
              style={{
                flex: 1,
                maxWidth: '360px',
                background: 'var(--ws-bg-2)',
                border: '1px solid var(--ws-border)',
                borderRadius: '8px',
                color: 'var(--ws-text)',
                fontSize: '12px',
                padding: '8px 12px',
                outline: 'none',
                transition: 'border-color 0.15s ease'
              }}
              onFocus={e => e.target.style.borderColor = 'var(--ws-accent)'}
              onBlur={e => e.target.style.borderColor = 'var(--ws-border)'}
            />
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--ws-text-3)' }}>
              {filtered.length} matching companies
            </div>
          </div>

          {/* Preset Buttons */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '10px', color: 'var(--ws-text-3)', fontWeight: 700, marginRight: '4px' }}>
              PRESETS:
            </span>
            {Object.entries(PRESETS).map(([key, p]) => (
              <button 
                key={key} 
                onClick={() => applyPreset(key)}
                style={{
                  background: activePreset === key ? 'var(--ws-accent)' : 'var(--ws-bg-2)',
                  color: activePreset === key ? 'var(--ws-bg-1)' : 'var(--ws-text-2)',
                  border: activePreset === key ? 'none' : '1px solid var(--ws-border)',
                  borderRadius: '20px',
                  padding: '4px 12px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={e => { if (activePreset !== key) e.currentTarget.style.background = 'var(--ws-border)' }}
                onMouseLeave={e => { if (activePreset !== key) e.currentTarget.style.background = 'var(--ws-bg-2)' }}
              >
                {p.label}
              </button>
            ))}
            <button className="mobile-filters-toggle-btn" onClick={() => setShowFilters(!showFilters)} style={{
              background: showFilters ? 'var(--ws-accent)' : 'var(--ws-bg-2)',
              color: showFilters ? 'var(--ws-bg-1)' : 'var(--ws-text)',
              border: '1px solid var(--ws-border)',
              borderRadius: '20px',
              padding: '4px 12px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              marginLeft: 'auto'
            }}>
              {showFilters ? '✕ Close Filters' : '⚙ Filters'}
            </button>
          </div>
        </div>

        {/* Quantitative Data Table */}
        <div ref={tableRef} className="responsive-table-container" style={{ flex: 1, overflow: 'auto' }}>
          {loading ? (
            <div style={{ padding: '80px 20px', textAlign: 'center', color: 'var(--ws-text-3)' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: 'var(--ws-accent)', fontSize: '11px' }}>▶</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', letterSpacing: '1px' }}>LOADING QUANTITATIVE DATASET...</span>
              </div>
            </div>
          ) : (
            <table className="responsive-table" style={{ fontSize: '11px', textAlign: 'left' }}>
              <thead style={{ position: 'sticky', top: 0, background: 'var(--ws-bg)', zIndex: 2 }}>
                <tr style={{ background: 'var(--ws-bg-2)' }}>
                  <th className="sticky-col" style={{ padding: '12px 14px', fontWeight: 700, fontSize: '10px', color: 'var(--ws-text-3)', width: '70px', borderBottom: '2px solid var(--ws-border)' }}>TICKER</th>
                  <th style={{ padding: '12px 14px', fontWeight: 700, fontSize: '10px', color: 'var(--ws-text-3)', borderBottom: '2px solid var(--ws-border)' }}>COMPANY NAME</th>
                  <th style={{ padding: '12px 14px', fontWeight: 700, fontSize: '10px', color: 'var(--ws-text-3)', borderBottom: '2px solid var(--ws-border)' }}>SECTOR</th>
                  <ColHeader col="currentPrice" label="PRICE" />
                  <ColHeader col="marketCap" label="MKT CAP" />
                  <ColHeader col="pe" label="P/E" />
                  <ColHeader col="revGrowth" label="REV GROWTH" />
                  <ColHeader col="opMargin" label="OP MARGIN" />
                  <ColHeader col="fcfYield" label="FCF YIELD" />
                  <ColHeader col="roe" label="ROE" />
                  <ColHeader col="grossMargin" label="GROSS MARGIN" />
                  <th style={{ padding: '12px 14px', fontWeight: 700, fontSize: '10px', color: 'var(--ws-text-3)', textAlign: 'right', borderBottom: '2px solid var(--ws-border)', width: '85px' }}>TREND</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((s, idx) => (
                  <tr key={s.ticker} onClick={() => router.push(`/stock/${s.ticker}`)}
                    style={{
                      borderBottom: '1px solid var(--ws-border)',
                      cursor: 'pointer',
                      background: idx % 2 === 0 ? 'var(--ws-bg-1)' : 'var(--ws-bg-2)',
                      transition: 'background 0.15s ease'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--ws-bg-2)'}
                    onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? 'var(--ws-bg-1)' : 'var(--ws-bg-2)'}
                  >
                    <td className="sticky-col" style={{ padding: '10px 14px', fontWeight: 800, color: 'var(--ws-text)' }}>
                      {s.ticker}
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--ws-text-2)', fontWeight: 600, maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.name}
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--ws-text-3)' }}>
                      {s.sector || '—'}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600 }}>
                      {s.currentPrice ? `$${s.currentPrice.toFixed(2)}` : '—'}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600 }}>
                      {fmt(s.marketCap)}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: s.pe && s.pe < 20 ? 'var(--ws-accent)' : 'var(--ws-text)' }}>
                      {fmtN(s.pe)}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: s.revGrowth > 15 ? 'var(--ws-accent)' : s.revGrowth < 0 ? 'var(--ws-red)' : 'var(--ws-text)' }}>
                      {s.revGrowth !== null ? `${s.revGrowth > 0 ? '+' : ''}${s.revGrowth}%` : '—'}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                      {gated(fmtP(s.opMargin))}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                      {gated(s.fcfYield !== null ? `${s.fcfYield}%` : '—')}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                      {gated(s.roe !== null ? `${s.roe}%` : '—')}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                      {gated(s.grossMargin !== null ? `${s.grossMargin}%` : '—')}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', width: '70px', height: '22px' }}>
                        <Sparkline data={sparklines[s.ticker] || []} width={70} height={20} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Empty State */}
          {!loading && filtered.length === 0 && (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--ws-text-3)', fontSize: '12px' }}>
              No companies match your filters. Try resetting or adjusting the values.
            </div>
          )}
        </div>

        {/* Footer Pagination */}
        {!loading && totalPages > 1 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            padding: '14px 20px',
            borderTop: '1px solid var(--ws-border)',
            background: 'var(--ws-bg-2)'
          }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              style={{
                padding: '6px 14px',
                fontSize: '11px',
                fontWeight: 700,
                border: '1px solid var(--ws-border)',
                borderRadius: '6px',
                background: 'var(--ws-bg-1)',
                color: 'var(--ws-text)',
                opacity: page === 1 ? 0.4 : 1,
                cursor: page === 1 ? 'default' : 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => { if (page !== 1) e.currentTarget.style.background = 'var(--ws-border)' }}
              onMouseLeave={e => { if (page !== 1) e.currentTarget.style.background = 'var(--ws-bg-1)' }}
            >
              ← Prev
            </button>
            <span style={{ color: 'var(--ws-text-2)', fontSize: '11px', fontWeight: 600 }}>
              Page {page} of {totalPages}
            </span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              style={{
                padding: '6px 14px',
                fontSize: '11px',
                fontWeight: 700,
                border: '1px solid var(--ws-border)',
                borderRadius: '6px',
                background: 'var(--ws-bg-1)',
                color: 'var(--ws-text)',
                opacity: page === totalPages ? 0.4 : 1,
                cursor: page === totalPages ? 'default' : 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => { if (page !== totalPages) e.currentTarget.style.background = 'var(--ws-border)' }}
              onMouseLeave={e => { if (page !== totalPages) e.currentTarget.style.background = 'var(--ws-bg-1)' }}
            >
              Next →
            </button>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
