import { fetchYahooRecommendationTrend } from '../../../lib/yahooFinance';

// Maps a 1-5 average rating score (5 = best) to a discrete consensus label.
function scoreToConsensus(score) {
  if (score >= 4.5) return 'strong_buy';
  if (score >= 3.5) return 'buy';
  if (score >= 2.5) return 'hold';
  if (score >= 1.5) return 'sell';
  return 'strong_sell';
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const ticker = searchParams.get('ticker')?.toUpperCase();
    if (!ticker) return Response.json({ error: 'ticker required' }, { status: 400 });

    // Finnhub's free plan only covers US-listed tickers, so international ones
    // (LLOY.L, SAP.DE, ...) fall back to Yahoo's recommendation trend, which reports
    // the same strongBuy/buy/hold/sell/strongSell shape.
    let rec = null;
    let source = 'none';
    try {
      const fhRes = await fetch(
        `https://finnhub.io/api/v1/stock/recommendation?symbol=${ticker}&token=${process.env.FINNHUB_API_KEY}`,
        { next: { revalidate: 3600 } }
      );
      const fhData = await fhRes.json();
      rec = Array.isArray(fhData) && fhData[0] ? fhData[0] : null;
      if (rec) source = 'finnhub';
    } catch { /* try Yahoo below */ }

    if (!rec) {
      rec = await fetchYahooRecommendationTrend(ticker);
      if (rec) source = 'yahoo';
    }

    if (!rec) {
      return Response.json({ ticker, ratings: null, total: 0, consensus: null, score: null, source: 'none' });
    }

    const ratings = {
      strongBuy: rec.strongBuy || 0,
      buy: rec.buy || 0,
      hold: rec.hold || 0,
      sell: rec.sell || 0,
      strongSell: rec.strongSell || 0,
    };
    const total = ratings.strongBuy + ratings.buy + ratings.hold + ratings.sell + ratings.strongSell;

    if (total === 0) {
      return Response.json({ ticker, ratings: null, total: 0, consensus: null, score: null, source: 'none' });
    }

    const score = (
      ratings.strongBuy * 5 +
      ratings.buy * 4 +
      ratings.hold * 3 +
      ratings.sell * 2 +
      ratings.strongSell * 1
    ) / total;

    return Response.json({
      ticker,
      ratings,
      total,
      consensus: scoreToConsensus(score),
      score: Math.round(score * 100) / 100,
      source,
    });
  } catch (error) {
    console.error('analyst-rating GET error:', error);
    return Response.json({ error: 'Error fetching analyst rating' }, { status: 500 });
  }
}
