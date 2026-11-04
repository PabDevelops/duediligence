'use client';
import { useState } from 'react';
import { NEW_COLORS as C } from '../theme';

const inputStyle = { width: '100%', height: '42px', borderRadius: '12px', border: `1px solid ${C.border}`, padding: '0 14px', fontSize: '14px', fontFamily: 'inherit', background: '#FDFBF6', color: C.ink, boxSizing: 'border-box' };
const labelStyle = { fontSize: '11px', fontWeight: 700, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.5px' };

export default function SellModal({ position, onClose, onSold, portfolioId }) {
  const [shares, setShares] = useState('');
  const [addToCash, setAddToCash] = useState(false);
  const [sellPrice, setSellPrice] = useState(position.priceNative || position.price || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // portfolioId is 'all' when the page's "Todos" tab is active — that's a UI-only filter
  // value, not a real portfolio, so it can't be written to a portfolio_id uuid column.
  // The position being sold always belongs to a real portfolio via its lots, so use that.
  const resolvedPortfolioId = portfolioId !== 'all' ? portfolioId : (position.lots?.[0]?.portfolio_id || '');

  const submit = async (e) => {
    e.preventDefault();
    const n = Number(shares);
    if (!(n > 0)) return;
    setSaving(true);
    setError(null);
    const res = await fetch('/api/portfolio/sell', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticker: position.ticker,
        shares: n,
        portfolio_id: resolvedPortfolioId,
        addToCash,
        sellPrice: addToCash ? Number(sellPrice) : null,
        currency: position.priceCurrency || 'USD'
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || 'No se pudo vender.');
      return;
    }
    onSold();
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(28,27,24,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '20px', boxSizing: 'border-box' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '380px', maxWidth: '100%', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '24px', boxShadow: '0 20px 60px rgba(28,27,24,0.18)', boxSizing: 'border-box' }}>
        <div style={{ fontSize: '16px', fontWeight: 800, color: C.ink, marginBottom: '4px' }}>Vender {position.ticker}</div>
        <div style={{ fontSize: '12px', color: C.text2, marginBottom: '18px' }}>Tienes {position.shares.toLocaleString(undefined, { maximumFractionDigits: 4 })} acciones. Se reducen primero las entradas más antiguas.</div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <div style={{ ...labelStyle, marginBottom: '6px' }}>ACCIONES A VENDER</div>
            <input type="number" step="any" min="0" max={position.shares} value={shares} onChange={e => setShares(e.target.value)} style={inputStyle} autoFocus required />
          </div>
          <button type="button" onClick={() => setShares(String(position.shares))}
            style={{ alignSelf: 'flex-start', fontSize: '11px', fontWeight: 700, color: C.ink, background: C.lime, border: 'none', borderRadius: '10px', padding: '6px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>
            Vender todo
          </button>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input type="checkbox" checked={addToCash} onChange={e => setAddToCash(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: C.green }} />
              <span style={{ fontSize: '13px', color: C.ink, fontWeight: 600 }}>Añadir el importe al saldo de caja</span>
            </label>
            {addToCash && (
              <div style={{ marginTop: '12px', background: C.bg, padding: '12px', borderRadius: '12px', border: `1px solid ${C.border}` }}>
                <div style={{ ...labelStyle, marginBottom: '6px' }}>PRECIO DE VENTA ({position.priceCurrency || 'USD'})</div>
                <input type="number" step="any" min="0" value={sellPrice} onChange={e => setSellPrice(e.target.value)} style={inputStyle} placeholder="Precio por acción" required />
                {Number(shares) > 0 && Number(sellPrice) > 0 && (
                  <div style={{ fontSize: '12px', color: C.text2, textAlign: 'right', marginTop: '8px' }}>
                    Importe total: <strong style={{ color: C.green }}>+{(Number(shares) * Number(sellPrice)).toLocaleString(undefined, { maximumFractionDigits: 2 })} {position.priceCurrency || 'USD'}</strong>
                  </div>
                )}
              </div>
            )}
          </div>
          {error && (
            <div style={{ padding: '10px 14px', borderRadius: '10px', background: '#F8DFDA', color: C.red, fontSize: '12px' }}>{error}</div>
          )}
          <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
            <button type="button" onClick={onClose}
              style={{ flex: 1, height: '42px', borderRadius: '12px', border: `1px solid ${C.border}`, background: 'transparent', color: C.text2, fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              style={{ flex: 2, height: '42px', borderRadius: '12px', border: 'none', background: C.red, color: '#FFF', fontWeight: 700, fontSize: '13px', cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Vendiendo…' : 'Vender'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
