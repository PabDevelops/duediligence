// ============================================================================
// Full-Market Populate Script — mega to nano cap, ~10,000 tickers
// ============================================================================
//
// Widens scripts/populateRealSmallCaps.js (which only kept sub-$2B names) to the
// whole cap range, and fixes two things that made that script risky to leave
// running for hours: it upserts incrementally every BATCH_SIZE tickers instead of
// holding everything in memory for a single insert at the end (an interruption
// used to mean losing the whole run), and it never deletes stock_cache — existing
// rows (including ones with full financials already backfilled by /api/stock on-
// demand) are left alone; this only fills in tickers that aren't there yet.
//
// Writes name/sector/marketCap/exchange only (Finnhub profile2) — financials are
// intentionally left null and get backfilled the first time a user opens that
// stock page, same as the small-caps script. That keeps this script to one
// Finnhub call per ticker instead of also hammering SEC EDGAR/Alpha Vantage for
// 10,000 tickers, and avoids seeding rows that read as "complete" without being.
//
// Run with: node scripts/populateFullMarket.js
// Resume: just run it again — it reloads which tickers already exist in
// stock_cache and skips them, and picks up the scan where populate_progress_full.json
// left off.
// Optional: node scripts/populateFullMarket.js --dry-run
// ============================================================================

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { createClient } = require('@supabase/supabase-js');

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
const TARGET_COUNT = 10000;
const PROGRESS_FILE = path.join(__dirname, 'populate_progress_full.json');
const WRITE_BATCH_SIZE = 200;

function fetchJson(url) {
  return new Promise((resolve) => {
    const getter = url.startsWith('https') ? https : http;
    getter.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode === 429) { resolve({ _rateLimited: true }); return; }
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchJson(res.headers.location).then(resolve);
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

async function getAllUsTickers() {
  console.log('Phase 1: Fetching US stock symbol list from Finnhub...');
  const symbols = await fetchJson(`https://finnhub.io/api/v1/stock/symbol?exchange=US&token=${FH_KEY}`);
  if (!Array.isArray(symbols)) {
    console.error('Failed to get symbol list:', symbols);
    process.exit(1);
  }
  const commonStocks = symbols.filter(s =>
    s.type === 'Common Stock' && /^[A-Z]{1,5}$/.test(s.symbol) && !s.symbol.includes('.')
  );
  console.log(`  Total symbols: ${symbols.length}`);
  console.log(`  Clean common stocks: ${commonStocks.length}`);
  return commonStocks;
}

async function getExistingTickers() {
  console.log('Phase 1b: Loading tickers already in stock_cache...');
  const existing = new Set();
  const PAGE_SIZE = 1000;
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('stock_cache')
      .select('ticker')
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) { console.error('  Error loading existing tickers:', error); break; }
    (data || []).forEach(r => existing.add(r.ticker));
    if (!data || data.length < PAGE_SIZE) break;
  }
  console.log(`  Already cached: ${existing.size} tickers`);
  return existing;
}

async function getProfileWithRetry(ticker, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const data = await fetchJson(`https://finnhub.io/api/v1/stock/profile2?symbol=${ticker}&token=${FH_KEY}`);
    if (data?._rateLimited) {
      await sleep(3000 + attempt * 2000);
      continue;
    }
    if (!data || data._parseError || !data.name) return null;
    return {
      ticker: data.ticker || ticker,
      name: data.name,
      marketCap: data.marketCapitalization ? data.marketCapitalization * 1e6 : null,
      sector: data.finnhubIndustry || null,
      exchange: data.exchange || null,
      ipo: data.ipo || null,
      weburl: data.weburl || null,
      country: data.country || null,
      logo: data.logo || null,
    };
  }
  return null;
}

function toRow(p) {
  return {
    ticker: p.ticker,
    updated_at: new Date().toISOString(),
    data: {
      name: p.name,
      sector: p.sector,
      exchange: p.exchange,
      marketCap: p.marketCap,
      country: p.country,
      weburl: p.weburl,
      ipo: p.ipo,
      // Intentionally null: populated on-demand by /api/stock on first view.
      currentPrice: null, priceChangePct: null, pe: null, beta: null,
      revGrowth: null, opMargin: null, grossMargin: null, fcfYield: null,
      roe: null, netDebt: null, cashVal: null, fcfVal: null, revVal: null,
      shareDilution: null, insiderOwnershipPct: null,
    },
  };
}

async function writeBatch(rows) {
  if (DRY_RUN || rows.length === 0) return;
  const { error } = await supabase.from('stock_cache').upsert(rows, { onConflict: 'ticker' });
  if (error) console.error(`  Batch upsert error (${rows.length} rows):`, error);
}

async function main() {
  const startTime = Date.now();
  const allTickers = await getAllUsTickers();
  const existing = await getExistingTickers();

  // Deterministic order (not shuffled) so resuming after a crash is just "start
  // index where we left off" instead of needing to persist a shuffled order.
  const candidates = allTickers.filter(t => !existing.has(t.symbol));

  let startIndex = 0;
  let withData = existing.size;
  if (fs.existsSync(PROGRESS_FILE)) {
    try {
      const saved = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
      if (typeof saved.candidateIndex === 'number') {
        startIndex = saved.candidateIndex;
        console.log(`  Resuming from candidate index ${startIndex} (${saved.timestamp})`);
      }
    } catch {}
  }

  const remaining = Math.max(TARGET_COUNT - withData, 0);
  console.log(`\nPhase 2: ${withData}/${TARGET_COUNT} already cached. Need ${remaining} more.`);
  console.log(`  Scanning up to ${candidates.length} uncached tickers, full cap range, no market-cap filter.`);
  console.log(`  Rate: 1 request per 1.1s (~55/min, under Finnhub 60/min limit)\n`);

  let pending = [];
  let processed = 0;
  let noData = 0;
  let i = startIndex;

  for (; i < candidates.length && withData < TARGET_COUNT; i++) {
    const ticker = candidates[i].symbol;
    const profile = await getProfileWithRetry(ticker);
    processed++;

    if (profile && profile.marketCap) {
      pending.push(toRow(profile));
      withData++;
    } else {
      noData++;
    }

    if (pending.length >= WRITE_BATCH_SIZE) {
      await writeBatch(pending);
      pending = [];
    }

    if (processed % 100 === 0) {
      const elapsed = ((Date.now() - startTime) / 60000).toFixed(1);
      const eta = ((candidates.length - i) * 1.1 / 60).toFixed(0);
      console.log(`  [${elapsed}min] scanned ${processed} (idx ${i}/${candidates.length}) | ${withData}/${TARGET_COUNT} total cached | ${noData} no-data | ETA to exhaust list: ${eta}min`);
      fs.writeFileSync(PROGRESS_FILE, JSON.stringify({
        candidateIndex: i + 1, processed, withData, noData, timestamp: new Date().toISOString(),
      }, null, 2));
    }

    await sleep(1100);
  }

  await writeBatch(pending);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`DONE — ${withData}/${TARGET_COUNT} tickers cached (${processed} scanned this run, ${noData} had no Finnhub data).`);
  console.log(`Time: ${((Date.now() - startTime) / 60000).toFixed(1)} minutes`);
  console.log(`${'='.repeat(60)}`);

  if (withData >= TARGET_COUNT || i >= candidates.length) {
    try { fs.unlinkSync(PROGRESS_FILE); } catch {}
  }
}

main().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
