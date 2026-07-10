import { supabase } from '../../../lib/supabase';

const FH_KEY = process.env.FINNHUB_API_KEY;

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

    const fromDate = new Date(from + 'T00:00:00');
    const toDate = new Date(to + 'T00:00:00');
    const diffTime = Math.abs(toDate - fromDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    let earningsPromises = [];
    if (diffDays > 10) {
      // Chunk the date range into 7-day intervals to bypass Finnhub's 1500-result limit
      const chunks = [];
      let currentStart = new Date(fromDate);
      while (currentStart <= toDate) {
        let currentEnd = new Date(currentStart);
        currentEnd.setDate(currentStart.getDate() + 6); // 7 days inclusive
        if (currentEnd > toDate) {
          currentEnd = new Date(toDate);
        }
        
        const formatDate = (d) => {
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };
        
        chunks.push({
          from: formatDate(currentStart),
          to: formatDate(currentEnd)
        });
        
        currentStart.setDate(currentStart.getDate() + 7);
      }

      earningsPromises = chunks.map(chunk =>
        fetch(`https://finnhub.io/api/v1/calendar/earnings?from=${chunk.from}&to=${chunk.to}&token=${FH_KEY}`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
        })
        .then(r => r.json())
        .then(d => d.earningsCalendar || [])
        .catch(() => [])
      );
    } else {
      earningsPromises = [
        fetch(`https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${to}&token=${FH_KEY}`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
        })
        .then(r => r.json())
        .then(d => d.earningsCalendar || [])
        .catch(() => [])
      ];
    }

    const [earningsResults, ipoRes, coverage] = await Promise.all([
      Promise.all(earningsPromises).then(results => results.flat()),
      fetch(`https://finnhub.io/api/v1/calendar/ipo?from=${from}&to=${to}&token=${FH_KEY}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      }).then(r => r.json()).catch(() => ({})),
      supabase.from('stock_cache').select('ticker'),
    ]);

    const covered = new Set((coverage.data || []).map(r => r.ticker));

    // Deduplicate just in case
    const seen = new Set();
    const earnings = [];
    for (const e of earningsResults) {
      if (e.symbol && e.date && covered.has(e.symbol)) {
        const key = `${e.symbol}-${e.date}`;
        if (!seen.has(key)) {
          seen.add(key);
          earnings.push({
            ticker: e.symbol,
            date: e.date,
            epsEstimate: e.epsEstimate,
            hour: e.hour,
          });
        }
      }
    }

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
