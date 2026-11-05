# Historical strict-policy notes

Runtime policy in this document is superseded by [provisional-financial-data.md](provisional-financial-data.md). The local official-document administrative workflow remains strict and isolated.

# Financial integrity and Spanish official-report comparison

This change validates inputs. Valuation/scoring/DCF/scenario arithmetic and sector rules are unchanged. `lib/engine/input.js` changes provenance labels only. Three statement helpers and their split helper moved from the stock route to `lib/financialStatements.js` so the offline importer reuses the existing arithmetic.

## Runtime behavior

`sanitizeFinancialData()` guards fresh and cached `/api/stock` responses, stock-cache writes, watchlist enrichment, screener, movers and earnings enrichment. ETFs retain their separate data shape. Unsupported values become null; original rejected values and histories remain in `financialIntegrity.rejected`. The rejected payload is diagnostic evidence, never input to a score.

Flow windows require exact start/end, basis (FY/H1/Q/TTM), currency and scope. Balance instants require an exact closing date. History joins use period identities; matching calendar labels or equal array lengths are insufficient. Monetary histories must match quote currency after an evidenced conversion. A missing FX rate is null, not 1. SEC companyfacts shares remain in their declared units, including values below a million.

Only FY points belong in annual flow arrays. Annual balance snapshots must coincide with the selected fiscal closes. When multiple fiscal windows would collide under the existing year-based consumer, ambiguous points are withheld. Quarters need four contiguous, exact periods before TTM aggregation. FY plus current YTD minus prior YTD requires compatible source windows. Missing CAPEX never implies zero, and OCF never substitutes for FCF. FCF is also checked against its components. EPS/PER require period-compatible weighted shares and income, with explicit rounding tolerance; current issued shares are not a weighted denominator.

**Coverage cost:** legacy cache records with `{year,val}` cannot establish exact fiscal identity. They are quarantined, including US/UK records. Yahoo commonly omits period starts; new Yahoo data with that omission is also withheld. This is a deliberate N/D result, not proof that the financial amount itself was wrong. Refetching SEC restores supported facts. Official administrative imports can restore other facts. Do not deploy expecting unchanged coverage.

Validated partial responses retain the current cache TTL to prevent repeated failed acquisitions on every visit. The importer itself never calls the app or a financial provider. Full cache-row reads now support cross-field validation in screener/movers; measure egress before deployment because discarded evidence increases payload size. No database schema, permissions or production records were changed by this work.

## Local administrative workflow

Run with Node 22+ from the repository. No new dependency is required. Obtain the exact PDF from the manifest's official URL yourself; the CLI does not scrape or fetch. The PDF SHA-256 must match. The manifest records source page (one-based PDF page), exact period, original number, declared scale/currency, consolidation, extraction method and audit status. Source excerpts in the sample are numeric fragments, with a separate source-row label; they are not a full-table transcription.

```
node scripts/importSpanishFinancials.mjs stage --store work/official-review --manifest data/official-financials/byte-fy2025.draft.json --pdf work/byte2025.pdf --actor OPERATOR
node scripts/importSpanishFinancials.mjs history --store work/official-review
node scripts/importSpanishFinancials.mjs preview --store work/official-review --ids VERSION_HASH --snapshot work/BYTE.MC.json --out work/preview.json
```

Replace uppercase arguments with actual values. Stage prints the immutable version hash. Stage is idempotent. Preview is explicitly unapproved and cannot publish. The two supplied ByteTravel drafts were staged against downloaded PDFs and remain unapproved.

After an administrator has checked the actual source tables, units, dates, signs, page count and consolidation:

```
node scripts/importSpanishFinancials.mjs review --store work/official-review --id VERSION_HASH --actor REVIEWER --reason "Checked the specified source pages and period columns"
node scripts/importSpanishFinancials.mjs approve --store work/official-review --id VERSION_HASH --actor REVIEWER --reason "Approved this exact immutable transcription"
node scripts/importSpanishFinancials.mjs activate --store work/official-review --ids VERSION_HASH --actor REVIEWER --reason "Use only for local comparison"
node scripts/importSpanishFinancials.mjs compare --store work/official-review --snapshot work/BYTE.MC.json --out work/comparison.json
```

A snapshot is the existing `/api/stock`/`stock_cache.data` shape, supplied locally. Output uses that same shape plus provenance; a cache key includes the input snapshot and source versions. It does not invalidate or update live `stock_cache`. No publication command exists. No admin UI was added.

Rollback: activate a previously approved set of version hashes, or an empty set by omitting `--ids`. Revoke a bad version with the `revoke` command. Old versions/documents/events remain. Revoked versions cannot be activated. Equal-rank conflicting facts are rejected; audited facts cannot be downgraded to a preliminary replacement. Separate individual and consolidated facts never merge. Stage/review/approval/activation/revocation events are ordered and hash chained. Versions and PDFs are content addressed and checked again when read. An exclusive local lock prevents concurrent writers.

This is a trusted local administration tool, not an authenticated multi-user service. Actor names are recorded claims, not verified identities. The filesystem owner can alter storage. Page count and meaning are checked by the reviewer; the CLI checks the document fingerprint and basic PDF header/size, not PDF rendering, audit signatures or full accounting semantics. There is no automatic PDF/OCR extraction and no claim that the numeric snippet alone proves the selected column. A crashed writer can leave a lock; inspect/restore the store from backup before removing an orphan lock. This store is not a substitute for a transactional production database.

## ByteTravel limits

Drafts cover FY2024/FY2025 (2024 comparative in audited 2025 accounts) and H1 2025/H1 2026 from reviewed statements. Annual histories stay annual. TTM uses the existing FY-minus-prior-YTD-plus-current-YTD arithmetic, with component provenance. Interim balances remain available separately.

CAPEX/FCF, weighted shares, EPS/PER, gross debt and ROIC remain withheld where evidence is incomplete. The drafts do not infer blank CAPEX as zero, convert capitalized development into a cash payment, copy adjusted EBITDA into EBIT, or infer organic growth from absence of acquisitions. No five-year audited history has been verified. Other Spanish issuers have snapshot regression checks, not approved imported documents.

## Verification

```
npm ci --ignore-scripts
npm test
npx eslint lib/financialIntegrity.js lib/financialStatements.js lib/spanishFinancials lib/engine/input.js app/api/stock/route.js app/api/stock/route.integrity.test.js app/api/watchlist/route.js app/api/movers/route.js app/api/earnings/route.js lib/screenerData.js scripts/importSpanishFinancials.mjs
npm run build
```

Snapshot tests run offline for BYTE, ALC, RBT, SCO, GRI, ART, AAPL and LLOY.L. The SEC endpoint test replays trimmed actual AAPL companyfacts; quote/profile/DB calls are mocked, so it is not a live end-to-end market-data test. Test PDFs are clearly synthetic. Importer fingerprint checks were separately run on the real ByteTravel files.

Optional: set `BULLTRACE_REPORT_DIR` to an existing output directory to save detailed snapshot comparisons. `BULLTRACE_OFFICIAL_PREVIEW` can reference an unapproved CLI preview to evaluate it with the unchanged engines. These are reports only.

Build compiled successfully locally but final page-data collection failed because `NEXT_PUBLIC_SUPABASE_URL` and service configuration are absent in this checkout. No real credentials were obtained or added to bypass it. Full build, staging deployment, connected-provider checks and performance testing remain prerequisites for release. Nothing was pushed, merged or deployed.
