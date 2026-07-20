// Test Finnhub stock symbols endpoint properly (following redirects)
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Load env
const envPath = path.join(__dirname, '..', '.env.local');
let fhKey = '';
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (m) {
      let val = m[2] || '';
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      if (m[1] === 'FINNHUB_API_KEY') fhKey = val.trim();
    }
  });
}

function followRedirect(url) {
  return new Promise((resolve, reject) => {
    const getter = url.startsWith('https') ? https : http;
    getter.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        console.log('Following redirect to:', res.headers.location.substring(0, 80) + '...');
        followRedirect(res.headers.location).then(resolve).catch(reject);
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          console.log('Response not JSON, first 200 chars:', data.substring(0, 200));
          reject(err);
        }
      });
    }).on('error', reject);
  });
}

// Alternative: Use Yahoo Finance v8 chart endpoint to get market cap for individual tickers
// This works without auth
async function getYahooMarketCap(ticker) {
  return new Promise((resolve, reject) => {
    https.get(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const meta = parsed?.chart?.result?.[0]?.meta;
          resolve({
            ticker,
            name: meta?.longName || meta?.shortName || ticker,
            marketCap: meta?.marketCap || null,
            price: meta?.regularMarketPrice,
            exchange: meta?.fullExchangeName
          });
        } catch (err) {
          resolve({ ticker, error: err.message });
        }
      });
    }).on('error', err => resolve({ ticker, error: err.message }));
  });
}

(async () => {
  console.log('=== Finnhub Stock Symbols (following redirects) ===');
  try {
    const symbols = await followRedirect(`https://finnhub.io/api/v1/stock/symbol?exchange=US&token=${fhKey}`);
    console.log(`Total US symbols: ${symbols.length}`);

    const types = {};
    symbols.forEach(s => { types[s.type] = (types[s.type] || 0) + 1; });
    console.log('\nSymbol types:', JSON.stringify(types, null, 2));

    const commonStocks = symbols.filter(s => s.type === 'Common Stock');
    console.log(`\nCommon Stocks: ${commonStocks.length}`);
    console.log('First 15:');
    commonStocks.slice(0, 15).forEach(s => {
      console.log(`  ${s.symbol.padEnd(8)} | ${(s.description || '').substring(0, 50)}`);
    });
  } catch (err) {
    console.log('Finnhub symbols failed:', err.message);
  }

  console.log('\n=== Yahoo v8 Market Cap Test (5 known small caps) ===');
  const testTickers = ['IONQ', 'RKLB', 'AFRM', 'SOFI', 'UPST', 'MNDY', 'CRWD', 'NET'];
  const results = await Promise.all(testTickers.map(t => getYahooMarketCap(t)));
  results.forEach(r => {
    if (r.marketCap) {
      const tier = r.marketCap > 2e9 ? 'MID/LARGE' : r.marketCap > 300e6 ? 'SMALL' : r.marketCap > 50e6 ? 'MICRO' : 'NANO';
      console.log(`  ${r.ticker.padEnd(8)} | ${(r.name || '').substring(0, 35).padEnd(37)} | MCap: $${(r.marketCap/1e9).toFixed(2)}B | ${tier}`);
    } else {
      console.log(`  ${r.ticker.padEnd(8)} | No market cap data | ${r.error || ''}`);
    }
  });
})();
