export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get('ticker');
  const range = searchParams.get('range') || '1mo';
  const interval = range === '1y' || range === '6mo' ? '1wk' : '1d';
  if (!ticker) return Response.json({ candles: [] });

  try {
    const range = searchParams.get('range') || '1mo';
    const interval = range === '1y' || range === '6mo' ? '1wk' : '1d';
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=${interval}&range=${range}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    const data = await res.json();
    const closes = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
    const candles = closes.filter(c => c != null).map(c => ({ c }));
    return Response.json({ candles });
  } catch (e) {
    return Response.json({ candles: [] });
  }
}