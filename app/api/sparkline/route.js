export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get('ticker');
  const range = searchParams.get('range') || '1m';
  if (!ticker) return Response.json({ candles: [] });

  const intervalMap = {
    '1d': { interval: '5m', range: '1d' },
    '1w': { interval: '15m', range: '5d' },
    '1m': { interval: '1d', range: '1mo' },
    '3m': { interval: '1d', range: '3mo' },
    '1y': { interval: '1d', range: '1y' },
    'ytd': { interval: '1d', range: 'ytd' },
    'max': { interval: '1wk', range: 'max' },
  };

  const { interval, range: r } = intervalMap[range] || intervalMap['1m'];

  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=${interval}&range=${r}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    const meta = result?.meta;
    const currency = meta?.currency;
    const timestamps = result?.timestamp || [];
    const closes = result?.indicators?.quote?.[0]?.close || [];

    const divisor = currency === 'GBp' ? 100 : 1;
    let candles = closes
      .map((c, i) => ({ c, t: timestamps[i] }))
      .filter(x => x.c != null)
      .map(x => ({ c: x.c / divisor, t: x.t, date: x.t ? new Date(x.t * 1000).toISOString().slice(0, 10) : null }));

    return Response.json({ candles });
  } catch (e) {
    return Response.json({ candles: [] });
  }
}