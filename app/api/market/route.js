export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const extended = searchParams.get('extended') === 'true';

  const symbols = [
    { symbol: '^GSPC', label: 'S&P 500' },
    { symbol: '^IXIC', label: 'NASDAQ' },
    { symbol: '^DJI', label: 'DOW JONES' },
    { symbol: '^RUT', label: 'RUSSELL 2000' },
    { symbol: '^VIX', label: 'VIX' },
    // Only fetched for callers that ask for them (the Explore page's "Global Markets"
    // panel) so the existing Home dashboard indices widget is unaffected.
    ...(extended ? [
      { symbol: 'GC=F', label: 'Gold' },
      { symbol: 'SI=F', label: 'Silver' },
      { symbol: 'CL=F', label: 'Crude Oil' },
      { symbol: 'NG=F', label: 'Natural Gas' },
      { symbol: '^N225', label: 'Japan 225' },
    ] : []),
  ];

  try {
    const results = await Promise.all(
      symbols.map(async ({ symbol, label }) => {
        const res = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1mo`,
          { headers: { 'User-Agent': 'Mozilla/5.0' } }
        );
        const data = await res.json();
        const meta = data?.chart?.result?.[0]?.meta;
        const closes = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
        const timestamps = data?.chart?.result?.[0]?.timestamp || [];

        const candles = closes.map((c, i) => ({ c, t: timestamps[i] })).filter(d => d.c);
        const price = meta?.regularMarketPrice;
        const prevClose = meta?.chartPreviousClose;
        const change = price && prevClose ? +(price - prevClose).toFixed(2) : null;
        const changePct = price && prevClose ? +((((price - prevClose) / prevClose) * 100)).toFixed(2) : null;

        return { symbol, label, candles, price, change, changePct };
      })
    );

    return Response.json({ markets: results });
  } catch (e) {
    return Response.json({ markets: [] });
  }
}