'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '../../components/AuthProvider';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const toKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function WorkspaceCalendar() {
  const router = useRouter();
  const { isSignedIn } = useUser();
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [earnings, setEarnings] = useState(null);
  const [ipos, setIpos] = useState([]);
  const [watchlistOnly, setWatchlistOnly] = useState(false);
  const [watchlistTickers, setWatchlistTickers] = useState(new Set());
  const [selectedDate, setSelectedDate] = useState(null);

  useEffect(() => {
    const from = toKey(new Date(cursor.getFullYear(), cursor.getMonth(), 1));
    const to = toKey(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0));
    setEarnings(null);
    fetch(`/api/earnings?from=${from}&to=${to}`).then(r => r.json()).then(d => {
      setEarnings(d.earnings || []);
      setIpos(d.ipos || []);
    });
  }, [cursor]);

  useEffect(() => {
    if (!isSignedIn) return;
    fetch('/api/watchlist').then(r => r.json()).then(d => {
      setWatchlistTickers(new Set((d.tickers || []).map(t => t.ticker)));
    });
  }, [isSignedIn]);

  const filteredEarnings = useMemo(
    () => watchlistOnly ? (earnings || []).filter(e => watchlistTickers.has(e.ticker)) : (earnings || []),
    [earnings, watchlistOnly, watchlistTickers]
  );
  const filteredIpos = useMemo(
    () => watchlistOnly ? ipos.filter(e => watchlistTickers.has(e.ticker)) : ipos,
    [ipos, watchlistOnly, watchlistTickers]
  );

  const byDate = useMemo(() => {
    const acc = {};
    filteredEarnings.forEach(e => { (acc[e.date] ||= { earnings: [], ipos: [] }).earnings.push(e); });
    filteredIpos.forEach(e => { (acc[e.date] ||= { earnings: [], ipos: [] }).ipos.push(e); });
    return acc;
  }, [filteredEarnings, filteredIpos]);

  const todayKey = toKey(new Date());

  const cells = useMemo(() => {
    const firstOfMonth = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const startOffset = firstOfMonth.getDay();
    const gridStart = new Date(firstOfMonth);
    gridStart.setDate(gridStart.getDate() - startOffset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [cursor]);

  const selected = selectedDate ? (byDate[selectedDate] || { earnings: [], ipos: [] }) : null;
  const totalEventsThisMonth = filteredEarnings.length + filteredIpos.length;

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ border: '1px solid var(--ws-border)', background: 'var(--ws-bg-1)', marginBottom: '20px', overflow: 'hidden' }}>
        <div style={{ background: 'var(--ws-bg-2)', borderBottom: '1px solid var(--ws-border)', padding: '7px 16px' }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: 'var(--ws-accent)', fontWeight: 700, letterSpacing: '1px' }}>
            $ traq calendar
          </span>
        </div>
        <div style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ws-text)' }}>Calendar</div>
            <div style={{ fontSize: '13px', color: 'var(--ws-text-2)' }}>Earnings and IPOs for covered stocks.</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {isSignedIn && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--ws-text-2)', cursor: 'pointer', userSelect: 'none' }}>
                <input type="checkbox" checked={watchlistOnly} onChange={e => setWatchlistOnly(e.target.checked)}
                  style={{ accentColor: 'var(--ws-accent)', cursor: 'pointer' }} />
                My watchlist only
              </label>
            )}
            <button onClick={() => setCursor(c => new Date(c.getFullYear(), c.getMonth() - 1, 1))}
              style={{ width: '28px', height: '28px', border: '1px solid var(--ws-border)', background: 'var(--ws-bg-1)', color: 'var(--ws-text)', cursor: 'pointer' }}>
              ‹
            </button>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ws-text)', width: '140px', textAlign: 'center' }}>
              {MONTH_NAMES[cursor.getMonth()]} {cursor.getFullYear()}
            </div>
            <button onClick={() => setCursor(c => new Date(c.getFullYear(), c.getMonth() + 1, 1))}
              style={{ width: '28px', height: '28px', border: '1px solid var(--ws-border)', background: 'var(--ws-bg-1)', color: 'var(--ws-text)', cursor: 'pointer' }}>
              ›
            </button>
            <button onClick={() => { const d = new Date(); d.setDate(1); setCursor(d); }}
              style={{ padding: '0 12px', height: '28px', border: '1px solid var(--ws-border)', background: 'var(--ws-bg-1)', color: 'var(--ws-text-2)', fontSize: '12px', cursor: 'pointer' }}>
              Today
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--ws-text-3)' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: 'var(--ws-accent)', display: 'inline-block' }} />
          Earnings
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--ws-text-3)' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#7c6fe0' /* distinct IPO purple, intentionally outside the --ws-* accent palette */, display: 'inline-block' }} />
          IPO
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '20px', alignItems: 'start' }}>
        <div style={{ border: '1px solid var(--ws-border)', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--ws-border)' }}>
            {DAY_NAMES.map(d => (
              <div key={d} style={{ padding: '8px', fontSize: '10px', fontWeight: 700, color: 'var(--ws-text-3)', textAlign: 'center', letterSpacing: '0.5px' }}>{d}</div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {cells.map((d, i) => {
              const key = toKey(d);
              const inMonth = d.getMonth() === cursor.getMonth();
              const dayData = byDate[key] || { earnings: [], ipos: [] };
              const allEvents = [...dayData.earnings.map(e => ({ ...e, type: 'earnings' })), ...dayData.ipos.map(e => ({ ...e, type: 'ipo' }))];
              const isToday = key === todayKey;
              const isSelected = key === selectedDate;
              return (
                <div key={i} onClick={() => allEvents.length && setSelectedDate(key)}
                  style={{
                    minHeight: '84px', padding: '6px', borderRight: (i + 1) % 7 !== 0 ? '1px solid var(--ws-border)' : 'none',
                    borderBottom: i < 35 ? '1px solid var(--ws-border)' : 'none',
                    background: isSelected ? 'var(--ws-accent-dim)' : 'transparent',
                    cursor: allEvents.length ? 'pointer' : 'default',
                    opacity: inMonth ? 1 : 0.35,
                  }}
                  onMouseEnter={e => { if (allEvents.length && !isSelected) e.currentTarget.style.background = 'var(--ws-bg-2)'; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}>
                  <div style={{
                    fontSize: '11px', fontWeight: isToday ? 800 : 500, color: isToday ? 'var(--ws-accent)' : 'var(--ws-text-2)',
                    marginBottom: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px',
                    borderRadius: '50%', background: isToday ? 'var(--ws-accent-dim)' : 'transparent',
                  }}>
                    {d.getDate()}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {allEvents.slice(0, 3).map((e, j) => (
                      <div key={j} style={{
                        fontSize: '9px', fontWeight: 700,
                        color: e.type === 'ipo' ? '#7c6fe0' /* distinct IPO purple, intentionally outside the --ws-* accent palette */ : 'var(--ws-accent)',
                        background: e.type === 'ipo' ? '#7c6fe014' : 'var(--ws-accent-dim)',
                        borderRadius: '3px', padding: '1px 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {e.ticker}
                      </div>
                    ))}
                    {allEvents.length > 3 && (
                      <div style={{ fontSize: '9px', color: 'var(--ws-text-3)', paddingLeft: '4px' }}>+{allEvents.length - 3} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ border: '1px solid var(--ws-border)', padding: '16px', position: 'sticky', top: '20px' }}>
          {earnings === null ? (
            <div style={{ color: 'var(--ws-text-3)', fontSize: '13px' }}>Loading…</div>
          ) : !selectedDate ? (
            <div style={{ color: 'var(--ws-text-3)', fontSize: '13px' }}>
              {totalEventsThisMonth === 0
                ? (watchlistOnly ? 'No events this month for your watchlist.' : 'No earnings or IPOs scheduled this month for covered stocks.')
                : 'Click a day with events to see details.'}
            </div>
          ) : (
            <>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ws-text)', marginBottom: '12px' }}>
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {selected.earnings.map((e, i) => (
                  <div key={'e' + e.ticker + i} onClick={() => router.push(`/stock/${e.ticker}`)}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', cursor: 'pointer', border: '1px solid var(--ws-border)' }}
                    onMouseEnter={ev => ev.currentTarget.style.background = 'var(--ws-bg-2)'}
                    onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}>
                    <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--ws-accent)', background: 'var(--ws-accent-dim)', borderRadius: '3px', padding: '2px 5px' }}>EARN</span>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ws-text)' }}>{e.ticker}</span>
                    <span style={{ fontSize: '10px', color: 'var(--ws-text-3)' }}>{e.hour === 'bmo' ? 'Before open' : e.hour === 'amc' ? 'After close' : 'Time TBD'}</span>
                    {e.epsEstimate != null && (
                      <span style={{ fontSize: '11px', color: 'var(--ws-text-2)', marginLeft: 'auto' }} title="Analyst-estimated earnings per share">Est. EPS ${e.epsEstimate}</span>
                    )}
                  </div>
                ))}
                {selected.ipos.map((e, i) => (
                  <div key={'i' + e.ticker + i} onClick={() => router.push(`/stock/${e.ticker}`)}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', cursor: 'pointer', border: '1px solid var(--ws-border)' }}
                    onMouseEnter={ev => ev.currentTarget.style.background = 'var(--ws-bg-2)'}
                    onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}>
                    <span style={{ fontSize: '9px', fontWeight: 700, color: '#7c6fe0' /* distinct IPO purple, intentionally outside the --ws-* accent palette */, background: '#7c6fe014', borderRadius: '3px', padding: '2px 5px' }}>IPO</span>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ws-text)' }}>{e.ticker}</span>
                    <span style={{ fontSize: '10px', color: 'var(--ws-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</span>
                    {e.price && (
                      <span style={{ fontSize: '11px', color: 'var(--ws-text-2)', marginLeft: 'auto' }} title="Expected IPO price range">IPO price ${e.price}</span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
