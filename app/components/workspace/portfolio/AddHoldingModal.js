'use client';
import { useState, useEffect, useRef } from 'react';
import StockLogo from '../StockLogo';
import { formatCurrency } from '../../../../lib/formatters';
import { useTickerSearch } from '../../../../lib/hooks/useTickerSearch';

const CURRENCIES = { USD: '$', EUR: '€', GBP: '£' };

export default function AddHoldingModal({ onClose, onAdded, existingPies, defaultCurrency, editLot, presetTicker, portfolioId }) {
  const isEdit = !!editLot;
  const [query, setQuery] = useState(editLot?.ticker || presetTicker || '');
  const [selected, setSelected] = useState(
    editLot ? { ticker: editLot.ticker, name: editLot.ticker } :
    presetTicker ? { ticker: presetTicker, name: presetTicker } : null
  );
  const [preview, setPreview] = useState(null);
  const [shares, setShares] = useState(editLot ? String(editLot.shares) : '');
  // 'shares' is always the value actually submitted — in 'amount' mode it's kept in sync
  // (via the effect below) from the amount the user typed, so the rest of the form (total
  // cost display, submit handler) doesn't need to know which mode is active. Defaults to
  // 'amount' for a new holding (most people think "I put in £80", not "I bought 12.3457
  // shares") but 'shares' when editing an existing lot, since that already has an exact
  // share count to adjust rather than an amount to re-derive it from.
  const [sharesMode, setSharesMode] = useState(isEdit ? 'shares' : 'amount');
  const [amount, setAmount] = useState('');
  const [costBasis, setCostBasis] = useState(editLot ? String(editLot.cost_basis) : '');
  const [costBasisCurrency, setCostBasisCurrency] = useState(editLot?.cost_basis_currency || defaultCurrency || 'USD');
  const [purchaseDate, setPurchaseDate] = useState(editLot?.purchase_date || new Date().toISOString().slice(0, 10));
  const [pie, setPie] = useState(editLot?.pie || '');
  const [showPieSuggestions, setShowPieSuggestions] = useState(false);
  const [deductCash, setDeductCash] = useState(false);
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

  const { suggestions } = useTickerSearch(query, { enabled: !selected });

  const pickTicker = (s) => {
    setSelected(s);
    setQuery(s.ticker);
    fetch(`/api/stock?ticker=${s.ticker}`).then(r => r.json()).then(setPreview).catch(() => {});
    if (!costBasis) inputRef.current?.blur();
  };

  const useCurrentPrice = () => { if (preview?.currentPrice) { setCostBasis(String(preview.currentPrice)); setCostBasisCurrency('USD'); } };

  // Amount mode: derive shares from "how much I spent / price per share" instead of the
  // user having to do that math themselves. Recomputes whenever either input changes, in
  // either fill order.
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
          body: JSON.stringify({ id: editLot.id, shares, costBasis, purchaseDate, pie, costBasisCurrency, portfolio_id: portfolioId }),
        })
      : await fetch('/api/portfolio', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticker: selected.ticker, shares, costBasis, purchaseDate, pie, costBasisCurrency, portfolio_id: portfolioId, deductCash }),
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

  return (
    <div onClick={onClose} className="fixed inset-0 bg-black/35 flex items-center justify-center z-[200]">
      <div onClick={e => e.stopPropagation()} style={{ width: '420px', maxWidth: '92vw', background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', borderRadius: '12px', padding: '22px', boxShadow: '0 12px 40px rgba(0,0,0,0.18)' }}>
        <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--ws-text)', marginBottom: '4px' }}>
          {isEdit ? `Edit ${editLot.ticker} lot` : presetTicker ? `Buy ${presetTicker}` : 'Add holding'}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--ws-text-3)', marginBottom: '16px' }}>
          {isEdit ? 'Update shares, cost, or date for this entry.' : presetTicker ? `Add a purchase of ${presetTicker} directly to your holdings.` : 'Search a ticker, then enter shares and cost.'}
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3">
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
              <div className="ws-label" style={{ marginBottom: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{sharesMode === 'shares' ? 'SHARES' : `AMOUNT (${costBasisCurrency})`}</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" onClick={() => setSharesMode('shares')}
                    style={{ background: 'none', border: 'none', color: sharesMode === 'shares' ? 'var(--ws-accent)' : 'var(--ws-text-3)', fontSize: '10px', fontWeight: 700, cursor: 'pointer', padding: 0 }}>
                    Shares
                  </button>
                  <button type="button" onClick={() => setSharesMode('amount')}
                    style={{ background: 'none', border: 'none', color: sharesMode === 'amount' ? 'var(--ws-accent)' : 'var(--ws-text-3)', fontSize: '10px', fontWeight: 700, cursor: 'pointer', padding: 0 }}>
                    Amount
                  </button>
                </div>
              </div>
              {sharesMode === 'shares' ? (
                <input type="number" step="any" min="0" value={shares} onChange={e => setShares(e.target.value)} className="ws-input" required />
              ) : (
                <>
                  <input type="number" step="any" min="0" value={amount} onChange={e => setAmount(e.target.value)} className="ws-input" placeholder="e.g. 80" required />
                  <div style={{ fontSize: '10px', color: 'var(--ws-text-3)', marginTop: '3px' }}>
                    {amount && costBasis && Number(costBasis) > 0
                      ? `≈ ${(Number(amount) / Number(costBasis)).toLocaleString(undefined, { maximumFractionDigits: 4 })} shares at ${CURRENCIES[costBasisCurrency]}${Number(costBasis).toFixed(2)}`
                      : 'Enter cost per share to see how many shares that buys.'}
                  </div>
                </>
              )}
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

          {!isEdit && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '4px' }}>
              <input type="checkbox" checked={deductCash} onChange={e => setDeductCash(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: 'var(--ws-accent)' }} />
              <span style={{ fontSize: '13px', color: 'var(--ws-text)', fontWeight: 600 }}>Deduct cost from cash balance</span>
            </label>
          )}

          {error && (
            <div style={{ padding: '8px 12px', border: '1px solid var(--ws-red)', color: 'var(--ws-red)', fontSize: '12px' }}>{error}</div>
          )}

          <div className="flex gap-2 mt-1.5">
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
