'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import StockChart from '../../components/StockChart';
import MarketStatusDot from '../../components/workspace/MarketStatusDot';
import { useUser } from '../../components/AuthProvider';
import { useStockData } from '../../../lib/hooks/useStockData';

const CURRENCY_SYMBOLS = { USD: '$', EUR: '€', GBP: '£', JPY: '¥', CNY: '¥', CHF: 'CHF ', CAD: 'C$', AUD: 'A$', HKD: 'HK$', INR: '₹', KRW: '₩', SEK: 'kr', NOK: 'kr', DKK: 'kr' };
const curSym = (code) => !code || code === 'USD' ? '$' : (CURRENCY_SYMBOLS[code] || `${code} `);

const CATEGORIES = [
  { id: 'all', label: 'All Funds' },
  { id: 'equity', label: 'US Equity' },
  { id: 'sector', label: 'Sector Specific' },
  { id: 'international', label: 'International' },
  { id: 'fixed', label: 'Bonds & Gold' }
];

export default function ETFsPage() {
  const router = useRouter();
  const { isSignedIn } = useUser();
  const [etfsList, setEtfsList] = useState([]);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [selectedTicker, setSelectedTicker] = useState('SPY');
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState('aum');
  const [sortAsc, setSortAsc] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 25;

  const [livePriceData, setLivePriceData] = useState(null);
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [priceError, setPriceError] = useState(null);
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

  // Reset page when tab, search or sort changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, sortField, sortAsc]);

  // Load real-time price info for selected ticker. loadingPrice/priceError/
  // livePriceData are also written to directly by handleSearchSubmit below
  // (adding a custom ticker reuses the same loading/error UI), so this stays
  // synced into that shared state rather than exposing the hook's own.
  const { data: rawPriceData, error: fetchError, loading: fetchLoading } = useStockData(selectedTicker);
  useEffect(() => {
    setLoadingPrice(fetchLoading);
  }, [fetchLoading]);
  useEffect(() => {
    if (fetchError) {
      setPriceError(fetchError);
      setLivePriceData(null);
      return;
    }
    if (rawPriceData) {
      setPriceError(null);
      setLivePriceData({
        name: rawPriceData.name,
        ticker: selectedTicker,
        exchange: rawPriceData.exchange,
        currentPrice: rawPriceData.currentPrice,
        priceChange: rawPriceData.priceChange,
        priceChangePct: rawPriceData.priceChangePct,
        currency: rawPriceData.currency,
      });
    }
  }, [rawPriceData, fetchError, selectedTicker]);

  // Check whether the selected ETF is already on the user's watchlist
  useEffect(() => {
    fetch('/api/watchlist')
      .then(res => res.json())
      .then(data => {
        const tickers = data.tickers?.map(t => t.ticker) || [];
        setInWatchlist(tickers.includes(selectedTicker));
      })
      .catch(() => {});
  }, [selectedTicker, isSignedIn]);

  const toggleWatchlist = async () => {
    if (!isSignedIn) { window.location.href = '/sign-in'; return; }
    const method = inWatchlist ? 'DELETE' : 'POST';
    await fetch('/api/watchlist', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker: selectedTicker }),
    });
    setInWatchlist(!inWatchlist);
  };

  const goToBuy = () => {
    if (!isSignedIn) { window.location.href = '/sign-in'; return; }
    router.push(`/portfolio?buy=${selectedTicker}`);
  };

  const handleSearchSubmit = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const cleanTicker = searchQuery.trim().toUpperCase();

    // If it's already in the list, select it
    const exists = etfsList.some(item => item.ticker === cleanTicker);
    if (exists) {
      setSelectedTicker(cleanTicker);
      setActiveTab('all');
      setSearchQuery('');
      return;
    }

    // Otherwise, fetch and add it dynamically on the server & DB!
    setLoadingPrice(true);
    setPriceError(null);
    try {
      const res = await fetch('/api/etfs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: cleanTicker })
      });
      const d = await res.json();
      if (d.error) {
        setPriceError(d.error);
      } else {
        setEtfsList(prev => {
          if (prev.some(item => item.ticker === d.ticker)) return prev;
          return [d, ...prev];
        });
        setSelectedTicker(d.ticker);
        setActiveTab('all');
      }
    } catch (err) {
      setPriceError('Failed to fetch pricing');
    } finally {
      setLoadingPrice(false);
      setSearchQuery('');
    }
  };

  const etfDetails = useMemo(() => {
    return etfsList.find(item => item.ticker === selectedTicker);
  }, [etfsList, selectedTicker]);

  const price = livePriceData?.currentPrice;
  const change = livePriceData?.priceChangePct;
  const isPositive = change != null && change >= 0;

  // Sorting & Filtering logic for Left List
  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const parseAUM = (aumStr) => {
    if (!aumStr || aumStr === 'See Prospectus') return 0;
    return parseFloat(aumStr.replace(/[$\$,B]/g, '')) || 0;
  };

  const parsePercent = (pctStr) => {
    if (!pctStr || pctStr === 'See Prospectus') return 0;
    return parseFloat(pctStr.replace(/%/g, '')) || 0;
  };

  const filteredETFs = useMemo(() => {
    let list = [...etfsList];

    // Filter by Tab
    if (activeTab !== 'all') {
      list = list.filter(item => item.category === activeTab);
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
      } else {
        valA = a[sortField]?.toUpperCase() || '';
        valB = b[sortField]?.toUpperCase() || '';
      }

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });

    return list;
  }, [etfsList, activeTab, sortField, sortAsc]);

  const totalPages = Math.ceil(filteredETFs.length / ITEMS_PER_PAGE);
  const paginatedETFs = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredETFs.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredETFs, currentPage]);

  const SortHeader = ({ field, label, align = 'right' }) => (
    <th onClick={() => handleSort(field)}
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
      <style dangerouslySetInnerHTML={{ __html: `
        .etfs-dual-panel {
          display: grid;
          grid-template-columns: 460px 1fr;
          gap: 24px;
          align-items: stretch;
        }
        @media (max-width: 1023px) {
          .etfs-dual-panel {
            grid-template-columns: 1fr;
          }
        }
      `}} />

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
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: 'var(--ws-text)', letterSpacing: '-0.75px', marginBottom: '4px' }}>ETF Terminal & Screener</h1>
          <p style={{ fontSize: '12px', color: 'var(--ws-text-3)' }}>Institutional-grade ETF screener. Meticulous tracking of expense ratios, yields, assets, and holdings.</p>
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
              cursor: 'pointer'
            }}
          >
            GO
          </button>
        </form>
      </div>

      {/* ERROR STATUS */}
      {priceError && (
        <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid var(--ws-red)', padding: '16px', borderRadius: '6px', color: 'var(--ws-red)', fontSize: '13px', fontFamily: "'JetBrains Mono', monospace" }}>
          [ERROR] Ticker "{selectedTicker}" was not found or failed to load. Make sure it is a valid US or international ETF symbol.
        </div>
      )}

      {/* DUAL PANEL LAYOUT */}
      <div className="etfs-dual-panel">

        {/* LEFT COLUMN: FILTER TABS & SCREENER LIST */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', padding: '16px', height: '100%', boxSizing: 'border-box' }}>

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

          {/* SCREENER LIST TABLE */}
          <div className="responsive-table-container" style={{ flex: 1, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
              <thead style={{ position: 'sticky', top: 0, background: 'var(--ws-bg-2)', zIndex: 1 }}>
                <tr>
                  <th onClick={() => handleSort('ticker')} style={{ padding: '10px 12px', fontWeight: 700, fontSize: '10px', color: sortField === 'ticker' ? 'var(--ws-accent)' : 'var(--ws-text-3)', cursor: 'pointer', borderBottom: '2px solid var(--ws-border)' }}>
                    TICKER {sortField === 'ticker' && (sortAsc ? '▲' : '▼')}
                  </th>
                  <th style={{ padding: '10px 12px', fontWeight: 700, fontSize: '10px', color: 'var(--ws-text-3)', borderBottom: '2px solid var(--ws-border)' }}>NAME</th>
                  <SortHeader field="aum" label="AUM" />
                  <SortHeader field="expense" label="EXP" />
                </tr>
              </thead>
              <tbody>
                {paginatedETFs.map((item, idx) => {
                  const active = selectedTicker === item.ticker;
                  return (
                    <tr
                      key={item.ticker}
                      onClick={() => setSelectedTicker(item.ticker)}
                      style={{
                        cursor: 'pointer',
                        background: active ? 'var(--ws-accent-dim)' : idx % 2 === 0 ? 'var(--ws-bg-1)' : 'var(--ws-bg-2)',
                        borderBottom: '1px solid var(--ws-border)',
                        transition: 'background 0.15s ease'
                      }}
                    >
                      <td style={{ padding: '10px 12px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, color: active ? 'var(--ws-accent)' : 'var(--ws-text)' }}>
                        {item.ticker}
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--ws-text-2)', fontWeight: 600, maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.name}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: 'var(--ws-text)' }}>
                        {item.aum}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", color: 'var(--ws-text-3)' }}>
                        {item.expenseRatio}
                      </td>
                    </tr>
                  );
                })}
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

        {/* RIGHT COLUMN: DETAIL DASHBOARD */}
        {etfDetails && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* PRICE HEADER CARD */}
            <div style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', color: 'var(--ws-text-3)', letterSpacing: '1.5px', marginBottom: '6px' }}>
                    {selectedTicker} · {livePriceData?.exchange || 'NASDAQ'} · ETF FUND SUMMARY
                  </div>
                  <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--ws-text)', margin: 0, letterSpacing: '-0.5px' }}>{etfDetails.name}</h2>
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                  {loadingPrice ? (
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '26px', color: 'var(--ws-text-3)' }}>LOADING...</span>
                  ) : price != null ? (
                    <>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '28px', fontWeight: 800, color: 'var(--ws-text)' }}>
                        {curSym(livePriceData?.currency)}{price.toFixed(2)}
                      </span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '14px', fontWeight: 700, color: isPositive ? 'var(--ws-accent)' : 'var(--ws-red)' }}>
                        {isPositive ? '+' : ''}{change?.toFixed(2)}%
                      </span>
                      <MarketStatusDot ticker={selectedTicker} showLabel />
                    </>
                  ) : (
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '14px', color: 'var(--ws-text-3)' }}>PRICE N/A</span>
                  )}
                </div>
              </div>

              {/* ACTIONS */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--ws-border)' }}>
                <button onClick={toggleWatchlist}
                  style={inWatchlist
                    ? { fontSize: '12px', padding: '8px 14px', background: 'var(--ws-text)', color: 'var(--ws-bg)', border: 'none', fontWeight: 600, cursor: 'pointer' }
                    : { fontSize: '12px', padding: '8px 14px', background: 'var(--ws-bg-2)', border: '1px solid var(--ws-border)', color: 'var(--ws-text)', fontWeight: 600, cursor: 'pointer' }}>
                  {inWatchlist ? 'Remove from Watchlist' : '+ Add to Watchlist'}
                </button>
                <button onClick={goToBuy}
                  style={{ fontSize: '12px', padding: '8px 14px', background: 'var(--ws-accent)', color: 'var(--ws-bg-1)', border: 'none', fontWeight: 700, cursor: 'pointer' }}>
                  + Add to Portfolio
                </button>
              </div>
            </div>

            {/* PERFORMANCE CHART */}
            <div style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', overflow: 'hidden' }}>
              <div style={{ background: 'var(--ws-bg-2)', borderBottom: '1px solid var(--ws-border)', padding: '10px 16px' }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', color: 'var(--ws-text-3)', letterSpacing: '1px', fontWeight: 700 }}>PERFORMANCE & CHART HISTORICALS</span>
              </div>
              <StockChart ticker={selectedTicker} currency={livePriceData?.currency || 'USD'} />
            </div>

            {/* METRICS GRID */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              {[
                { label: 'EXPENSE RATIO', value: etfDetails.expenseRatio, desc: 'Annualized cost ratio' },
                { label: 'AUM', value: etfDetails.aum, desc: 'Assets Under Management' },
                { label: 'DIVIDEND YIELD', value: etfDetails.yield, desc: '12-month trailing yield' },
                { label: 'AVG DAILY VOLUME', value: etfDetails.volume, desc: 'Liquidity metric' },
                { label: 'PE RATIO', value: etfDetails.pe, desc: 'Average portfolio price/earnings' },
                { label: 'BETA (1Y)', value: etfDetails.beta, desc: 'Volatility vs Benchmark' },
                { label: 'ISSUER', value: etfDetails.issuer, desc: 'Fund manager' },
                { label: 'INCEPTION DATE', value: etfDetails.inception, desc: 'Fund creation date' },
              ].map((m, i) => (
                <div key={i} style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', padding: '14px 16px' }}>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '9px', color: 'var(--ws-text-3)', letterSpacing: '1px', fontWeight: 700, marginBottom: '6px' }}>
                    {m.label}
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: m.label === 'EXPENSE RATIO' ? 'var(--ws-accent)' : 'var(--ws-text)', marginBottom: '4px' }}>
                    {m.value}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--ws-text-3)' }}>
                    {m.desc}
                  </div>
                </div>
              ))}
            </div>

            {/* EXPOSURES ROW */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', flexWrap: 'wrap' }}>

              {/* TOP HOLDINGS */}
              <div style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)' }}>
                <div style={{ background: 'var(--ws-bg-2)', borderBottom: '1px solid var(--ws-border)', padding: '10px 16px' }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', color: 'var(--ws-text-3)', letterSpacing: '1px', fontWeight: 700 }}>PORTFOLIO TOP HOLDINGS</span>
                </div>
                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {etfDetails.holdings.length === 0 ? (
                    <span style={{ fontSize: '11px', color: 'var(--ws-text-3)' }}>No holdings data reported by the fund.</span>
                  ) : etfDetails.holdings.map((h, i) => {
                    const weightPct = parseFloat(h.weight);
                    return (
                      <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 600 }}>
                          <span style={{ color: 'var(--ws-text-2)' }}>{h.name} <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '9px', color: 'var(--ws-accent)', marginLeft: '4px' }}>{h.ticker}</span></span>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--ws-text)' }}>{h.weight}</span>
                        </div>
                        <div style={{ height: '5px', background: 'var(--ws-bg-2)', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${weightPct}%`, background: 'var(--ws-accent)', borderRadius: '2px' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SECTOR EXPOSURE */}
              <div style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)' }}>
                <div style={{ background: 'var(--ws-bg-2)', borderBottom: '1px solid var(--ws-border)', padding: '10px 16px' }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', color: 'var(--ws-text-3)', letterSpacing: '1px', fontWeight: 700 }}>SECTOR ALLOCATION EXPOSURE</span>
                </div>
                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {etfDetails.sectors.length === 0 ? (
                    <span style={{ fontSize: '11px', color: 'var(--ws-text-3)' }}>No sector data reported by the fund.</span>
                  ) : etfDetails.sectors.map((s, i) => {
                    const weightPct = parseFloat(s.weight);
                    return (
                      <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 600 }}>
                          <span style={{ color: 'var(--ws-text-2)' }}>{s.name}</span>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--ws-text)' }}>{s.weight}</span>
                        </div>
                        <div style={{ height: '5px', background: 'var(--ws-bg-2)', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${weightPct}%`, background: 'var(--ws-text-2)', borderRadius: '2px' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>

          </div>
        )}

      </div>

    </div>
  );
}
