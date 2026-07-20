// Fallback earnings-calendar source for tickers Finnhub's calendar/earnings doesn't cover
// (thin coverage for foreign private issuers / 20-F filers like Nokia). Unlike Yahoo's
// quoteSummary endpoints, this one needs no session cookie/crumb handshake, so it isn't
// blocked from Vercel's datacenter IPs the way Yahoo's crumb-gated endpoints are — Yahoo
// returns 401 "Invalid Cookie" for the getcrumb handshake itself when called from cloud IPs,
// which is why the earnings fallback worked on localhost but not in production.
//
// The endpoint only accepts a single `date`, not a range, so a multi-day window means one
// request per day. Requests are batched (not all fired at once) to stay polite to Nasdaq's
// Akamai-fronted API.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const BATCH_SIZE = 10;

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function fetchNasdaqEarningsForDate(dateStr) {
  try {
    const res = await fetch(`https://api.nasdaq.com/api/calendar/earnings?date=${dateStr}`, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
    });
    if (!res.ok) return [];
    const json = await res.json();
    const rows = json?.data?.rows || [];
    return rows
      .filter(r => r.symbol)
      .map(r => ({
        ticker: r.symbol,
        date: dateStr,
        epsEstimate: r.epsForecast && r.epsForecast !== 'N/A' ? parseFloat(r.epsForecast.replace(/[^0-9.-]/g, '')) || null : null,
        hour: r.time === 'time-pre-market' ? 'bmo' : r.time === 'time-after-hours' ? 'amc' : null,
        source: 'nasdaq',
      }));
  } catch {
    return [];
  }
}

// Capped so a wide/bad date range can't fan out into hundreds of requests — 60 days is
// enough to catch the next quarterly report for practically any ticker.
export async function fetchNasdaqEarningsRange(from, to, maxDays = 60) {
  const dates = [];
  const d = new Date(from + 'T00:00:00');
  const end = new Date(to + 'T00:00:00');
  while (d <= end && dates.length < maxDays) {
    dates.push(toDateStr(d));
    d.setDate(d.getDate() + 1);
  }

  const all = [];
  for (let i = 0; i < dates.length; i += BATCH_SIZE) {
    const batch = dates.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map(fetchNasdaqEarningsForDate));
    all.push(...batchResults.flat());
  }
  return all;
}
