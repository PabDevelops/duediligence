const fs = require('fs');
const path = require('path');
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

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
  // Get total count
  const { count } = await sb.from('stock_cache').select('ticker', { count: 'exact', head: true });
  console.log('Total rows in stock_cache:', count);

  // Get first 30 alphabetically
  const { data, error } = await sb
    .from('stock_cache')
    .select('ticker, data->name')
    .order('ticker')
    .limit(30);

  if (error) { console.error('Error:', error); return; }

  console.log('\nFirst 30 tickers (alphabetical):');
  data.forEach(r => console.log('  ' + r.ticker.padEnd(8) + ' -> ' + JSON.stringify(r.name)));

  // Get some from middle
  const { data: mid } = await sb
    .from('stock_cache')
    .select('ticker, data->name')
    .order('ticker')
    .range(1500, 1520);

  console.log('\nTickers 1500-1520 (middle):');
  mid.forEach(r => console.log('  ' + r.ticker.padEnd(8) + ' -> ' + JSON.stringify(r.name)));

  // Get last 10
  const { data: last } = await sb
    .from('stock_cache')
    .select('ticker, data->name')
    .order('ticker', { ascending: false })
    .limit(10);

  console.log('\nLast 10 tickers (alphabetical):');
  last.reverse().forEach(r => console.log('  ' + r.ticker.padEnd(8) + ' -> ' + JSON.stringify(r.name)));

  // Check if any fake-looking tickers exist
  const { data: fakeCheck } = await sb
    .from('stock_cache')
    .select('ticker, data->name')
    .in('ticker', ['EDJA', 'AIJA', 'UVOA', 'DQIA', 'BDRA', 'RXKA', 'JMLA']);

  console.log('\nChecking for fake tickers from screenshot (EDJA, AIJA, etc.):');
  console.log('  Found:', fakeCheck.length, 'rows');
  fakeCheck.forEach(r => console.log('    ' + r.ticker + ' -> ' + JSON.stringify(r.name)));

  // Check for known real tickers
  const { data: realCheck } = await sb
    .from('stock_cache')
    .select('ticker, data->name, data->marketCap, data->sector')
    .in('ticker', ['AAPL', 'MSFT', 'IONQ', 'RKLB', 'PLTR', 'RIVN', 'SOFI', 'HOOD']);

  console.log('\nChecking for known real tickers (AAPL, IONQ, RKLB, etc.):');
  realCheck.forEach(r => console.log('  ' + r.ticker.padEnd(8) + ' -> name=' + JSON.stringify(r.name) + ', mcap=' + r.marketCap + ', sector=' + r.sector));
})();
