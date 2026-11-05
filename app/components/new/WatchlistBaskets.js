'use client';
import { useState } from 'react';
import { BASKET_NAME_LIMIT } from '../../../lib/watchlistBaskets';
import { NEW_COLORS as C } from './theme';

const buttonStyle = { border: `1px solid ${C.border}`, borderRadius: '12px', padding: '9px 14px', background: C.surface, color: C.ink, font: 'inherit', fontSize: '12px', fontWeight: 700, cursor: 'pointer', maxWidth: '100%', boxSizing: 'border-box', overflowWrap: 'anywhere' };

export default function WatchlistBaskets({ names, tickers, active, onSelect, onSave, onDelete, busy, canManage }) {
  const [editor, setEditor] = useState(null);
  const [draft, setDraft] = useState('');

  const select = (name) => { onSelect(name); setEditor(null); };
  const startEditor = (mode) => {
    setDraft(mode === 'rename' ? active : '');
    setEditor(mode);
  };
  const submit = async (event) => {
    event.preventDefault();
    if (await onSave(editor === 'rename' ? active : null, draft)) setEditor(null);
  };
  const filterButton = (name, label, count) => (
    <button key={JSON.stringify(name)} type="button" disabled={busy} aria-pressed={active === name}
      onClick={() => select(name)} style={{ ...buttonStyle, background: active === name ? C.lime : C.surface }}>
      {label} ({count})
    </button>
  );

  return (
    <section aria-label="Cestas de seguimiento" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {filterButton(null, 'Todos', tickers.length)}
        {filterButton('', 'Sin cesta', tickers.filter(t => !t.pie).length)}
        {names.map(name => filterButton(name, name, tickers.filter(t => t.pie === name).length))}
        <button type="button" disabled={busy || !canManage} onClick={() => startEditor('create')} style={buttonStyle}>+ Nueva cesta</button>
      </div>
      {active && !editor && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" disabled={busy || !canManage} onClick={() => startEditor('rename')} style={buttonStyle}>Renombrar cesta</button>
          <button type="button" disabled={busy || !canManage} style={buttonStyle}
            onClick={() => { if (window.confirm(`¿Eliminar la cesta «${active}»? Sus empresas seguirán en seguimiento, sin cesta.`)) onDelete(active); }}>
            Eliminar cesta
          </button>
        </div>
      )}
      {editor && (
        <form onSubmit={submit} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <label htmlFor="basket-name" style={{ fontSize: '12px', fontWeight: 700 }}>{editor === 'rename' ? 'Nuevo nombre' : 'Nombre de la cesta'}</label>
          <input id="basket-name" value={draft} onChange={e => setDraft(e.target.value)} maxLength={BASKET_NAME_LIMIT} required disabled={busy}
            style={{ ...buttonStyle, cursor: 'text', flex: '1 1 180px', minWidth: 0, boxSizing: 'border-box' }} />
          <button type="submit" disabled={busy || !draft.trim()} style={{ ...buttonStyle, background: C.lime }}>{editor === 'rename' ? 'Guardar nombre' : 'Crear cesta'}</button>
          <button type="button" disabled={busy} onClick={() => setEditor(null)} style={buttonStyle}>Cancelar</button>
        </form>
      )}
    </section>
  );
}
