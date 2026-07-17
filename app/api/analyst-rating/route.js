import { fetchYahooRecommendationTrend } from '../../../lib/yahooFinance';

// Maps a 1-5 average rating score (5 = best) to a discrete consensus label.
function scoreToConsensus(score) {
  if (score >= 4.5) return 'strong_buy';
  if (score >= 3.5) return 'buy';
  if (score >= 2.5) return 'hold';
  if (score >= 1.5) return 'sell';
  return 'strong_sell';
}

function parseRatings(rec) {
  if (!rec) return null;
  const ratings = {
    strongBuy: Number(rec.strongBuy) || 0,
    buy: Number(rec.buy) || 0,
    hold: Number(rec.hold) || 0,
    sell: Number(rec.sell) || 0,
    strongSell: Number(rec.strongSell) || 0,
  };
  const total = ratings.strongBuy + ratings.buy + ratings.hold + ratings.sell + ratings.strongSell;
  if (total === 0) return null;
  return { ratings, total };
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const ticker = searchParams.get('ticker')?.toUpperCase();
    if (!ticker) return Response.json({ error: 'ticker required' }, { status: 400 });

    // Fetch both Finnhub and Yahoo Finance in parallel to compare coverage
    const [fhResult, yahooResult] = await Promise.allSettled([
      fetch(
        `https://finnhub.io/api/v1/stock/recommendation?symbol=${ticker}&token=${process.env.FINNHUB_API_KEY}`,
        { next: { revalidate: 3600 } }
      ).then(r => r.json()).then(data => (Array.isArray(data) && data[0] ? data[0] : null)),
      fetchYahooRecommendationTrend(ticker),
    ]);

    const fhRec = fhResult.status === 'fulfilled' ? parseRatings(fhResult.value) : null;
    const yahooRec = yahooResult.status === 'fulfilled' ? parseRatings(yahooResult.value) : null;

    // Select whichever source returns the maximum total analyst count
    let best = null;
    let source = 'none';

    if (fhRec && yahooRec) {
      if (yahooRec.total > fhRec.total) {
        best = yahooRec;
        source = 'yahoo';
      } else {
        best = fhRec;
        source = 'finnhub';
      }
    } else if (yahooRec) {
      best = yahooRec;
      source = 'yahoo';
    } else if (fhRec) {
      best = fhRec;
      source = 'finnhub';
    }

    if (!best || best.total === 0) {
      return Response.json({ ticker, ratings: null, total: 0, consensus: null, score: null, source: 'none' });
    }

    const { ratings, total } = best;
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
