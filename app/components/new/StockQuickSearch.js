"use client";

import { useId, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTickerSearch } from '../../../lib/hooks/useTickerSearch';
import { NEW_COLORS as C } from './theme';

export default function StockQuickSearch() {
  const router = useRouter();
  const resultsId = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const { suggestions, loading } = useTickerSearch(query, { enabled: open, limit: 5 });
  const close = () => { setOpen(false); setQuery(''); };
  const submit = event => {
    event.preventDefault();
    if (!query.trim()) return;
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    close();
  };

  return (
    <form role="search" aria-label="Buscar otra empresa" onSubmit={submit}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}
      style={{ position: 'relative', width: '100%', maxWidth: 360, alignSelf: 'flex-end', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', gap: 6, padding: 5, border: `1px solid ${C.border}`, borderRadius: 12, background: C.surface }}>
        <input type="search" aria-label="Buscar otra empresa" placeholder="Buscar otra empresa…"
          value={query} onChange={event => { setQuery(event.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)} onKeyDown={event => { if (event.key === 'Escape') close(); }}
          aria-controls={open && query.trim() ? resultsId : undefined}
          style={{ minWidth: 0, width: '100%', padding: '7px 9px', font: 'inherit', fontSize: 13, color: C.ink, background: 'transparent', border: 0, borderRadius: 8 }} />
        <button type="submit" style={{ padding: '7px 11px', border: 0, borderRadius: 8, background: C.lime, color: C.ink, font: 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Buscar</button>
      </div>
      {open && query.trim() && <div id={resultsId} style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 30, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, boxShadow: '0 8px 24px #1c1b1814', overflow: 'hidden' }}>
        {loading ? <p role="status" style={{ margin: 12, fontSize: 12, color: C.text2 }}>Buscando…</p>
          : suggestions.length ? <ul aria-label="Coincidencias de empresas" style={{ listStyle: 'none', padding: 0, margin: 0 }}>{suggestions.map(result => <li key={result.ticker}>
            <Link href={result.isEtf ? `/etfs/${result.ticker}` : `/stock/${result.ticker}`} onClick={close}
              style={{ display: 'block', padding: '11px 13px', borderBottom: `1px solid ${C.borderSoft}`, color: C.ink, textDecoration: 'none', fontSize: 12 }}>
              <strong>{result.ticker}</strong>{result.isEtf ? ' · ETF' : ''}<span style={{ display: 'block', color: C.text2, marginTop: 3 }}>{result.name}</span>
            </Link>
          </li>)}</ul> : <p role="status" style={{ margin: 12, fontSize: 12, color: C.text2 }}>No hay coincidencias disponibles.</p>}
        <Link href={`/search?q=${encodeURIComponent(query.trim())}`} onClick={close} style={{ display: 'block', padding: '10px 13px', fontSize: 12, fontWeight: 700, color: C.ink }}>Ver búsqueda completa →</Link>
      </div>}
    </form>
  );
}
