'use client';
import { useState } from 'react';
import { formatCurrency } from '../../../../lib/formatters';
import { isaEntryValue } from '../../../../lib/isaInterest';

const CURRENCIES = ['USD', 'EUR', 'GBP'];

export default function CashModal({ portfolioId, portfolios, transactions = [], onClose, onAdded, initialBucket = 'main' }) {
  const [bucket, setBucket] = useState(initialBucket);
  const bucketTransactions = transactions.filter(t => (t.bucket || 'main') === bucket);
  const [mode, setMode] = useState(bucketTransactions.length === 0 ? 'add' : 'list');
  const [type, setType] = useState('deposit');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [notes, setNotes] = useState('');
  const [selectedPortfolio, setSelectedPortfolio] = useState(portfolioId === 'all' ? (portfolios[0]?.id || '') : (portfolioId || ''));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [savingRate, setSavingRate] = useState(false);
  const [transferAmount, setTransferAmount] = useState('');
  const [transferCurrency, setTransferCurrency] = useState('USD');

  const switchBucket = (b) => {
    setBucket(b);
    const bt = transactions.filter(t => (t.bucket || 'main') === b);
    setMode(bt.length === 0 ? 'add' : 'list');
  };

  const activePortfolio = portfolios.find(p => p.id === selectedPortfolio) || portfolios.find(p => p.id === portfolioId);
  const isaRate = activePortfolio?.isa_interest_rate ?? '';

  const saveIsaRate = async (value) => {
    if (!activePortfolio) return;
    setSavingRate(true);
    try {
      const res = await fetch('/api/portfolios', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: activePortfolio.id, isa_interest_rate: value === '' ? null : Number(value) }),
      });
      if (res.ok) onAdded();
    } finally {
      setSavingRate(false);
    }
  };

  const isaPrincipal = bucketTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
  const isaValueToday = bucket === 'isa'
    ? bucketTransactions.reduce((sum, t) => sum + isaEntryValue(t, activePortfolio?.isa_interest_rate), 0)
    : isaPrincipal;
  const isaGrowth = isaValueToday - isaPrincipal;

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
          type: type.toUpperCase(),
          notes,
          bucket
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to save transaction');
      }

      setAmount('');
      setNotes('');
      setSaving(false);
      onAdded();
      setMode('list');
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  const handleTransfer = async (e) => {
    e.preventDefault();
    setError(null);
    if (!transferAmount || Number(transferAmount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    if (!selectedPortfolio) {
      setError('Please select a portfolio');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/portfolio/cash/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portfolio_id: selectedPortfolio,
          amount: Number(transferAmount),
          currency: transferCurrency,
          direction: bucket === 'main' ? 'to_isa' : 'to_main',
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to move cash');
      }

      setTransferAmount('');
      setSaving(false);
      onAdded();
      setMode('list');
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <div onClick={onClose} className="fixed inset-0 bg-black/35 flex items-center justify-center z-[200]">
      <div onClick={e => e.stopPropagation()} style={{ width: '500px', maxWidth: '92vw', background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', borderRadius: '12px', boxShadow: '0 12px 40px rgba(0,0,0,0.18)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--ws-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ws-text)' }}>Cash Ledger</div>
            {mode === 'list' && (
              <>
                <button onClick={() => setMode('add')} className="ws-btn" style={{ padding: '4px 10px', fontSize: '11px', height: 'auto' }}>+ Add Transaction</button>
                <button onClick={() => setMode('transfer')} className="ws-btn-secondary" style={{ padding: '4px 10px', fontSize: '11px', height: 'auto' }}>
                  {bucket === 'main' ? '⇄ Move to ISA' : '⇄ Move to Cash'}
                </button>
              </>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--ws-text-3)', cursor: 'pointer', fontSize: '16px' }}>✕</button>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid var(--ws-border)' }}>
          <button type="button" onClick={() => switchBucket('main')}
            style={{ flex: 1, padding: '10px', border: 'none', borderBottom: bucket === 'main' ? '2px solid var(--ws-accent)' : '2px solid transparent', background: 'none', color: bucket === 'main' ? 'var(--ws-text)' : 'var(--ws-text-3)', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}>
            💵 Cash
          </button>
          <button type="button" onClick={() => switchBucket('isa')}
            style={{ flex: 1, padding: '10px', border: 'none', borderBottom: bucket === 'isa' ? '2px solid var(--ws-accent)' : '2px solid transparent', background: 'none', color: bucket === 'isa' ? 'var(--ws-text)' : 'var(--ws-text-3)', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}>
            🏦 ISA{activePortfolio?.isa_interest_rate ? ` · ${activePortfolio.isa_interest_rate}%` : ''}
          </button>
        </div>

        {bucket === 'isa' && (
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--ws-border)', background: 'var(--ws-bg-2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: isaPrincipal !== 0 ? '10px' : 0 }}>
              <label style={{ fontSize: '12px', color: 'var(--ws-text-2)' }}>Interest rate (annual, compounds daily)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input type="number" step="0.01" min="0" defaultValue={isaRate} key={`${activePortfolio?.id}-${isaRate}`}
                  onBlur={e => saveIsaRate(e.target.value)}
                  className="ws-input" style={{ width: '70px', padding: '4px 6px' }} placeholder="3.6" />
                <span style={{ fontSize: '12px', color: 'var(--ws-text-3)' }}>%{savingRate ? ' saving…' : ''}</span>
              </div>
            </div>
            {isaPrincipal !== 0 && (
              <div style={{ display: 'flex', gap: '20px', fontSize: '12px' }}>
                <div><span style={{ color: 'var(--ws-text-3)' }}>Deposited: </span><span style={{ fontWeight: 600, color: 'var(--ws-text)' }}>{formatCurrency(isaPrincipal, '$')}</span></div>
                <div><span style={{ color: 'var(--ws-text-3)' }}>Value today: </span><span style={{ fontWeight: 600, color: 'var(--ws-text)' }}>{formatCurrency(isaValueToday, '$')}</span></div>
                <div><span style={{ color: 'var(--ws-text-3)' }}>Growth: </span><span style={{ fontWeight: 600, color: 'var(--ws-accent)' }}>+{formatCurrency(isaGrowth, '$')}</span></div>
              </div>
            )}
          </div>
        )}

        {mode === 'transfer' ? (
          <form onSubmit={handleTransfer} style={{ padding: '20px' }}>
            <div style={{ fontSize: '13px', color: 'var(--ws-text-2)', marginBottom: '16px' }}>
              Move cash from <strong style={{ color: 'var(--ws-text)' }}>{bucket === 'main' ? 'Cash' : 'ISA'}</strong> to <strong style={{ color: 'var(--ws-text)' }}>{bucket === 'main' ? 'ISA' : 'Cash'}</strong>.
              {bucket === 'main' && ' It starts earning interest from today.'}
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--ws-text-2)', marginBottom: '6px' }}>Portfolio</label>
              <select value={selectedPortfolio} onChange={e => setSelectedPortfolio(e.target.value)} className="ws-input" style={{ width: '100%' }} required>
                {portfolios.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
              <div style={{ flex: 2 }}>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--ws-text-2)', marginBottom: '6px' }}>Amount</label>
                <input type="number" step="any" min="0" value={transferAmount} onChange={e => setTransferAmount(e.target.value)} className="ws-input" style={{ width: '100%' }} placeholder="0.00" required autoFocus />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--ws-text-2)', marginBottom: '6px' }}>Currency</label>
                <select value={transferCurrency} onChange={e => setTransferCurrency(e.target.value)} className="ws-input" style={{ width: '100%' }}>
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {error && <div style={{ color: 'var(--ws-red)', fontSize: '12px', marginBottom: '16px', padding: '8px', border: '1px solid var(--ws-red)', borderRadius: '4px' }}>{error}</div>}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" onClick={() => setMode('list')} className="ws-btn-secondary" style={{ padding: '8px 16px' }}>Cancel</button>
              <button type="submit" className="ws-btn" style={{ padding: '8px 16px' }} disabled={saving}>
                {saving ? 'Moving...' : `Move to ${bucket === 'main' ? 'ISA' : 'Cash'}`}
              </button>
            </div>
          </form>
        ) : mode === 'list' ? (
          <div style={{ padding: '0', maxHeight: '400px', overflowY: 'auto' }}>
            {bucketTransactions.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ws-text-3)', fontSize: '13px' }}>
                No {bucket === 'isa' ? 'ISA' : 'cash'} transactions yet.<br/><br/>
                <button onClick={() => setMode('add')} className="ws-btn" style={{ padding: '6px 16px' }}>+ Add Transaction</button>
              </div>
            ) : (
              <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--ws-border)', background: 'var(--ws-bg-2)' }}>
                    <th style={{ padding: '8px 20px', textAlign: 'left', fontWeight: 600, color: 'var(--ws-text-3)' }}>Date</th>
                    <th style={{ padding: '8px 20px', textAlign: 'left', fontWeight: 600, color: 'var(--ws-text-3)' }}>Type</th>
                    <th style={{ padding: '8px 20px', textAlign: 'right', fontWeight: 600, color: 'var(--ws-text-3)' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {bucketTransactions.map(t => (
                    <tr key={t.id} style={{ borderBottom: '1px solid var(--ws-border)' }}>
                      <td style={{ padding: '10px 20px', color: 'var(--ws-text-2)' }}>{new Date(t.date).toISOString().slice(0, 10)}</td>
                      <td style={{ padding: '10px 20px' }}>
                        <span style={{ fontWeight: 600, color: t.amount >= 0 ? 'var(--ws-accent)' : 'var(--ws-red)' }}>{t.type}</span>
                        {t.notes && <div style={{ fontSize: '11px', color: 'var(--ws-text-3)', marginTop: '2px' }}>{t.notes}</div>}
                      </td>
                      <td style={{ padding: '10px 20px', textAlign: 'right', fontWeight: 600, color: t.amount >= 0 ? 'var(--ws-accent)' : 'var(--ws-red)' }}>
                        {t.amount >= 0 ? '+' : ''}{formatCurrency(t.amount, t.currency === 'EUR' ? '€' : t.currency === 'GBP' ? '£' : '$')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
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
              <button type="button" onClick={bucketTransactions.length > 0 ? () => setMode('list') : onClose} className="ws-btn-secondary" style={{ padding: '8px 16px' }}>Cancel</button>
              <button type="submit" className="ws-btn" style={{ padding: '8px 16px' }} disabled={saving}>
                {saving ? 'Saving...' : 'Save Transaction'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
