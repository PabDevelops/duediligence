'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import NewNav from '../../components/new/NewNav';
import StockLogo from '../../components/workspace/StockLogo';
import { useUser } from '../../components/AuthProvider';
import { getGuestWatchlist, addToGuestWatchlist, removeFromGuestWatchlist, GUEST_WATCHLIST_LIMIT } from '../../../lib/guestWatchlist';
import { computeEasyMode } from '../../../lib/stockScoring';
import { stockVerdict } from '../../../lib/verdict';
import { formatCurrency } from '../../../lib/formatters';
import { NEW_COLORS as C, VERDICT_BADGE } from '../../components/new/theme';

const hasFundamentals = (d) => d.revVal != null || d.niVal != null || d.marketCap != null
  || d.roic != null || d.grossMargin != null || (d.revHistory?.length ?? 0) > 0;

function WatchlistRow({ item, onRemove }) {
  const easyMode = computeEasyMode(item, hasFundamentals(item));
  const companyName = (item.name || item.ticker).split(' ')[0];
  const verdict = easyMode ? stockVerdict(easyMode, companyName) : null;
  const badge = verdict ? VERDICT_BADGE[verdict.tier] : null;
  const changeColor = item.priceChangePct == null ? C.text2 : item.priceChangePct >= 0 ? C.green : C.red;
  const sym = item.currency === 'EUR' ? '€' : item.currency === 'GBP' ? '£' : '$';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '18px 24px', borderBottom: `1px solid ${C.borderSoft}` }}>
      <Link href={`/stock/${item.ticker}`} style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0, textDecoration: 'none', color: 'inherit' }}>
        <StockLogo ticker={item.ticker} name={item.name} size={38} />
        <div style={{ minWidth: 0, flexShrink: 1 }}>
          <div style={{ fontSize: '14px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name || item.ticker}</div>
          <div style={{ fontSize: '12px', color: C.text2 }}>{item.ticker}</div>
        </div>
        {badge && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 12px', borderRadius: '20px', background: badge.bg, flexShrink: 0, marginLeft: '8px' }}>
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
      <button type="button" onClick={() => onRemove(item.ticker)} aria-label={`Quitar ${item.name || item.ticker} de seguimiento`}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', color: C.text3, flexShrink: 0 }}>
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    </div>
  );
}

export default function NewWatchlistPage() {
  const { isSignedIn, isLoaded } = useUser();
  const [tickers, setTickers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addQuery, setAddQuery] = useState('');
  const [addError, setAddError] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const fetchWatchlist = useCallback(async () => {
    setLoading(true);
    try {
      let list = [];
      if (isSignedIn) {
        const res = await fetch('/api/watchlist?full=true');
        list = (await res.json()).tickers || [];
      } else {
        const guestTickers = getGuestWatchlist();
        if (guestTickers.length > 0) {
          const res = await fetch(`/api/watchlist?full=true&tickers=${guestTickers.join(',')}`);
          list = (await res.json()).tickers || [];
        }
      }
      setTickers(list);
    } catch {
      setTickers([]);
    } finally {
      setLoading(false);
    }
  }, [isSignedIn]);

  useEffect(() => {
    if (!isLoaded) return;
    fetchWatchlist();
  }, [isLoaded, fetchWatchlist]);

  // Picks up tickers added from elsewhere (e.g. the Dashboard's search, or the real stock
  // page) while this page stays mounted — same pattern as the existing /watchlist page.
  useEffect(() => {
    if (!isSignedIn) {
      window.addEventListener('guest-watchlist-changed', fetchWatchlist);
      return () => window.removeEventListener('guest-watchlist-changed', fetchWatchlist);
    }
  }, [isSignedIn, fetchWatchlist]);

  const removeTicker = async (ticker) => {
    setTickers(prev => prev.filter(t => t.ticker !== ticker));
    if (!isSignedIn) { removeFromGuestWatchlist(ticker); return; }
    await fetch('/api/watchlist', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker }),
    });
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    const ticker = addQuery.trim().toUpperCase();
    if (!ticker) return;
    setIsAdding(true);
    setAddError('');
    try {
      const res = await fetch(`/api/stock?ticker=${ticker}`);
      const data = await res.json();
      if (data.error) { setAddError('No encontramos ese ticker.'); setIsAdding(false); return; }

      if (!isSignedIn) {
        const { added, atLimit } = addToGuestWatchlist(ticker);
        if (atLimit) setAddError(`Límite de ${GUEST_WATCHLIST_LIMIT} temporales — crea una cuenta gratis para seguir sin límite.`);
        else if (added) { setAddQuery(''); fetchWatchlist(); }
        setIsAdding(false);
        return;
      }

      const addRes = await fetch('/api/watchlist', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ticker }),
      });
      if (addRes.ok) { setAddQuery(''); fetchWatchlist(); } else { setAddError('No se pudo añadir.'); }
    } catch {
      setAddError('Error de conexión.');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div style={{ width: '100%', minHeight: '100vh', boxSizing: 'border-box', background: C.bg, color: C.ink, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '32px 24px 96px', display: 'flex', flexDirection: 'column', gap: '24px', boxSizing: 'border-box' }}>

        <NewNav active="seguidos" />

        <Link href="/new" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: C.text2, textDecoration: 'none', width: 'fit-content' }}>
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
          Volver
        </Link>

        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em' }}>Lo que sigues</h1>
          <div style={{ fontSize: '13px', color: C.text2 }}>
            {tickers.length} {tickers.length === 1 ? 'acción o fondo' : 'acciones y fondos'}
          </div>
        </div>

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
              style={{ flex: '1 1 260px', height: '46px', borderRadius: '12px', border: `1px solid ${C.border}`, padding: '0 16px', fontSize: '14px', fontFamily: 'inherit', background: '#FDFBF6', boxSizing: 'border-box', color: C.ink }}
            />
            <button type="submit" disabled={isAdding} style={{ height: '46px', padding: '0 22px', borderRadius: '12px', border: 'none', background: C.lime, color: C.ink, fontWeight: 700, fontSize: '14px', fontFamily: 'inherit', cursor: isAdding ? 'default' : 'pointer', opacity: isAdding ? 0.6 : 1 }}>
              + Añadir
            </button>
          </div>
          {addError && <div style={{ fontSize: '12px', color: C.red }}>{addError}</div>}
        </form>

        {loading ? (
          <div style={{ fontSize: '13px', color: C.text3 }}>Cargando…</div>
        ) : tickers.length === 0 ? (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '28px', textAlign: 'center', fontSize: '13px', color: C.text2 }}>
            Aún no sigues ninguna empresa — añade una arriba.
          </div>
        ) : (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', boxSizing: 'border-box', overflow: 'hidden' }}>
            {tickers.map(item => <WatchlistRow key={item.ticker} item={item} onRemove={removeTicker} />)}
          </div>
        )}

      </div>
    </div>
  );
}
