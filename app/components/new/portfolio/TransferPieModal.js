'use client';
import { useState } from 'react';
import { NEW_COLORS as C } from '../theme';

const inputStyle = { width: '100%', height: '42px', borderRadius: '12px', border: `1px solid ${C.border}`, padding: '0 14px', fontSize: '14px', fontFamily: 'inherit', background: '#FDFBF6', color: C.ink, boxSizing: 'border-box' };
const labelStyle = { fontSize: '11px', fontWeight: 700, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.5px' };

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
        setError('El nombre del portfolio es obligatorio.');
        setSaving(false);
        return;
      }
      const res = await fetch('/api/portfolios', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newPortfolioName })
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || 'No se pudo crear el portfolio.');
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
      setError(d.error || 'No se pudo transferir la cesta.');
      return;
    }
    onTransferred();
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(28,27,24,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '20px', boxSizing: 'border-box' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '380px', maxWidth: '100%', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '24px', boxShadow: '0 20px 60px rgba(28,27,24,0.18)', boxSizing: 'border-box' }}>
        <div style={{ fontSize: '16px', fontWeight: 800, color: C.ink, marginBottom: '4px' }}>Transferir {pie}</div>
        <div style={{ fontSize: '12px', color: C.text2, marginBottom: '18px' }}>Mueve todas las posiciones de &quot;{pie}&quot; a otro portfolio.</div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <div style={{ ...labelStyle, marginBottom: '6px' }}>PORTFOLIO DE DESTINO</div>
            <select value={targetPortfolioId} onChange={e => setTargetPortfolioId(e.target.value)} style={inputStyle}>
              {availablePortfolios.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
              {canCreateNew && <option value="new">+ Crear nuevo portfolio</option>}
            </select>
          </div>

          {targetPortfolioId === 'new' && (
            <div>
              <div style={{ ...labelStyle, marginBottom: '6px' }}>NOMBRE DEL NUEVO PORTFOLIO</div>
              <input type="text" value={newPortfolioName} onChange={e => setNewPortfolioName(e.target.value)} style={inputStyle} autoFocus required placeholder="p. ej. SIPP" />
            </div>
          )}

          {error && (
            <div style={{ padding: '10px 14px', borderRadius: '10px', background: '#F8DFDA', color: C.red, fontSize: '12px' }}>{error}</div>
          )}
          <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
            <button type="button" onClick={onClose}
              style={{ flex: 1, height: '42px', borderRadius: '12px', border: `1px solid ${C.border}`, background: 'transparent', color: C.text2, fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>
              Cancelar
            </button>
            <button type="submit" disabled={saving || (!canCreateNew && availablePortfolios.length === 0)}
              style={{ flex: 2, height: '42px', borderRadius: '12px', border: 'none', background: C.lime, color: C.ink, fontWeight: 700, fontSize: '13px', cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Transfiriendo…' : 'Transferir'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
