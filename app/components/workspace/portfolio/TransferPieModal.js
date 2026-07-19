'use client';
import { useState } from 'react';

export default function TransferPieModal({ pie, sourcePortfolioId, portfolios, onClose, onTransferred }) {
  const [targetPortfolioId, setTargetPortfolioId] = useState(
    portfolios.find(p => p.id !== sourcePortfolioId)?.id || 'new'
  );
  const [newPortfolioName, setNewPortfolioName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const availablePortfolios = portfolios.filter(p => p.id !== sourcePortfolioId);
  const canCreateNew = portfolios.length < 3;

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    let finalTargetId = targetPortfolioId;

    // Create new portfolio first if "new" is selected
    if (targetPortfolioId === 'new') {
      if (!newPortfolioName.trim()) {
        setError('Portfolio name required.');
        setSaving(false);
        return;
      }
      const res = await fetch('/api/portfolios', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newPortfolioName })
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || 'Failed to create portfolio');
        setSaving(false);
        return;
      }
      const d = await res.json();
      finalTargetId = d.portfolio.id;
    }

    const res = await fetch('/api/portfolio/transfer', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pie, sourcePortfolioId, targetPortfolioId: finalTargetId }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || 'Failed to transfer pie.');
      return;
    }
    onTransferred();
  };

  return (
    <div onClick={onClose} className="fixed inset-0 bg-black/35 flex items-center justify-center z-[200]">
      <div onClick={e => e.stopPropagation()} style={{ width: '360px', maxWidth: '92vw', background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', borderRadius: '12px', padding: '22px', boxShadow: '0 12px 40px rgba(0,0,0,0.18)' }}>
        <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--ws-text)', marginBottom: '4px' }}>Transfer {pie}</div>
        <div style={{ fontSize: '12px', color: 'var(--ws-text-3)', marginBottom: '16px' }}>Move all holdings in "{pie}" to another portfolio.</div>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div>
            <div className="ws-label" style={{ marginBottom: '4px' }}>DESTINATION PORTFOLIO</div>
            <select value={targetPortfolioId} onChange={e => setTargetPortfolioId(e.target.value)} className="ws-input">
              {availablePortfolios.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
              {canCreateNew && <option value="new">+ Create New Portfolio</option>}
            </select>
          </div>
          
          {targetPortfolioId === 'new' && (
            <div>
              <div className="ws-label" style={{ marginBottom: '4px' }}>NEW PORTFOLIO NAME</div>
              <input type="text" value={newPortfolioName} onChange={e => setNewPortfolioName(e.target.value)} className="ws-input" autoFocus required placeholder="e.g. SIPP" />
            </div>
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
            <button type="submit" disabled={saving || (!canCreateNew && availablePortfolios.length === 0)}
              className="ws-btn"
              style={{ flex: 2, height: '38px' }}>
              {saving ? 'Transferring…' : 'Transfer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
