'use client';
import { useState, useEffect } from 'react';

// Dynamic Corporate & Economic Calendar Component
export default function EconomicCalendar({ triggerSpotlight }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date();
    const fromStr = today.toISOString().slice(0, 10);
    // Fetch events for the next 14 days to make sure we always have enough data
    const nextTwoWeeks = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
    const toStr = nextTwoWeeks.toISOString().slice(0, 10);

    fetch(`/api/earnings?from=${fromStr}&to=${toStr}`)
      .then(r => r.json())
      .then(d => {
        const list = [];
        (d.earnings || []).forEach(e => {
          list.push({
            ticker: e.ticker,
            type: 'EARNINGS',
            date: e.date,
            time: e.hour === 'bmo' ? 'Before Open' : e.hour === 'amc' ? 'After Close' : 'TBD',
            badge: 'EARN',
            color: 'var(--ws-accent)',
            bgColor: 'var(--ws-accent-dim)',
            metricLabel: 'Est. EPS: ',
            metricValue: e.epsEstimate != null ? `$${e.epsEstimate}` : 'TBD'
          });
        });
        (d.ipos || []).forEach(i => {
          list.push({
            ticker: i.ticker,
            type: 'IPO',
            date: i.date,
            time: i.exchange || 'TBD',
            badge: 'IPO',
            color: '#7c6fe0', // distinct purple used only for IPO badges, intentionally outside the --ws-* accent palette
            bgColor: '#7c6fe014',
            metricLabel: 'Price: ',
            metricValue: i.price ? `$${i.price}` : 'TBD'
          });
        });
        // Sort chronologically
        list.sort((a, b) => new Date(a.date) - new Date(b.date));
        setEvents(list.slice(0, 4));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px', height: '100%', boxSizing: 'border-box' }}>
      <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--ws-accent)', letterSpacing: '1px', borderBottom: '1px solid var(--ws-border)', paddingBottom: '8px' }}>
        CORPORATE CALENDAR
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, justifyContent: 'center' }}>
        {loading ? (
          <div style={{ fontSize: '11px', color: 'var(--ws-text-3)', textAlign: 'center', padding: '20px 0' }}>Loading calendar…</div>
        ) : events.length === 0 ? (
          <div style={{ fontSize: '11px', color: 'var(--ws-text-3)', textAlign: 'center', padding: '20px 0' }}>No upcoming earnings or IPOs.</div>
        ) : (
          events.map((e, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', borderBottom: i < events.length - 1 ? '1px dashed var(--ws-border)' : 'none', paddingBottom: '6px', paddingTop: '4px' }}>
              <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '8px', fontWeight: 800, color: e.color, background: e.bgColor, padding: '2px 4px', borderRadius: '3px', flexShrink: 0 }}>
                  {e.badge}
                </span>
                <span
                  onClick={() => triggerSpotlight(e.ticker)}
                  style={{ fontWeight: 800, cursor: 'pointer', color: 'var(--ws-text)' }}
                  onMouseEnter={ev => ev.currentTarget.style.color = 'var(--ws-accent)'}
                  onMouseLeave={ev => ev.currentTarget.style.color = 'var(--ws-text)'}
                >
                  {e.ticker}
                </span>
              </div>
              <div style={{ textAlign: 'right', fontSize: '10px', flexShrink: 0 }}>
                <span className="text-ws-text-3">{e.metricLabel}</span><b style={{ color: 'var(--ws-text)' }}>{e.metricValue}</b>
                <div style={{ fontSize: '8px', color: 'var(--ws-text-3)', marginTop: '2px' }}>
                  {new Date(e.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {e.time}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
