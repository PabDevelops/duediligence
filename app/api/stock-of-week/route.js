import { supabase } from '../../../lib/supabase';

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
  return companyNames[ticker] || 'N/A';
}

function getWeekStart(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const weekStart = new Date(d.setDate(diff));
  return weekStart.toISOString().split('T')[0];
}

export async function GET() {
  try {
    const weekStart = getWeekStart();

    // Check if we already have a stock of the week for this week
    const { data: existing, error: checkError } = await supabase
      .from('stock_of_week')
      .select('ticker')
      .eq('week_start', weekStart)
      .single();

    if (!checkError && existing && existing.ticker) {
      // Get name from cache, fallback to known companies
      const { data: stock } = await supabase
        .from('stock_cache')
        .select('name')
        .eq('ticker', existing.ticker)
        .single();
      const name = stock?.name || getCompanyName(existing.ticker);
      return Response.json({ ticker: existing.ticker, name, isNew: false });
    }

    // If existing record has null/empty ticker, delete it so we can create a fresh one
    if (!checkError && existing && !existing.ticker) {
      await supabase
        .from('stock_of_week')
        .delete()
        .eq('week_start', weekStart);
    }

    // Get all stocks in cache with name
    const { data: allStocks, error: cacheError } = await supabase
      .from('stock_cache')
      .select('ticker, name')
      .order('updated_at', { ascending: false })
      .limit(500);

    if (cacheError || !allStocks || allStocks.length === 0) {
      throw new Error('No stocks in cache');
    }

    // Get all previously used tickers
    const { data: usedStocks, error: usedError } = await supabase
      .from('stock_of_week')
      .select('ticker');

    if (usedError) throw usedError;

    const usedTickers = new Set(usedStocks?.map(s => s.ticker) || []);
    const availableTickers = allStocks.filter(s => !usedTickers.has(s.ticker));

    // If all stocks have been used, reset and pick from all
    const pickFrom = availableTickers.length > 0 ? availableTickers : allStocks;

    // Pick random stock
    const randomStock = pickFrom[Math.floor(Math.random() * pickFrom.length)];

    if (!randomStock) {
      // Fallback: return a hardcoded popular stock
      const fallback = { ticker: 'AAPL', name: 'Apple Inc.' };
      return Response.json(fallback);
    }

    // Insert into stock_of_week
    const { error: insertError } = await supabase
      .from('stock_of_week')
      .insert([{ ticker: randomStock.ticker, week_start: weekStart }]);

    if (insertError) throw insertError;

    const name = randomStock.name || getCompanyName(randomStock.ticker);
    return Response.json({ ticker: randomStock.ticker, name, isNew: true });
  } catch (error) {
    console.error('stock-of-week error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
