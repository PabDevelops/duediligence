const BASE_URL = 'https://traqcker.com';

const SP500_TICKERS = [
  'AAPL','MSFT','NVDA','AMZN','GOOGL','META','BRK-B','TSLA','JPM','V',
  'UNH','XOM','LLY','MA','JNJ','PG','AVGO','HD','MRK','COST',
  'ABBV','CVX','CRM','BAC','NFLX','PEP','TMO','KO','WMT','CSCO',
  'ORCL','MCD','ACN','ABT','LIN','DIS','ADBE','AMD','TXN','WFC',
  'PFE','BMY','HON','AMGN','RTX','QCOM','UPS','SPGI','CAT','INTU',
  'GE','IBM','ISRG','LOW','ELV','MDLZ','BKNG','GS','BLK','AXP',
  'SYK','VRTX','DE','PLD','ADI','REGN','MS','CI','AMAT','GILD',
  'NOW','TJX','LRCX','PANW','MO','ZTS','ADP','CME','ETN','EOG',
  'SLB','SO','DUK','BSX','MMM','ITW','MCO','HCA','MU','NOC',
  'CL','NEE','APH','AON','ICE','KLAC','PH','F','GM','UBER',
];

export default async function sitemap() {
  const staticPages = [
    { url: BASE_URL,                        changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${BASE_URL}/screener`,          changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${BASE_URL}/compare`,           changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${BASE_URL}/pricing`,           changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/about`,             changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/watchlist`,         changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/sign-up`,           changeFrequency: 'yearly',  priority: 0.5 },
    { url: `${BASE_URL}/sign-in`,           changeFrequency: 'yearly',  priority: 0.3 },
  ];

  const stockPages = SP500_TICKERS.map(ticker => ({
    url: `${BASE_URL}/stock/${ticker}`,
    changeFrequency: 'daily',
    priority: 0.9,
    lastModified: new Date(),
  }));

  // Try to add any extra tickers from Supabase cache
  let extraTickers = [];
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    const { data } = await supabase
      .from('stock_cache')
      .select('ticker')
      .limit(500);

    if (data) {
      const known = new Set(SP500_TICKERS);
      extraTickers = data
        .map(r => r.ticker)
        .filter(t => !known.has(t))
        .map(ticker => ({
          url: `${BASE_URL}/stock/${ticker}`,
          changeFrequency: 'daily',
          priority: 0.7,
          lastModified: new Date(),
        }));
    }
  } catch { /* sitemap still works without extra tickers */ }

  return [...staticPages, ...stockPages, ...extraTickers];
}
