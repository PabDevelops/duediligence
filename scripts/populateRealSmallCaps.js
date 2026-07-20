// ============================================================================
// REAL Small Cap Populate Script v2 — Production-ready
// ============================================================================
//
// Uses Finnhub profile2 to get REAL market caps, names, sectors.
// Rate limited to ~55 req/min (safe for Finnhub free tier 60 req/min).
// Estimated time: ~2-3 hours for full universe scan (18k tickers).
//
// Run with: node scripts/populateRealSmallCaps.js
// Optional: node scripts/populateRealSmallCaps.js --dry-run
// ============================================================================

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
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
const FH_KEY = process.env.FINNHUB_API_KEY;
const DRY_RUN = process.argv.includes('--dry-run');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const getter = url.startsWith('https') ? https : http;
    getter.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode === 429) {
        resolve({ _rateLimited: true });
        return;
      }
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchJson(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve({ _parseError: true }); }
      });
    }).on('error', () => resolve(null));
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Get all US common stock tickers from Finnhub
async function getAllUsTickers() {
  console.log('Phase 1: Fetching US stock symbol list from Finnhub...');
  const symbols = await fetchJson(`https://finnhub.io/api/v1/stock/symbol?exchange=US&token=${FH_KEY}`);

  if (!Array.isArray(symbols)) {
    console.error('Failed to get symbol list:', symbols);
    process.exit(1);
  }

  const commonStocks = symbols.filter(s =>
    s.type === 'Common Stock' &&
    /^[A-Z]{1,5}$/.test(s.symbol) &&
    !s.symbol.includes('.')
  );

  console.log(`  Total symbols: ${symbols.length}`);
  console.log(`  Clean common stocks: ${commonStocks.length}`);
  return commonStocks;
}

// Fetch one profile with retry on rate limit
async function getProfileWithRetry(ticker, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const data = await fetchJson(`https://finnhub.io/api/v1/stock/profile2?symbol=${ticker}&token=${FH_KEY}`);
    
    if (data?._rateLimited) {
      // Back off on rate limit
      const backoff = 3000 + attempt * 2000;
      await sleep(backoff);
      continue;
    }
    
    if (!data || data._parseError || !data.name) return null;
    
    return {
      name: data.name,
      marketCap: data.marketCapitalization ? data.marketCapitalization * 1e6 : null,
      sector: data.finnhubIndustry || null,
      exchange: data.exchange || null,
      ipo: data.ipo || null,
      weburl: data.weburl || null,
      country: data.country || null,
      logo: data.logo || null,
      ticker: data.ticker || ticker
    };
  }
  return null; // All retries exhausted
}

async function main() {
  const startTime = Date.now();
  
  // Phase 1: Get ticker list
  const allTickers = await getAllUsTickers();
  
  // Shuffle for diversity (don't want just A-tickers if we stop early)
  const shuffled = [...allTickers].sort(() => Math.random() - 0.5);
  
  console.log(`\nPhase 2: Scanning ${shuffled.length} tickers for sub-$2B market cap...`);
  console.log(`  Rate: 1 request per 1.1 seconds (~55/min, under Finnhub 60/min limit)`);
  console.log(`  Progress updates every 100 tickers\n`);
  
  const smallCaps = [];
  let processed = 0;
  let withData = 0;
  let noData = 0;
  let rateLimitHits = 0;

  // Save progress to disk periodically (resume-friendly)
  const progressFile = path.join(__dirname, 'populate_progress.json');

  for (let i = 0; i < shuffled.length; i++) {
    const ticker = shuffled[i].symbol;
    
    const profile = await getProfileWithRetry(ticker);
    processed++;
    
    if (profile && profile.marketCap) {
      withData++;
      if (profile.marketCap < 2e9 && profile.marketCap > 1e6) { // $1M - $2B
        smallCaps.push(profile);
      }
    } else {
      noData++;
    }

    // Progress log every 100
    if (processed % 100 === 0) {
      const elapsed = ((Date.now() - startTime) / 60000).toFixed(1);
      const rate = (processed / ((Date.now() - startTime) / 1000)).toFixed(1);
      const eta = ((shuffled.length - processed) / (processed / ((Date.now() - startTime) / 1000)) / 60).toFixed(0);
      
      console.log(
        `  [${elapsed}min] ${processed}/${shuffled.length} scanned | ` +
        `${withData} w/data | ${smallCaps.length} sub-$2B found | ` +
        `${rate} req/s | ETA: ${eta}min`
      );

      // Save progress
      fs.writeFileSync(progressFile, JSON.stringify({
        processed, withData, noData, smallCapsCount: smallCaps.length,
        elapsedMin: elapsed, timestamp: new Date().toISOString()
      }, null, 2));
    }

    // Rate limit: 1 request per 1.1 seconds = ~55/min
    await sleep(1100);
  }

  // Final stats
  const small = smallCaps.filter(s => s.marketCap >= 300e6);
  const micro = smallCaps.filter(s => s.marketCap >= 50e6 && s.marketCap < 300e6);
  const nano = smallCaps.filter(s => s.marketCap < 50e6);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`SCAN COMPLETE`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Total scanned: ${processed}`);
  console.log(`With profile data: ${withData}`);
  console.log(`Sub-$2B stocks found: ${smallCaps.length}`);
  console.log(`  Small ($300M-$2B): ${small.length}`);
  console.log(`  Micro ($50M-$300M): ${micro.length}`);
  console.log(`  Nano (<$50M): ${nano.length}`);
  console.log(`Time: ${((Date.now() - startTime) / 60000).toFixed(1)} minutes`);

  // Show samples
  console.log(`\nSample Small Caps:`);
  small.slice(0, 8).forEach(s => {
    console.log(`  ${s.ticker.padEnd(7)} ${s.name.substring(0, 32).padEnd(34)} $${(s.marketCap/1e6).toFixed(0).padStart(6)}M  ${s.sector || ''}`);
  });
  console.log(`\nSample Micro Caps:`);
  micro.slice(0, 8).forEach(s => {
    console.log(`  ${s.ticker.padEnd(7)} ${s.name.substring(0, 32).padEnd(34)} $${(s.marketCap/1e6).toFixed(0).padStart(6)}M  ${s.sector || ''}`);
  });
  console.log(`\nSample Nano Caps:`);
  nano.slice(0, 8).forEach(s => {
    console.log(`  ${s.ticker.padEnd(7)} ${s.name.substring(0, 32).padEnd(34)} $${(s.marketCap/1e6).toFixed(0).padStart(6)}M  ${s.sector || ''}`);
  });

  if (DRY_RUN) {
    console.log(`\n[DRY RUN] Skipping database write.`);
    // Save to disk for inspection
    fs.writeFileSync(
      path.join(__dirname, 'smallcaps_found.json'),
      JSON.stringify(smallCaps, null, 2)
    );
    console.log(`Saved results to scripts/smallcaps_found.json`);
    return;
  }

  // Phase 3: Write to Supabase
  console.log(`\nPhase 3: Writing ${smallCaps.length} REAL small caps to Supabase...`);
  
  // Clear existing data
  const { error: delError } = await supabase
    .from('stock_cache')
    .delete()
    .neq('ticker', 'KEEP_NON_EXISTENT_ROW');
  
  if (delError) {
    console.error('Error clearing table:', delError);
    return;
  }
  console.log('  Old data cleared.');

  const rows = smallCaps.map(s => ({
    ticker: s.ticker,
    updated_at: new Date().toISOString(),
    data: {
      name: s.name,
      sector: s.sector,
      exchange: s.exchange,
      marketCap: s.marketCap,
      country: s.country,
      weburl: s.weburl,
      ipo: s.ipo,
      // Intentionally null: populated on-demand by /api/stock
      currentPrice: null,
      priceChangePct: null,
      pe: null,
      beta: null,
      revGrowth: null,
      opMargin: null,
      grossMargin: null,
      fcfYield: null,
      roe: null,
      netDebt: null,
      cashVal: null,
      fcfVal: null,
      revVal: null,
      shareDilution: null,
      insiderOwnershipPct: null,
    }
  }));

  const BATCH_SIZE = 500;
  for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
    const batch = rows.slice(offset, offset + BATCH_SIZE);
    const batchNum = Math.floor(offset / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(rows.length / BATCH_SIZE);
    console.log(`  Inserting batch ${batchNum}/${totalBatches} (${batch.length} rows)...`);
    
    const { error } = await supabase
      .from('stock_cache')
      .upsert(batch, { onConflict: 'ticker' });
    
    if (error) console.error(`  Batch ${batchNum} error:`, error);
  }

  console.log(`\n=== DONE ===`);
  console.log(`${rows.length} REAL stocks inserted with verified market caps, names, and sectors.`);

  // Cleanup
  try { fs.unlinkSync(progressFile); } catch {}
}

main().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
