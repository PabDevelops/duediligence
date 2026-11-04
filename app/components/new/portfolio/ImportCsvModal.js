'use client';
import { useState, useEffect, useRef } from 'react';
import { NEW_COLORS as C } from '../theme';

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
  if (lines.length < 2) return { rows: [], errors: ['El CSV necesita una fila de cabecera y al menos una fila de datos.'] };

  const header = lines[0].split(',').map(h => h.trim().toLowerCase());
  const colIndex = {};
  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    const idx = header.findIndex(h => aliases.includes(h));
    if (idx !== -1) colIndex[field] = idx;
  }
  if (colIndex.ticker === undefined || colIndex.shares === undefined || colIndex.costBasis === undefined) {
    return { rows: [], errors: ['El CSV debe tener columnas para ticker, acciones y precio. Cabecera detectada: ' + header.join(', ')], hasCurrencyColumn: false };
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
      errors.push(`Fila ${i + 1}: datos no válidos (${lines[i]})`);
      continue;
    }
    rows.push({ ticker, shares, costBasis, purchaseDate, costBasisCurrency });
  }
  return { rows, errors, hasCurrencyColumn };
}

export default function ImportCsvModal({ onClose, onImported, defaultCurrency, portfolioId, portfolios }) {
  // portfolioId is 'all' when the page's "Todos" tab is active — that's a UI-only filter
  // value, not a real portfolio, so it can't be written to a portfolio_id uuid column.
  const resolvedPortfolioId = portfolioId !== 'all' ? portfolioId : (portfolios?.[0]?.id || '');
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
      body: JSON.stringify({ rows, portfolio_id: resolvedPortfolioId }),
    });
    setImporting(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setErrors([d.error || 'La importación falló.']);
      return;
    }
    onImported();
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(28,27,24,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '20px', boxSizing: 'border-box' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '500px', maxWidth: '100%', maxHeight: '85vh', overflowY: 'auto', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '24px', boxShadow: '0 20px 60px rgba(28,27,24,0.18)', boxSizing: 'border-box' }}>
        <div style={{ fontSize: '16px', fontWeight: 800, color: C.ink, marginBottom: '4px' }}>Importar desde CSV</div>
        <div style={{ fontSize: '12px', color: C.text2, marginBottom: '14px' }}>
          Columnas: <strong>ticker, shares, price, date</strong> (fecha opcional, moneda opcional). La primera fila debe ser la cabecera.
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', color: C.text2 }}>{hasCurrencyColumn ? 'Columna de moneda detectada en el CSV' : 'La columna de precio está en:'}</span>
          {!hasCurrencyColumn && (
            <div style={{ display: 'flex', borderRadius: '10px', overflow: 'hidden', border: `1px solid ${C.border}` }}>
              {Object.keys(CURRENCIES).map(c => (
                <button key={c} type="button" onClick={() => setFallbackCurrency(c)}
                  style={{ height: '26px', padding: '0 10px', fontSize: '11px', fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: fallbackCurrency === c ? C.lime : C.surface, color: fallbackCurrency === c ? C.ink : C.text2 }}>
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>

        <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} style={{ display: 'none' }} />
        <button type="button" onClick={() => fileRef.current?.click()}
          style={{ width: '100%', height: '80px', borderRadius: '12px', border: `1px dashed ${C.border}`, background: C.bg, color: C.text2, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>
          {fileName || 'Toca para elegir un archivo .csv'}
        </button>

        {errors.length > 0 && (
          <div style={{ marginTop: '14px', padding: '10px 14px', borderRadius: '10px', background: '#F8DFDA' }}>
            {errors.map((e, i) => <div key={i} style={{ fontSize: '12px', color: C.red }}>{e}</div>)}
          </div>
        )}

        {rows.length > 0 && (
          <>
            <div style={{ fontSize: '12px', fontWeight: 700, color: C.ink, margin: '16px 0 8px' }}>{rows.length} fila{rows.length !== 1 ? 's' : ''} lista{rows.length !== 1 ? 's' : ''} para importar</div>
            <div style={{ borderRadius: '12px', border: `1px solid ${C.border}`, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: C.bg }}>
                    {['Ticker', 'Acciones', 'Precio', 'Fecha'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: C.text3, fontWeight: 700 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 8).map((r, i) => (
                    <tr key={i} style={{ borderTop: `1px solid ${C.borderSoft}` }}>
                      <td style={{ padding: '8px 10px', fontWeight: 700, color: C.ink }}>{r.ticker}</td>
                      <td style={{ padding: '8px 10px', color: C.text2 }}>{r.shares}</td>
                      <td style={{ padding: '8px 10px', color: C.text2 }}>${r.costBasis}</td>
                      <td style={{ padding: '8px 10px', color: C.text2 }}>{r.purchaseDate || 'hoy'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 8 && <div style={{ padding: '8px 10px', fontSize: '12px', color: C.text3 }}>+{rows.length - 8} más…</div>}
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: '10px', marginTop: '18px' }}>
          <button type="button" onClick={onClose}
            style={{ flex: 1, height: '42px', borderRadius: '12px', border: `1px solid ${C.border}`, background: 'transparent', color: C.text2, fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>
            Cancelar
          </button>
          <button type="button" onClick={doImport} disabled={rows.length === 0 || importing}
            style={{ flex: 2, height: '42px', borderRadius: '12px', border: 'none', background: C.lime, color: C.ink, fontWeight: 700, fontSize: '13px', cursor: (rows.length === 0 || importing) ? 'default' : 'pointer', fontFamily: 'inherit', opacity: (rows.length === 0 || importing) ? 0.6 : 1 }}>
            {importing ? 'Importando…' : `Importar ${rows.length || ''} posición${rows.length === 1 ? '' : 'es'}`}
          </button>
        </div>
      </div>
    </div>
  );
}
