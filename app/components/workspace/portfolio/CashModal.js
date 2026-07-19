'use client';
import { useState } from 'react';

const CURRENCIES = ['USD', 'EUR', 'GBP'];

export default function CashModal({ portfolioId, portfolios, onClose, onAdded }) {
  const [type, setType] = useState('deposit');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [notes, setNotes] = useState('');
  const [selectedPortfolio, setSelectedPortfolio] = useState(portfolioId === 'all' ? (portfolios[0]?.id || '') : (portfolioId || ''));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!amount || Number(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    if (!selectedPortfolio) {
      setError('Please select a portfolio');
      return;
    }

    setSaving(true);
    const finalAmount = type === 'deposit' ? Number(amount) : -Number(amount);

    try {
      const res = await fetch('/api/portfolio/cash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portfolio_id: selectedPortfolio,
          amount: finalAmount,
          currency,
          notes
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to save transaction');
      }

      onAdded();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <div className="ws-modal-overlay">
      <div className="ws-modal">
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--ws-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ws-text)' }}>Manage Cash</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--ws-text-3)', cursor: 'pointer', fontSize: '16px' }}>✕</button>
        </div>
        
        <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
            <button type="button" onClick={() => setType('deposit')} style={{ flex: 1, padding: '8px', borderRadius: '4px', border: type === 'deposit' ? '1px solid var(--ws-accent)' : '1px solid var(--ws-border)', background: type === 'deposit' ? 'var(--ws-accent-10)' : 'var(--ws-bg-1)', color: type === 'deposit' ? 'var(--ws-accent)' : 'var(--ws-text-2)', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
              Deposit
            </button>
            <button type="button" onClick={() => setType('withdraw')} style={{ flex: 1, padding: '8px', borderRadius: '4px', border: type === 'withdraw' ? '1px solid var(--ws-accent)' : '1px solid var(--ws-border)', background: type === 'withdraw' ? 'var(--ws-accent-10)' : 'var(--ws-bg-1)', color: type === 'withdraw' ? 'var(--ws-accent)' : 'var(--ws-text-2)', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
              Withdraw
            </button>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--ws-text-2)', marginBottom: '6px' }}>Portfolio</label>
            <select value={selectedPortfolio} onChange={e => setSelectedPortfolio(e.target.value)} className="ws-input" style={{ width: '100%' }} required>
              {portfolios.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
            <div style={{ flex: 2 }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--ws-text-2)', marginBottom: '6px' }}>Amount</label>
              <input type="number" step="any" min="0" value={amount} onChange={e => setAmount(e.target.value)} className="ws-input" style={{ width: '100%' }} placeholder="0.00" required autoFocus />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--ws-text-2)', marginBottom: '6px' }}>Currency</label>
              <select value={currency} onChange={e => setCurrency(e.target.value)} className="ws-input" style={{ width: '100%' }}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--ws-text-2)', marginBottom: '6px' }}>Notes (Optional)</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)} className="ws-input" style={{ width: '100%' }} placeholder="e.g. Monthly deposit" />
          </div>

          {error && <div style={{ color: 'var(--ws-red)', fontSize: '12px', marginBottom: '16px', padding: '8px', border: '1px solid var(--ws-red)', borderRadius: '4px' }}>{error}</div>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button type="button" onClick={onClose} className="ws-btn-secondary" style={{ padding: '8px 16px' }}>Cancel</button>
            <button type="submit" className="ws-btn" style={{ padding: '8px 16px' }} disabled={saving}>
              {saving ? 'Saving...' : 'Save Transaction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
