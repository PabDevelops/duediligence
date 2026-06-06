export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get('ticker');
  if (!ticker) return Response.json({ candles: [] });

  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1mo`,
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