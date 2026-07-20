'use client';
import { fmt } from '../../../../lib/formatters';

const TIER_ORDER = ['micro', 'small', 'mid', 'large', 'mega'];

// Who moved between market-cap tiers over the trailing ~30 days (app/api/small-caps/radar/
// route.js compares today's market_cap_snapshots row against the nearest one 25-35 days back).
// This table only exists from the moment app/api/admin/refresh-small-cap-radar/route.js's daily
// cron started running — trackingSince tells the page how far back it can actually see, and the
// panel says so explicitly rather than showing a silently-empty "no migrations" state that looks
// identical to "nothing happened" and "we have no history yet."
export default function TierMigrationPanel({ migrations, trackingSince, daysTracking, loading, onSelect }) {
  const up = (migrations || []).filter(m => TIER_ORDER.indexOf(m.to) > TIER_ORDER.indexOf(m.from));
  const down = (migrations || []).filter(m => TIER_ORDER.indexOf(m.to) < TIER_ORDER.indexOf(m.from));

  const isEarly = (daysTracking ?? 0) < 25;

  const Row = ({ m, positive }) => (
    <div key={m.ticker} onClick={() => onSelect(m.ticker)} style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 14px',
      cursor: 'pointer', borderBottom: '1px solid var(--ws-border)',
    }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--ws-bg-2)'}
      onMouseLeave={e => e.currentTarget.style.background = 'none'}
    >
      <span style={{ fontWeight: 800, fontSize: '11px' }}>{m.ticker}</span>
      <span style={{ fontSize: '10px', color: positive ? 'var(--ws-accent)' : 'var(--ws-red)', fontWeight: 700 }}>
        {m.from.toUpperCase()} → {m.to.toUpperCase()} · {fmt(m.marketCapNow)}
      </span>
    </div>
  );

  return (
    <div style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', overflow: 'hidden' }}>
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--ws-border)' }}>
        <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--ws-accent)', letterSpacing: '1px' }}>TIER MIGRATION</span>
      </div>
      {loading ? (
        <div style={{ padding: '30px 16px', textAlign: 'center', color: 'var(--ws-text-3)', fontSize: '11px' }}>Loading…</div>
      ) : isEarly ? (
        <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--ws-text-3)', fontSize: '11px', lineHeight: 1.6 }}>
          Tracking since {trackingSince || 'today'} — tier migrations need ~30 days of history to show up. Check back soon.
        </div>
      ) : up.length === 0 && down.length === 0 ? (
        <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--ws-text-3)', fontSize: '11px' }}>No tier changes in the last 30 days.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
          <div style={{ borderRight: '1px solid var(--ws-border)' }}>
            <div style={{ padding: '6px 14px', fontSize: '9px', fontWeight: 800, color: 'var(--ws-accent)', letterSpacing: '1px' }}>GRADUATED ▲</div>
            {up.length === 0 ? <div style={{ padding: '10px 14px', fontSize: '10px', color: 'var(--ws-text-3)' }}>None</div> : up.map(m => <Row key={m.ticker} m={m} positive />)}
          </div>
          <div>
            <div style={{ padding: '6px 14px', fontSize: '9px', fontWeight: 800, color: 'var(--ws-red)', letterSpacing: '1px' }}>SLIPPED ▼</div>
            {down.length === 0 ? <div style={{ padding: '10px 14px', fontSize: '10px', color: 'var(--ws-text-3)' }}>None</div> : down.map(m => <Row key={m.ticker} m={m} positive={false} />)}
          </div>
        </div>
      )}
    </div>
  );
}
