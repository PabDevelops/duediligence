const FH_KEY = 'd8he51pr01qgcfbpbuo0d8he51pr01qgcfbpbuog';

export async function GET() {
  try {
    const today = new Date();
    const from = today.toISOString().slice(0, 10);
    const to = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const res = await fetch(
      `https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${to}&token=${FH_KEY}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    const data = await res.json();
    const earnings = (data.earningsCalendar || [])
      .filter(e => e.symbol && e.date)
      .slice(0, 20)
      .map(e => ({
        ticker: e.symbol,
        date: e.date,
        epsEstimate: e.epsEstimate,
        hour: e.hour,
      }));

    return Response.json({ earnings });
  } catch (e) {
    return Response.json({ earnings: [] });
  }
}