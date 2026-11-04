'use client';
import { useState } from 'react';
import { formatCurrency } from '../../../../lib/formatters';
import { isaEntryValue } from '../../../../lib/isaInterest';
import { NEW_COLORS as C } from '../theme';

const CURRENCIES = ['USD', 'EUR', 'GBP'];
const inputStyle = { width: '100%', height: '42px', borderRadius: '12px', border: `1px solid ${C.border}`, padding: '0 14px', fontSize: '14px', fontFamily: 'inherit', background: '#FDFBF6', color: C.ink, boxSizing: 'border-box' };
const labelStyle = { display: 'block', fontSize: '12px', color: C.text2, marginBottom: '6px' };
const btnPrimary = { border: 'none', borderRadius: '12px', background: C.lime, color: C.ink, fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit', padding: '10px 18px' };
const btnSecondary = { border: `1px solid ${C.border}`, borderRadius: '12px', background: 'transparent', color: C.text2, fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit', padding: '10px 18px' };

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
      setError('Indica un importe válido');
      return;
    }
    if (!selectedPortfolio) {
      setError('Selecciona un portfolio');
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
        throw new Error(d.error || 'No se pudo guardar el movimiento');
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
      setError('Indica un importe válido');
      return;
    }
    if (!selectedPortfolio) {
      setError('Selecciona un portfolio');
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
        throw new Error(d.error || 'No se pudo mover el saldo');
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
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(28,27,24,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '20px', boxSizing: 'border-box' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '520px', maxWidth: '100%', maxHeight: '88vh', overflowY: 'auto', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', boxShadow: '0 20px 60px rgba(28,27,24,0.18)', boxSizing: 'border-box' }}>
        <div style={{ padding: '18px 22px', borderBottom: `1px solid ${C.borderSoft}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '15px', fontWeight: 800, color: C.ink }}>Caja</div>
            {mode === 'list' && (
              <>
                <button type="button" onClick={() => setMode('add')} style={{ ...btnPrimary, padding: '6px 12px', fontSize: '11px' }}>+ Añadir movimiento</button>
                <button type="button" onClick={() => setMode('transfer')} style={{ ...btnSecondary, padding: '6px 12px', fontSize: '11px' }}>
                  {bucket === 'main' ? '⇄ Mover a ISA' : '⇄ Mover a Caja'}
                </button>
              </>
            )}
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: C.text3, cursor: 'pointer', fontSize: '18px' }}>✕</button>
        </div>

        <div style={{ display: 'flex', borderBottom: `1px solid ${C.borderSoft}` }}>
          <button type="button" onClick={() => switchBucket('main')}
            style={{ flex: 1, padding: '12px', border: 'none', borderBottom: bucket === 'main' ? `2px solid ${C.green}` : '2px solid transparent', background: 'none', color: bucket === 'main' ? C.ink : C.text3, cursor: 'pointer', fontWeight: 700, fontSize: '13px', fontFamily: 'inherit' }}>
            💵 Caja
          </button>
          <button type="button" onClick={() => switchBucket('isa')}
            style={{ flex: 1, padding: '12px', border: 'none', borderBottom: bucket === 'isa' ? `2px solid ${C.green}` : '2px solid transparent', background: 'none', color: bucket === 'isa' ? C.ink : C.text3, cursor: 'pointer', fontWeight: 700, fontSize: '13px', fontFamily: 'inherit' }}>
            🏦 ISA{activePortfolio?.isa_interest_rate ? ` · ${activePortfolio.isa_interest_rate}%` : ''}
          </button>
        </div>

        {bucket === 'isa' && (
          <div style={{ padding: '16px 22px', borderBottom: `1px solid ${C.borderSoft}`, background: C.bg }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: isaPrincipal !== 0 ? '10px' : 0, flexWrap: 'wrap' }}>
              <label style={{ fontSize: '12px', color: C.text2 }}>Tipo de interés (anual, compone a diario)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input type="number" step="0.01" min="0" defaultValue={isaRate} key={`${activePortfolio?.id}-${isaRate}`}
                  onBlur={e => saveIsaRate(e.target.value)}
                  style={{ ...inputStyle, width: '76px', height: '32px', padding: '0 8px' }} placeholder="3.6" />
                <span style={{ fontSize: '12px', color: C.text3 }}>%{savingRate ? ' guardando…' : ''}</span>
              </div>
            </div>
            {isaPrincipal !== 0 && (
              <div style={{ display: 'flex', gap: '20px', fontSize: '12px', flexWrap: 'wrap' }}>
                <div><span style={{ color: C.text3 }}>Depositado: </span><span style={{ fontWeight: 700, color: C.ink }}>{formatCurrency(isaPrincipal, '$')}</span></div>
                <div><span style={{ color: C.text3 }}>Valor hoy: </span><span style={{ fontWeight: 700, color: C.ink }}>{formatCurrency(isaValueToday, '$')}</span></div>
                <div><span style={{ color: C.text3 }}>Crecimiento: </span><span style={{ fontWeight: 700, color: C.green }}>+{formatCurrency(isaGrowth, '$')}</span></div>
              </div>
            )}
          </div>
        )}

        {mode === 'transfer' ? (
          <form onSubmit={handleTransfer} style={{ padding: '22px' }}>
            <div style={{ fontSize: '13px', color: C.text2, marginBottom: '18px' }}>
              Mueve saldo de <strong style={{ color: C.ink }}>{bucket === 'main' ? 'Caja' : 'ISA'}</strong> a <strong style={{ color: C.ink }}>{bucket === 'main' ? 'ISA' : 'Caja'}</strong>.
              {bucket === 'main' && ' Empieza a generar interés desde hoy.'}
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Portfolio</label>
              <select value={selectedPortfolio} onChange={e => setSelectedPortfolio(e.target.value)} style={inputStyle} required>
                {portfolios.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
              <div style={{ flex: 2 }}>
                <label style={labelStyle}>Importe</label>
                <input type="number" step="any" min="0" value={transferAmount} onChange={e => setTransferAmount(e.target.value)} style={inputStyle} placeholder="0.00" required autoFocus />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Moneda</label>
                <select value={transferCurrency} onChange={e => setTransferCurrency(e.target.value)} style={inputStyle}>
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {error && <div style={{ color: C.red, fontSize: '12px', marginBottom: '16px', padding: '10px 14px', borderRadius: '10px', background: '#F8DFDA' }}>{error}</div>}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" onClick={() => setMode('list')} style={btnSecondary}>Cancelar</button>
              <button type="submit" style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }} disabled={saving}>
                {saving ? 'Moviendo…' : `Mover a ${bucket === 'main' ? 'ISA' : 'Caja'}`}
              </button>
            </div>
          </form>
        ) : mode === 'list' ? (
          <div style={{ padding: '0', maxHeight: '400px', overflowY: 'auto' }}>
            {bucketTransactions.length === 0 ? (
              <div style={{ padding: '44px 20px', textAlign: 'center', color: C.text3, fontSize: '13px' }}>
                Aún no hay movimientos de {bucket === 'isa' ? 'ISA' : 'caja'}.<br/><br/>
                <button type="button" onClick={() => setMode('add')} style={{ ...btnPrimary, padding: '8px 18px' }}>+ Añadir movimiento</button>
              </div>
            ) : (
              <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.borderSoft}`, background: C.bg }}>
                    <th style={{ padding: '9px 22px', textAlign: 'left', fontWeight: 700, color: C.text3 }}>Fecha</th>
                    <th style={{ padding: '9px 22px', textAlign: 'left', fontWeight: 700, color: C.text3 }}>Tipo</th>
                    <th style={{ padding: '9px 22px', textAlign: 'right', fontWeight: 700, color: C.text3 }}>Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {bucketTransactions.map(t => (
                    <tr key={t.id} style={{ borderBottom: `1px solid ${C.borderSoft}` }}>
                      <td style={{ padding: '10px 22px', color: C.text2 }}>{new Date(t.date).toISOString().slice(0, 10)}</td>
                      <td style={{ padding: '10px 22px' }}>
                        <span style={{ fontWeight: 700, color: t.amount >= 0 ? C.green : C.red }}>{t.type}</span>
                        {t.notes && <div style={{ fontSize: '11px', color: C.text3, marginTop: '2px' }}>{t.notes}</div>}
                      </td>
                      <td style={{ padding: '10px 22px', textAlign: 'right', fontWeight: 700, color: t.amount >= 0 ? C.green : C.red }}>
                        {t.amount >= 0 ? '+' : ''}{formatCurrency(t.amount, t.currency === 'EUR' ? '€' : t.currency === 'GBP' ? '£' : '$')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ padding: '22px' }}>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <button type="button" onClick={() => setType('deposit')} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: type === 'deposit' ? `1px solid ${C.green}` : `1px solid ${C.border}`, background: type === 'deposit' ? '#E4F3DE' : C.surface, color: type === 'deposit' ? C.green : C.text2, cursor: 'pointer', fontWeight: 700, fontSize: '13px', fontFamily: 'inherit' }}>
                Ingreso
              </button>
              <button type="button" onClick={() => setType('withdraw')} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: type === 'withdraw' ? `1px solid ${C.green}` : `1px solid ${C.border}`, background: type === 'withdraw' ? '#E4F3DE' : C.surface, color: type === 'withdraw' ? C.green : C.text2, cursor: 'pointer', fontWeight: 700, fontSize: '13px', fontFamily: 'inherit' }}>
                Retirada
              </button>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Portfolio</label>
              <select value={selectedPortfolio} onChange={e => setSelectedPortfolio(e.target.value)} style={inputStyle} required>
                {portfolios.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <div style={{ flex: 2 }}>
                <label style={labelStyle}>Importe</label>
                <input type="number" step="any" min="0" value={amount} onChange={e => setAmount(e.target.value)} style={inputStyle} placeholder="0.00" required autoFocus />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Moneda</label>
                <select value={currency} onChange={e => setCurrency(e.target.value)} style={inputStyle}>
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Notas (opcional)</label>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)} style={inputStyle} placeholder="p. ej. Aportación mensual" />
            </div>

            {error && <div style={{ color: C.red, fontSize: '12px', marginBottom: '16px', padding: '10px 14px', borderRadius: '10px', background: '#F8DFDA' }}>{error}</div>}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" onClick={bucketTransactions.length > 0 ? () => setMode('list') : onClose} style={btnSecondary}>Cancelar</button>
              <button type="submit" style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }} disabled={saving}>
                {saving ? 'Guardando…' : 'Guardar movimiento'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
