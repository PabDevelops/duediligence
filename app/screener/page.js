'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const fmt = (val) => {
  if (val === null || val === undefined) return '—';
  if (Math.abs(val) >= 1e12) return `$${(val / 1e12).toFixed(1)}T`;
  if (Math.abs(val) >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
  if (Math.abs(val) >= 1e6) return `$${(val / 1e6).toFixed(0)}M`;
  return `$${val.toLocaleString()}`;
};
const fmtP = (v) => v !== null && v !== undefined ? `${v}%` : '—';
const fmtN = (v, d = 1) => v !== null && v !== undefined ? v.toFixed(d) : '—';

const SECTORS = ['All', 'Technology', 'Healthcare', 'Financials', 'Industrials', 'Consumer Cyclical', 'Consumer Defensive', 'Energy', 'Materials', 'Real Estate', 'Utilities', 'Communication Services'];

export default function Screener() {
  const router = useRouter();
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sector, setSector] = useState('All');
  const [sortBy, setSortBy] = useState('marketCap');
  const [sortDir, setSortDir] = useState('desc');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    minMargin: '', maxPE: '', minFCFYield: '', minRevGrowth: '',
  });

  useEffect(() => {
    fetch('/api/screener')
      .then(r => r.json())
      .then(d => { setStocks(d.stocks || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = stocks
    .filter(s => sector === 'All' || s.sector === sector)
    .filter(s => !search || s.ticker.includes(search.toUpperCase()) || s.name?.toUpperCase().includes(search.toUpperCase()))
    .filter(s => !filters.minMargin || (s.opMargin !== null && s.opMargin >= +filters.minMargin))
    .filter(s => !filters.maxPE || (s.pe !== null && s.pe <= +filters.maxPE))
    .filter(s => !filters.minFCFYield || (s.fcfYield !== null && s.fcfYield >= +filters.minFCFYield))
    .filter(s => !filters.minRevGrowth || (s.revGrowth !== null && s.revGrowth >= +filters.minRevGrowth))
    .sort((a, b) => {
      const av = a[sortBy] ?? (sortDir === 'desc' ? -Infinity : Infinity);
      const bv = b[sortBy] ?? (sortDir === 'desc' ? -Infinity : Infinity);
      return sortDir === 'desc' ? bv - av : av - bv;
    });

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortBy(col); setSortDir('desc'); }
  };

  const SortIcon = ({ col }) => sortBy === col ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ' ·';

  const ColHeader = ({ col, label }) => (
    <th onClick={() => toggleSort(col)}
      style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 400, fontSize: '10px', letterSpacing: '1px', color: sortBy === col ? 'var(--accent)' : 'var(--text-3)', cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none' }}>
      {label}<SortIcon col={col} />
    </th>
  );

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', fontFamily: 'IBM Plex Mono, monospace' }}>
      {/* Topbar */}
      <div style={{ borderBottom: '1px solid var(--border)', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '12px', position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 10, fontSize: '11px' }}>
        <a href="/" style={{ color: 'var(--accent)', fontWeight: 600, letterSpacing: '2px', textDecoration: 'none' }}>TERMINAL</a>
        <span style={{ color: 'var(--border-2)' }}>/</span>
        <span style={{ color: 'var(--text)' }}>SCREENER</span>
        <div style={{ flex: 1 }}>
          <input
            style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', padding: '4px 10px', width: '220px', outline: 'none', letterSpacing: '1px' }}
            placeholder="SEARCH TICKER OR NAME..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <span style={{ color: 'var(--text-3)', fontSize: '10px' }}>{filtered.length} COMPANIES</span>
      </div>

      <div style={{ display: 'flex' }}>
        {/* Filters sidebar */}
        <div style={{ width: '200px', flexShrink: 0, borderRight: '1px solid var(--border)', padding: '16px', fontSize: '11px' }}>
          <div style={{ color: 'var(--text-3)', fontSize: '9px', letterSpacing: '2px', marginBottom: '16px' }}>FILTERS</div>

          <div style={{ marginBottom: '16px' }}>
            <div style={{ color: 'var(--text-3)', fontSize: '10px', marginBottom: '6px' }}>SECTOR</div>
            {SECTORS.map(s => (
              <button key={s} onClick={() => setSector(s)}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '4px 8px', fontSize: '10px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'IBM Plex Mono, monospace', color: sector === s ? 'var(--accent)' : 'var(--text-3)', borderLeft: sector === s ? '2px solid var(--accent)' : '2px solid transparent' }}>
                {s}
              </button>
            ))}
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
            <div style={{ color: 'var(--text-3)', fontSize: '10px', marginBottom: '12px' }}>METRICS</div>
            {[
              { key: 'minMargin', label: 'MIN OP. MARGIN %' },
              { key: 'maxPE', label: 'MAX P/E' },
              { key: 'minFCFYield', label: 'MIN FCF YIELD %' },
              { key: 'minRevGrowth', label: 'MIN REV GROWTH %' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: '10px' }}>
                <div style={{ color: 'var(--text-3)', fontSize: '9px', letterSpacing: '1px', marginBottom: '4px' }}>{f.label}</div>
                <input
                  type="number"
                  style={{ width: '100%', background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', padding: '4px 8px', outline: 'none' }}
                  placeholder="—"
                  value={filters[f.key]}
                  onChange={e => setFilters(prev => ({ ...prev, [f.key]: e.target.value }))}
                />
              </div>
            ))}
            <button onClick={() => setFilters({ minMargin: '', maxPE: '', minFCFYield: '', minRevGrowth: '' })}
              style={{ width: '100%', padding: '6px', fontSize: '10px', background: 'none', border: '1px solid var(--border)', color: 'var(--text-3)', cursor: 'pointer', fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '1px', marginTop: '4px' }}>
              RESET FILTERS
            </button>
          </div>
        </div>

        {/* Table */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px', color: 'var(--text-3)', fontSize: '11px', letterSpacing: '2px' }}>
              LOADING SCREENER DATA...
            </div>
          ) : stocks.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', color: 'var(--text-3)', fontSize: '11px', textAlign: 'center', gap: '8px' }}>
              <div style={{ color: 'var(--accent)', fontSize: '24px', letterSpacing: '4px' }}>EMPTY</div>
              <div>No companies in cache yet.</div>
              <div>Visit stock pages to populate the screener.</div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                {['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'VISA', 'ASML'].map(t => (
                  <a key={t} href={`/stock/${t}`}
                    style={{ color: 'var(--accent)', fontSize: '11px', border: '1px solid var(--border)', padding: '4px 10px', textDecoration: 'none' }}>
                    {t}
                  </a>
                ))}
              </div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead style={{ position: 'sticky', top: '33px', background: 'var(--bg)' }}>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 400, fontSize: '10px', letterSpacing: '1px', color: 'var(--text-3)', width: '120px' }}>TICKER</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 400, fontSize: '10px', letterSpacing: '1px', color: 'var(--text-3)' }}>NAME</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 400, fontSize: '10px', letterSpacing: '1px', color: 'var(--text-3)' }}>SECTOR</th>
                  <ColHeader col="currentPrice" label="PRICE" />
                  <ColHeader col="marketCap" label="MKT CAP" />
                  <ColHeader col="pe" label="P/E" />
                  <ColHeader col="revGrowth" label="REV GROWTH" />
                  <ColHeader col="opMargin" label="OP MARGIN" />
                  <ColHeader col="fcfYield" label="FCF YIELD" />
                  <ColHeader col="roe" label="ROE" />
                  <ColHeader col="netDebt" label="NET DEBT" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => (
                  <tr key={s.ticker}
                    onClick={() => router.push(`/stock/${s.ticker}`)}
                    style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', background: i % 2 === 0 ? 'var(--bg)' : 'var(--bg-1)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-2)'}
                    onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'var(--bg)' : 'var(--bg-1)'}>
                    <td style={{ padding: '8px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '24px', height: '24px', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                          <img
                            src={`https://img.logo.dev/${s.name?.toLowerCase().replace(/\binc\b|\bcorp\b|\bltd\b|\bplc\b|\bco\b|\bllc\b|\bgroup\b|\bholdings\b|\binternational\b|\bthe\b/g, '').trim().split(/\s+/)[0].replace(/[^a-z0-9]/g, '')}.com?token=pk_B4aaLZF6S4G1YbCgqZq2Ug`}
                            alt=""
                            style={{ width: '16px', height: '16px', objectFit: 'contain' }}
                            onError={e => { e.target.style.display = 'none'; e.target.parentElement.style.background = 'var(--bg-2)'; e.target.parentElement.innerHTML = `<span style="color:var(--accent);font-size:8px;font-weight:600">${s.ticker.slice(0,2)}</span>`; }}
                          />
                        </div>
                        <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{s.ticker}</span>
                      </div>
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--text-2)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--text-3)', fontSize: '10px' }}>{s.sector || '—'}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>{s.currentPrice ? `$${s.currentPrice.toFixed(2)}` : '—'}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmt(s.marketCap)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: s.pe > 30 ? 'var(--red)' : s.pe > 0 ? 'var(--green)' : 'var(--text-3)' }}>{fmtN(s.pe)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: s.revGrowth > 10 ? 'var(--green)' : s.revGrowth > 0 ? 'var(--accent)' : 'var(--red)' }}>{s.revGrowth !== null ? `${s.revGrowth > 0 ? '+' : ''}${s.revGrowth}%` : '—'}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: s.opMargin > 15 ? 'var(--green)' : s.opMargin > 0 ? 'var(--accent)' : 'var(--red)' }}>{fmtP(s.opMargin)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: s.fcfYield > 4 ? 'var(--green)' : s.fcfYield > 0 ? 'var(--accent)' : 'var(--red)' }}>{s.fcfYield !== null ? `${s.fcfYield}%` : '—'}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: s.roe > 15 ? 'var(--green)' : 'var(--text)' }}>{fmtP(s.roe)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: s.netDebt < 0 ? 'var(--green)' : 'var(--text)' }}>{fmt(s.netDebt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}