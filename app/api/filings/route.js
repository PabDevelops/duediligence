import Parser from 'rss-parser';

const FH_KEY = process.env.FINNHUB_API_KEY;

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const rssParser = new Parser({
  timeout: 8000,
  headers: { 'User-Agent': BROWSER_UA },
  customFields: { item: [['media:content', 'mediaContent', { keepArray: true }]] },
});

// General market news comes from RSS — free, no rate limits, and no per-user
// cost regardless of how many people load the News tab. Personalized "My
// Positions" news still uses Finnhub below, since RSS has no reliable way to
// tag a story to a specific ticker.
const RSS_FEEDS = [
  { url: 'https://finance.yahoo.com/news/rssindex', source: 'Yahoo Finance' },
  { url: 'http://feeds.marketwatch.com/marketwatch/marketpulse/', source: 'MarketWatch' },
  { url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html', source: 'CNBC' },
  { url: 'https://www.investing.com/rss/news.rss', source: 'Investing.com' },
];

const LOGO_URL_BLOCKLIST = [
  'finnhub.io/file/finnhub/logo',
  'static2.finnhub.io',
  'logo.clearbit.com',
  '_logo.jpeg',
  '_logo.png',
  'reuters_logo',
];
function isLogoUrl(url) {
  if (!url) return true;
  const lower = url.toLowerCase();
  return LOGO_URL_BLOCKLIST.some(p => lower.includes(p));
}

function toRelativeTime(dateMs) {
  const diffMins = Math.max(1, Math.round((Date.now() - dateMs) / 60000));
  if (diffMins < 60) return `${diffMins}m ago`;
  const hours = Math.round(diffMins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function dedupeByTitle(items) {
  const seen = new Set();
  return items.filter(item => {
    const key = item.title.toLowerCase().slice(0, 60).replace(/\s+/g, ' ').trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractRssImage(item) {
  const enclosureUrl = item.enclosure?.url;
  if (enclosureUrl && !isLogoUrl(enclosureUrl)) return enclosureUrl;
  const media = Array.isArray(item.mediaContent) ? item.mediaContent.find(m => m?.$?.url) : null;
  if (media?.$?.url && !isLogoUrl(media.$.url)) return media.$.url;
  return null;
}

// General market news from RSS — free, no rate limits, no per-user API cost.
async function fetchRssFeed({ url, source }) {
  try {
    const feed = await rssParser.parseURL(url);
    return (feed.items || [])
      .filter(item => item.title && item.link)
      .slice(0, 15)
      .map(item => {
        const publishedAt = new Date(item.isoDate || item.pubDate || Date.now()).getTime();
        return {
          id: `rss_${source}_${item.guid || item.link}`,
          title: item.title.trim(),
          summary: (item.contentSnippet || '').replace(/\s+/g, ' ').trim(),
          source,
          ticker: '',
          time: toRelativeTime(publishedAt),
          publishedAt,
          url: item.link,
          image: extractRssImage(item),
        };
      });
  } catch (e) {
    console.error(`RSS fetch failed for ${source}:`, e.message);
    return [];
  }
}

// rss-parser doesn't go through Next's fetch cache, so cache the merged
// result in-process for 5 minutes to avoid re-fetching 4 feeds on every load.
let rssCache = { data: null, fetchedAt: 0 };
const RSS_CACHE_MS = 5 * 60 * 1000;

async function fetchAllRss() {
  if (rssCache.data && Date.now() - rssCache.fetchedAt < RSS_CACHE_MS) {
    return rssCache.data;
  }
  const results = await Promise.all(RSS_FEEDS.map(fetchRssFeed));
  const merged = results.flat();
  rssCache = { data: merged, fetchedAt: Date.now() };
  return merged;
}

// Finnhub personalized company news (for holdings/watchlist tab)
async function fetchCompanyNews(ticker) {
  try {
    const to = new Date();
    const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fmt = d => d.toISOString().slice(0, 10);
    const res = await fetch(
      `https://finnhub.io/api/v1/company-news?symbol=${ticker}&from=${fmt(from)}&to=${fmt(to)}&token=${FH_KEY}`,
      { next: { revalidate: 300 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (Array.isArray(data) ? data : [])
      .filter(item => item.headline && item.image && !isLogoUrl(item.image))
      .slice(0, 5)
      .map(item => ({
        id: `fhc_${item.id}`,
        title: item.headline,
        summary: item.summary || '',
        source: item.source || 'Finnhub',
        ticker,
        time: toRelativeTime(item.datetime * 1000),
        url: item.url,
        image: item.image,
      }));
  } catch {
    return [];
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const tickersParam = searchParams.get('tickers');
  const tickers = tickersParam
    ? [...new Set(tickersParam.split(',').map(t => t.trim().toUpperCase()).filter(Boolean))].slice(0, 8)
    : [];

  // Personalized holdings/watchlist news
  if (tickers.length > 0) {
    try {
      const arrays = await Promise.all(tickers.map(fetchCompanyNews));
      const holdingsNews = dedupeByTitle(arrays.flat()).slice(0, 15);
      return Response.json({ holdingsNews });
    } catch (e) {
      console.error('Error fetching holdings news:', e);
      return Response.json({ holdingsNews: [] });
    }
  }

  // General market news from RSS
  try {
    const merged = dedupeByTitle(await fetchAllRss())
      .sort((a, b) => b.publishedAt - a.publishedAt)
      .slice(0, 30);
    return Response.json({ filings: merged });
  } catch (e) {
    console.error('Error fetching market news:', e);
    return Response.json({ filings: [] });
  }
}
