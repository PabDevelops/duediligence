'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useUser } from '../../components/AuthProvider';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Sparkline from '../../components/Sparkline';
import MarketStatusDot from '../../components/workspace/MarketStatusDot';

import { formatCurrency } from '../../../lib/formatters';
const fmt = (val) => formatCurrency(val, '$');

const CURRENCIES = { USD: '$', EUR: '€', GBP: '£' };

// Fixed multi-hue chart palette for pie/allocation slices — intentionally outside the --ws-* theme tokens
// since it needs 10 visually distinct colors, not just the app's accent/text/border set.
const PALETTE = ['#4f7a68', '#7c6fe0', '#d99a4e', '#5a9bd4', '#c1666b', '#8fb996', '#b98fc9', '#e0a458', '#6b9080', '#a4a4a4'];

import StockLogo from '../../components/workspace/StockLogo';

const COLUMN_ALIASES = {
  ticker: ['ticker', 'symbol'],
  shares: ['shares', 'quantity', 'qty'],
  costBasis: ['price', 'cost', 'costbasis', 'cost_basis', 'avgcost', 'avg_cost'],
  purchaseDate: ['date', 'purchasedate', 'purchase_date', 'trade_date'],
  costBasisCurrency: ['currency', 'ccy'],
};

function parseCsv(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return { rows: [], errors: ['CSV needs a header row and at least one data row.'] };

  const header = lines[0].split(',').map(h => h.trim().toLowerCase());
  const colIndex = {};
  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    const idx = header.findIndex(h => aliases.includes(h));
    if (idx !== -1) colIndex[field] = idx;
  }
  if (colIndex.ticker === undefined || colIndex.shares === undefined || colIndex.costBasis === undefined) {
    return { rows: [], errors: ['CSV must have columns for ticker, shares, and price. Detected header: ' + header.join(', ')], hasCurrencyColumn: false };
  }
  const hasCurrencyColumn = colIndex.costBasisCurrency !== undefined;

  const rows = [];
  const errors = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim());
    const ticker = cols[colIndex.ticker]?.toUpperCase();
    const shares = Number(cols[colIndex.shares]);
    const costBasis = Number(cols[colIndex.costBasis]);
    const rawDate = colIndex.purchaseDate !== undefined ? cols[colIndex.purchaseDate] : '';
    const purchaseDate = rawDate && !isNaN(Date.parse(rawDate)) ? new Date(rawDate).toISOString().slice(0, 10) : undefined;
    const rawCcy = colIndex.costBasisCurrency !== undefined ? cols[colIndex.costBasisCurrency]?.toUpperCase() : '';
    const costBasisCurrency = ['USD', 'EUR', 'GBP'].includes(rawCcy) ? rawCcy : 'USD';

    if (!ticker || !(shares > 0) || !(costBasis >= 0)) {
      errors.push(`Row ${i + 1}: invalid data (${lines[i]})`);
      continue;
    }
    rows.push({ ticker, shares, costBasis, purchaseDate, costBasisCurrency });
  }
  return { rows, errors, hasCurrencyColumn };
}

function ImportCsvModal({ onClose, onImported, defaultCurrency }) {
  const [rows, setRows] = useState([]);
  const [errors, setErrors] = useState([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [fallbackCurrency, setFallbackCurrency] = useState(defaultCurrency || 'USD');
  const [hasCurrencyColumn, setHasCurrencyColumn] = useState(false);
  const fileRef = useRef(null);

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const { rows, errors, hasCurrencyColumn } = parseCsv(ev.target.result);
      setHasCurrencyColumn(hasCurrencyColumn);
      setRows(hasCurrencyColumn ? rows : rows.map(r => ({ ...r, costBasisCurrency: fallbackCurrency })));
      setErrors(errors);
    };
    reader.readAsText(file);
  };

  useEffect(() => {
    if (hasCurrencyColumn) return;
    setRows(prev => prev.map(r => ({ ...r, costBasisCurrency: fallbackCurrency })));
  }, [fallbackCurrency, hasCurrencyColumn]);

  const doImport = async () => {
    if (rows.length === 0) return;
    setImporting(true);
    const res = await fetch('/api/portfolio/import', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows }),
    });
    setImporting(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setErrors([d.error || 'Import failed.']);
      return;
    }
    onImported();
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '480px', maxWidth: '92vw', maxHeight: '80vh', overflowY: 'auto', background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', borderRadius: '12px', padding: '22px', boxShadow: '0 12px 40px rgba(0,0,0,0.18)' }}>
        <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--ws-text)', marginBottom: '4px' }}>Import from CSV</div>
        <div style={{ fontSize: '12px', color: 'var(--ws-text-3)', marginBottom: '12px' }}>
          Columns: <strong>ticker, shares, price, date</strong> (date optional, currency optional). First row must be the header.
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <span style={{ fontSize: '11px', color: 'var(--ws-text-2)' }}>{hasCurrencyColumn ? 'Currency column detected in CSV' : 'Price column is in:'}</span>
          {!hasCurrencyColumn && (
            <div style={{ display: 'flex', border: '1px solid var(--ws-border)', overflow: 'hidden' }}>
              {Object.keys(CURRENCIES).map(c => (
                <button key={c} type="button" onClick={() => setFallbackCurrency(c)}
                  style={{ height: '24px', padding: '0 8px', fontSize: '10px', fontWeight: 700, border: 'none', cursor: 'pointer', background: fallbackCurrency === c ? 'var(--ws-accent)' : 'var(--ws-bg-2)', color: fallbackCurrency === c ? 'var(--ws-bg-1)' : 'var(--ws-text-2)' }}>
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>

        <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} style={{ display: 'none' }} />
        <button onClick={() => fileRef.current?.click()}
          style={{ width: '100%', height: '80px', border: '1px dashed var(--ws-border)', background: 'var(--ws-bg-2)', color: 'var(--ws-text-2)', fontSize: '12px', cursor: 'pointer' }}>
          {fileName || 'Click to choose a .csv file'}
        </button>

        {errors.length > 0 && (
          <div style={{ marginTop: '12px', padding: '10px 12px', border: '1px solid var(--ws-red)', background: 'rgba(239, 68, 68, 0.08)' }}>
            {errors.map((e, i) => <div key={i} style={{ fontSize: '11px', color: 'var(--ws-red)' }}>{e}</div>)}
          </div>
        )}

        {rows.length > 0 && (
          <>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ws-text)', margin: '14px 0 8px' }}>{rows.length} row{rows.length !== 1 ? 's' : ''} ready to import</div>
            <div style={{ border: '1px solid var(--ws-border)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <thead>
                  <tr style={{ background: 'var(--ws-bg-2)' }}>
                    {['Ticker', 'Shares', 'Price', 'Date'].map(h => (
                      <th key={h} style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--ws-text-3)', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 8).map((r, i) => (
                    <tr key={i} style={{ borderTop: '1px solid var(--ws-border)' }}>
                      <td style={{ padding: '6px 10px', fontWeight: 600, color: 'var(--ws-text)' }}>{r.ticker}</td>
                      <td style={{ padding: '6px 10px', color: 'var(--ws-text-2)' }}>{r.shares}</td>
                      <td style={{ padding: '6px 10px', color: 'var(--ws-text-2)' }}>${r.costBasis}</td>
                      <td style={{ padding: '6px 10px', color: 'var(--ws-text-2)' }}>{r.purchaseDate || 'today'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 8 && <div style={{ padding: '6px 10px', fontSize: '11px', color: 'var(--ws-text-3)' }}>+{rows.length - 8} more…</div>}
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
          <button type="button" onClick={onClose}
            className="ws-btn-secondary"
            style={{ flex: 1, height: '38px' }}>
            Cancel
          </button>
          <button type="button" onClick={doImport} disabled={rows.length === 0 || importing}
            className="ws-btn"
            style={{ flex: 2, height: '38px' }}>
            {importing ? 'Importing…' : `Import ${rows.length || ''} holding${rows.length === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddHoldingModal({ onClose, onAdded, existingPies, defaultCurrency, editLot, presetTicker }) {
  const isEdit = !!editLot;
  const [query, setQuery] = useState(editLot?.ticker || presetTicker || '');
  const [suggestions, setSuggestions] = useState([]);
  const [selected, setSelected] = useState(
    editLot ? { ticker: editLot.ticker, name: editLot.ticker } :
    presetTicker ? { ticker: presetTicker, name: presetTicker } : null
  );
  const [preview, setPreview] = useState(null);
  const [shares, setShares] = useState(editLot ? String(editLot.shares) : '');
  const [costBasis, setCostBasis] = useState(editLot ? String(editLot.cost_basis) : '');
  const [costBasisCurrency, setCostBasisCurrency] = useState(editLot?.cost_basis_currency || defaultCurrency || 'USD');
  const [purchaseDate, setPurchaseDate] = useState(editLot?.purchase_date || new Date().toISOString().slice(0, 10));
  const [pie, setPie] = useState(editLot?.pie || '');
  const [showPieSuggestions, setShowPieSuggestions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [manualLookupState, setManualLookupState] = useState('idle'); // idle | loading | not_found
  const inputRef = useRef(null);

  const pieSuggestions = existingPies.filter(p => p.toLowerCase().includes(pie.toLowerCase()) && p.toLowerCase() !== pie.toLowerCase());

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (presetTicker && !editLot) {
      fetch(`/api/stock?ticker=${presetTicker}`).then(r => r.json()).then(setPreview).catch(() => {});
    }
  }, [presetTicker, editLot]);

  useEffect(() => {
    if (selected || query.length < 1) { setSuggestions([]); return; }
    const t = setTimeout(() => {
      fetch(`/api/search?q=${query}`).then(r => r.json()).then(d => setSuggestions(d.results || [])).catch(() => {});
    }, 200);
    return () => clearTimeout(t);
  }, [query, selected]);

  const pickTicker = (s) => {
    setSelected(s);
    setQuery(s.ticker);
    setSuggestions([]);
    fetch(`/api/stock?ticker=${s.ticker}`).then(r => r.json()).then(setPreview).catch(() => {});
    if (!costBasis) inputRef.current?.blur();
  };

  const useCurrentPrice = () => { if (preview?.currentPrice) { setCostBasis(String(preview.currentPrice)); setCostBasisCurrency('USD'); } };

  const manualLookup = async () => {
    if (!query) return;
    setManualLookupState('loading');
    try {
      const res = await fetch(`/api/stock?ticker=${query}&refresh=true`);
      const data = await res.json();
      if (!res.ok || !data.name) { setManualLookupState('not_found'); return; }
      setSelected({ ticker: query, name: data.name, international: true });
      setPreview(data);
      setSuggestions([]);
      setManualLookupState('idle');
    } catch {
      setManualLookupState('not_found');
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!selected || !shares || costBasis === '') return;
    setSaving(true);
    setError(null);
    const res = isEdit
      ? await fetch('/api/portfolio', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editLot.id, shares, costBasis, purchaseDate, pie, costBasisCurrency }),
        })
      : await fetch('/api/portfolio', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticker: selected.ticker, shares, costBasis, purchaseDate, pie, costBasisCurrency }),
        });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || `Failed to ${isEdit ? 'update' : 'add'} holding.`);
      return;
    }
    onAdded();
  };

  const total = shares && costBasis ? Number(shares) * Number(costBasis) : null;
  const inputStyle = { width: '100%', height: '36px', padding: '0 12px', fontSize: '13px', border: '1px solid var(--ws-border)', background: 'var(--ws-bg)', color: 'var(--ws-text)', outline: 'none' };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '420px', maxWidth: '92vw', background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', borderRadius: '12px', padding: '22px', boxShadow: '0 12px 40px rgba(0,0,0,0.18)' }}>
        <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--ws-text)', marginBottom: '4px' }}>
          {isEdit ? `Edit ${editLot.ticker} lot` : presetTicker ? `Buy ${presetTicker}` : 'Add holding'}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--ws-text-3)', marginBottom: '16px' }}>
          {isEdit ? 'Update shares, cost, or date for this entry.' : presetTicker ? `Add a purchase of ${presetTicker} directly to your holdings.` : 'Search a ticker, then enter shares and cost.'}
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {!isEdit && (
          <>
          <div style={{ position: 'relative' }}>
            <input ref={inputRef} value={query} placeholder="Search ticker or company…"
              onChange={e => { setQuery(e.target.value.toUpperCase()); setSelected(null); setPreview(null); setManualLookupState('idle'); }}
              className="ws-input"
              style={{ background: presetTicker ? 'var(--ws-bg-2)' : 'var(--ws-bg)', cursor: presetTicker ? 'not-allowed' : 'text' }}
              autoComplete="off" required disabled={!!presetTicker} />
            {suggestions.length > 0 && (
              <div style={{ position: 'absolute', top: '40px', left: 0, right: 0, background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', boxShadow: '0 8px 24px rgba(0,0,0,0.1)', maxHeight: '220px', overflowY: 'auto', zIndex: 10 }}>
                {suggestions.map(s => (
                  <div key={s.ticker} onClick={() => pickTicker(s)}
                    style={{ padding: '9px 12px', cursor: 'pointer', display: 'flex', gap: '10px', alignItems: 'center', fontSize: '12px' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--ws-bg-2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <StockLogo ticker={s.ticker} size={22} />
                    <span style={{ color: 'var(--ws-accent)', fontWeight: 700 }}>{s.ticker}</span>
                    <span style={{ color: 'var(--ws-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {!selected && query.length >= 2 && suggestions.length === 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', border: '1px dashed var(--ws-border)', background: 'var(--ws-bg-2)' }}>
              <span style={{ fontSize: '11px', color: 'var(--ws-text-3)' }}>
                {manualLookupState === 'not_found'
                  ? `Couldn't find "${query}". Check the exact symbol (e.g. LLOY.L for London).`
                  : `Not in our screened universe — try it as an international ticker (e.g. LLOY.L, VOD.L).`}
              </span>
              <button type="button" onClick={manualLookup} disabled={manualLookupState === 'loading'}
                style={{ flexShrink: 0, marginLeft: '8px', fontSize: '11px', fontWeight: 600, color: 'var(--ws-accent)', background: 'var(--ws-accent-dim)', border: 'none', padding: '6px 10px', cursor: 'pointer' }}>
                {manualLookupState === 'loading' ? 'Looking up…' : `Look up "${query}"`}
              </button>
            </div>
          )}
          </>
          )}

          {selected && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', border: '1px solid var(--ws-border)', background: 'var(--ws-bg-2)' }}>
                <StockLogo ticker={selected.ticker} size={32} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ws-text)' }}>{selected.ticker}</div>
                  <div style={{ fontSize: '11px', color: 'var(--ws-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected.name}</div>
                </div>
                {preview?.currentPrice && (
                  <button type="button" onClick={useCurrentPrice}
                    style={{ fontSize: '11px', fontWeight: 600, color: 'var(--ws-accent)', background: 'var(--ws-accent-dim)', border: 'none', padding: '6px 10px', cursor: 'pointer' }}>
                    Use ${preview.currentPrice.toFixed(2)}
                  </button>
                )}
              </div>
              {selected.international && (
                <div style={{ fontSize: '10px', color: 'var(--ws-text-3)' }}>
                  International ticker — price tracking works, but the stock page's extended fundamentals (score, fair value) may not be available for this market.
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <div className="ws-label" style={{ marginBottom: '4px' }}>SHARES</div>
              <input type="number" step="any" min="0" value={shares} onChange={e => setShares(e.target.value)} className="ws-input" required />
            </div>
            <div>
              <div className="ws-label" style={{ marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                <span>COST PER SHARE</span>
                <select value={costBasisCurrency} onChange={e => setCostBasisCurrency(e.target.value)}
                  style={{ fontSize: '10px', fontWeight: 700, color: 'var(--ws-accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  {Object.keys(CURRENCIES).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <input type="number" step="any" min="0" value={costBasis} onChange={e => setCostBasis(e.target.value)} className="ws-input" required />
              <div style={{ fontSize: '10px', color: 'var(--ws-text-3)', marginTop: '3px' }}>Enter the price exactly as your broker showed it, in {costBasisCurrency}.</div>
            </div>
          </div>

          <div>
            <div className="ws-label" style={{ marginBottom: '4px' }}>PURCHASE DATE</div>
            <input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} className="ws-input" />
          </div>

          <div style={{ position: 'relative' }}>
            <div className="ws-label" style={{ marginBottom: '4px' }}>PIE (OPTIONAL) — group into a themed basket</div>
            <input value={pie} placeholder="e.g. Quantum Computing"
              onChange={e => { setPie(e.target.value); setShowPieSuggestions(true); }}
              onFocus={() => setShowPieSuggestions(true)}
              onBlur={() => setTimeout(() => setShowPieSuggestions(false), 150)}
              className="ws-input" autoComplete="off" />
            {showPieSuggestions && pieSuggestions.length > 0 && (
              <div style={{ position: 'absolute', top: '58px', left: 0, right: 0, background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', boxShadow: '0 8px 24px rgba(0,0,0,0.1)', zIndex: 10 }}>
                {pieSuggestions.map(p => (
                  <div key={p} onMouseDown={() => { setPie(p); setShowPieSuggestions(false); }}
                    style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '12px', color: 'var(--ws-text)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--ws-bg-2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    {p}
                  </div>
                ))}
              </div>
            )}
          </div>

          {total != null && (
            <div style={{ fontSize: '12px', color: 'var(--ws-text-2)', textAlign: 'right' }}>Total cost: <strong style={{ color: 'var(--ws-text)' }}>{formatCurrency(total, CURRENCIES[costBasisCurrency])}</strong></div>
          )}

          {error && (
            <div style={{ padding: '8px 12px', border: '1px solid var(--ws-red)', color: 'var(--ws-red)', fontSize: '12px' }}>{error}</div>
          )}

          <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
            <button type="button" onClick={onClose}
              className="ws-btn-secondary"
              style={{ flex: 1, height: '38px' }}>
              Cancel
            </button>
            <button type="submit" disabled={!selected || saving}
              className="ws-btn"
              style={{ flex: 2, height: '38px' }}>
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add to portfolio'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SellModal({ position, onClose, onSold }) {
  const [shares, setShares] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    const n = Number(shares);
    if (!(n > 0)) return;
    setSaving(true);
    setError(null);
    const res = await fetch('/api/portfolio/sell', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker: position.ticker, shares: n }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || 'Failed to sell.');
      return;
    }
    onSold();
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '360px', maxWidth: '92vw', background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', borderRadius: '12px', padding: '22px', boxShadow: '0 12px 40px rgba(0,0,0,0.18)' }}>
        <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--ws-text)', marginBottom: '4px' }}>Sell {position.ticker}</div>
        <div style={{ fontSize: '12px', color: 'var(--ws-text-3)', marginBottom: '16px' }}>You hold {position.shares.toLocaleString(undefined, { maximumFractionDigits: 4 })} shares. Reduces from your oldest lots first.</div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <div className="ws-label" style={{ marginBottom: '4px' }}>SHARES TO SELL</div>
            <input type="number" step="any" min="0" max={position.shares} value={shares} onChange={e => setShares(e.target.value)} className="ws-input" autoFocus required />
          </div>
          <button type="button" onClick={() => setShares(String(position.shares))}
            style={{ alignSelf: 'flex-start', fontSize: '11px', fontWeight: 600, color: 'var(--ws-accent)', background: 'var(--ws-accent-dim)', border: 'none', padding: '5px 10px', cursor: 'pointer' }}>
            Sell all
          </button>
          {error && (
            <div style={{ padding: '8px 12px', border: '1px solid var(--ws-red)', color: 'var(--ws-red)', fontSize: '12px' }}>{error}</div>
          )}
          <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
            <button type="button" onClick={onClose}
              className="ws-btn-secondary"
              style={{ flex: 1, height: '38px' }}>
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="ws-btn-danger"
              style={{ flex: 2, height: '38px' }}>
              {saving ? 'Selling…' : 'Sell'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const GROWTH_PERIODS = ['1D', '1W', '1M', '3M', '1Y', 'YTD', 'MAX'];

// Returns the earliest date a period's window should start from, or null for MAX (= earliest available data).
function periodStartDate(key, today) {
  const d = new Date(today);
  if (key === '1D') d.setDate(d.getDate() - 1);
  else if (key === '1W') d.setDate(d.getDate() - 7);
  else if (key === '1M') d.setMonth(d.getMonth() - 1);
  else if (key === '3M') d.setMonth(d.getMonth() - 3);
  else if (key === '1Y') d.setFullYear(d.getFullYear() - 1);
  else if (key === 'YTD') return new Date(today.getFullYear(), 0, 1);
  else return null;
  return d;
}

function GrowthChart({ snapshots, currentValue, currentCost, rate, symbol }) {
  const [period, setPeriod] = useState('1M');
  const fmtC = (v) => formatCurrency(v * rate, symbol);
  const data = useMemo(() => {
    const points = snapshots.map(s => ({ date: s.date, value: Number(s.value), cost: Number(s.cost) }));
    const today = new Date().toISOString().slice(0, 10);
    if (points.length === 0 || points[points.length - 1].date !== today) {
      points.push({ date: today, value: currentValue, cost: currentCost });
    }
    return points;
  }, [snapshots, currentValue, currentCost]);

  if (data.length < 2) {
    return (
      <div style={{ border: '1px solid var(--ws-border)', padding: '16px' }}>
        <div style={{ fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: 'var(--ws-text-3)', letterSpacing: '1.5px', marginBottom: '8px' }}>PORTFOLIO GROWTH</div>
        <div style={{ fontSize: '12px', color: 'var(--ws-text-3)', padding: '20px 0', textAlign: 'center' }}>
          Come back tomorrow to start seeing your growth chart — we snapshot your portfolio value daily.
        </div>
      </div>
    );
  }

  const last = data[data.length - 1];
  const target = periodStartDate(period, new Date(last.date + 'T00:00:00'));

  // Walk forward from the oldest snapshot to find the last one on/before the period's start date —
  // that's our baseline. If nothing qualifies (history is shorter than the period), fall back to
  // the earliest snapshot we have, effectively showing "since inception" for that period.
  let baseline = data[0];
  if (target) {
    for (const pt of data) {
      if (new Date(pt.date + 'T00:00:00') <= target) baseline = pt;
      else break;
    }
  }
  const chartData = data.slice(data.indexOf(baseline));
  // Gain is measured as the change in (value - cost) rather than raw value delta, so adding new
  // capital mid-period (which bumps value and cost by the same amount) doesn't get counted as "gain".
  const periodGain = (last.value - last.cost) - (baseline.value - baseline.cost);
  const periodGainPct = baseline.cost > 0 ? (periodGain / baseline.cost) * 100 : null;
  const limitedHistory = !!target && new Date(data[0].date + 'T00:00:00') > target;

  return (
    <div style={{ border: '1px solid var(--ws-border)', padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
        <div>
          <div style={{ fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: 'var(--ws-text-3)', letterSpacing: '1.5px', marginBottom: '6px' }}>PORTFOLIO GROWTH</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: periodGain >= 0 ? 'var(--ws-accent)' : 'var(--ws-red)' }}>
            {periodGain >= 0 ? '+' : ''}{fmtC(periodGain)}{periodGainPct != null && ` (${periodGainPct >= 0 ? '+' : ''}${periodGainPct.toFixed(1)}%)`}
          </div>
          {limitedHistory && (
            <div style={{ fontSize: '10px', color: 'var(--ws-text-3)', marginTop: '2px' }}>
              Since {new Date(baseline.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} — as far back as we've tracked your portfolio
            </div>
          )}
        </div>
        <div style={{ display: 'flex', border: '1px solid var(--ws-border)', overflow: 'hidden', flexShrink: 0 }}>
          {GROWTH_PERIODS.map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              style={{ height: '28px', padding: '0 10px', fontSize: '10px', fontWeight: 700, border: 'none', cursor: 'pointer',
                background: period === p ? 'var(--ws-accent)' : 'var(--ws-bg-1)',
                color: period === p ? 'var(--ws-bg-1)' : 'var(--ws-text-2)' }}>
              {p}
            </button>
          ))}
        </div>
      </div>
      <div style={{ width: '100%', height: '180px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--ws-border)" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: 'var(--ws-text-3)', fontSize: 10 }} tickFormatter={d => new Date(d + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} axisLine={false} tickLine={false} minTickGap={40} />
            <YAxis tick={{ fill: 'var(--ws-text-3)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => fmtC(v)} width={56} />
            <Tooltip formatter={(v, n) => [fmtC(v), n === 'value' ? 'Market value' : 'Cost basis']}
              labelFormatter={d => new Date(d + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
              contentStyle={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', fontSize: 11, borderRadius: 8 }} />
            <Line type="monotone" dataKey="cost" stroke="var(--ws-text-3)" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
            <Line type="monotone" dataKey="value" stroke="var(--ws-accent)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: 'flex', gap: '14px', marginTop: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', color: 'var(--ws-text-3)' }}>
          <span style={{ width: '10px', height: '2px', background: 'var(--ws-accent)', display: 'inline-block' }} /> Market value
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', color: 'var(--ws-text-3)' }}>
          <span style={{ width: '10px', height: '2px', background: 'var(--ws-text-3)', display: 'inline-block', borderTop: '1px dashed var(--ws-text-3)' }} /> Cost basis
        </div>
      </div>
    </div>
  );
}

function AllocationChart({ title, data }) {
  if (data.length === 0) return null;
  return (
    <div style={{ border: '1px solid var(--ws-border)', padding: '16px' }}>
      <div style={{ fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: 'var(--ws-text-3)', letterSpacing: '1.5px', marginBottom: '8px' }}>{title}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ width: '120px', height: '120px', flexShrink: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={34} outerRadius={58} paddingAngle={2} stroke="none">
                {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
              </Pie>
              <Tooltip formatter={(v, n) => [`${v.toFixed(1)}%`, n]} contentStyle={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', fontSize: 11, borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
          {data.slice(0, 6).map((d, i) => (
            <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: PALETTE[i % PALETTE.length], flexShrink: 0 }} />
              <span style={{ color: 'var(--ws-text)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
              <span style={{ color: 'var(--ws-text-3)', marginLeft: 'auto' }}>{d.value.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function WorkspacePortfolio() {
  const { isSignedIn } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [holdings, setHoldings] = useState([]);
  const [stocks, setStocks] = useState({});
  const [sparklines, setSparklines] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [buyTicker, setBuyTicker] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [editLot, setEditLot] = useState(null);
  const [sellPosition, setSellPosition] = useState(null);
  const [snapshots, setSnapshots] = useState([]);
  const [currency, setCurrency] = useState('USD');
  // Approximate fallback rates in case the live fetch fails (network/CORS) — overwritten below when it succeeds.
  const [rates, setRates] = useState({ EUR: 0.92, GBP: 0.79 });

  useEffect(() => {
    const saved = localStorage.getItem('portfolio_currency');
    if (saved && CURRENCIES[saved]) setCurrency(saved);
  }, []);

  // Deep link from other pages (e.g. /etfs) that want to open the buy modal directly,
  // via /portfolio?buy=TICKER. Strip the param once consumed so a refresh doesn't reopen it.
  useEffect(() => {
    const buyParam = searchParams.get('buy');
    if (buyParam) {
      setBuyTicker(buyParam.toUpperCase());
      router.replace('/portfolio');
    }
  }, [searchParams, router]);

  useEffect(() => {
    // frankfurter.app moved to frankfurter.dev (old domain 301-redirects) — pointing directly
    // at the new one avoids relying on a redirect actually being followed.
    fetch('https://api.frankfurter.dev/v1/latest?from=USD&to=EUR,GBP')
      .then(r => r.json())
      .then(d => {
        if (d.rates && d.rates.EUR && d.rates.GBP) setRates(d.rates);
        else console.warn('FX rates response missing EUR/GBP, using fallback:', d);
      })
      .catch(e => console.warn('FX rates fetch failed, using fallback rates:', e));
  }, []);

  const changeCurrency = (c) => { setCurrency(c); localStorage.setItem('portfolio_currency', c); };
  const rate = currency === 'USD' ? 1 : (rates[currency] || 1);
  const symbol = CURRENCIES[currency];
  const fmtC = (val) => formatCurrency(val == null ? null : val * rate, symbol);

  useEffect(() => {
    if (!isSignedIn) return;
    fetch('/api/portfolio/snapshot').then(r => r.json()).then(d => setSnapshots(d.snapshots || [])).catch(() => {});
  }, [isSignedIn]);

  const load = ({ refresh = false } = {}) => {
    if (!isSignedIn) return;
    fetch('/api/portfolio').then(async r => {
      const d = await r.json();
      if (!r.ok) { setLoadError(d.error || 'Failed to load portfolio.'); setLoading(false); return; }
      setLoadError(null);
      setHoldings(d.holdings || []);
      setLoading(false);
      const tickers = [...new Set((d.holdings || []).map(h => h.ticker))];
      tickers.forEach(ticker => {
        fetch(`/api/stock?ticker=${ticker}${refresh ? '&refresh=true' : ''}`).then(r => r.json()).then(data => setStocks(prev => ({ ...prev, [ticker]: data })));
        fetch(`/api/sparkline?ticker=${ticker}`).then(r => r.json()).then(data => setSparklines(prev => ({ ...prev, [ticker]: data.candles }))).catch(() => {});
      });
    });
  };

  useEffect(() => {
    load({ refresh: false });
  }, [isSignedIn]);

  // Keep holding prices reasonably live — reload isn't the only way to see a move.
  useEffect(() => {
    if (!isSignedIn) return;
    const interval = setInterval(() => load({ refresh: false }), 60000);
    return () => clearInterval(interval);
  }, [isSignedIn]);

  const existingPies = useMemo(() => [...new Set(holdings.map(h => h.pie).filter(Boolean))].sort(), [holdings]);

  // Lots can be entered in whatever currency the user actually paid in (see AddHoldingModal).
  // We normalize every lot's cost to USD here, same base as the live market price, so gain/loss
  // math is always apples-to-apples — then the currency toggle just re-converts for display.
  const toUSD = (amount, ccy) => {
    if (!ccy || ccy === 'USD') return amount;
    const r = rates[ccy];
    return r ? amount / r : amount;
  };

  const positions = useMemo(() => {
    const byTicker = {};
    holdings.forEach(h => {
      const p = byTicker[h.ticker] ||= { ticker: h.ticker, shares: 0, cost: 0, costNative: 0, lots: [] };
      p.shares += Number(h.shares);
      p.cost += Number(h.shares) * toUSD(Number(h.cost_basis), h.cost_basis_currency);
      p.costNative += Number(h.shares) * Number(h.cost_basis); // only valid when all lots share one currency
      p.lots.push(h);
    });
    return Object.values(byTicker).map(p => {
      const s = stocks[p.ticker];
      const avgCost = p.cost / p.shares;
      // Avg cost / price are shown in their real trading currency (no conversion) — only
      // the aggregate value/gain figures get converted to your reporting currency below.
      const costCurrency = p.lots[0]?.cost_basis_currency || 'USD';
      const sameCostCurrency = p.lots.every(l => (l.cost_basis_currency || 'USD') === costCurrency);
      const avgCostNative = sameCostCurrency ? p.costNative / p.shares : null;
      const priceCurrency = s?.currency || 'USD';
      const priceNative = s?.currentPrice ?? null;
      // Most tickers quote in USD, but international ones (via the Yahoo fallback) report
      // their own currency in s.currency — normalize to USD to make gain/loss math currency-safe.
      const price = s?.currentPrice != null ? toUSD(s.currentPrice, priceCurrency) : null;
      const marketValue = price != null ? price * p.shares : null;
      const marketValueNative = priceNative != null ? priceNative * p.shares : null;
      const gain = marketValue != null ? marketValue - p.cost : null;
      const gainPct = marketValue != null && p.cost > 0 ? (gain / p.cost) * 100 : null;
      const pie = p.lots.find(l => l.pie)?.pie || null;
      return {
        ...p, avgCost, price, marketValue, gain, gainPct,
        avgCostNative, costCurrency, priceNative, priceCurrency, marketValueNative,
        name: s?.name, sector: s?.sector, pie, pe: s?.pe, dividendYield: s?.dividendYield, dayChangePct: s?.priceChangePct,
      };
    });
  }, [holdings, stocks, rates]);

  const totals = useMemo(() => {
    const cost = positions.reduce((a, p) => a + p.cost, 0);
    const value = positions.reduce((a, p) => a + (p.marketValue ?? p.cost), 0);
    const gain = value - cost;
    const gainPct = cost > 0 ? (gain / cost) * 100 : 0;
    return { cost, value, gain, gainPct };
  }, [positions]);

  useEffect(() => {
    if (positions.length === 0 || totals.value === 0) return;
    if (!positions.every(p => p.marketValue != null)) return;
    fetch('/api/portfolio/snapshot', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: totals.value, cost: totals.cost }),
    }).catch(() => {});
  }, [positions, totals.value, totals.cost]);

  const byTickerChart = useMemo(() => {
    if (totals.value === 0) return [];
    return positions
      .map(p => ({ name: p.ticker, value: ((p.marketValue ?? p.cost) / totals.value) * 100 }))
      .sort((a, b) => b.value - a.value);
  }, [positions, totals.value]);

  const bySectorChart = useMemo(() => {
    if (totals.value === 0) return [];
    const bySector = {};
    positions.forEach(p => {
      const key = p.sector || 'Unknown';
      bySector[key] = (bySector[key] || 0) + ((p.marketValue ?? p.cost) / totals.value) * 100;
    });
    return Object.entries(bySector).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [positions, totals.value]);

  const byPieChart = useMemo(() => {
    if (totals.value === 0) return [];
    const byPie = {};
    positions.forEach(p => {
      const key = p.pie || 'Unassigned';
      byPie[key] = (byPie[key] || 0) + ((p.marketValue ?? p.cost) / totals.value) * 100;
    });
    return Object.entries(byPie).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [positions, totals.value]);

  const groupedByPie = useMemo(() => {
    const groups = {};
    positions.forEach(p => {
      const key = p.pie || 'Unassigned';
      (groups[key] ||= []).push(p);
    });
    return Object.entries(groups)
      .map(([name, items]) => {
        const cost = items.reduce((a, p) => a + p.cost, 0);
        const value = items.reduce((a, p) => a + (p.marketValue ?? p.cost), 0);
        const gain = value - cost;
        const gainPct = cost > 0 ? (gain / cost) * 100 : 0;
        return { name, items: items.sort((a, b) => (b.marketValue ?? 0) - (a.marketValue ?? 0)), cost, value, gain, gainPct };
      })
      .sort((a, b) => (a.name === 'Unassigned' ? 1 : b.name === 'Unassigned' ? -1 : b.value - a.value));
  }, [positions]);

  const hasPies = groupedByPie.length > 1 || (groupedByPie.length === 1 && groupedByPie[0].name !== 'Unassigned');

  const removeLot = async (id) => {
    await fetch('/api/portfolio', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    load();
  };

  const removePosition = async (ticker) => {
    if (confirm(`Are you sure you want to remove all holdings for ${ticker}?`)) {
      await fetch('/api/portfolio', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ticker }) });
      load();
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ border: '1px solid var(--ws-border)', background: 'var(--ws-bg-1)', marginBottom: '20px', overflow: 'hidden' }}>
        <div style={{ background: 'var(--ws-bg-2)', borderBottom: '1px solid var(--ws-border)', padding: '7px 16px' }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: 'var(--ws-accent)', fontWeight: 700, letterSpacing: '1px' }}>
            $ traq portfolio
          </span>
        </div>
        <div style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ws-text)' }}>Portfolio</div>
            <div style={{ fontSize: '13px', color: 'var(--ws-text-2)' }}>Track your holdings and performance.</div>
          </div>
          {isSignedIn && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', border: '1px solid var(--ws-border)', overflow: 'hidden', flexShrink: 0 }}>
                {Object.keys(CURRENCIES).map(c => (
                  <button key={c} onClick={() => changeCurrency(c)}
                    style={{
                      height: '32px', padding: '0 10px', fontSize: '11px', fontWeight: 700, border: 'none', cursor: 'pointer',
                      background: currency === c ? 'var(--ws-accent)' : 'var(--ws-bg-1)',
                      color: currency === c ? 'var(--ws-bg-1)' : 'var(--ws-text-2)',
                      flexShrink: 0,
                    }}>
                    {c}
                  </button>
                ))}
              </div>
              <button onClick={() => setShowImport(true)}
                className="ws-btn-secondary"
                style={{ height: '34px', padding: '0 14px' }}>
                Import CSV
              </button>
              <button onClick={() => setShowModal(true)}
                className="ws-btn"
                style={{ height: '34px', padding: '0 16px' }}>
                + Add holding
              </button>
            </div>
          )}
        </div>
      </div>

      {!isSignedIn ? (
        <div style={{ border: '1px solid var(--ws-border)', padding: '48px', textAlign: 'center' }}>
          <div style={{ color: 'var(--ws-text-2)', fontSize: '14px', marginBottom: '16px' }}>Sign in to track your portfolio</div>
          <Link href="/sign-in" className="ws-btn" style={{ padding: '9px 20px', textDecoration: 'none' }}>Sign in →</Link>
        </div>
      ) : loading ? (
        <div style={{ color: 'var(--ws-text-3)', fontSize: '13px', padding: '30px 0' }}>Loading…</div>
      ) : loadError ? (
        <div style={{ border: '1px solid var(--ws-red)', padding: '20px', color: 'var(--ws-red)', fontSize: '13px' }}>
          Couldn't load your portfolio: {loadError}
        </div>
      ) : positions.length === 0 ? (
        <div style={{ border: '1px solid var(--ws-border)', padding: '48px', textAlign: 'center' }}>
          <div style={{ color: 'var(--ws-text)', fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>No holdings yet</div>
          <div style={{ color: 'var(--ws-text-3)', fontSize: '12px', marginBottom: '16px' }}>Add your first position to start tracking.</div>
          <button onClick={() => setShowModal(true)}
            className="ws-btn"
            style={{ padding: '9px 20px' }}>
            + Add holding
          </button>
        </div>
      ) : (
        <>
          <div className="portfolio-overview-grid">
            <div style={{ border: '1px solid var(--ws-border)', padding: '14px' }}>
              <div style={{ fontSize: '10px', color: 'var(--ws-text-3)', letterSpacing: '0.5px', marginBottom: '4px' }}>MARKET VALUE</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ws-text)' }}>{fmtC(totals.value)}</div>
            </div>
            <div style={{ border: '1px solid var(--ws-border)', padding: '14px' }}>
              <div style={{ fontSize: '10px', color: 'var(--ws-text-3)', letterSpacing: '0.5px', marginBottom: '4px' }}>COST BASIS</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ws-text)' }}>{fmtC(totals.cost)}</div>
            </div>
            <div style={{ border: '1px solid var(--ws-border)', padding: '14px' }}>
              <div style={{ fontSize: '10px', color: 'var(--ws-text-3)', letterSpacing: '0.5px', marginBottom: '4px' }}>TOTAL GAIN/LOSS</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: totals.gain >= 0 ? 'var(--ws-accent)' : 'var(--ws-red)' }}>
                {totals.gain >= 0 ? '+' : ''}{fmtC(totals.gain)} ({totals.gainPct >= 0 ? '+' : ''}{totals.gainPct.toFixed(1)}%)
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '18px' }}>
            <GrowthChart snapshots={snapshots} currentValue={totals.value} currentCost={totals.cost} rate={rate} symbol={symbol} />
          </div>

          <div className="portfolio-allocations-grid" style={{ gridTemplateColumns: `repeat(${1 + (bySectorChart.length > 1 ? 1 : 0) + (hasPies ? 1 : 0)}, 1fr)` }}>
            <AllocationChart title="ALLOCATION BY STOCK" data={byTickerChart} />
            {bySectorChart.length > 1 && <AllocationChart title="ALLOCATION BY SECTOR" data={bySectorChart} />}
            {hasPies && <AllocationChart title="ALLOCATION BY PIE" data={byPieChart} />}
          </div>

          {groupedByPie.map(group => {
            const groupAllocation = totals.value > 0 ? (group.value / totals.value) * 100 : 0;
            return (
              <div key={group.name} style={{ marginBottom: '18px' }}>
                {hasPies && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 4px', marginBottom: '2px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ws-text)' }}>{group.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--ws-text-3)' }}>{group.items.length} holding{group.items.length !== 1 ? 's' : ''} · {groupAllocation.toFixed(1)}% of portfolio</div>
                    <div style={{ marginLeft: 'auto', fontSize: '12px', fontWeight: 600, color: 'var(--ws-text)' }}>{fmtC(group.value)}</div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: group.gain >= 0 ? 'var(--ws-accent)' : 'var(--ws-red)' }}>
                      {group.gain >= 0 ? '+' : ''}{fmtC(group.gain)} ({group.gainPct >= 0 ? '+' : ''}{group.gainPct.toFixed(1)}%)
                    </div>
                  </div>
                )}
                <div className="responsive-table-container" style={{ border: '1px solid var(--ws-border)', background: 'var(--ws-bg-1)' }}>
                  <table className="responsive-table" style={{ fontSize: '12px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--ws-border)', background: 'var(--ws-bg-1)' }}>
                        {['Stock', '1M', 'Shares', 'Avg cost', 'Price', 'Day', 'P/E', 'Div yield', 'Market value', 'Gain/loss', 'Allocation', ''].map(h => (
                          <th key={h} className={h === 'Stock' ? 'sticky-col' : ''} style={{ padding: '9px 12px', textAlign: h === 'Stock' ? 'left' : h === '1M' ? 'center' : 'right', fontWeight: 600, fontSize: '10px', color: 'var(--ws-text-3)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map(p => {
                        const allocation = totals.value > 0 ? ((p.marketValue ?? p.cost) / totals.value) * 100 : 0;
                        const lastLot = [...p.lots].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
                        return (
                          <tr key={p.ticker} onClick={() => router.push(`/stock/${p.ticker}`)}
                            style={{ borderBottom: '1px solid var(--ws-border)', cursor: 'pointer', background: 'var(--ws-bg-1)' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--ws-bg-2)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'var(--ws-bg-1)'}>
                            <td className="sticky-col" style={{ padding: '10px 12px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <StockLogo ticker={p.ticker} size={24} />
                                <div>
                                  <div style={{ fontWeight: 600, color: 'var(--ws-text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    {p.ticker}
                                    <MarketStatusDot ticker={p.ticker} />
                                  </div>
                                  <div style={{ color: 'var(--ws-text-3)', fontSize: '11px' }}>{p.name || '…'}</div>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                              {sparklines[p.ticker] && <Sparkline data={sparklines[p.ticker]} width={64} height={22} />}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right' }}>{p.shares.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right' }}>{p.avgCostNative != null ? formatCurrency(p.avgCostNative, CURRENCIES[p.costCurrency] || p.costCurrency) : fmtC(p.avgCost)}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>{p.priceNative != null ? formatCurrency(p.priceNative, CURRENCIES[p.priceCurrency] || p.priceCurrency) : '—'}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', color: p.dayChangePct == null ? 'var(--ws-text-3)' : p.dayChangePct >= 0 ? 'var(--ws-accent)' : 'var(--ws-red)' }}>
                              {p.dayChangePct != null ? `${p.dayChangePct >= 0 ? '+' : ''}${p.dayChangePct.toFixed(2)}%` : '—'}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--ws-text-2)' }}>{p.pe ? p.pe.toFixed(1) : '—'}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--ws-text-2)' }}>{p.dividendYield ? `${p.dividendYield.toFixed(2)}%` : '—'}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>{fmtC(p.marketValue ?? p.cost)}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', color: p.gain == null ? 'var(--ws-text-3)' : p.gain >= 0 ? 'var(--ws-accent)' : 'var(--ws-red)', fontWeight: 600 }}>
                              {p.gain == null ? '—' : `${p.gain >= 0 ? '+' : ''}${fmtC(p.gain)} (${p.gainPct >= 0 ? '+' : ''}${p.gainPct.toFixed(1)}%)`}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--ws-text-2)' }}>{allocation.toFixed(1)}%</td>
                             <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                               <button onClick={() => setBuyTicker(p.ticker)} title="Buy shares"
                                 className="ws-btn"
                                 style={{ fontSize: '10px', padding: '5px 10px', marginRight: '4px' }}>
                                 Buy
                               </button>
                               <button onClick={() => setSellPosition(p)} title="Sell shares"
                                 className="ws-btn-secondary"
                                 style={{ fontSize: '10px', padding: '4px 8px', marginRight: '4px' }}>
                                 Sell
                               </button>
                               <button onClick={() => setEditLot(lastLot)} title={`Edit last entry: ${lastLot.shares} sh @ ${lastLot.cost_basis} ${lastLot.cost_basis_currency} on ${lastLot.purchase_date}`}
                                 style={{ background: 'none', border: 'none', color: 'var(--ws-text-3)', cursor: 'pointer', fontSize: '13px', marginLeft: '2px' }}>
                                 ✎
                               </button>
                               <button onClick={() => removePosition(p.ticker)} title={`Remove entire ${p.ticker} position`}
                                 style={{ background: 'none', border: 'none', color: 'var(--ws-text-3)', cursor: 'pointer', fontSize: '13px', marginLeft: '6px' }}>
                                 ✕
                               </button>
                             </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </>
      )}

      {(showModal || buyTicker) && <AddHoldingModal presetTicker={buyTicker} onClose={() => { setShowModal(false); setBuyTicker(null); }} onAdded={() => { setShowModal(false); setBuyTicker(null); load(); }} existingPies={existingPies} defaultCurrency={currency} />}
      {showImport && <ImportCsvModal onClose={() => setShowImport(false)} onImported={() => { setShowImport(false); load(); }} defaultCurrency={currency} />}
      {editLot && <AddHoldingModal onClose={() => setEditLot(null)} onAdded={() => { setEditLot(null); load(); }} existingPies={existingPies} defaultCurrency={currency} editLot={editLot} />}
      {sellPosition && <SellModal position={sellPosition} onClose={() => setSellPosition(null)} onSold={() => { setSellPosition(null); load(); }} />}
    </div>
  );
}
