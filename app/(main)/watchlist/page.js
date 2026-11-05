'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import NewNav from '../../components/new/NewNav';
import StockLogo from '../../components/workspace/StockLogo';
import { useUser } from '../../components/AuthProvider';
import { getGuestWatchlist, addToGuestWatchlist, removeFromGuestWatchlist, GUEST_WATCHLIST_LIMIT } from '../../../lib/guestWatchlist';
import { computeEasyMode } from '../../../lib/stockScoring';
import { stockVerdict } from '../../../lib/verdict';
import { formatCurrency } from '../../../lib/formatters';
import { NEW_COLORS as C, VERDICT_BADGE } from '../../components/new/theme';
import WatchlistBaskets from '../../components/new/WatchlistBaskets';
import { getBasketNames, validateBasketName } from '../../../lib/watchlistBaskets';

const hasFundamentals = (d) => d.revVal != null || d.niVal != null || d.marketCap != null
  || d.roic != null || d.grossMargin != null || (d.revHistory?.length ?? 0) > 0;

async function loadWatchlist(isSignedIn, signal) {
  let url = '/api/watchlist?full=true';
  if (!isSignedIn) {
    const guestTickers = getGuestWatchlist();
    if (guestTickers.length === 0) return [];
    url += `&tickers=${encodeURIComponent(guestTickers.join(','))}`;
  }
  const res = await fetch(url, { signal });
  const data = await res.json();
  if (!res.ok) throw new Error('No se pudo cargar el seguimiento.');
  return data.tickers || [];
}

function WatchlistRow({ item, onRemove, basketNames, onMove, busy, signedIn, canManage }) {
  const easyMode = computeEasyMode(item, hasFundamentals(item));
  const companyName = (item.name || item.ticker).split(' ')[0];
  const verdict = easyMode ? stockVerdict(easyMode, companyName) : null;
  const badge = verdict ? VERDICT_BADGE[verdict.tier] : null;
  const changeColor = item.priceChangePct == null ? C.text2 : item.priceChangePct >= 0 ? C.green : C.red;
  const sym = item.currency === 'EUR' ? '€' : item.currency === 'GBP' ? '£' : '$';

  return (
    <div style={{ borderBottom: `1px solid ${C.borderSoft}` }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '18px 24px' }}>
      <Link href={`/stock/${item.ticker}`} style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0, textDecoration: 'none', color: 'inherit' }}>
        <StockLogo ticker={item.ticker} name={item.name} size={38} />
        <div style={{ minWidth: 0, flex: '1 1 auto' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name || item.ticker}</div>
          <div style={{ fontSize: '12px', color: C.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.ticker}</div>
        </div>
        {badge && (
          <div className="new-watchlist-badge" style={{ alignItems: 'center', gap: '6px', padding: '5px 12px', borderRadius: '20px', background: badge.bg, flexShrink: 0, marginLeft: '8px' }}>
            <span aria-hidden="true" style={{ width: '7px', height: '7px', borderRadius: '50%', background: badge.dot }} />
            <span style={{ fontSize: '11px', fontWeight: 700, color: badge.text, whiteSpace: 'nowrap' }}>{verdict.label}</span>
          </div>
        )}
      </Link>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: '14px', fontWeight: 700 }}>{item.currentPrice != null ? formatCurrency(item.currentPrice, sym) : 'N/D'}</div>
        {item.priceChangePct != null && (
          <div style={{ fontSize: '12px', fontWeight: 700, color: changeColor }}>
            {item.priceChangePct >= 0 ? '+' : ''}{item.priceChangePct.toFixed(2)}%
          </div>
        )}
      </div>
      <button type="button" disabled={busy} onClick={() => onRemove(item.ticker)} aria-label={`Quitar ${item.name || item.ticker} de seguimiento`}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', color: C.text3, flexShrink: 0 }}>
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    </div>
    {signedIn && (
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0 24px 14px', minWidth: 0 }}>
        <label htmlFor={`basket-${item.ticker}`} style={{ fontSize: '12px', color: C.text2, flexShrink: 0 }}>Mover a</label>
        <select id={`basket-${item.ticker}`} aria-label={`Cesta de ${item.ticker}`} value={item.pie || ''} disabled={busy || !canManage}
          onChange={e => onMove(item.ticker, e.target.value || null)}
          style={{ maxWidth: '100%', minWidth: 0, flex: '0 1 240px', border: `1px solid ${C.border}`, borderRadius: '8px', padding: '7px 10px', background: C.surface, color: C.ink, fontFamily: 'inherit', fontSize: '12px' }}>
          <option value="">Sin cesta</option>
          {basketNames.map(name => <option key={name} value={name}>{name}</option>)}
        </select>
      </div>
    )}
    </div>
  );
}

export default function NewWatchlistPage() {
  const { user, isSignedIn, isLoaded } = useUser();
  // Reset account-scoped state on sign-in/out or account changes.
  return <WatchlistContent key={user?.id || 'guest'} isSignedIn={isSignedIn} isLoaded={isLoaded} />;
}

function WatchlistContent({ isSignedIn, isLoaded }) {
  const [tickers, setTickers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addQuery, setAddQuery] = useState('');
  const [addError, setAddError] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [savedBaskets, setSavedBaskets] = useState([]);
  const [activeBasket, setActiveBasket] = useState(null); // null = all, '' = ungrouped
  const [basketReady, setBasketReady] = useState(false);
  const [basketError, setBasketError] = useState('');
  const [listError, setListError] = useState('');
  const [saving, setSaving] = useState(false);
  const mutationInFlight = useRef(false);
  const loadVersion = useRef(0);
  const basketNames = getBasketNames(tickers, savedBaskets);
  const visibleTickers = activeBasket === null ? tickers : tickers.filter(t => (t.pie || '') === activeBasket);
  const busy = loading || saving || isAdding;

  const fetchWatchlist = useCallback((signal) => {
    const version = ++loadVersion.current;
    return loadWatchlist(isSignedIn, signal).then(list => {
      if (version === loadVersion.current) { setTickers(list); setListError(''); }
    }).catch(error => {
      if (error.name === 'AbortError') return;
      if (version === loadVersion.current) setListError('No se pudo cargar el seguimiento. Inténtalo de nuevo.');
    }).finally(() => {
      if (version === loadVersion.current) setLoading(false);
    });
  }, [isSignedIn]);

  useEffect(() => {
    if (!isLoaded) return;
    const controller = new AbortController();
    fetchWatchlist(controller.signal);
    return () => controller.abort();
  }, [isLoaded, fetchWatchlist]);

  useEffect(() => {
    if (!isLoaded) return;
    let cancelled = false;
    if (isSignedIn) {
      fetch('/api/watchlist/baskets').then(async res => {
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!cancelled) { setSavedBaskets(data.baskets || []); setBasketReady(true); }
      }).catch(() => {
        if (!cancelled) setBasketError('No se pudieron cargar las cestas. Puedes seguir viendo todas tus empresas. Recarga para reintentar.');
      });
    }
    return () => { cancelled = true; };
  }, [isLoaded, isSignedIn]);

  // Picks up tickers added from elsewhere (e.g. the Dashboard's search, or the real stock
  // page) while this page stays mounted — same pattern as the existing /watchlist page.
  useEffect(() => {
    if (!isSignedIn) {
      const refresh = () => fetchWatchlist();
      window.addEventListener('guest-watchlist-changed', refresh);
      return () => window.removeEventListener('guest-watchlist-changed', refresh);
    }
  }, [isSignedIn, fetchWatchlist]);

  const removeTicker = async (ticker) => {
    if (!isSignedIn) { removeFromGuestWatchlist(ticker); return; }
    await mutate('/api/watchlist', 'DELETE', { ticker }, () => {
      setTickers(prev => prev.filter(t => t.ticker !== ticker));
    });
  };

  const mutate = async (url, method, body, onSuccess) => {
    if (mutationInFlight.current) return false;
    mutationInFlight.current = true;
    setSaving(true);
    setBasketError('');
    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar el cambio.');
      onSuccess();
      return true;
    } catch (error) {
      setBasketError(error.message || 'Error de conexión.');
      return false;
    } finally {
      mutationInFlight.current = false;
      setSaving(false);
    }
  };

  const moveTicker = (ticker, pie) => mutate('/api/watchlist', 'PATCH', { ticker, pie }, () => {
    setTickers(prev => prev.map(t => t.ticker === ticker ? { ...t, pie } : t));
  });

  const saveBasket = async (oldName, draft) => {
    const error = validateBasketName(draft);
    if (error) { setBasketError(error); return false; }
    const name = draft.trim();
    if (oldName === name) return true;
    if (basketNames.includes(name)) { setBasketError('Ya existe una cesta con ese nombre.'); return false; }
    return mutate('/api/watchlist/baskets', oldName === null ? 'POST' : 'PATCH', oldName === null ? { name } : { name: oldName, newName: name }, () => {
      setSavedBaskets(prev => [...prev.filter(n => n !== oldName), name]);
      if (oldName !== null) setTickers(prev => prev.map(t => t.pie === oldName ? { ...t, pie: name } : t));
      setActiveBasket(name);
    });
  };

  const deleteBasket = (name) => mutate('/api/watchlist/baskets', 'DELETE', { name }, () => {
    setSavedBaskets(prev => prev.filter(n => n !== name));
    setTickers(prev => prev.map(t => t.pie === name ? { ...t, pie: null } : t));
    setActiveBasket(null);
  });

  const handleAdd = async (e) => {
    e.preventDefault();
    const ticker = addQuery.trim().toUpperCase();
    if (!ticker) return;
    setIsAdding(true);
    setAddError('');
    try {
      const res = await fetch(`/api/stock?ticker=${encodeURIComponent(ticker)}`);
      const data = await res.json();
      if (data.error) { setAddError('No encontramos ese ticker.'); setIsAdding(false); return; }

      if (!isSignedIn) {
        const { added, atLimit } = addToGuestWatchlist(ticker);
        if (atLimit) setAddError(`Límite de ${GUEST_WATCHLIST_LIMIT} temporales — crea una cuenta gratis para seguir sin límite.`);
        else if (added) { setAddQuery(''); await fetchWatchlist(); }
        setIsAdding(false);
        return;
      }

      const addRes = await fetch('/api/watchlist', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(activeBasket === null ? { ticker } : { ticker, pie: activeBasket || null }),
      });
      if (addRes.ok) {
        setAddQuery('');
        await fetchWatchlist();
      } else {
        const body = await addRes.json().catch(() => ({}));
        setAddError(body.error || 'No se pudo añadir.');
      }
    } catch {
      setAddError('Error de conexión.');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div style={{ width: '100%', minHeight: '100vh', boxSizing: 'border-box', background: C.bg, color: C.ink, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 'min(1200px, 92vw)', margin: '0 auto', padding: '32px 24px 96px', display: 'flex', flexDirection: 'column', gap: '24px', boxSizing: 'border-box' }}>

        <NewNav active="seguidos" />

        <Link href="/home" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: C.text2, textDecoration: 'none', width: 'fit-content' }}>
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
          Volver
        </Link>

        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em' }}>Lo que sigues</h1>
          <div style={{ fontSize: '13px', color: C.text2 }}>
            {tickers.length} {tickers.length === 1 ? 'acción o fondo' : 'acciones y fondos'}
          </div>
        </div>

        {isSignedIn && (
          <WatchlistBaskets names={basketNames} tickers={tickers} active={activeBasket} onSelect={setActiveBasket}
            onSave={saveBasket} onDelete={deleteBasket} busy={busy} canManage={basketReady} />
        )}
        {basketError && <div role="alert" style={{ fontSize: '13px', color: C.red }}>{basketError}</div>}
        {listError && <div role="alert" style={{ fontSize: '13px', color: C.red }}>{listError} <button type="button" onClick={() => fetchWatchlist()}>Reintentar</button></div>}

        <form onSubmit={handleAdd} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '8px', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <label className="sr-only" htmlFor="watch-add" style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>Añadir ticker o empresa</label>
            <input
              id="watch-add"
              type="text"
              value={addQuery}
              onChange={e => setAddQuery(e.target.value)}
              placeholder="Añadir una acción o fondo..."
              autoComplete="off"
              disabled={busy}
              style={{ flex: '1 1 260px', height: '46px', borderRadius: '12px', border: `1px solid ${C.border}`, padding: '0 16px', fontSize: '14px', fontFamily: 'inherit', background: '#FDFBF6', boxSizing: 'border-box', color: C.ink }}
            />
            <button type="submit" disabled={busy} style={{ height: '46px', padding: '0 22px', borderRadius: '12px', border: 'none', background: C.lime, color: C.ink, fontWeight: 700, fontSize: '14px', fontFamily: 'inherit', cursor: isAdding ? 'default' : 'pointer', opacity: isAdding ? 0.6 : 1 }}>
              + Añadir
            </button>
          </div>
          {addError && <div style={{ fontSize: '12px', color: C.red }}>{addError}</div>}
          {activeBasket && <div style={{ fontSize: '12px', color: C.text2, overflowWrap: 'anywhere' }}>Se añadirá a «{activeBasket}».</div>}
        </form>

        {loading ? (
          <div style={{ fontSize: '13px', color: C.text3 }}>Cargando…</div>
        ) : listError && tickers.length === 0 ? null : visibleTickers.length === 0 ? (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '28px', textAlign: 'center', fontSize: '13px', color: C.text2 }}>
            {activeBasket === null ? 'Aún no sigues ninguna empresa — añade una arriba.' : 'No hay empresas en esta cesta. Puedes añadir una arriba o moverla desde Todos.'}
          </div>
        ) : (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', boxSizing: 'border-box', overflow: 'hidden' }}>
            {visibleTickers.map(item => <WatchlistRow key={item.ticker} item={item} onRemove={removeTicker}
              basketNames={basketNames} onMove={moveTicker} busy={busy} signedIn={isSignedIn} canManage={basketReady} />)}
          </div>
        )}

      </div>
    </div>
  );
}
