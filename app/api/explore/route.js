import { supabase } from '../../../lib/supabase';

// Curated ticker lists per theme — Trading212's "Thematic" section is backed by their own
// classification data we don't have, so these are hand-picked baskets. Prices/names/change
// always come from stock_cache (populated by /api/stock), never hardcoded here.
export const THEMES = {
  // Thematic — broad macro themes
  bigtech: { label: 'Big Tech', tickers: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA'] },
  ai: { label: 'AI & Semiconductors', tickers: ['NVDA', 'AMD', 'AVGO', 'TSM', 'ASML', 'MU'] },
  defence: { label: 'Defence', tickers: ['LMT', 'RTX', 'NOC', 'GD', 'BA', 'LHX'] },
  quantum: { label: 'Quantum Computing', tickers: ['IONQ', 'RGTI', 'QBTS', 'IBM', 'HON', 'ARQQ'] },
  evs: { label: 'EVs', tickers: ['TSLA', 'RIVN', 'LCID', 'NIO', 'GM', 'F'] },
  banks: { label: 'Banks & Financials', tickers: ['JPM', 'BAC', 'WFC', 'GS', 'MS', 'C'] },
  dividends: { label: 'Dividend Aristocrats', tickers: ['JNJ', 'PG', 'KO', 'PEP', 'MMM', 'O'] },
  cybersecurity: { label: 'Cybersecurity', tickers: ['CRWD', 'PANW', 'FTNT', 'ZS', 'OKTA', 'S'] },
  biotech: { label: 'Biotech & Drugs', tickers: ['LLY', 'UNH', 'PFE', 'MRK', 'ABBV', 'MRNA'] },
  energy: { label: 'Oil & Gas', tickers: ['XOM', 'CVX', 'COP', 'SLB', 'OXY', 'BP'] },

  // Industries — narrower sector verticals
  bigpharma: { label: 'Big Pharma', tickers: ['PFE', 'MRK', 'LLY', 'ABBV', 'BMY', 'NVS'] },
  reit: { label: 'REIT', tickers: ['O', 'PLD', 'AMT', 'SPG', 'PSA', 'EQIX'] },
  airlines: { label: 'Airlines', tickers: ['DAL', 'UAL', 'AAL', 'LUV', 'RYAAY', 'ALK'] },
  automotive: { label: 'Automotive', tickers: ['TM', 'GM', 'F', 'STLA', 'HMC', 'VWAGY'] },
  chipmakers: { label: 'Chipmakers', tickers: ['NVDA', 'TSM', 'AVGO', 'QCOM', 'TXN', 'INTC'] },
  insurance: { label: 'Insurance Giants', tickers: ['UNH', 'CI', 'PGR', 'AIG', 'MET', 'ALL'] },
  hotels: { label: 'Hotels', tickers: ['MAR', 'HLT', 'H', 'IHG', 'WH', 'MGM'] },
  restaurants: { label: 'Restaurants', tickers: ['MCD', 'SBUX', 'CMG', 'YUM', 'DPZ', 'QSR'] },
  regionalbanks: { label: 'Regional Banks', tickers: ['TFC', 'PNC', 'USB', 'FITB', 'RF', 'KEY'] },
  mining: { label: 'Mining Prospects', tickers: ['BHP', 'RIO', 'VALE', 'FCX', 'NEM', 'SCCO'] },
  chemicals: { label: 'Chemical Manufacturing', tickers: ['LIN', 'DOW', 'DD', 'APD', 'LYB', 'ECL'] },
  railroads: { label: 'Railroads', tickers: ['UNP', 'CSX', 'NSC', 'CNI', 'CP'] },
  motionpictures: { label: 'Motion Pictures', tickers: ['DIS', 'NFLX', 'WBD', 'PARA', 'AMC', 'CNK'] },
  broadcasting: { label: 'Broadcasting & Cable', tickers: ['CMCSA', 'CHTR', 'FOXA', 'NWSA', 'NXST', 'TGNA'] },
  grocery: { label: 'Grocery Stores', tickers: ['KR', 'ACI', 'SFM', 'WMT', 'COST'] },
  footwear: { label: 'Footwear', tickers: ['NKE', 'DECK', 'CROX', 'SKX', 'VFC', 'ONON'] },
  fashion: { label: 'Fashion', tickers: ['RL', 'PVH', 'TPR', 'VFC', 'LULU'] },
  robotics: { label: 'Robotics', tickers: ['ISRG', 'ABB', 'IRBT', 'ROK', 'TER'] },
  crypto: { label: 'Crypto & Blockchain', tickers: ['COIN', 'MSTR', 'MARA', 'RIOT', 'HUT', 'CLSK'] },
  spac: { label: 'SPAC-Born', tickers: ['DKNG', 'GRAB', 'CCCS', 'BOWL', 'GLBE', 'GENI'] },
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  const theme = THEMES[category];

  if (!theme) {
    return Response.json({ error: 'Unknown category' }, { status: 400 });
  }

  try {
    const { data } = await supabase
      .from('stock_cache')
      .select('ticker, data')
      .in('ticker', theme.tickers);

    const byTicker = Object.fromEntries((data || []).map((row) => [row.ticker, row.data]));

    const stocks = theme.tickers
      .map((ticker) => {
        const d = byTicker[ticker];
        if (!d || d.currentPrice == null) return null;
        return {
          ticker,
          name: d.name,
          currentPrice: d.currentPrice,
          priceChangePct: d.priceChangePct,
          exchange: d.exchange,
          currency: d.currency,
        };
      })
      .filter(Boolean);

    // Tickers with no fresh cache entry yet — the frontend seeds these via /api/stock
    // (same on-demand pattern the ETF screener uses for new tickers) and they'll show
    // up here on the next load.
    const missing = theme.tickers.filter((t) => !byTicker[t] || byTicker[t].currentPrice == null);

    return Response.json({ label: theme.label, stocks, missing });
  } catch (err) {
    console.error('Error fetching explore category:', err);
    return Response.json({ label: theme.label, stocks: [], missing: theme.tickers });
  }
}
