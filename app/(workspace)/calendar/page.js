'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '../../components/AuthProvider';
import StockLogo from '../../components/workspace/StockLogo';
import { toKey, startOfMonth, endOfMonth, shiftMonth } from '../../../lib/calendarDates';
import { openInNewTab } from '../../../lib/openInNewTab';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function WorkspaceCalendar() {
  const router = useRouter();
  const { isSignedIn } = useUser();
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [weekCursor, setWeekCursor] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  });
  const [viewMode, setViewMode] = useState('week'); // default to new week view based on mockup
  const [earnings, setEarnings] = useState(null);
  const [ipos, setIpos] = useState([]);
  
  // Filtering & Search states
  const [watchlistOnly, setWatchlistOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // all | earnings | ipos
  const [marketCapFilter, setMarketCapFilter] = useState('all');
  const [sectorFilter, setSectorFilter] = useState('all');
  const [watchlistTickers, setWatchlistTickers] = useState(new Set());
  const [selectedDate, setSelectedDate] = useState(null);
  const [togglingWatchlist, setTogglingWatchlist] = useState(null);

  // Fetch Calendar Data (Earnings & IPOs)
  const fetchCalendarData = () => {
    const activeCursor = viewMode === 'week' ? weekCursor : cursor;
    const from = toKey(startOfMonth(activeCursor));
    const to = toKey(endOfMonth(activeCursor));
    setEarnings(null);
    const qs = new URLSearchParams({ from, to });
    fetch(`/api/earnings?${qs.toString()}`)
      .then(r => r.json())
      .then(d => {
        setEarnings(d.earnings || []);
        setIpos(d.ipos || []);
      })
      .catch(() => {
        setEarnings([]);
        setIpos([]);
      });
  };

  useEffect(() => {
    fetchCalendarData();
  }, [cursor, weekCursor, viewMode]);

  // Fetch Watchlist Tickers
  const fetchWatchlist = () => {
    if (!isSignedIn) return;
    fetch('/api/watchlist')
      .then(r => r.json())
      .then(d => {
        setWatchlistTickers(new Set((d.tickers || []).map(t => t.ticker)));
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchWatchlist();
  }, [isSignedIn]);

  // Watchlist Toggle Handler
  const handleToggleWatchlist = async (e, ticker) => {
    e.stopPropagation();
    if (!isSignedIn) {
      router.push('/sign-in');
      return;
    }
    setTogglingWatchlist(ticker);
    const isAdded = watchlistTickers.has(ticker);
    try {
      const res = await fetch('/api/watchlist', {
        method: isAdded ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker })
      });
      if (res.ok) {
        setWatchlistTickers(prev => {
          const next = new Set(prev);
          if (isAdded) next.delete(ticker);
          else next.add(ticker);
          return next;
        });
      }
    } catch (err) {
      console.error('Failed to update watchlist', err);
    } finally {
      setTogglingWatchlist(null);
    }
  };

  // Compile calendar events by Date
  const allEventsThisMonth = useMemo(() => {
    const earnList = (earnings || []).map(e => ({ ...e, type: 'earnings' }));
    const ipoList = ipos.map(i => ({ ...i, type: 'ipo' }));
    return [...earnList, ...ipoList];
  }, [earnings, ipos]);

  const availableSectors = useMemo(() => {
    const sectors = new Set();
    allEventsThisMonth.forEach(e => {
      if (e.sector) sectors.add(e.sector);
    });
    return Array.from(sectors).sort();
  }, [allEventsThisMonth]);

  // Apply filters: Watchlist, Search, Type, Market Cap, Sector
  const filteredEvents = useMemo(() => {
    return allEventsThisMonth.filter(event => {
      // 1. Watchlist filter
      if (watchlistOnly && !watchlistTickers.has(event.ticker)) return false;

      // 2. Type filter
      if (typeFilter === 'earnings' && event.type !== 'earnings') return false;
      if (typeFilter === 'ipos' && event.type !== 'ipo') return false;

      // 3. Search query filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTicker = event.ticker?.toLowerCase().includes(query);
        const matchesName = event.name?.toLowerCase().includes(query);
        if (!matchesTicker && !matchesName) return false;
      }

      // 4. Market Cap filter
      if (marketCapFilter !== 'all') {
        const mc = event.marketCap || 0;
        if (marketCapFilter === 'mega' && mc < 200000000000) return false;
        if (marketCapFilter === 'large' && (mc < 10000000000 || mc >= 200000000000)) return false;
        if (marketCapFilter === 'mid' && (mc < 2000000000 || mc >= 10000000000)) return false;
        if (marketCapFilter === 'small' && mc >= 2000000000) return false;
      }

      // 5. Sector filter
      if (sectorFilter !== 'all' && event.sector !== sectorFilter) return false;

      return true;
    });
  }, [allEventsThisMonth, watchlistOnly, watchlistTickers, typeFilter, searchQuery, marketCapFilter, sectorFilter]);

  // Categorize filtered events by date
  const byDate = useMemo(() => {
    const acc = {};
    filteredEvents.forEach(e => {
      acc[e.date] ||= [];
      acc[e.date].push(e);
    });
    return acc;
  }, [filteredEvents]);

  // Week events grouped by day for the Weekly Grid
  const weekEvents = useMemo(() => {
    if (viewMode !== 'week') return [];
    
    // Generate dates for Mon-Fri
    const dates = Array.from({ length: 5 }, (_, i) => {
      const d = new Date(weekCursor);
      d.setDate(d.getDate() + i);
      return {
        dateStr: toKey(d),
        dateObj: d,
      };
    });

    return dates.map(({ dateStr, dateObj }) => {
      const eventsForDay = byDate[dateStr] || [];
      const bmo = eventsForDay.filter(e => e.hour === 'bmo' || e.time === 'bmo');
      const amc = eventsForDay.filter(e => e.hour === 'amc' || e.time === 'amc');
      const other = eventsForDay.filter(e => e.hour !== 'bmo' && e.hour !== 'amc' && e.time !== 'bmo' && e.time !== 'amc');
      
      return {
        dateStr,
        dateObj,
        bmo: bmo.sort((a, b) => a.ticker.localeCompare(b.ticker)),
        amc: amc.sort((a, b) => a.ticker.localeCompare(b.ticker)),
        other: other.sort((a, b) => a.ticker.localeCompare(b.ticker)),
      };
    });
  }, [viewMode, weekCursor, byDate]);

  // Stats Counters
  const stats = useMemo(() => {
    const todayStr = toKey(new Date());
    if (viewMode === 'week') {
      let eCount = 0;
      let iCount = 0;
      let wCount = 0;
      weekEvents.forEach(day => {
        const allDay = [...day.bmo, ...day.amc, ...day.other];
        eCount += allDay.filter(e => e.type === 'earnings').length;
        iCount += allDay.filter(e => e.type === 'ipo' && e.date >= todayStr).length;
        wCount += allDay.filter(e => watchlistTickers.has(e.ticker)).length;
      });
      return { totalEarnings: eCount, totalIpos: iCount, watchlistMatch: wCount };
    }

    const totalEarnings = (earnings || []).length;
    const totalIpos = ipos.filter(i => i.date >= todayStr).length;
    const watchlistMatch = allEventsThisMonth.filter(e => watchlistTickers.has(e.ticker)).length;
    return { totalEarnings, totalIpos, watchlistMatch };
  }, [viewMode, weekEvents, earnings, ipos, allEventsThisMonth, watchlistTickers]);

  const todayKey = toKey(new Date());

  // Generate calendar grid cells (42 days)
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

  // Timeline list events (grouped by date)
  const timelineGrouped = useMemo(() => {
    // If selectedDate is set, show only that day. Otherwise, show all filtered events
    const sourceDates = selectedDate ? [selectedDate] : Object.keys(byDate).sort();
    return sourceDates.map(dateKey => {
      const events = byDate[dateKey] || [];
      return {
        date: dateKey,
        events: events.sort((a, b) => a.ticker.localeCompare(b.ticker))
      };
    }).filter(group => group.events.length > 0);
  }, [byDate, selectedDate]);

  // (weekEvents moved up before stats)

  const getWeekEndDate = () => {
    const end = new Date(weekCursor);
    end.setDate(end.getDate() + 4); // Friday
    return end;
  };

  return (
    <div style={{ padding: '24px' }}>
      
      {/* 1. Terminal style Header */}
      <div style={{ border: '1px solid var(--ws-border)', background: 'var(--ws-bg-1)', marginBottom: '20px', overflow: 'hidden' }}>
        <div style={{ background: 'var(--ws-bg-2)', borderBottom: '1px solid var(--ws-border)', padding: '7px 16px' }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: 'var(--ws-accent)', fontWeight: 700, letterSpacing: '1px' }}>
            $ traq calendar --interactive
          </span>
        </div>
        <div style={{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--ws-text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Market Calendar</span>
              <span style={{ fontSize: '11px', background: 'var(--ws-accent-dim)', color: 'var(--ws-accent)', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>LIVE</span>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--ws-text-2)', marginTop: '4px' }}>Track scheduled earnings releases, expected analyst updates, and upcoming IPOs.</div>
          </div>
          
          {/* Month/Week controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button onClick={() => {
                if (viewMode === 'month') {
                  setCursor(c => shiftMonth(c, -1));
                } else {
                  const next = new Date(weekCursor);
                  next.setDate(next.getDate() - 7);
                  setWeekCursor(next);
                }
              }}
              className="ctrl-btn"
              style={{ width: '32px', height: '32px', border: '1px solid var(--ws-border)', background: 'var(--ws-bg-1)', color: 'var(--ws-text)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', transition: 'all 0.15s ease' }}>
              ‹
            </button>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ws-text)', width: '220px', textAlign: 'center', letterSpacing: '0.3px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {viewMode === 'month' ? (
                <span>{MONTH_NAMES[cursor.getMonth()]} {cursor.getFullYear()}</span>
              ) : (
                <>
                  <span style={{ fontSize: '12px', color: 'var(--ws-text-3)', marginBottom: '2px' }}>Earnings This Week</span>
                  <span>{MONTH_NAMES[weekCursor.getMonth()].slice(0, 3)} {weekCursor.getDate()} - {MONTH_NAMES[getWeekEndDate().getMonth()].slice(0, 3)} {getWeekEndDate().getDate()}</span>
                </>
              )}
            </div>
            <button onClick={() => {
                if (viewMode === 'month') {
                  setCursor(c => shiftMonth(c, 1));
                } else {
                  const next = new Date(weekCursor);
                  next.setDate(next.getDate() + 7);
                  setWeekCursor(next);
                }
              }}
              className="ctrl-btn"
              style={{ width: '32px', height: '32px', border: '1px solid var(--ws-border)', background: 'var(--ws-bg-1)', color: 'var(--ws-text)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', transition: 'all 0.15s ease' }}>
              ›
            </button>
            <button onClick={() => {
                const now = new Date();
                if (viewMode === 'month') {
                  setCursor(startOfMonth(now));
                  setSelectedDate(null);
                } else {
                  const day = now.getDay();
                  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
                  setWeekCursor(new Date(now.setDate(diff)));
                }
              }}
              className="ctrl-btn"
              style={{ padding: '0 14px', height: '32px', border: '1px solid var(--ws-border)', background: 'var(--ws-bg-1)', color: 'var(--ws-text-2)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', borderRadius: '4px', transition: 'all 0.15s ease' }}>
              Today
            </button>
          </div>
        </div>
      </div>

      {/* 2. Institutional Quick Stats Grid */}
      <div className="calendar-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        <div style={{ border: '1px solid var(--ws-border)', background: 'var(--ws-bg-1)', padding: '16px', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '10px', color: 'var(--ws-text-3)', fontWeight: 700, letterSpacing: '0.5px', marginBottom: '4px' }}>
              {viewMode === 'week' ? 'EARNINGS THIS WEEK' : 'EARNINGS THIS MONTH'}
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--ws-text)' }}>{earnings === null ? '—' : stats.totalEarnings}</div>
            <div style={{ fontSize: '11px', color: 'var(--ws-text-2)', marginTop: '2px' }}>Companies reporting</div>
          </div>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'rgba(20, 184, 166, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ws-accent)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
          </div>
        </div>
        <div style={{ border: '1px solid var(--ws-border)', background: 'var(--ws-bg-1)', padding: '16px', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '10px', color: 'var(--ws-text-3)', fontWeight: 700, letterSpacing: '0.5px', marginBottom: '4px' }}>UPCOMING IPOS</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#7c6fe0' }}>{earnings === null ? '—' : stats.totalIpos}</div>
            <div style={{ fontSize: '11px', color: 'var(--ws-text-2)', marginTop: '2px' }}>New stock listings scheduled</div>
          </div>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'rgba(124, 111, 224, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7c6fe0' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
          </div>
        </div>
        <div style={{ border: '1px solid var(--ws-border)', background: 'var(--ws-bg-1)', padding: '16px', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '10px', color: 'var(--ws-text-3)', fontWeight: 700, letterSpacing: '0.5px', marginBottom: '4px' }}>WATCHLIST EVENTS</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--ws-accent)' }}>{earnings === null ? '—' : stats.watchlistMatch}</div>
            <div style={{ fontSize: '11px', color: 'var(--ws-text-2)', marginTop: '2px' }}>Matching your watchlisted tickers</div>
          </div>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'var(--ws-accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ws-accent)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
          </div>
        </div>
      </div>

      {/* 3. Filter and Search Bar */}
      <div style={{ border: '1px solid var(--ws-border)', background: 'var(--ws-bg-1)', padding: '14px 18px', display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', borderRadius: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '260px' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--ws-text-3)' }}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input type="text" placeholder="Search by ticker or company name..."
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            style={{ width: '100%', background: 'none', border: 'none', color: 'var(--ws-text)', fontSize: '13px', outline: 'none' }} />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')}
              style={{ background: 'none', border: 'none', color: 'var(--ws-text-3)', cursor: 'pointer', fontSize: '12px' }}>✕</button>
          )}
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Market Cap & Sector Filters */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <select value={marketCapFilter} onChange={e => setMarketCapFilter(e.target.value)}
              style={{ background: 'var(--ws-bg-2)', border: '1px solid var(--ws-border)', color: 'var(--ws-text)', fontSize: '11px', fontWeight: 600, padding: '4px 8px', borderRadius: '4px', outline: 'none', cursor: 'pointer' }}>
              <option value="all">All Sizes</option>
              <option value="mega">Mega Cap (&gt;$200B)</option>
              <option value="large">Large Cap ($10B-$200B)</option>
              <option value="mid">Mid Cap ($2B-$10B)</option>
              <option value="small">Small Cap (&lt;$2B)</option>
            </select>
            
            <select value={sectorFilter} onChange={e => setSectorFilter(e.target.value)}
              style={{ background: 'var(--ws-bg-2)', border: '1px solid var(--ws-border)', color: 'var(--ws-text)', fontSize: '11px', fontWeight: 600, padding: '4px 8px', borderRadius: '4px', outline: 'none', cursor: 'pointer', maxWidth: '140px' }}>
              <option value="all">All Sectors</option>
              {availableSectors.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* View toggle */}
          <div style={{ display: 'flex', border: '1px solid var(--ws-border)', borderRadius: '4px', overflow: 'hidden' }}>
            <button onClick={() => setViewMode('month')}
              style={{ border: 'none', height: '28px', padding: '0 12px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', background: viewMode === 'month' ? 'var(--ws-accent)' : 'var(--ws-bg-2)', color: viewMode === 'month' ? 'var(--ws-bg-1)' : 'var(--ws-text-2)', transition: 'all 0.15s ease' }}>
              Month View
            </button>
            <button onClick={() => setViewMode('week')}
              style={{ border: 'none', height: '28px', padding: '0 12px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', background: viewMode === 'week' ? 'var(--ws-accent)' : 'var(--ws-bg-2)', color: viewMode === 'week' ? 'var(--ws-bg-1)' : 'var(--ws-text-2)', transition: 'all 0.15s ease' }}>
              Weekly Grid
            </button>
          </div>

          {/* Event type pills */}
          <div style={{ display: 'flex', border: '1px solid var(--ws-border)', borderRadius: '4px', overflow: 'hidden' }}>
            <button onClick={() => setTypeFilter('all')}
              style={{ border: 'none', height: '28px', padding: '0 12px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', background: typeFilter === 'all' ? 'var(--ws-accent)' : 'var(--ws-bg-2)', color: typeFilter === 'all' ? 'var(--ws-bg-1)' : 'var(--ws-text-2)', transition: 'all 0.15s ease' }}>
              All Events
            </button>
            <button onClick={() => setTypeFilter('earnings')}
              style={{ border: 'none', height: '28px', padding: '0 12px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', background: typeFilter === 'earnings' ? 'var(--ws-accent)' : 'var(--ws-bg-2)', color: typeFilter === 'earnings' ? 'var(--ws-bg-1)' : 'var(--ws-text-2)', transition: 'all 0.15s ease' }}>
              Earnings
            </button>
            <button onClick={() => setTypeFilter('ipos')}
              style={{ border: 'none', height: '28px', padding: '0 12px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', background: typeFilter === 'ipos' ? 'var(--ws-accent)' : 'var(--ws-bg-2)', color: typeFilter === 'ipos' ? 'var(--ws-bg-1)' : 'var(--ws-text-2)', transition: 'all 0.15s ease' }}>
              IPOs
            </button>
          </div>

          {/* Watchlist toggle */}
          {isSignedIn && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--ws-text-2)', cursor: 'pointer', userSelect: 'none', background: 'var(--ws-bg-2)', padding: '4px 10px', borderRadius: '4px', border: '1px solid var(--ws-border)' }}>
              <input type="checkbox" checked={watchlistOnly} onChange={e => setWatchlistOnly(e.target.checked)}
                style={{ accentColor: 'var(--ws-accent)', cursor: 'pointer' }} />
              Watchlist only
            </label>
          )}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px', paddingLeft: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--ws-text-3)', fontWeight: 600 }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: 'var(--ws-accent)', display: 'inline-block' }} />
          Earnings Release
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--ws-text-3)', fontWeight: 600 }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#7c6fe0', display: 'inline-block' }} />
          IPO Schedule
        </div>
      </div>

      {/* 4. Main Dual Grid Layout OR Weekly Grid */}
      {viewMode === 'week' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', alignItems: 'stretch' }}>
          {weekEvents.map((dayGroup, i) => (
            <div key={dayGroup.dateStr} style={{ border: '1px solid var(--ws-border)', background: 'var(--ws-bg-1)', borderRadius: '4px', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '720px' }}>
              {/* Column Header */}
              <div style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid var(--ws-border)', background: 'var(--ws-bg-2)', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '4px' }}>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: dayGroup.dateStr === todayKey ? 'var(--ws-accent)' : 'var(--ws-text)' }}>
                    {dayGroup.dateObj.getDate()}
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ws-text)', textTransform: 'uppercase' }}>
                    {DAY_NAMES[dayGroup.dateObj.getDay()]}
                  </div>
                </div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--ws-text-3)' }}>
                  {dayGroup.bmo.length + dayGroup.amc.length + dayGroup.other.length} events
                </div>
              </div>

              <div className="custom-scroll" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', flex: 1 }}>
                {/* Other/Unspecified */}
                {dayGroup.other.length > 0 && (
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--ws-text-3)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                      Time TBD
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(44px, 1fr))', gap: '6px' }}>
                      {dayGroup.other.map(e => (
                        <div key={e.ticker} className="weekly-stock-tile" title={`${e.ticker}${e.name ? ` - ${e.name}` : ''}`} onClick={() => openInNewTab(`/stock/${e.ticker}`)}
                          style={{ background: 'var(--ws-bg-2)', border: '1px solid var(--ws-border)', borderRadius: '4px', padding: '4px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                          <StockLogo ticker={e.ticker} size={28} />
                          <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--ws-text)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', width: '100%', textAlign: 'center' }}>
                            {e.ticker}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Before Open */}
                <div>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--ws-text-3)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    Before Open
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(44px, 1fr))', gap: '6px' }}>
                    {dayGroup.bmo.map(e => (
                      <div key={e.ticker} className="weekly-stock-tile" title={`${e.ticker}${e.name ? ` - ${e.name}` : ''}`} onClick={() => openInNewTab(`/stock/${e.ticker}`)}
                        style={{ background: 'var(--ws-bg-2)', border: '1px solid var(--ws-border)', borderRadius: '4px', padding: '4px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        <StockLogo ticker={e.ticker} size={28} />
                        <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--ws-text)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', width: '100%', textAlign: 'center' }}>
                          {e.ticker}
                        </div>
                      </div>
                    ))}
                    {dayGroup.bmo.length === 0 && (
                      <div style={{ fontSize: '11px', color: 'var(--ws-text-3)', padding: '4px', fontStyle: 'italic', gridColumn: '1 / -1' }}>None</div>
                    )}
                  </div>
                </div>

                {/* After Close */}
                <div>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--ws-text-3)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
                    After Close
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(44px, 1fr))', gap: '6px' }}>
                    {dayGroup.amc.map(e => (
                      <div key={e.ticker} className="weekly-stock-tile" title={`${e.ticker}${e.name ? ` - ${e.name}` : ''}`} onClick={() => openInNewTab(`/stock/${e.ticker}`)}
                        style={{ background: 'var(--ws-bg-2)', border: '1px solid var(--ws-border)', borderRadius: '4px', padding: '4px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        <StockLogo ticker={e.ticker} size={28} />
                        <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--ws-text)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', width: '100%', textAlign: 'center' }}>
                          {e.ticker}
                        </div>
                      </div>
                    ))}
                    {dayGroup.amc.length === 0 && (
                      <div style={{ fontSize: '11px', color: 'var(--ws-text-3)', padding: '4px', fontStyle: 'italic', gridColumn: '1 / -1' }}>None</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
      <div className="calendar-main-grid" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', alignItems: 'start' }}>
        
        {/* Left Side: Monthly Grid view */}
        <div style={{ border: '1px solid var(--ws-border)', background: 'var(--ws-bg-1)', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--ws-border)', background: 'var(--ws-bg-2)' }}>
            {DAY_NAMES.map(d => (
              <div key={d} style={{ padding: '10px 8px', fontSize: '11px', fontWeight: 700, color: 'var(--ws-text-2)', textAlign: 'center', letterSpacing: '0.5px' }}>{d}</div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {cells.map((d, i) => {
              const key = toKey(d);
              const inMonth = d.getMonth() === cursor.getMonth();
              const dayData = byDate[key] || [];
              const isToday = key === todayKey;
              const isSelected = key === selectedDate;
              const hasEvents = dayData.length > 0;

              return (
                <div key={i} onClick={() => hasEvents && setSelectedDate(isSelected ? null : key)}
                  style={{
                    minHeight: '94px',
                    padding: '8px',
                    borderRight: (i + 1) % 7 !== 0 ? '1px solid var(--ws-border)' : 'none',
                    borderBottom: i < 35 ? '1px solid var(--ws-border)' : 'none',
                    background: isSelected ? 'var(--ws-accent-dim)' : 'transparent',
                    cursor: hasEvents ? 'pointer' : 'default',
                    opacity: inMonth ? 1 : 0.3,
                    transition: 'all 0.15s ease',
                    position: 'relative'
                  }}
                  className={`calendar-cell ${hasEvents ? 'clickable-cell' : ''} ${isSelected ? 'selected-cell' : ''}`}>
                  
                  {/* Day number */}
                  <div style={{
                    fontSize: '11px',
                    fontWeight: isToday ? 800 : 600,
                    color: isToday ? 'var(--ws-accent)' : 'var(--ws-text-2)',
                    marginBottom: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: isToday ? 'var(--ws-accent-dim)' : 'transparent',
                    border: isToday ? '1px solid var(--ws-accent)' : 'none'
                  }}>
                    {d.getDate()}
                  </div>

                  {/* Day mini events */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {dayData.slice(0, 3).map((e, j) => (
                      <div key={j} style={{
                        fontSize: '9px',
                        fontWeight: 700,
                        color: e.type === 'ipo' ? '#7c6fe0' : 'var(--ws-accent)',
                        background: e.type === 'ipo' ? 'rgba(124, 111, 224, 0.08)' : 'var(--ws-accent-dim)',
                        borderRadius: '3px',
                        padding: '2px 5px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        borderLeft: `2px solid ${e.type === 'ipo' ? '#7c6fe0' : 'var(--ws-accent)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <span>{e.ticker}</span>
                        {watchlistTickers.has(e.ticker) && <span style={{ color: '#d99a4e', fontSize: '7px' }}>★</span>}
                      </div>
                    ))}
                    {dayData.length > 3 && (
                      <div style={{ fontSize: '9px', color: 'var(--ws-text-3)', fontWeight: 600, paddingLeft: '4px', marginTop: '2px' }}>
                        +{dayData.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side: Timeline / Detailed List view */}
        <div style={{ border: '1px solid var(--ws-border)', background: 'var(--ws-bg-1)', borderRadius: '4px', padding: '18px', maxHeight: '680px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          
          {/* Selected Date indicator header */}
          <div style={{ borderBottom: '1px solid var(--ws-border)', paddingBottom: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ws-text)' }}>
                {selectedDate ? 'Selected Schedule' : 'Schedule Feed'}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--ws-text-3)' }}>
                {selectedDate 
                  ? `${new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}`
                  : `${filteredEvents.length} events scheduled in this viewport`
                }
              </div>
            </div>
            {selectedDate && (
              <button onClick={() => setSelectedDate(null)}
                style={{ background: 'none', border: '1px solid var(--ws-border)', color: 'var(--ws-text-2)', cursor: 'pointer', fontSize: '10px', fontWeight: 600, padding: '4px 8px', borderRadius: '4px' }}>
                Show Month Feed
              </button>
            )}
          </div>

          {/* Loading state */}
          {earnings === null ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--ws-text-3)', fontSize: '13px' }}>
              <div className="spinner" style={{ width: '20px', height: '20px', border: '2px solid var(--ws-border)', borderTopColor: 'var(--ws-accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 10px' }} />
              Loading calendar events...
            </div>
          ) : timelineGrouped.length === 0 ? (
            <div style={{ padding: '60px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'var(--ws-text-3)', fontSize: '13px' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '12px', color: 'var(--ws-text-3)' }}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
              <div>No events scheduled for the current selection.</div>
              {watchlistOnly && <div style={{ fontSize: '11px', color: 'var(--ws-text-3)', marginTop: '4px' }}>Try switching off the "Watchlist only" filter.</div>}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {timelineGrouped.map(group => (
                <div key={group.date}>
                  {/* Group Date Header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '2px 0', marginBottom: '8px', position: 'sticky', top: '0', background: 'var(--ws-bg-1)', zIndex: 1 }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ws-text)', letterSpacing: '0.3px', background: 'var(--ws-bg-2)', padding: '3px 8px', borderRadius: '4px' }}>
                      {new Date(group.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </div>
                    {group.date === todayKey && (
                      <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--ws-bg-1)', background: 'var(--ws-accent)', padding: '2px 6px', borderRadius: '3px' }}>TODAY</span>
                    )}
                    <div style={{ flex: 1, height: '1px', background: 'var(--ws-border)' }} />
                  </div>

                  {/* Group Items Stack */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {group.events.map((e, index) => {
                      const isWatchlisted = watchlistTickers.has(e.ticker);
                      return (
                        <div key={e.type + e.ticker + index}
                          onClick={() => openInNewTab(`/stock/${e.ticker}`)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '10px 12px',
                            cursor: 'pointer',
                            border: '1px solid var(--ws-border)',
                            background: 'var(--ws-bg-1)',
                            borderRadius: '4px',
                            transition: 'all 0.15s ease',
                          }}
                          className="timeline-item-card">
                          
                          {/* Logo */}
                          <StockLogo ticker={e.ticker} size={28} />

                          {/* Info */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ws-text)' }}>{e.ticker}</span>
                              <span style={{
                                fontSize: '8px',
                                fontWeight: 700,
                                color: e.type === 'ipo' ? '#7c6fe0' : 'var(--ws-accent)',
                                background: e.type === 'ipo' ? 'rgba(124, 111, 224, 0.08)' : 'var(--ws-accent-dim)',
                                padding: '1px 5px',
                                borderRadius: '3px',
                                textTransform: 'uppercase'
                              }}>
                                {e.type === 'ipo' ? 'IPO' : 'EARN'}
                              </span>
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--ws-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '1px' }}>
                              {e.type === 'ipo' ? e.name : (e.hour === 'bmo' ? 'Before Open' : e.hour === 'amc' ? 'After Close' : 'Time TBD')}
                              {e.source === 'nasdaq' && <span title="Not yet confirmed by our primary data source — estimated date"> · Est. date</span>}
                            </div>
                          </div>

                          {/* Metric info */}
                          {e.type === 'earnings' && e.epsEstimate != null && (
                            <div style={{ textAlign: 'right', marginRight: '6px' }}>
                              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ws-text)' }}>${e.epsEstimate.toFixed(2)}</div>
                              <div style={{ fontSize: '8px', color: 'var(--ws-text-3)', fontWeight: 600 }}>EST. EPS</div>
                            </div>
                          )}
                          {e.type === 'ipo' && e.price && (
                            <div style={{ textAlign: 'right', marginRight: '6px' }}>
                              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ws-text)' }}>${e.price}</div>
                              <div style={{ fontSize: '8px', color: 'var(--ws-text-3)', fontWeight: 600 }}>IPO PRICE</div>
                            </div>
                          )}

                          {/* Star Watchlist Action Button */}
                          <button onClick={(event) => handleToggleWatchlist(event, e.ticker)}
                            disabled={togglingWatchlist === e.ticker}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: isWatchlisted ? '#d99a4e' : 'var(--ws-text-3)',
                              cursor: 'pointer',
                              fontSize: '15px',
                              padding: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'transform 0.15s ease'
                            }}
                            className="star-btn"
                            title={isWatchlisted ? "Remove from watchlist" : "Add to watchlist"}>
                            {isWatchlisted ? '★' : '☆'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .custom-scroll::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scroll::-webkit-scrollbar-thumb {
          background: var(--ws-border);
          border-radius: 4px;
        }
        .custom-scroll::-webkit-scrollbar-thumb:hover {
          background: var(--ws-text-3);
        }
        .ctrl-btn:hover {
          background: var(--ws-bg-2) !important;
          border-color: var(--ws-accent) !important;
        }
        .clickable-cell:hover {
          background: var(--ws-bg-2) !important;
          border-color: var(--ws-border) !important;
        }
        .selected-cell {
          border: 1px solid var(--ws-accent) !important;
        }
        .timeline-item-card:hover {
          background: var(--ws-bg-2) !important;
          border-color: var(--ws-accent) !important;
          transform: translateX(2px);
        }
        .weekly-stock-tile:hover {
          background: var(--ws-bg-3) !important;
          border-color: var(--ws-accent) !important;
          transform: translateY(-2px);
          transition: all 0.15s ease;
        }
        .star-btn:hover {
          transform: scale(1.2);
          color: #d99a4e !important;
        }
        @media (max-width: 1023px) {
          .calendar-main-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
