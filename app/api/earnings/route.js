import { supabase } from '../../../lib/supabase';

const FH_KEY = 'd8he51pr01qgcfbpbuo0d8he51pr01qgcfbpbuog';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const today = new Date();
    const ticker = searchParams.get('ticker')?.toUpperCase();

    if (ticker) {
      const from = searchParams.get('from') || new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const to = searchParams.get('to') || new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      const fhRes = await fetch(`https://finnhub.io/api/v1/calendar/earnings?symbol=${ticker}&from=${from}&to=${to}&token=${FH_KEY}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      }).then(r => r.json());

      const earnings = (fhRes.earningsCalendar || [])
        .filter(e => e.symbol === ticker && e.date)
        .map(e => ({
          ticker: e.symbol,
          date: e.date,
          epsEstimate: e.epsEstimate,
          hour: e.hour,
        }));

      return Response.json({ earnings });
    }

    const from = searchParams.get('from') || today.toISOString().slice(0, 10);
    const to = searchParams.get('to') || new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const [fhRes, ipoRes, coverage] = await Promise.all([
      fetch(`https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${to}&token=${FH_KEY}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      }).then(r => r.json()),
      fetch(`https://finnhub.io/api/v1/calendar/ipo?from=${from}&to=${to}&token=${FH_KEY}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      }).then(r => r.json()).catch(() => ({})),
      supabase.from('stock_cache').select('ticker'),
    ]);

    const covered = new Set((coverage.data || []).map(r => r.ticker));

    const earnings = (fhRes.earningsCalendar || [])
      .filter(e => e.symbol && e.date && covered.has(e.symbol))
      .map(e => ({
        ticker: e.symbol,
        date: e.date,
        epsEstimate: e.epsEstimate,
        hour: e.hour,
      }));

    const ipos = (ipoRes.ipoCalendar || [])
      .filter(e => e.symbol && e.date)
      .map(e => ({
        ticker: e.symbol,
        date: e.date,
        name: e.name,
        exchange: e.exchange,
        price: e.price,
        numberOfShares: e.numberOfShares,
      }));

    return Response.json({ earnings, ipos });
  } catch (e) {
    return Response.json({ earnings: [] });
  }
}
