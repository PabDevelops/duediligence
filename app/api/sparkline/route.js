export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get('ticker');
  const range = searchParams.get('range') || '1mo';
  if (!ticker) return Response.json({ candles: [] });

  try {
    const interval = range === '1y' || range === '6mo' ? '1wk' : '1d';
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=${interval}&range=${range}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    const meta = result?.meta;
    const currency = meta?.currency;
    const closes = result?.indicators?.quote?.[0]?.close || [];
    
    let candles = closes.filter(c => c != null);
    if (currency === 'GBp') {
      candles = candles.map(c => ({ c: c / 100 }));
    } else {
      candles = candles.map(c => ({ c }));
    }
    
    return Response.json({ candles });
  } catch (e) {
    return Response.json({ candles: [] });
  }
}