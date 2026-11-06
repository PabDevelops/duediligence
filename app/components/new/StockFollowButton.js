"use client";
import { useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { useUser } from '../AuthProvider';
import { isInGuestWatchlist, addToGuestWatchlist, removeFromGuestWatchlist } from '../../../lib/guestWatchlist';
import { getBasketNames } from '../../../lib/watchlistBaskets';
import { saveStockFollow, removeStockFollow } from '../../../lib/stockFollowActions';
import { NEW_COLORS as C } from './theme';

export default function StockFollowButton({ ticker }) {
  const { user, isSignedIn, isLoaded } = useUser();
  return <StockFollowControl key={`${ticker}-${user?.id || 'guest'}`} ticker={ticker} isSignedIn={isSignedIn} isLoaded={isLoaded} />;
}

export function StockFollowControl({ ticker, isSignedIn, isLoaded }) {
  const selectId = useId();
  const [record, setRecord] = useState(null);
  const [reload, setReload] = useState(0);
  const [open, setOpen] = useState(false);
  const [names, setNames] = useState([]);
  const [selected, setSelected] = useState('');
  const [basketState, setBasketState] = useState('idle');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const following = record?.following === true;
  const ready = isLoaded && record?.ticker === ticker && record?.signedIn === isSignedIn && !record?.error;

  useEffect(() => {
    if (!isLoaded) return;
    let active = true;
    const load = isSignedIn ? fetch('/api/watchlist').then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo cargar el seguimiento.');
      return data.tickers || [];
    }) : Promise.resolve([]);
    load.then(rows => {
      if (!active) return;
      const current = rows.find(row => row.ticker === ticker);
      setRecord({ ticker, signedIn: isSignedIn, following: isSignedIn ? !!current : isInGuestWatchlist(ticker), pie: current?.pie || null, names: getBasketNames(rows) });
    }).catch(() => { if (active) setRecord({ ticker, signedIn: isSignedIn, error: true }); });
    return () => { active = false; };
  }, [ticker, isSignedIn, isLoaded, reload]);

  const loadBaskets = async () => {
    setBasketState('loading'); setError('');
    try {
      const response = await fetch('/api/watchlist/baskets');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudieron cargar tus bolsas.');
      setNames(getBasketNames([], [...(record?.names || []), ...(data.baskets || [])]));
      setBasketState('ready');
    } catch (err) { setBasketState('error'); setError(err.message); }
  };
  const clickFollow = () => {
    if (!ready || busy) return;
    if (!isSignedIn) {
      if (following) removeFromGuestWatchlist(ticker); else addToGuestWatchlist(ticker);
      setRecord(previous => ({ ...previous, following: !following }));
      return;
    }
    if (open) { setOpen(false); return; }
    setSelected(record.pie || ''); setOpen(true); loadBaskets();
  };
  const mutate = async removing => {
    if (busy || (!removing && basketState !== 'ready')) return;
    setBusy(true); setError('');
    try {
      if (removing) await removeStockFollow(ticker);
      else await saveStockFollow(ticker, selected, following);
      setRecord(previous => ({ ...previous, following: !removing, pie: removing ? null : selected || null }));
      setOpen(false);
    } catch (err) { setError(err.message || 'No se pudo guardar el seguimiento.'); }
    finally { setBusy(false); }
  };

  return <div onBlur={event => { if (!busy && !event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}
    onKeyDown={event => { if (event.key === 'Escape' && !busy) setOpen(false); }}
    style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
    <button type="button" disabled={!ready || busy} onClick={clickFollow} aria-expanded={isSignedIn ? open : undefined}
      style={{ height: 36, padding: '0 16px', borderRadius: 12, fontWeight: 700, fontSize: 12, fontFamily: 'inherit', cursor: !ready || busy ? 'default' : 'pointer', border: following ? 'none' : `1px solid ${C.ink}`, background: following ? C.lime : 'transparent', color: C.ink }}>
      {busy ? 'Guardando…' : following ? '✓ Siguiendo' : '+ Seguir'}{isSignedIn && !busy ? ' ▾' : ''}
    </button>
    {record?.error && <div role="alert" style={{ fontSize: 12, color: C.red }}>No se pudo cargar el seguimiento. <button type="button" onClick={() => setReload(value => value + 1)}>Reintentar</button></div>}
    {open && <div role="group" aria-label="Elegir bolsa de seguimiento" style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, width: 'min(270px, 75vw)', padding: 14, boxSizing: 'border-box', zIndex: 25, border: `1px solid ${C.border}`, borderRadius: 14, background: C.surface, boxShadow: '0 8px 24px #1c1b1814', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <label htmlFor={selectId} style={{ fontSize: 13, fontWeight: 700 }}>Guardar en una bolsa</label>
      {basketState === 'loading' && <span role="status" style={{ fontSize: 12, color: C.text2 }}>Cargando bolsas…</span>}
      <select id={selectId} value={selected} onChange={event => setSelected(event.target.value)} disabled={busy || basketState !== 'ready'}
        style={{ width: '100%', padding: 9, borderRadius: 8, border: `1px solid ${C.border}`, font: 'inherit', fontSize: 13, background: C.surface, color: C.ink }}>
        <option value="">Sin bolsa (General)</option>
        {names.map(name => <option key={name} value={name}>{name}</option>)}
      </select>
      {error && <span role="alert" style={{ fontSize: 12, color: C.red }}>{error}</span>}
      {basketState === 'error' && <button type="button" onClick={loadBaskets}>Reintentar carga</button>}
      <button type="button" disabled={busy || basketState !== 'ready'} onClick={() => mutate(false)} style={{ padding: 9, borderRadius: 8, border: 0, font: 'inherit', fontWeight: 700, fontSize: 12, background: C.lime, color: C.ink }}>{following ? 'Guardar bolsa' : 'Seguir en esta bolsa'}</button>
      {following && <button type="button" disabled={busy} onClick={() => mutate(true)} style={{ border: 0, background: 'none', color: C.red, font: 'inherit', fontSize: 12 }}>Dejar de seguir</button>}
      <Link href="/watchlist" style={{ color: C.text2, fontSize: 12 }}>Gestionar mis bolsas →</Link>
    </div>}
  </div>;
}
