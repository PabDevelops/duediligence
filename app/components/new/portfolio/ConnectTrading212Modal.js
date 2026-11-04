'use client';
import { useState } from 'react';
import { NEW_COLORS as C } from '../theme';

const inputStyle = { width: '100%', height: '42px', borderRadius: '12px', border: `1px solid ${C.border}`, padding: '0 14px', fontSize: '14px', fontFamily: 'inherit', background: '#FDFBF6', color: C.ink, boxSizing: 'border-box' };
const labelStyle = { fontSize: '11px', fontWeight: 700, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.5px' };

const STEPS = [
  <>Abre la app de <strong>Trading 212</strong> en tu móvil.</>,
  <>Ve a tu perfil (arriba a la izquierda) → <strong>Ajustes</strong> → <strong>API (Beta)</strong>.</>,
  <>Pulsa <strong>Generar clave de API</strong>.</>,
  <>Activa al menos los permisos de solo lectura de <strong>cartera</strong> y <strong>cuenta</strong> — no actives nada de órdenes, Bulltrace no necesita (ni puede) operar.</>,
  <>Trading 212 te muestra una <strong>Clave</strong> y un <strong>Secreto</strong> (API Key y API Secret) <strong>una sola vez</strong>: copia los dos ahora, no podrás verlos de nuevo después.</>,
  <>Vuelve aquí y pega cada uno en su campo.</>,
];

export default function ConnectTrading212Modal({ portfolio, onClose, onConnected }) {
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const ready = apiKey.trim() && apiSecret.trim();

  const submit = async (e) => {
    e.preventDefault();
    if (!ready) return;
    setSaving(true);
    setError(null);
    const res = await fetch('/api/portfolio/trading212/connect', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ portfolio_id: portfolio.id, apiKey: apiKey.trim(), apiSecret: apiSecret.trim() }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || 'No se pudo conectar con Trading 212.');
      return;
    }
    onConnected();
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(28,27,24,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '20px', boxSizing: 'border-box' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '420px', maxWidth: '100%', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '24px', boxShadow: '0 20px 60px rgba(28,27,24,0.18)', boxSizing: 'border-box' }}>
        <div style={{ fontSize: '16px', fontWeight: 800, color: C.ink, marginBottom: '4px' }}>
          Conectar {portfolio.name} a Trading 212
        </div>
        <div style={{ fontSize: '12px', color: C.text2, marginBottom: '18px' }}>
          Tus posiciones y tu caja se sincronizarán solas desde tu cuenta real.
          Esta cuenta dejará de aceptar altas manuales.
        </div>

        <ol style={{ fontSize: '12px', color: C.text2, background: C.bg, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '14px 14px 14px 30px', marginBottom: '18px', display: 'flex', flexDirection: 'column', gap: '8px', listStyleType: 'decimal' }}>
          {STEPS.map((step, i) => <li key={i} style={{ lineHeight: 1.4 }}>{step}</li>)}
        </ol>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <div style={{ ...labelStyle, marginBottom: '6px' }}>CLAVE DE API (API KEY)</div>
            <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} style={inputStyle} placeholder="Pega aquí tu clave" autoFocus required autoComplete="off" />
          </div>

          <div>
            <div style={{ ...labelStyle, marginBottom: '6px' }}>SECRETO DE API (API SECRET)</div>
            <input type="password" value={apiSecret} onChange={e => setApiSecret(e.target.value)} style={inputStyle} placeholder="Pega aquí tu secreto" required autoComplete="off" />
          </div>

          {error && (
            <div style={{ padding: '10px 14px', borderRadius: '10px', background: '#F8DFDA', color: C.red, fontSize: '12px' }}>{error}</div>
          )}

          <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
            <button type="button" onClick={onClose}
              style={{ flex: 1, height: '42px', borderRadius: '12px', border: `1px solid ${C.border}`, background: 'transparent', color: C.text2, fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>
              Cancelar
            </button>
            <button type="submit" disabled={!ready || saving}
              style={{ flex: 2, height: '42px', borderRadius: '12px', border: 'none', background: C.lime, color: C.ink, fontWeight: 700, fontSize: '13px', cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit', opacity: (!ready || saving) ? 0.6 : 1 }}>
              {saving ? 'Conectando…' : 'Conectar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
