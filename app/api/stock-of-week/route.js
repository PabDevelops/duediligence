import { supabase } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Fallback company names for stocks not in cache
const companyNames = {
  'MOH': 'Molina Healthcare, Inc.',
  'AAPL': 'Apple Inc.',
  'MSFT': 'Microsoft Corporation',
  'GOOGL': 'Alphabet Inc.',
  'AMZN': 'Amazon.com Inc.',
  'NVDA': 'NVIDIA Corporation',
  'TSLA': 'Tesla Inc.',
  'META': 'Meta Platforms Inc.',
  'INTC': 'Intel Corporation',
  'AMD': 'Advanced Micro Devices',
};

function getCompanyName(ticker) {
  return companyNames[ticker] || ticker;
}

function getWeekStart(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const weekStart = new Date(d.setDate(diff));
  return weekStart.toISOString().split('T')[0];
}

const HARDCODED_FALLBACK = { ticker: 'AAPL', name: 'Apple Inc.' };

export async function GET() {
  const weekStart = getWeekStart();

  try {
    // Step 1: Check if a valid SOTW already exists for this week
    const { data: existingRows } = await supabase
      .from('stock_of_week')
      .select('ticker')
      .eq('week_start', weekStart)
      .limit(1);

    const existing = existingRows?.[0];

    if (existing?.ticker) {
      // Valid existing record - get name and return
      const { data: stock } = await supabase
        .from('stock_cache')
        .select('data')
        .eq('ticker', existing.ticker)
        .limit(1);

      const name = stock?.[0]?.data?.name || getCompanyName(existing.ticker);
      return Response.json({ ticker: existing.ticker, name, isNew: false, source: 'existing' });
    }

    // Step 2: Clean up any corrupt record (null ticker) for this week
    if (existing && !existing.ticker) {
      await supabase
        .from('stock_of_week')
        .delete()
        .eq('week_start', weekStart);
    }

    // Step 3: Get stocks from cache to pick a new SOTW
    const { data: allStocksRaw, error: cacheError, count } = await supabase
      .from('stock_cache')
      .select('ticker, data', { count: 'exact' })
      .neq('ticker', 'INHD')
      .neq('ticker', 'INNO')
      .order('updated_at', { ascending: false })
      .limit(500);

    const allStocks = (allStocksRaw || []).map(s => ({ ticker: s.ticker, name: s.data?.name }));

    if (!allStocks || allStocks.length === 0) {
      // No stocks in cache at all - return hardcoded fallback WITHOUT inserting
      return Response.json({ 
        ...HARDCODED_FALLBACK, 
        isNew: false, 
        source: 'fallback',
        debug: { cacheError: cacheError?.message, count, allStocksLength: allStocks?.length }
      });
    }

    // Step 4: Avoid repeating recently used tickers
    const { data: usedStocks } = await supabase
      .from('stock_of_week')
      .select('ticker');

    const usedTickers = new Set((usedStocks || []).map(s => s.ticker).filter(Boolean));
    const availableTickers = allStocks.filter(s => !usedTickers.has(s.ticker));
    const pickFrom = availableTickers.length > 0 ? availableTickers : allStocks;

    const randomStock = pickFrom[Math.floor(Math.random() * pickFrom.length)];

    if (!randomStock?.ticker) {
      return Response.json({ ...HARDCODED_FALLBACK, isNew: false, source: 'fallback' });
    }

    // Step 5: Try to save the pick for this week (best-effort, don't fail if it errors)
    try {
      await supabase
        .from('stock_of_week')
        .insert([{ ticker: randomStock.ticker, week_start: weekStart }]);
    } catch (insertErr) {
      console.error('SOTW insert failed (non-fatal):', insertErr);
    }

    const name = randomStock.name || getCompanyName(randomStock.ticker);
    return Response.json({ ticker: randomStock.ticker, name, isNew: true, source: 'random_pick' });
  } catch (error) {
    console.error('stock-of-week error:', error);
    // Always return a valid stock, even on unexpected errors
    return Response.json({ ...HARDCODED_FALLBACK, isNew: false, source: 'fallback' });
  }
}
