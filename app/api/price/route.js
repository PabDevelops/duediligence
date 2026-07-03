const AV_KEY = process.env.ALPHA_VANTAGE_API_KEY;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get('ticker')?.toUpperCase();

  if (!ticker) return Response.json({ error: 'Ticker requerido' }, { status: 400 });
  if (!AV_KEY) return Response.json({ error: 'ALPHA_VANTAGE_API_KEY no está configurada' }, { status: 500 });

  try {
    const res = await fetch(
      `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${ticker}&outputsize=compact&apikey=${AV_KEY}`
    );
    const data = await res.json();

    if (data['Note'] || data['Information']) {
      return Response.json({ error: 'Límite de API alcanzado, intenta en 1 minuto' }, { status: 429 });
    }

    const series = data['Time Series (Daily)'];
    if (!series) return Response.json({ error: 'No hay datos de precio' }, { status: 404 });

    const candles = Object.entries(series)
      .map(([date, v]) => ({
        time: date,
        open: +v['1. open'],
        high: +v['2. high'],
        low: +v['3. low'],
        close: +v['4. close'],
        volume: +v['5. volume'],
      }))
      .sort((a, b) => a.time.localeCompare(b.time));

    return Response.json({ candles });
  } catch (e) {
    return Response.json({ error: 'Error al cargar precio' }, { status: 500 });
  }
}