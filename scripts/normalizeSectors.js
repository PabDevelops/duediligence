// ============================================================================
// Sector Normalization — one-off backfill for stock_cache.data.sector
// ============================================================================
//
// stock_cache.sector was populated from Finnhub's finnhubIndustry field, which returns
// GICS industry-group-level strings ("Metals & Mining", "Banking", "Biotechnology", ...)
// instead of the 11 broad sectors ("Basic Materials", "Financial Services", "Healthcare", ...)
// the screener/calendar sector filters expect. See lib/sectorMapping.js for the mapping table
// and app/api/stock/route.js's sector/industry assignment for the ongoing-ingestion fix.
//
// This script rewrites existing rows in place:
//   - data.sector    -> mapped to one of the 11 canonical sectors
//   - data.industry  -> the original granular value, preserved (only if not already set)
// Rows whose current sector is "N/A", null, or an unrecognized string are left untouched and
// counted separately — there's no reliable source to reclassify them from here.
//
// Run with: node scripts/normalizeSectors.js            (dry run — no writes, prints a report)
//           node scripts/normalizeSectors.js --apply     (writes the changes)
// ============================================================================

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { normalizeSector } = require('../lib/sectorMapping.js');

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

const APPLY = process.argv.includes('--apply');
const PAGE_SIZE = 1000;
const WRITE_BATCH_SIZE = 200;

async function fetchAllRows() {
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('stock_cache')
      .select('ticker, data')
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) { console.error('Error loading stock_cache:', error); break; }
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

async function writeBatch(rows) {
  if (!APPLY || rows.length === 0) return;
  const { error } = await supabase.from('stock_cache').upsert(rows, { onConflict: 'ticker' });
  if (error) console.error('  Write error:', error);
}

async function main() {
  console.log(APPLY ? 'Running LIVE (writes enabled)...' : 'Running DRY RUN (pass --apply to write)...');
  const rows = await fetchAllRows();
  console.log(`Loaded ${rows.length} rows from stock_cache.\n`);

  const toWrite = [];
  const mappedCounts = {}; // "raw -> canonical" : count
  const alreadyClean = {};
  const unmapped = {}; // raw value we don't recognize (or N/A/null) : count

  for (const row of rows) {
    const raw = row.data?.sector ?? null;
    const mapped = normalizeSector(raw);

    if (!mapped) {
      const key = raw === null ? '(null)' : raw;
      unmapped[key] = (unmapped[key] || 0) + 1;
      continue;
    }
    if (mapped === raw) {
      alreadyClean[raw] = (alreadyClean[raw] || 0) + 1;
      continue;
    }

    const key = `${raw} -> ${mapped}`;
    mappedCounts[key] = (mappedCounts[key] || 0) + 1;
    toWrite.push({
      ticker: row.ticker,
      updated_at: new Date().toISOString(),
      data: {
        ...row.data,
        sector: mapped,
        industry: row.data?.industry || raw,
      },
    });
  }

  console.log('=== Already canonical (no change) ===');
  Object.entries(alreadyClean).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${v.toString().padStart(5)}  ${k}`));

  console.log('\n=== Will be remapped ===');
  Object.entries(mappedCounts).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${v.toString().padStart(5)}  ${k}`));

  console.log('\n=== Left unmapped (no reliable classification) ===');
  Object.entries(unmapped).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${v.toString().padStart(5)}  ${k}`));

  console.log(`\nTotal rows: ${rows.length} | to remap: ${toWrite.length} | already clean: ${Object.values(alreadyClean).reduce((a, b) => a + b, 0)} | unmapped: ${Object.values(unmapped).reduce((a, b) => a + b, 0)}`);

  if (!APPLY) {
    console.log('\nDry run only — no rows written. Re-run with --apply to persist these changes.');
    return;
  }

  console.log(`\nWriting ${toWrite.length} rows in batches of ${WRITE_BATCH_SIZE}...`);
  for (let i = 0; i < toWrite.length; i += WRITE_BATCH_SIZE) {
    const batch = toWrite.slice(i, i + WRITE_BATCH_SIZE);
    await writeBatch(batch);
    console.log(`  Wrote ${Math.min(i + WRITE_BATCH_SIZE, toWrite.length)} / ${toWrite.length}`);
  }
  console.log('Done.');
}

main();
