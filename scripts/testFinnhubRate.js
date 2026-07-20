// Quick test: How many Finnhub profile2 calls can we do per minute?
// Also verify the data quality for known small caps

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

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

const FH_KEY = process.env.FINNHUB_API_KEY;

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const getter = url.startsWith('https') ? https : http;
    getter.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchJson(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (err) { resolve({ error: data.substring(0, 100) }); }
      });
    }).on('error', reject);
  });
}

(async () => {
  // Test with known small/micro/nano caps
  const testTickers = [
    'IONQ',    // IonQ - quantum computing, should be small/mid
    'RKLB',    // Rocket Lab
    'UPST',    // Upstart
    'DOCS',    // Doximity
    'GENI',    // Genius Sports
    'DM',      // Desktop Metal
    'ASTS',    // AST SpaceMobile
    'STEM',    // Stem Inc
    'AEHR',    // Aehr Test Systems
    'SOUN',    // SoundHound
    'BTDR',    // Bitdeer
    'DNA',     // Ginkgo Bioworks
    'BIRD',    // Allbirds
    'OUST',    // Ouster
    'LUNR',    // Intuitive Machines
  ];

  console.log('=== Finnhub Profile2 Quality Check ===\n');
  
  for (const ticker of testTickers) {
    const data = await fetchJson(`https://finnhub.io/api/v1/stock/profile2?symbol=${ticker}&token=${FH_KEY}`);
    
    if (data.name) {
      const mcap = data.marketCapitalization ? data.marketCapitalization * 1e6 : null;
      const tier = mcap ? (mcap > 2e9 ? 'MID+' : mcap > 300e6 ? 'SMALL' : mcap > 50e6 ? 'MICRO' : 'NANO') : '???';
      console.log(`  ${ticker.padEnd(6)} | ${data.name.substring(0, 30).padEnd(32)} | MCap: $${mcap ? (mcap/1e6).toFixed(0)+'M' : 'N/A'} | ${tier.padEnd(5)} | Sector: ${data.finnhubIndustry || 'N/A'}`);
    } else {
      console.log(`  ${ticker.padEnd(6)} | NO DATA | Response: ${JSON.stringify(data).substring(0, 80)}`);
    }
    
    // Small delay to avoid rate limit
    await new Promise(r => setTimeout(r, 600));
  }

  // Now test rate limit: how fast can we go?
  console.log('\n=== Rate Limit Test: 30 quick calls ===');
  const startTime = Date.now();
  let success = 0;
  let rateLimited = 0;
  
  const quickTickers = ['A', 'AA', 'AAL', 'AAP', 'AAPL', 'ABBV', 'ABC', 'ABCL', 'ABNB', 'ABT',
                        'ACGL', 'ACM', 'ACN', 'ADBE', 'ADI', 'ADM', 'ADP', 'ADSK', 'AEE', 'AEP',
                        'AES', 'AFL', 'AIG', 'AIZ', 'AJG', 'AKAM', 'ALB', 'ALGN', 'ALK', 'ALL'];
  
  for (const t of quickTickers) {
    const data = await fetchJson(`https://finnhub.io/api/v1/stock/profile2?symbol=${t}&token=${FH_KEY}`);
    if (data.name) success++;
    else if (data.error && String(data.error).includes('429')) rateLimited++;
    else rateLimited++;
  }
  
  const elapsed = Date.now() - startTime;
  console.log(`  ${success} success, ${rateLimited} failed/rate-limited in ${elapsed}ms`);
  console.log(`  Rate: ${(success / (elapsed/1000)).toFixed(1)} successful req/sec`);
  console.log(`  At this rate, 8000 tickers would take: ${(8000 / (success / (elapsed/1000)) / 60).toFixed(1)} minutes`);
})();
