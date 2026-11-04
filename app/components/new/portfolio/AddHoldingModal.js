'use client';
import { useState, useEffect, useRef } from 'react';
import StockLogo from '../../workspace/StockLogo';
import { formatCurrency } from '../../../../lib/formatters';
import { useTickerSearch } from '../../../../lib/hooks/useTickerSearch';
import { NEW_COLORS as C } from '../theme';

const CURRENCIES = { USD: '$', EUR: '€', GBP: '£' };

const inputStyle = { width: '100%', height: '42px', borderRadius: '12px', border: `1px solid ${C.border}`, padding: '0 14px', fontSize: '14px', fontFamily: 'inherit', background: '#FDFBF6', color: C.ink, boxSizing: 'border-box' };
const labelStyle = { fontSize: '11px', fontWeight: 700, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.5px' };

export default function AddHoldingModal({ onClose, onAdded, editLot, presetTicker, portfolioId, portfolios }) {
  const isEdit = !!editLot;
  // portfolioId is 'all' when the page's "Todos" tab is active — that's a UI-only filter
  // value, not a real portfolio, so it can't be written to a portfolio_id uuid column.
  // Fall back to the holding's own portfolio when editing, otherwise the first portfolio.
  const resolvedPortfolioId = portfolioId !== 'all' ? portfolioId : (editLot?.portfolio_id || portfolios?.[0]?.id || '');
  const [query, setQuery] = useState(editLot?.ticker || presetTicker || '');
  const [selected, setSelected] = useState(
    editLot ? { ticker: editLot.ticker, name: editLot.ticker } :
    presetTicker ? { ticker: presetTicker, name: presetTicker } : null
  );
  const [preview, setPreview] = useState(null);
  const [shares, setShares] = useState(editLot ? String(editLot.shares) : '');
  // 'shares' is always the value actually submitted — in 'amount' mode it's kept in sync
  // (via the effect below) from the amount the user typed, so the rest of the form (total
  // cost display, submit handler) doesn't need to know which mode is active.
  const [sharesMode, setSharesMode] = useState(isEdit ? 'shares' : 'amount');
  const [amount, setAmount] = useState('');
  const [costBasis, setCostBasis] = useState(editLot ? String(editLot.cost_basis) : '');
  const [purchaseDate, setPurchaseDate] = useState(editLot?.purchase_date || new Date().toISOString().slice(0, 10));
  const [deductCash, setDeductCash] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [manualLookupState, setManualLookupState] = useState('idle'); // idle | loading | not_found
  const inputRef = useRef(null);

  // No currency picker — cost basis is always in the stock's own trading currency (what the
  // stock API reports, or what the lot was already saved with when editing), one fewer thing
  // to choose per position.
  const costBasisCurrency = editLot ? (editLot.cost_basis_currency || 'USD') : (preview?.currency || 'USD');

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (presetTicker && !editLot) {
      fetch(`/api/stock?ticker=${presetTicker}`).then(r => r.json()).then(setPreview).catch(() => {});
    }
  }, [presetTicker, editLot]);

  const { suggestions } = useTickerSearch(query, { enabled: !selected });

  const pickTicker = (s) => {
    setSelected(s);
    setQuery(s.ticker);
    fetch(`/api/stock?ticker=${s.ticker}`).then(r => r.json()).then(setPreview).catch(() => {});
    if (!costBasis) inputRef.current?.blur();
  };

  const useCurrentPrice = () => { if (preview?.currentPrice) setCostBasis(String(preview.currentPrice)); };

  // Amount mode: derive shares from "how much I spent / price per share" instead of the
  // user having to do that math themselves.
  useEffect(() => {
    if (sharesMode !== 'amount') return;
    const amt = Number(amount), price = Number(costBasis);
    if (amount === '' || costBasis === '' || !(price > 0)) return;
    setShares(String(amt / price));
  }, [sharesMode, amount, costBasis]);

  const manualLookup = async () => {
    if (!query) return;
    setManualLookupState('loading');
    try {
      const res = await fetch(`/api/stock?ticker=${query}&refresh=true`);
      const data = await res.json();
      if (!res.ok || !data.name) { setManualLookupState('not_found'); return; }
      setSelected({ ticker: query, name: data.name, international: true });
      setPreview(data);
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
          body: JSON.stringify({ id: editLot.id, shares, costBasis, purchaseDate, costBasisCurrency, portfolio_id: resolvedPortfolioId }),
        })
      : await fetch('/api/portfolio', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticker: selected.ticker, shares, costBasis, purchaseDate, costBasisCurrency, portfolio_id: resolvedPortfolioId, deductCash }),
        });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || `No se pudo ${isEdit ? 'actualizar' : 'añadir'} la posición.`);
      return;
    }
    onAdded();
  };

  const total = shares && costBasis ? Number(shares) * Number(costBasis) : null;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(28,27,24,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '20px', boxSizing: 'border-box' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '440px', maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '24px', boxShadow: '0 20px 60px rgba(28,27,24,0.18)', boxSizing: 'border-box' }}>
        <div style={{ fontSize: '16px', fontWeight: 800, color: C.ink, marginBottom: '4px' }}>
          {isEdit ? `Editar posición de ${editLot.ticker}` : presetTicker ? `Comprar ${presetTicker}` : 'Añadir posición'}
        </div>
        <div style={{ fontSize: '12px', color: C.text2, marginBottom: '18px' }}>
          {isEdit ? 'Actualiza acciones o coste de esta entrada.' : presetTicker ? `Añade una compra de ${presetTicker} directamente a tus posiciones.` : 'Busca un ticker, luego indica acciones y coste.'}
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {!isEdit && (
            <>
              <div style={{ position: 'relative' }}>
                <input ref={inputRef} value={query} placeholder="Busca un ticker o empresa…"
                  onChange={e => { setQuery(e.target.value.toUpperCase()); setSelected(null); setPreview(null); setManualLookupState('idle'); }}
                  style={{ ...inputStyle, background: presetTicker ? C.avatarBg : '#FDFBF6', cursor: presetTicker ? 'not-allowed' : 'text' }}
                  autoComplete="off" required disabled={!!presetTicker} />
                {suggestions.length > 0 && (
                  <div style={{ position: 'absolute', top: '46px', left: 0, right: 0, background: C.surface, border: `1px solid ${C.border}`, borderRadius: '12px', boxShadow: '0 12px 32px rgba(28,27,24,0.12)', maxHeight: '220px', overflowY: 'auto', zIndex: 10 }}>
                    {suggestions.map(s => (
                      <button key={s.ticker} type="button" onClick={() => pickTicker(s)}
                        style={{ width: '100%', background: 'none', border: 'none', fontFamily: 'inherit', textAlign: 'left', padding: '10px 14px', cursor: 'pointer', display: 'flex', gap: '10px', alignItems: 'center', fontSize: '13px' }}
                        onMouseEnter={e => e.currentTarget.style.background = C.bg}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <StockLogo ticker={s.ticker} size={22} />
                        <span style={{ color: C.ink, fontWeight: 700 }}>{s.ticker}</span>
                        <span style={{ color: C.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {!selected && query.length >= 2 && suggestions.length === 0 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '10px 14px', borderRadius: '12px', border: `1px dashed ${C.border}`, background: C.bg }}>
                  <span style={{ fontSize: '12px', color: C.text3 }}>
                    {manualLookupState === 'not_found'
                      ? `No encontramos "${query}". Comprueba el símbolo exacto (p. ej. SAN.MC para Madrid).`
                      : `No está en nuestro universo filtrado — pruébalo como ticker internacional (p. ej. SAN.MC, VOD.L).`}
                  </span>
                  <button type="button" onClick={manualLookup} disabled={manualLookupState === 'loading'}
                    style={{ flexShrink: 0, fontSize: '12px', fontWeight: 700, color: C.ink, background: C.lime, border: 'none', borderRadius: '10px', padding: '7px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>
                    {manualLookupState === 'loading' ? 'Buscando…' : `Buscar "${query}"`}
                  </button>
                </div>
              )}
            </>
          )}

          {selected && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '12px', border: `1px solid ${C.border}`, background: C.bg }}>
                <StockLogo ticker={selected.ticker} size={32} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: C.ink }}>{selected.ticker}</div>
                  <div style={{ fontSize: '11px', color: C.text3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected.name}</div>
                </div>
                {preview?.currentPrice && (
                  <button type="button" onClick={useCurrentPrice}
                    style={{ fontSize: '11px', fontWeight: 700, color: C.ink, background: C.lime, border: 'none', borderRadius: '10px', padding: '7px 10px', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                    Usar {CURRENCIES[preview.currency] || '$'}{preview.currentPrice.toFixed(2)}
                  </button>
                )}
              </div>
              {selected.international && (
                <div style={{ fontSize: '10px', color: C.text3 }}>
                  Ticker internacional — el precio se sigue bien, pero los fundamentales extendidos de la ficha (nota, valor razonable) pueden no estar disponibles para este mercado.
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <div style={{ ...labelStyle, marginBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{sharesMode === 'shares' ? 'ACCIONES' : `IMPORTE (${costBasisCurrency})`}</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" onClick={() => setSharesMode('shares')}
                    style={{ background: 'none', border: 'none', color: sharesMode === 'shares' ? C.green : C.text3, fontSize: '10px', fontWeight: 700, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
                    Acciones
                  </button>
                  <button type="button" onClick={() => setSharesMode('amount')}
                    style={{ background: 'none', border: 'none', color: sharesMode === 'amount' ? C.green : C.text3, fontSize: '10px', fontWeight: 700, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
                    Importe
                  </button>
                </div>
              </div>
              {sharesMode === 'shares' ? (
                <input type="number" step="any" min="0" value={shares} onChange={e => setShares(e.target.value)} style={inputStyle} required />
              ) : (
                <>
                  <input type="number" step="any" min="0" value={amount} onChange={e => setAmount(e.target.value)} style={inputStyle} placeholder="p. ej. 80" required />
                  <div style={{ fontSize: '10px', color: C.text3, marginTop: '4px' }}>
                    {amount && costBasis && Number(costBasis) > 0
                      ? `≈ ${(Number(amount) / Number(costBasis)).toLocaleString(undefined, { maximumFractionDigits: 4 })} acciones a ${CURRENCIES[costBasisCurrency]}${Number(costBasis).toFixed(2)}`
                      : 'Indica el coste por acción para ver cuántas acciones compra.'}
                  </div>
                </>
              )}
            </div>
            <div>
              <div style={{ ...labelStyle, marginBottom: '6px', display: 'flex', justifyContent: 'space-between' }}>
                <span>COSTE POR ACCIÓN</span>
                <span style={{ fontSize: '10px', fontWeight: 700, color: C.text3 }}>{costBasisCurrency}</span>
              </div>
              <input type="number" step="any" min="0" value={costBasis} onChange={e => setCostBasis(e.target.value)} style={inputStyle} required />
              <div style={{ fontSize: '10px', color: C.text3, marginTop: '4px' }}>Indica el precio tal como lo mostró tu broker.</div>
            </div>
          </div>

          <div>
            <div style={{ ...labelStyle, marginBottom: '6px' }}>FECHA DE COMPRA</div>
            <input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} style={inputStyle} />
          </div>

          {total != null && (
            <div style={{ fontSize: '12px', color: C.text2, textAlign: 'right' }}>Coste total: <strong style={{ color: C.ink }}>{formatCurrency(total, CURRENCIES[costBasisCurrency])}</strong></div>
          )}

          {!isEdit && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '2px' }}>
              <input type="checkbox" checked={deductCash} onChange={e => setDeductCash(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: C.green }} />
              <span style={{ fontSize: '13px', color: C.ink, fontWeight: 600 }}>Descontar el coste del saldo de caja</span>
            </label>
          )}

          {error && (
            <div style={{ padding: '10px 14px', borderRadius: '10px', background: '#F8DFDA', color: C.red, fontSize: '12px' }}>{error}</div>
          )}

          <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
            <button type="button" onClick={onClose}
              style={{ flex: 1, height: '42px', borderRadius: '12px', border: `1px solid ${C.border}`, background: 'transparent', color: C.text2, fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>
              Cancelar
            </button>
            <button type="submit" disabled={!selected || saving}
              style={{ flex: 2, height: '42px', borderRadius: '12px', border: 'none', background: C.lime, color: C.ink, fontWeight: 700, fontSize: '13px', cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit', opacity: (!selected || saving) ? 0.6 : 1 }}>
              {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Añadir al portfolio'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
