// Builds a Google Calendar "quick add" link for an earnings event. Earnings are reported
// before/after market rather than at a known clock time, so this creates an all-day event
// instead of guessing an hour.
function toGoogleDateKey(date) {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
}

export function buildEarningsCalendarUrl({ ticker, name, date, hour }) {
  const start = new Date(date + 'T00:00:00');
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const timeLabel = hour === 'bmo' ? 'before market open' : hour === 'amc' ? 'after market close' : 'at an unconfirmed time';
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${ticker} Earnings Report`,
    dates: `${toGoogleDateKey(start)}/${toGoogleDateKey(end)}`,
    details: `${name ? `${name} (${ticker})` : ticker} is expected to report earnings ${timeLabel}.`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
