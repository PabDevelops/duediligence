export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get('ticker');
  const range = searchParams.get('range') || '1y';
  
  if (!ticker) return Response.json({ candles: [] });

  const intervalMap = {
    '1d': { interval: '5m', range: '1d' },
    '5d': { interval: '15m', range: '5d' },
    '15d': { interval: '30m', range: '15d' },
    '1m': { interval: '1d', range: '1mo' },
    '6m': { interval: '1d', range: '6mo' },
    '1y': { interval: '1d', range: '1y' },
    '3y': { interval: '1wk', range: '3y' },
    '5y': { interval: '1wk', range: '5y' },
  };

  const { interval, range: r } = intervalMap[range] || intervalMap['1y'];

  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=${interval}&range=${r}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return Response.json({ candles: [] });

    const timestamps = result.timestamp || [];
    const quotes = result.indicators?.quote?.[0] || {};

    const candles = timestamps.map((t, i) => ({
      t: t * 1000,
      o: +quotes.open?.[i]?.toFixed(2),
      h: +quotes.high?.[i]?.toFixed(2),
      l: +quotes.low?.[i]?.toFixed(2),
      c: +quotes.close?.[i]?.toFixed(2),
      v: quotes.volume?.[i],
    })).filter(c => c.c && c.o && c.h && c.l);

    return Response.json({ candles });
  } catch (e) {
    return Response.json({ candles: [] });
  }
}