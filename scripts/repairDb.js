// ============================================================================
// EMERGENCY DB REPAIR SCRIPT
// ============================================================================
// 1. Delete all 3,789 fake rows from the bad populate script
// 2. Re-seed the ~260 Explore theme tickers via /api/stock (real data)
// 3. Everything else populates on-demand when users search
// ============================================================================

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load env
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (m) {
      let val = m[2] || '';
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      process.env[m[1]] = val.trim();
    }
  });
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const EXPLORE_THEMES = {
  bigtech: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA'],
  ai: ['NVDA', 'AMD', 'AVGO', 'TSM', 'ASML', 'MU'],
  defence: ['LMT', 'RTX', 'NOC', 'GD', 'BA', 'LHX'],
  quantum: ['IONQ', 'RGTI', 'QBTS', 'IBM', 'HON', 'ARQQ'],
  evs: ['TSLA', 'RIVN', 'LCID', 'NIO', 'GM', 'F'],
  banks: ['JPM', 'BAC', 'WFC', 'GS', 'MS', 'C'],
  dividends: ['JNJ', 'PG', 'KO', 'PEP', 'MMM', 'O'],
  cybersecurity: ['CRWD', 'PANW', 'FTNT', 'ZS', 'OKTA', 'S'],
  biotech: ['LLY', 'UNH', 'PFE', 'MRK', 'ABBV', 'MRNA'],
  energy: ['XOM', 'CVX', 'COP', 'SLB', 'OXY', 'BP'],
  bigpharma: ['PFE', 'MRK', 'LLY', 'ABBV', 'BMY', 'NVS'],
  reit: ['O', 'PLD', 'AMT', 'SPG', 'PSA', 'EQIX'],
  airlines: ['DAL', 'UAL', 'AAL', 'LUV', 'RYAAY', 'ALK'],
  automotive: ['TM', 'GM', 'F', 'STLA', 'HMC', 'VWAGY'],
  chipmakers: ['NVDA', 'TSM', 'AVGO', 'QCOM', 'TXN', 'INTC'],
  insurance: ['UNH', 'CI', 'PGR', 'AIG', 'MET', 'ALL'],
  hotels: ['MAR', 'HLT', 'H', 'IHG', 'WH', 'MGM'],
  restaurants: ['MCD', 'SBUX', 'CMG', 'YUM', 'DPZ', 'QSR'],
  regionalbanks: ['TFC', 'PNC', 'USB', 'FITB', 'RF', 'KEY'],
  mining: ['BHP', 'RIO', 'VALE', 'FCX', 'NEM', 'SCCO'],
  chemicals: ['LIN', 'DOW', 'DD', 'APD', 'LYB', 'ECL'],
  railroads: ['UNP', 'CSX', 'NSC', 'CNI', 'CP'],
  motionpictures: ['DIS', 'NFLX', 'WBD', 'PARA', 'AMC', 'CNK'],
  broadcasting: ['CMCSA', 'CHTR', 'FOXA', 'NWSA', 'NXST', 'TGNA'],
  grocery: ['KR', 'ACI', 'SFM', 'WMT', 'COST'],
  footwear: ['NKE', 'DECK', 'CROX', 'SKX', 'VFC', 'ONON'],
  fashion: ['RL', 'PVH', 'TPR', 'VFC', 'LULU'],
  robotics: ['ISRG', 'ABB', 'IRBT', 'ROK', 'TER'],
  crypto: ['COIN', 'MSTR', 'MARA', 'RIOT', 'HUT', 'CLSK'],
  spac: ['DKNG', 'GRAB', 'CCCS', 'BOWL', 'GLBE', 'GENI'],
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('=== EMERGENCY DB REPAIR ===\n');

  // Step 1: Count current rows
  const { count: beforeCount } = await supabase
    .from('stock_cache')
    .select('ticker', { count: 'exact', head: true });
  console.log(`Step 1: Current rows in stock_cache: ${beforeCount}`);

  // Step 2: Delete ALL rows (the bad populate poisoned everything)
  console.log('\nStep 2: Deleting ALL poisoned rows...');
  const { error: delError } = await supabase
    .from('stock_cache')
    .delete()
    .neq('ticker', 'KEEP_NON_EXISTENT_ROW');
  
  if (delError) {
    console.error('Delete error:', delError);
    return;
  }

  const { count: afterCount } = await supabase
    .from('stock_cache')
    .select('ticker', { count: 'exact', head: true });
  console.log(`  Deleted ${beforeCount - afterCount} rows. Remaining: ${afterCount}`);

  // Step 3: Re-seed Explore tickers via /api/stock (real data pipeline)
  const allTickers = [...new Set(Object.values(EXPLORE_THEMES).flat())];
  console.log(`\nStep 3: Re-seeding ${allTickers.length} Explore theme tickers via /api/stock...`);
  console.log('  Using real SEC EDGAR + Finnhub + Yahoo Finance pipeline');
  console.log('  Rate: 2 concurrent, 8s delay between batches (Finnhub safe)\n');

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const seeded = [];
  const failed = [];
  const CONCURRENCY = 2;
  const BATCH_DELAY_MS = 8000;

  for (let i = 0; i < allTickers.length; i += CONCURRENCY) {
    const batch = allTickers.slice(i, i + CONCURRENCY);
    
    const results = await Promise.all(batch.map(async (ticker) => {
      try {
        const res = await fetch(`${baseUrl}/api/stock?ticker=${encodeURIComponent(ticker)}`);
        const data = await res.json();
        if (res.ok && data.name && !data.error) {
          return { ticker, success: true, name: data.name, mcap: data.marketCap };
        } else {
          return { ticker, success: false, error: data.error || `HTTP ${res.status}` };
        }
      } catch (err) {
        return { ticker, success: false, error: err.message };
      }
    }));

    results.forEach(r => {
      if (r.success) {
        seeded.push(r.ticker);
        console.log(`  OK  ${r.ticker.padEnd(6)} | ${(r.name || '').substring(0, 35)} | MCap: ${r.mcap ? '$'+(r.mcap/1e9).toFixed(1)+'B' : 'N/A'}`);
      } else {
        failed.push(r.ticker);
        console.log(`  ERR ${r.ticker.padEnd(6)} | ${r.error}`);
      }
    });

    // Rate limit delay between batches
    if (i + CONCURRENCY < allTickers.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  console.log(`\n=== REPAIR COMPLETE ===`);
  console.log(`Seeded: ${seeded.length}/${allTickers.length} Explore tickers with REAL data`);
  if (failed.length > 0) {
    console.log(`Failed: ${failed.join(', ')}`);
    console.log('(These will auto-populate when users search for them)');
  }

  const { count: finalCount } = await supabase
    .from('stock_cache')
    .select('ticker', { count: 'exact', head: true });
  console.log(`\nFinal stock_cache rows: ${finalCount}`);
  console.log('All other stocks will populate on-demand via /api/stock when searched.');
}

main().catch(err => {
  console.error('Repair failed:', err);
  process.exit(1);
});
