// Market open/closed/pre/post status computed purely from real trading-hour schedules —
// deliberately NOT sourced from Finnhub/Yahoo's live "marketState" field, since both have
// shown they can silently freeze and keep reporting stale data for an entire session.
// Approximate only: doesn't account for local market holidays.

const EXCHANGES = {
  // suffix -> { tz, open, close } in minutes-from-midnight, local exchange time. No pre/post
  // market session is modeled for non-US exchanges since it's not commonly traded/reported.
  L:  { tz: 'Europe/London',    open: 8 * 60,        close: 16 * 60 + 30 },
  AS: { tz: 'Europe/Amsterdam', open: 9 * 60,        close: 17 * 60 + 30 },
  PA: { tz: 'Europe/Paris',     open: 9 * 60,        close: 17 * 60 + 30 },
  DE: { tz: 'Europe/Berlin',    open: 9 * 60,        close: 17 * 60 + 30 },
  T:  { tz: 'Asia/Tokyo',       open: 9 * 60,        close: 15 * 60 },
  HK: { tz: 'Asia/Hong_Kong',   open: 9 * 60 + 30,   close: 16 * 60 },
};

// US market (default for any ticker with no recognized suffix) — NASDAQ/NYSE hours,
// including the standard pre-market and after-hours windows.
const US = { tz: 'America/New_York', preOpen: 4 * 60, open: 9 * 60 + 30, close: 16 * 60, postClose: 20 * 60 };

function minutesInTZ(tz, date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(date);
  const h = Number(parts.find(p => p.type === 'hour').value);
  const m = Number(parts.find(p => p.type === 'minute').value);
  return h * 60 + m;
}

function weekdayInTZ(tz, date) {
  // en-US short weekday, e.g. "Mon" — map to 0(Sun)-6(Sat) equivalent for a simple weekend check.
  const day = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(date);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(day);
}

/**
 * Returns 'open' | 'closed' | 'pre' | 'post' for a given ticker, based on wall-clock time
 * right now versus that market's known trading hours. Non-US tickers (identified by a
 * ".SUFFIX" in the ticker, e.g. "LLOY.L") only ever return 'open'/'closed'.
 */
export function getMarketStatus(ticker, now = new Date()) {
  const suffix = ticker?.includes('.') ? ticker.split('.').pop().toUpperCase() : null;
  const market = suffix && EXCHANGES[suffix];

  if (market) {
    const day = weekdayInTZ(market.tz, now);
    if (day === 0 || day === 6) return 'closed';
    const mins = minutesInTZ(market.tz, now);
    return mins >= market.open && mins < market.close ? 'open' : 'closed';
  }

  const day = weekdayInTZ(US.tz, now);
  if (day === 0 || day === 6) return 'closed';
  const mins = minutesInTZ(US.tz, now);
  if (mins >= US.preOpen && mins < US.open) return 'pre';
  if (mins >= US.open && mins < US.close) return 'open';
  if (mins >= US.close && mins < US.postClose) return 'post';
  return 'closed';
}

export const MARKET_STATUS_META = {
  open:   { color: '#10b981', label: 'OPEN' },
  closed: { color: '#ef4444', label: 'CLOSED' },
  pre:    { color: '#f59e0b', label: 'PRE-MARKET' },
  post:   { color: '#1e3a8a', label: 'AFTER-HOURS' },
};
