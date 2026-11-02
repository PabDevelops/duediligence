'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import NewNav from '../../components/new/NewNav';
import { useUser } from '../../components/AuthProvider';
import { getGuestWatchlist, addToGuestWatchlist, removeFromGuestWatchlist } from '../../../lib/guestWatchlist';
import { NEW_COLORS as C } from '../../components/new/theme';

const WEEKDAYS = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
const MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
const RANGE_DAYS = 13;
const ITEMS_PER_DAY = 5;

const LOGO_BG = ['#DCE7D8', '#F2E6D6', '#F1DAD3', '#DCE3EE', '#E6DCEE', '#E6E2D3'];
const logoBgFor = (ticker) => LOGO_BG[[...ticker].reduce((a, c) => a + c.charCodeAt(0), 0) % LOGO_BG.length];

const timingLabel = (hour) => hour === 'bmo' ? 'Antes de abrir' : hour === 'amc' ? 'Después del cierre' : 'Hora sin confirmar';

const toDateStr = (d) => d.toISOString().slice(0, 10);

function dayLabel(dateStr, todayStr, tomorrowStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const base = `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  if (dateStr === todayStr) return `HOY · ${base}`;
  if (dateStr === tomorrowStr) return `MAÑANA · ${base}`;
  return base;
}

export default function NewCalendarPage() {
  const { isSignedIn, isLoaded } = useUser();
  const [earnings, setEarnings] = useState(null); // null = loading
  const [watched, setWatched] = useState(new Set());
  const [onlyWatched, setOnlyWatched] = useState(false);
  const [expandedDays, setExpandedDays] = useState(new Set());

  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => toDateStr(today), [today]);
  const tomorrowStr = useMemo(() => toDateStr(new Date(today.getTime() + 86400000)), [today]);
  const toStr = useMemo(() => toDateStr(new Date(today.getTime() + RANGE_DAYS * 86400000)), [today]);

  useEffect(() => {
    let active = true;
    fetch(`/api/earnings?from=${todayStr}&to=${toStr}`).then(r => r.json()).then(d => {
      if (active) setEarnings(d.earnings || []);
    }).catch(() => { if (active) setEarnings([]); });
    return () => { active = false; };
  }, [todayStr, toStr]);

  const loadWatched = useCallback(async () => {
    if (isSignedIn) {
      const res = await fetch('/api/watchlist');
      const d = await res.json();
      setWatched(new Set((d.tickers || []).map(t => t.ticker)));
    } else {
      setWatched(new Set(getGuestWatchlist()));
    }
  }, [isSignedIn]);

  useEffect(() => {
    if (!isLoaded) return;
    loadWatched();
  }, [isLoaded, loadWatched]);

  const toggleWatch = async (ticker) => {
    const isWatched = watched.has(ticker);
    setWatched(prev => {
      const next = new Set(prev);
      if (isWatched) next.delete(ticker); else next.add(ticker);
      return next;
    });
    if (!isSignedIn) {
      if (isWatched) removeFromGuestWatchlist(ticker); else addToGuestWatchlist(ticker);
      return;
    }
    if (isWatched) {
      await fetch('/api/watchlist', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ticker }) });
    } else {
      await fetch('/api/watchlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ticker }) });
    }
  };

  const days = useMemo(() => {
    if (!earnings) return [];
    const filtered = onlyWatched ? earnings.filter(e => watched.has(e.ticker)) : earnings;
    const byDate = {};
    filtered.forEach(e => { (byDate[e.date] ||= []).push(e); });
    return Object.keys(byDate).sort().map(date => ({
      date,
      label: dayLabel(date, todayStr, tomorrowStr),
      items: byDate[date].sort((a, b) => a.ticker.localeCompare(b.ticker)),
    }));
  }, [earnings, onlyWatched, watched, todayStr, tomorrowStr]);

  const toggleExpand = (date) => setExpandedDays(prev => {
    const next = new Set(prev);
    if (next.has(date)) next.delete(date); else next.add(date);
    return next;
  });

  return (
    <div style={{ width: '100%', minHeight: '100vh', boxSizing: 'border-box', background: C.bg, color: C.ink, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '32px 24px 96px', display: 'flex', flexDirection: 'column', gap: '24px', boxSizing: 'border-box' }}>

        <NewNav active="calendario" />

        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em' }}>Próximos resultados</h1>
          <div style={{ fontSize: '13px', color: C.text2 }}>Cuándo las empresas cuentan cómo les ha ido este trimestre.</div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" onClick={() => setOnlyWatched(false)} style={{
            height: '34px', padding: '0 16px', borderRadius: '20px', border: onlyWatched ? `1px solid ${C.border}` : 'none',
            background: onlyWatched ? 'transparent' : C.ink, color: onlyWatched ? C.text2 : '#FFFFFF',
            fontSize: '12px', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
          }}>
            Todo
          </button>
          <button type="button" onClick={() => setOnlyWatched(true)} style={{
            height: '34px', padding: '0 16px', borderRadius: '20px', border: onlyWatched ? 'none' : `1px solid ${C.border}`,
            background: onlyWatched ? C.ink : 'transparent', color: onlyWatched ? '#FFFFFF' : C.text2,
            fontSize: '12px', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
          }}>
            Solo lo que sigues
          </button>
        </div>

        {earnings === null ? (
          <div style={{ fontSize: '13px', color: C.text3 }}>Cargando…</div>
        ) : days.length === 0 ? (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '28px', textAlign: 'center', fontSize: '13px', color: C.text2 }}>
            {onlyWatched ? 'Ninguna de las empresas que sigues presenta resultados en los próximos días.' : 'No hay resultados próximos en este rango.'}
          </div>
        ) : (
          days.map(day => {
            const expanded = expandedDays.has(day.date);
            const visible = expanded ? day.items : day.items.slice(0, ITEMS_PER_DAY);
            const overflow = day.items.length - visible.length;
            return (
              <div key={day.date} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', paddingLeft: '4px', paddingRight: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: C.text3, letterSpacing: '0.04em' }}>{day.label}</span>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: C.text3 }}>{day.items.length} presenta{day.items.length === 1 ? '' : 'n'} resultados</span>
                </div>
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', boxSizing: 'border-box', overflow: 'hidden' }}>
                  {visible.map(item => {
                    const isWatched = watched.has(item.ticker);
                    return (
                      <div key={item.ticker} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px 22px', borderBottom: `1px solid ${C.borderSoft}` }}>
                        <Link href={`/new/stock/${item.ticker}`} style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0, textDecoration: 'none', color: 'inherit' }}>
                          <div aria-hidden="true" style={{ width: '36px', height: '36px', borderRadius: '10px', background: logoBgFor(item.ticker), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 800, flexShrink: 0 }}>
                            {item.ticker.slice(0, 1)}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '14px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name || item.ticker}</div>
                            <div style={{ fontSize: '12px', color: C.text2 }}>{item.ticker}</div>
                          </div>
                        </Link>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: C.text2, background: C.bg, borderRadius: '20px', padding: '5px 12px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                          {timingLabel(item.hour)}
                        </span>
                        <button type="button" onClick={() => toggleWatch(item.ticker)} aria-label={isWatched ? `Dejar de seguir ${item.ticker}` : `Seguir ${item.ticker}`}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', flexShrink: 0, color: isWatched ? '#8A9C3A' : '#B3AE9F' }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill={isWatched ? C.lime : 'none'} stroke={isWatched ? '#8A9C3A' : '#B3AE9F'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                  {overflow > 0 && (
                    <button type="button" onClick={() => toggleExpand(day.date)} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', width: '100%',
                      padding: '14px 22px', fontSize: '13px', fontWeight: 700, color: '#45413A', textDecoration: 'none',
                      background: C.bg, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                      Ver las otras {overflow}
                      <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}

      </div>
    </div>
  );
}
