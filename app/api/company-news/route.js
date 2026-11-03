const FH_KEY = process.env.FINNHUB_API_KEY;
const DEFAULT_LIMIT = 5;
const LOOKBACK_DAYS = 30;

const toDateStr = (d) => d.toISOString().slice(0, 10);

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get('ticker')?.toUpperCase();
  const limit = Math.min(Number(searchParams.get('limit')) || DEFAULT_LIMIT, 20);

  if (!ticker) return Response.json({ error: 'ticker is required' }, { status: 400 });
  if (!FH_KEY) return Response.json({ articles: [] });

  const to = new Date();
  const from = new Date(to.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/company-news?symbol=${ticker}&from=${toDateStr(from)}&to=${toDateStr(to)}&token=${FH_KEY}`
    );
    if (!res.ok) return Response.json({ articles: [] });
    const raw = await res.json();
    if (!Array.isArray(raw)) return Response.json({ articles: [] });

    const articles = raw
      // Finnhub's feed includes thin wire-service blurbs with no real summary — skip those
      // rather than show a headline with nothing behind it.
      .filter(a => a.headline && a.datetime && a.summary && a.summary.length > 20)
      .sort((a, b) => b.datetime - a.datetime)
      .slice(0, limit)
      .map(a => ({
        headline: a.headline,
        summary: a.summary,
        source: a.source || null,
        url: a.url || null,
        publishedAt: new Date(a.datetime * 1000).toISOString(),
      }));

    return Response.json({ articles });
  } catch (e) {
    console.error('company-news error:', e);
    return Response.json({ articles: [] });
  }
}
