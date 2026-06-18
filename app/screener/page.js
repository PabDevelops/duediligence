'use client';
import { useState, useEffect, useRef } from 'react';
import Sparkline from '../components/Sparkline';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import Topbar from '../components/Topbar';

const fmt = (val) => {
  if (val === null || val === undefined) return '—';
  if (Math.abs(val) >= 1e12) return `$${(val / 1e12).toFixed(1)}T`;
  if (Math.abs(val) >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
  if (Math.abs(val) >= 1e6) return `$${(val / 1e6).toFixed(0)}M`;
  return `$${val.toLocaleString()}`;
};
const fmtP = (v) => v !== null && v !== undefined ? `${v}%` : '—';
const fmtN = (v, d = 1) => v !== null && v !== undefined ? v.toFixed(d) : '—';

const SECTORS = ['All'];

export default function Screener() {
  const router = useRouter();
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sector, setSector] = useState('All');
  const [sortBy, setSortBy] = useState('marketCap');
  const [sparklines, setSparklines] = useState({});

const loadSparkline = async (ticker) => {
  if (sparklines[ticker]) return;
  const res = await fetch(`/api/sparkline?ticker=${ticker}`);
  const data = await res.json();
  setSparklines(prev => ({ ...prev, [ticker]: data.candles }));
};
  const [sortDir, setSortDir] = useState('desc');
  const tableRef = useRef(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;
  const [isPro, setIsPro] = useState(false);
  const { isSignedIn } = useUser();

  useEffect(() => {
    fetch('/api/subscription')
      .then(r => r.json())
      .then(d => setIsPro(d.isPro))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (tableRef.current) tableRef.current.scrollTop = 0;
  }, [search, sector]);

  const [filters, setFilters] = useState({
    minMargin: '', maxPE: '', minFCFYield: '', minRevGrowth: '',
  });
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    fetch('/api/screener')
      .then(r => r.json())
      .then(d => { setStocks(d.stocks || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = stocks
    .filter(s => sector === 'All' || s.sector === sector)
    .filter(s => !search || s.ticker.includes(search.toUpperCase()) || s.name?.toUpperCase().includes(search.toUpperCase()))
    .filter(s => filters.minMargin === '' || (s.opMargin !== null && s.opMargin >= Number(filters.minMargin)))
    .filter(s => filters.maxPE === '' || (s.pe !== null && s.pe > 0 && s.pe <= Number(filters.maxPE)))
    .filter(s => filters.minFCFYield === '' || (s.fcfYield !== null && s.fcfYield >= Number(filters.minFCFYield)))
    .filter(s => filters.minRevGrowth === '' || (s.revGrowth !== null && s.revGrowth >= Number(filters.minRevGrowth)))
    .sort((a, b) => {
      const av = a[sortBy] ?? (sortDir === 'desc' ? -Infinity : Infinity);
      const bv = b[sortBy] ?? (sortDir === 'desc' ? -Infinity : Infinity);
      return sortDir === 'desc' ? bv - av : av - bv;
    });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);



  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortBy(col); setSortDir('desc'); }
  };

  const SortIcon = ({ col }) => sortBy === col ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ' ·';

  const ColHeader = ({ col, label }) => (
    <th onClick={() => toggleSort(col)}
      style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, fontSize: '11px', letterSpacing: '0.5px', color: sortBy === col ? 'var(--accent)' : 'var(--text-3)', cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none' }}>
      {label}<SortIcon col={col} />
    </th>
  );

  const activeFilterCount = Object.values(filters).filter(v => v !== '').length + (sector !== 'All' ? 1 : 0);

  return (
    <div className="screener-root" style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', fontFamily: 'Nunito, sans-serif' }}>

      <Topbar />
      {/* Search bar */}
      <div style={{ borderBottom: '1px solid var(--border)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(8,9,15,0.8)', backdropFilter: 'blur(10px)' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text)', fontFamily: 'Nunito, sans-serif', fontSize: '14px', padding: '10px 14px', outline: 'none', transition: 'border-color 0.2s' }}
            placeholder="Search ticker or name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
        </div>
        <button className="screener-filter-btn" onClick={() => setFiltersOpen(true)}
          style={{ display: 'none', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text-2)', padding: '10px 14px', fontFamily: 'Nunito, sans-serif', fontSize: '13px', fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
          Filters
          {activeFilterCount > 0 && (
            <span style={{ background: 'linear-gradient(135deg,#a78bfa,#60a5fa)', color: '#000', borderRadius: '20px', fontSize: '11px', fontWeight: 700, padding: '1px 8px' }}>{activeFilterCount}</span>
          )}
        </button>
        <span className="desktop-only" style={{ color: 'var(--text-3)', fontSize: '13px', fontWeight: 600, flexShrink: 0 }}>{filtered.length} companies</span>
      </div>

      <div style={{ display: 'flex' }}>
        {/* Filters sidebar (desktop only - mobile uses drawer) */}
        <div className="desktop-only" style={{ width: '200px', flexShrink: 0, borderRight: '1px solid var(--border)', padding: '16px', fontSize: '13px' }}>
          <div style={{ color: 'var(--text-3)', fontSize: '10px', letterSpacing: '2px', marginBottom: '16px', fontWeight: 700 }}>FILTERS</div>

          <div style={{ marginBottom: '16px' }}>
            <div style={{ color: 'var(--text-3)', fontSize: '11px', fontWeight: 700, marginBottom: '8px' }}>Sector</div>
            {['All', ...new Set(stocks.map(s => s.sector).filter(Boolean))].sort().map(sec => (
              <button key={sec} onClick={() => setSector(sec)}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '5px 10px', fontSize: '12px', background: sector === sec ? 'rgba(167,139,250,0.1)' : 'none', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Nunito, sans-serif', fontWeight: sector === sec ? 700 : 500, color: sector === sec ? 'var(--accent)' : 'var(--text-3)', marginBottom: '2px' }}>
                {sec}
              </button>
            ))}
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
            <div style={{ color: 'var(--text-3)', fontSize: '11px', fontWeight: 700, marginBottom: '12px' }}>Metrics</div>
            {[
              { key: 'minMargin', label: 'Min op. margin %' },
              { key: 'maxPE', label: 'Max P/E' },
              { key: 'minFCFYield', label: 'Min FCF yield %' },
              { key: 'minRevGrowth', label: 'Min rev growth %' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: '10px' }}>
                <div style={{ color: 'var(--text-3)', fontSize: '11px', marginBottom: '5px' }}>{f.label}</div>
                <input
                  type="number"
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', fontFamily: 'Nunito, sans-serif', fontSize: '13px', padding: '6px 10px', outline: 'none' }}
                  placeholder="—"
                  value={filters[f.key]}
                  onChange={e => setFilters(prev => ({ ...prev, [f.key]: e.target.value }))}
                />
              </div>
            ))}
            <button onClick={() => setFilters({ minMargin: '', maxPE: '', minFCFYield: '', minRevGrowth: '' })}
              className="btn-secondary" style={{ width: '100%', padding: '8px', fontSize: '12px', marginTop: '4px' }}>
              Reset filters
            </button>
          </div>
        </div>

        {/* Table */}
        <div ref={tableRef} style={{ flex: 1, overflow: 'auto', minHeight: '100vh', padding: '0 0 80px' }}>
          {!isPro && (
          <div style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent)', borderRadius: '14px', margin: '12px 16px', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--accent)', fontSize: '13px', fontWeight: 600 }}>🔒 Upgrade to Pro to see full metrics</span>
            <a href="/pricing" className="btn-primary" style={{ padding: '7px 18px', fontSize: '13px' }}>Upgrade →</a>
          </div>
        )}

        {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', color: 'var(--text-3)', fontSize: '14px' }}>
              Loading screener data...
            </div>
          ) : stocks.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', color: 'var(--text-3)', fontSize: '12px', textAlign: 'center', gap: '10px', padding: '0 24px' }}>
              <div style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text)', fontSize: '18px', fontWeight: 700 }}>No companies yet</div>
              <div>Visit a few stock pages to populate the screener.</div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                {['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'VISA', 'ASML'].map(t => (
                  <a key={t} href={`/stock/${t}`}
                    style={{ color: 'var(--accent)', fontSize: '12px', border: '1px solid var(--border)', borderRadius: '10px', padding: '6px 12px', textDecoration: 'none' }}>
                    {t}
                  </a>
                ))}
              </div>
            </div>
          ) : (
            <>
            <table className="desktop-only" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', fontFamily: 'Nunito, sans-serif' }}>
              <thead style={{ position: 'sticky', top: 0, background: 'rgba(8,9,15,0.95)', backdropFilter: 'blur(10px)' }}>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, fontSize: '11px', letterSpacing: '0.5px', color: 'var(--text-3)', width: '120px' }}>TICKER</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, fontSize: '11px', letterSpacing: '0.5px', color: 'var(--text-3)' }}>NAME</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, fontSize: '11px', letterSpacing: '0.5px', color: 'var(--text-3)' }}>SECTOR</th>
                  <ColHeader col="currentPrice" label="PRICE" />
                  <ColHeader col="marketCap" label="MKT CAP" />
                  <ColHeader col="pe" label="P/E" />
                  <ColHeader col="revGrowth" label="REV GROWTH" />
                  <ColHeader col="opMargin" label="OP MARGIN" />
                  <ColHeader col="fcfYield" label="FCF YIELD" />
                  <ColHeader col="roe" label="ROE" />
                  <ColHeader col="netDebt" label="NET DEBT" />
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 400, fontSize: '10px', letterSpacing: '1px', color: 'var(--text-3)' }}>TREND</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((s, i) => (
                  <tr key={s.ticker}
                    onClick={() => router.push(`/stock/${s.ticker}`)}
                    style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', background: 'var(--bg-1)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-2)'}
onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-1)'}>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '26px', height: '26px', borderRadius: '6px', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                          <img
                            src={`https://img.logo.dev/${s.name?.toLowerCase().replace(/\binc\b|\bcorp\b|\bltd\b|\bplc\b|\bco\b|\bllc\b|\bgroup\b|\bholdings\b|\binternational\b|\bthe\b/g, '').trim().split(/\s+/)[0].replace(/[^a-z0-9]/g, '')}.com?token=pk_B4aaLZF6S4G1YbCgqZq2Ug`}
                            alt=""
                            style={{ width: '16px', height: '16px', objectFit: 'contain' }}
                            onError={e => { e.target.style.display = 'none'; e.target.parentElement.style.background = 'var(--bg-2)'; e.target.parentElement.innerHTML = `<span style="color:var(--accent);font-size:8px;font-weight:600">${s.ticker.slice(0,2)}</span>`; }}
                          />
                        </div>
                        <span style={{ color: 'var(--accent)', fontWeight: 800, fontSize: '13px' }}>{s.ticker}</span>
                      </div>
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--text-2)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--text-3)', fontSize: '10px' }}>{s.sector || '—'}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', filter: !isPro ? 'blur(4px)' : 'none', userSelect: !isPro ? 'none' : 'auto' }}>{s.currentPrice ? `$${s.currentPrice.toFixed(2)}` : '—'}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', filter: !isPro ? 'blur(4px)' : 'none', userSelect: !isPro ? 'none' : 'auto' }}>{fmt(s.marketCap)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: s.pe > 30 ? 'var(--red)' : s.pe > 0 ? 'var(--green)' : 'var(--text-3)', filter: !isPro ? 'blur(4px)' : 'none', userSelect: !isPro ? 'none' : 'auto' }}>{fmtN(s.pe)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: s.revGrowth > 10 ? 'var(--green)' : s.revGrowth > 0 ? 'var(--accent)' : 'var(--red)', filter: !isPro ? 'blur(4px)' : 'none', userSelect: !isPro ? 'none' : 'auto' }}>{s.revGrowth !== null ? `${s.revGrowth > 0 ? '+' : ''}${s.revGrowth}%` : '—'}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: s.opMargin > 15 ? 'var(--green)' : s.opMargin > 0 ? 'var(--accent)' : 'var(--red)', filter: !isPro ? 'blur(4px)' : 'none', userSelect: !isPro ? 'none' : 'auto' }}>{fmtP(s.opMargin)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: s.fcfYield > 4 ? 'var(--green)' : s.fcfYield > 0 ? 'var(--accent)' : 'var(--red)', filter: !isPro ? 'blur(4px)' : 'none', userSelect: !isPro ? 'none' : 'auto' }}>{s.fcfYield !== null ? `${s.fcfYield}%` : '—'}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: s.roe > 15 ? 'var(--green)' : 'var(--text)', filter: !isPro ? 'blur(4px)' : 'none', userSelect: !isPro ? 'none' : 'auto' }}>{fmtP(s.roe)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: s.netDebt < 0 ? 'var(--green)' : 'var(--text)', filter: !isPro ? 'blur(4px)' : 'none', userSelect: !isPro ? 'none' : 'auto' }}>{fmt(s.netDebt)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}
  onMouseEnter={() => loadSparkline(s.ticker)}>
  <Sparkline data={sparklines[s.ticker] || []} width={80} height={28} />
</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile card list */}
            <div className="screener-cards" style={{ display: 'none', flexDirection: 'column', gap: '10px', padding: '12px 16px' }}>
              {paginated.map(s => (
                <div key={s.ticker} onClick={() => router.push(`/stock/${s.ticker}`)}
                  className="glass" style={{ padding: '16px', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                      <img
                        src={`https://img.logo.dev/${s.name?.toLowerCase().replace(/\binc\b|\bcorp\b|\bltd\b|\bplc\b|\bco\b|\bllc\b|\bgroup\b|\bholdings\b|\binternational\b|\bthe\b/g, '').trim().split(/\s+/)[0].replace(/[^a-z0-9]/g, '')}.com?token=pk_B4aaLZF6S4G1YbCgqZq2Ug`}
                        alt=""
                        style={{ width: '22px', height: '22px', objectFit: 'contain' }}
                        onError={e => { e.target.style.display = 'none'; e.target.parentElement.style.background = 'var(--bg-2)'; e.target.parentElement.innerHTML = `<span style="color:var(--accent);font-size:10px;font-weight:700">${s.ticker.slice(0,2)}</span>`; }}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: '14px', color: 'var(--accent)' }}>{s.ticker}</div>
                      <div style={{ color: 'var(--text-3)', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '14px', filter: !isPro ? 'blur(4px)' : 'none', userSelect: !isPro ? 'none' : 'auto' }}>
                        {s.currentPrice ? `$${s.currentPrice.toFixed(2)}` : '—'}
                      </div>
                      <div style={{ color: 'var(--text-3)', fontSize: '11px' }}>{s.sector || '—'}</div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                    {[
                      { label: 'P/E', val: fmtN(s.pe), color: s.pe > 30 ? 'var(--red)' : s.pe > 0 ? 'var(--green)' : 'var(--text-3)' },
                      { label: 'Rev Gr.', val: s.revGrowth !== null ? `${s.revGrowth > 0 ? '+' : ''}${s.revGrowth}%` : '—', color: s.revGrowth > 10 ? 'var(--green)' : s.revGrowth > 0 ? 'var(--accent)' : 'var(--red)' },
                      { label: 'Op Mgn', val: fmtP(s.opMargin), color: s.opMargin > 15 ? 'var(--green)' : s.opMargin > 0 ? 'var(--accent)' : 'var(--red)' },
                      { label: 'FCF Yld', val: s.fcfYield !== null ? `${s.fcfYield}%` : '—', color: s.fcfYield > 4 ? 'var(--green)' : s.fcfYield > 0 ? 'var(--accent)' : 'var(--red)' },
                    ].map(m => (
                      <div key={m.label}>
                        <div style={{ color: 'var(--text-3)', fontSize: '10px', fontWeight: 600, marginBottom: '2px' }}>{m.label}</div>
                        <div style={{ fontWeight: 700, fontSize: '12px', color: m.color, filter: !isPro ? 'blur(4px)' : 'none', userSelect: !isPro ? 'none' : 'auto' }}>{m.val}</div>
                      </div>
                    ))}
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); const text = `Check out ${s.ticker} – ${s.name} on Traqcker: traqcker.com/stock/${s.ticker}`; window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank'); }}
                    className="btn-secondary" style={{ width: '100%', marginTop: '12px', padding: '8px', fontSize: '12px' }}>
                    📸 Share on Twitter
                  </button>
                </div>
              ))}
            </div>
            </>
          )}

          {/* Paginador */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '20px 0', borderTop: '1px solid var(--border)' }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="btn-secondary" style={{ padding: '7px 18px', fontSize: '13px', opacity: page === 1 ? 0.4 : 1, cursor: page === 1 ? 'default' : 'pointer' }}>
                ← Prev
              </button>
              <span style={{ color: 'var(--text-3)', fontSize: '13px', fontWeight: 600 }}>
                {page} / {totalPages} · {filtered.length} results
              </span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="btn-secondary" style={{ padding: '7px 18px', fontSize: '13px', opacity: page === totalPages ? 0.4 : 1, cursor: page === totalPages ? 'default' : 'pointer' }}>
                Next →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile filter drawer */}
      {filtersOpen && (
        <div onClick={() => setFiltersOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: 'rgba(15,17,25,0.98)', backdropFilter: 'blur(24px)', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', border: '1px solid var(--border)', width: '100%', maxHeight: '80vh', overflow: 'auto', padding: '24px', fontFamily: 'Nunito, sans-serif' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ fontWeight: 800, fontSize: '18px' }}>Filters</div>
              <button onClick={() => setFiltersOpen(false)}
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', borderRadius: '10px', color: 'var(--text-2)', padding: '6px 12px', fontSize: '14px', cursor: 'pointer', fontFamily: 'Nunito, sans-serif' }}>✕</button>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ color: 'var(--text-3)', fontSize: '12px', fontWeight: 700, letterSpacing: '1px', marginBottom: '12px' }}>SECTOR</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {['All', ...new Set(stocks.map(s => s.sector).filter(Boolean))].sort().map(sec => (
                  <button key={sec} onClick={() => setSector(sec)}
                    style={{ borderRadius: '10px', padding: '8px 14px', fontSize: '13px', background: sector === sec ? 'linear-gradient(135deg,#a78bfa,#60a5fa)' : 'rgba(255,255,255,0.05)', border: sector === sec ? 'none' : '1px solid var(--border)', cursor: 'pointer', fontFamily: 'Nunito, sans-serif', fontWeight: sector === sec ? 700 : 500, color: sector === sec ? '#000' : 'var(--text-2)' }}>
                    {sec}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', marginBottom: '20px' }}>
              <div style={{ color: 'var(--text-3)', fontSize: '12px', fontWeight: 700, letterSpacing: '1px', marginBottom: '12px' }}>METRICS</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {[
                  { key: 'minMargin', label: 'Min op. margin %' },
                  { key: 'maxPE', label: 'Max P/E' },
                  { key: 'minFCFYield', label: 'Min FCF yield %' },
                  { key: 'minRevGrowth', label: 'Min rev growth %' },
                ].map(f => (
                  <div key={f.key}>
                    <div style={{ color: 'var(--text-3)', fontSize: '12px', marginBottom: '6px', fontWeight: 600 }}>{f.label}</div>
                    <input
                      type="number"
                      style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '10px', color: 'var(--text)', fontFamily: 'Nunito, sans-serif', fontSize: '14px', padding: '10px 12px', outline: 'none' }}
                      placeholder="—"
                      value={filters[f.key]}
                      onChange={e => setFilters(prev => ({ ...prev, [f.key]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => { setFilters({ minMargin: '', maxPE: '', minFCFYield: '', minRevGrowth: '' }); setSector('All'); }}
                className="btn-secondary" style={{ flex: 1, padding: '13px' }}>
                Reset
              </button>
              <button onClick={() => setFiltersOpen(false)}
                className="btn-primary" style={{ flex: 1, padding: '13px', fontSize: '14px' }}>
                Show {filtered.length} results
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{`
        @media (max-width: 767px) {
          .screener-root { padding-bottom: calc(72px + env(safe-area-inset-bottom, 0px)) !important; }
        }
      `}</style>
    </div>
  );
}