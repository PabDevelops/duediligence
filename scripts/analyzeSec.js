const https = require('https');

function fetchSecTickers() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'www.sec.gov',
      path: '/files/company_tickers.json',
      headers: { 'User-Agent': 'DueDiligenceBot admin@duediligence.com' }
    };
    https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(Object.values(parsed));
        } catch (err) { reject(err); }
      });
    }).on('error', reject);
  });
}

(async () => {
  const all = await fetchSecTickers();
  console.log('Total SEC entries:', all.length);
  console.log('\nFirst 20 entries (by CIK order):');
  all.slice(0, 20).forEach((e, i) => 
    console.log(`  ${String(i).padStart(4)} | CIK ${String(e.cik_str).padStart(10)} | ${e.ticker.padEnd(6)} | ${e.title}`)
  );

  // Filter to clean common stocks
  const clean = all.filter(s => /^[A-Z]{1,5}$/.test(s.ticker));
  console.log('\nClean tickers:', clean.length);

  // Show a sample of what we NEED: small caps. But SEC doesn't have market cap data!
  console.log('\n--- THE PROBLEM ---');
  console.log('SEC company_tickers.json does NOT contain market cap data.');
  console.log('It only has: cik_str, ticker, title');
  console.log('So we cannot filter by market cap from this source alone.');
  console.log('We need a source that provides actual market cap data.');

  // Show the fields available
  console.log('\nSample entry fields:', JSON.stringify(all[0], null, 2));
})();
