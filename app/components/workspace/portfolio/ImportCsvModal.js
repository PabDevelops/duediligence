'use client';
import { useState, useEffect, useRef } from 'react';

const CURRENCIES = { USD: '$', EUR: '€', GBP: '£' };

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

export default function ImportCsvModal({ onClose, onImported, defaultCurrency, portfolioId }) {
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
      body: JSON.stringify({ rows, portfolio_id: portfolioId }),
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
    <div onClick={onClose} className="fixed inset-0 bg-black/35 flex items-center justify-center z-[200]">
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
