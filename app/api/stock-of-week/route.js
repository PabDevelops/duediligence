import { supabase } from '../../../lib/supabase';

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

    if (!checkError && existing) {
      // Get name from cache
      const { data: stock } = await supabase
        .from('stock_cache')
        .select('name')
        .eq('ticker', existing.ticker)
        .single();
      return Response.json({ ticker: existing.ticker, name: stock?.name || 'N/A', isNew: false });
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

    // Insert into stock_of_week
    const { error: insertError } = await supabase
      .from('stock_of_week')
      .insert([{ ticker: randomStock.ticker, week_start: weekStart }]);

    if (insertError) throw insertError;

    return Response.json({ ticker: randomStock.ticker, name: randomStock.name || 'N/A', isNew: true });
  } catch (error) {
    console.error('stock-of-week error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
