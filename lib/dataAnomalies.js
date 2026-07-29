import { supabase } from './supabase';

// Weekly-review log for the class of bug fixed on MNTN (see app/api/stock/route.js's
// sharesForCalc/xbrlSharesLookPartial comment): independent data sources disagreeing on a fact
// that should be a single number (shares outstanding, market cap, debt) is exactly the signal
// that caught that bug, just found by a user instead of caught automatically. This logs the same
// kind of disagreement for every ticker as it's fetched, so mismatches can be triaged from a list
// instead of waiting for someone to notice a wrong number on screen.
//
// Not a fix — sources that already have per-ticker reconciliation logic (VEON-style stale shares,
// ZBRA-style stale marketCap, MNTN-style single-class XBRL tag) still resolve to a single value
// upstream of this call. This only flags cases nobody's written a reconciliation rule for yet.
const THRESHOLD = 0.15;

// values: array of { source, value } — nulls are skipped. Fires and forgets; never throws into
// the caller, since a logging failure shouldn't fail the actual stock fetch.
export async function flagDataAnomaly(ticker, field, values) {
  try {
    const present = values.filter(v => v.value != null && v.value !== 0);
    if (present.length < 2) return;

    let worst = null;
    for (let i = 0; i < present.length; i++) {
      for (let j = i + 1; j < present.length; j++) {
        const a = present[i], b = present[j];
        const pctDiff = Math.abs(a.value - b.value) / Math.max(Math.abs(a.value), Math.abs(b.value));
        if (pctDiff > THRESHOLD && (!worst || pctDiff > worst.pctDiff)) {
          worst = { pctDiff, a, b };
        }
      }
    }
    if (!worst) return;

    await supabase.from('data_anomalies').upsert({
      ticker,
      field,
      detail: { sources: present, worstPair: [worst.a.source, worst.b.source] },
      pct_diff: +(worst.pctDiff * 100).toFixed(1),
      created_at: new Date().toISOString(),
      reviewed_at: null,
    }, { onConflict: 'ticker,field', ignoreDuplicates: false });
  } catch (e) {
    console.error(`flagDataAnomaly failed for ${ticker}/${field}:`, e);
  }
}
