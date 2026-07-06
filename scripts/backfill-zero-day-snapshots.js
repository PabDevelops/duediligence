// One-time backfill: for every existing user in portfolio_snapshots, insert a real
// $0/$0 snapshot dated the day before their earliest recorded snapshot — the portfolio
// genuinely was worth $0 before it existed, so the growth chart's MAX/1Y/etc. views can
// read from day 1 (like Trading 212) instead of only starting once daily snapshots piled up.
// Going forward, app/api/portfolio/snapshot/route.js does this automatically for new users;
// this script only covers accounts that already had snapshot rows before that change shipped.
//
// Usage: node scripts/backfill-zero-day-snapshots.js

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local');
  const text = fs.readFileSync(envPath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

async function main() {
  loadEnvLocal();
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: rows, error } = await supabase
    .from('portfolio_snapshots')
    .select('user_id, date')
    .order('user_id', { ascending: true })
    .order('date', { ascending: true });
  if (error) throw error;

  const earliestByUser = new Map();
  for (const r of rows) {
    if (!earliestByUser.has(r.user_id)) earliestByUser.set(r.user_id, r.date);
  }

  const toInsert = [];
  for (const [userId, earliestDate] of earliestByUser) {
    const d = new Date(earliestDate + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    const zeroDate = d.toISOString().slice(0, 10);
    toInsert.push({ user_id: userId, date: zeroDate, value: 0, cost: 0 });
  }

  if (toInsert.length === 0) {
    console.log('No users with snapshots found — nothing to backfill.');
    return;
  }

  // onConflict skips users who already have a row on that date (e.g. re-running this script,
  // or someone whose zero-day already landed via the live route).
  const { error: upsertErr, data: result } = await supabase
    .from('portfolio_snapshots')
    .upsert(toInsert, { onConflict: 'user_id,date', ignoreDuplicates: true })
    .select();
  if (upsertErr) throw upsertErr;

  console.log(`Backfilled zero-day snapshot for ${toInsert.length} user(s). ${result?.length ?? 0} row(s) newly inserted (rest already existed).`);
}

main().catch(e => { console.error(e); process.exit(1); });
