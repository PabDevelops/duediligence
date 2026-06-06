export async function GET() {
  const symbols = [
    { symbol: 'SPY', label: 'S&P 500' },
    { symbol: 'QQQ', label: 'NASDAQ' },
    { symbol: 'DIA', label: 'DOW JONES' },
    { symbol: 'IWM', label: 'RUSSELL 2000' },
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