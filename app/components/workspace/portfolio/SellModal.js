'use client';
import { useState } from 'react';

export default function SellModal({ position, onClose, onSold, portfolioId }) {
  const [shares, setShares] = useState('');
  const [addToCash, setAddToCash] = useState(false);
  const [sellPrice, setSellPrice] = useState(position.priceNative || position.price || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // portfolioId is 'all' when the page's "All Portfolios" tab is active — that's a UI-only
  // filter value, not a real portfolio, so it can't be written to a portfolio_id uuid column.
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
      setError(d.error || 'Failed to sell.');
      return;
    }
    onSold();
  };

  return (
    <div onClick={onClose} className="fixed inset-0 bg-black/35 flex items-center justify-center z-[200]">
      <div onClick={e => e.stopPropagation()} style={{ width: '360px', maxWidth: '92vw', background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', borderRadius: '12px', padding: '22px', boxShadow: '0 12px 40px rgba(0,0,0,0.18)' }}>
        <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--ws-text)', marginBottom: '4px' }}>Sell {position.ticker}</div>
        <div style={{ fontSize: '12px', color: 'var(--ws-text-3)', marginBottom: '16px' }}>You hold {position.shares.toLocaleString(undefined, { maximumFractionDigits: 4 })} shares. Reduces from your oldest lots first.</div>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div>
            <div className="ws-label" style={{ marginBottom: '4px' }}>SHARES TO SELL</div>
            <input type="number" step="any" min="0" max={position.shares} value={shares} onChange={e => setShares(e.target.value)} className="ws-input" autoFocus required />
          </div>
          <button type="button" onClick={() => setShares(String(position.shares))}
            style={{ alignSelf: 'flex-start', fontSize: '11px', fontWeight: 600, color: 'var(--ws-accent)', background: 'var(--ws-accent-dim)', border: 'none', padding: '5px 10px', cursor: 'pointer' }}>
            Sell all
          </button>
          <div style={{ marginTop: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input type="checkbox" checked={addToCash} onChange={e => setAddToCash(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: 'var(--ws-accent)' }} />
              <span style={{ fontSize: '13px', color: 'var(--ws-text)', fontWeight: 600 }}>Add proceeds to cash balance</span>
            </label>
            {addToCash && (
              <div style={{ marginTop: '12px', background: 'var(--ws-bg-2)', padding: '12px', borderRadius: '8px', border: '1px solid var(--ws-border)' }}>
                <div className="ws-label" style={{ marginBottom: '4px' }}>SELL PRICE ({position.priceCurrency || 'USD'})</div>
                <input type="number" step="any" min="0" value={sellPrice} onChange={e => setSellPrice(e.target.value)} className="ws-input" style={{ width: '100%' }} placeholder="Price per share" required />
                {Number(shares) > 0 && Number(sellPrice) > 0 && (
                  <div style={{ fontSize: '12px', color: 'var(--ws-text-2)', textAlign: 'right', marginTop: '8px' }}>
                    Total proceeds: <strong style={{ color: 'var(--ws-accent)' }}>+{(Number(shares) * Number(sellPrice)).toLocaleString(undefined, { maximumFractionDigits: 2 })} {position.priceCurrency || 'USD'}</strong>
                  </div>
                )}
              </div>
            )}
          </div>
          {error && (
            <div style={{ padding: '8px 12px', border: '1px solid var(--ws-red)', color: 'var(--ws-red)', fontSize: '12px' }}>{error}</div>
          )}
          <div className="flex gap-2 mt-3">
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
