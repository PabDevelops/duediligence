# Provisional financial inputs (integrity policy v2)

This policy separates missing provenance from proven incompatibility. It does not change the scoring, valuation, DCF, scenario or sector arithmetic.

## Three states, with missing as a separate availability state

- Verified: the field's exact period, currency, scope and source are supplied and compatible with its dependencies. A recovered date does not certify the company's accounting.
- Provisional: a reported amount or legacy annual observation has incomplete provenance, without evidence of incompatible operands. Unknown dates stay unknown. A fiscal-year label is never converted to 1 January/31 December by assumption.
- Blocked: contradictory dates, FY/TTM, currencies or consolidation; ambiguous duplicate history; impossible EPS/price multiple; or FCF without compatible cash-flow/CAPEX components. Raw standalone operands remain available where independently usable. Rejected evidence is retained.
- Missing: the field was not supplied. It is not zero.

Annual history contracts support provisional same-year joins with uniqueness checks. This is an explicit legacy assumption, not confirmation that both fiscal windows match. Exact conflicting dates override a shared year label. H1/Q/TTM observations cannot be placed in annual histories. Synthetic year labels created by the old quoteSummary fallback are removed from annual arrays; an undated reported aggregate can remain provisional outside that history.

Reported ratios may stay provisional if their ingredients are unavailable. The policy does not recompute them from invented ingredients. Known incompatible ingredients still block them. Reported trailing EPS is not tested as if it were annual income divided by current issued shares. That unresolved distinction warns; an explicit same-period weighted-denominator contradiction blocks EPS. A price/EPS/PER contradiction blocks that multiple without erasing income or independent cash metrics.

The v1 rejected payload can be reevaluated under v2 so a previously quarantined legacy record is not permanently lost. Repeated validation is idempotent and retains evidence of blocked historical points. v2 does not blindly restore blocked values on every cache hit.

## Recovery without changing amounts

`financialPeriodRecovery.js` recovers only uniquely matching concepts/amounts. SEC candidates include actual annual dates and fiscal-year + current YTD - prior YTD windows. Ambiguous matches remain provisional. Yahoo annual `12M` records supply their actual `asOfDate`, currency and duration, while a missing start stays null. A 12M duration does not reveal an exact fiscal start for a 52/53-week filer. Unknown consolidation remains `provider-unspecified`.

Recovery is called on data already fetched by the existing full SEC/Yahoo acquisition path, so it adds no per-visit provider request. Cache-only reads retain provisional labels until the normal refresh cycle supplies better metadata. The saved comparison also matches legacy snapshots against direct provider responses, without changing their prices or monetary amounts. The test fixtures contain raw provider facts, never session cookies or crumbs. Yahoo's endpoints are unofficial; no public API guarantee is claimed.

## Model-specific dependencies and UI

`financialDataPolicy.js` preserves standalone figures and records per-calculation status. `financialCalculations.js` and the engine normalization adapter mask only inappropriate inputs for the calculation concerned. Industrial scenarios and bank scenarios use separate dependency groups. The original model functions remain unchanged. Valuation can still use an independently available income multiple when a cross-period operating-margin projection is blocked. Existing unrelated fatal validations remain in force.

The fact sheet, Numbers and detailed analysis display warnings; score cards, watchlist and screener identify provisional data. Existing detailed validation receives field-specific warnings. A provisional score is a model result conditional on unresolved inputs, including any original model defaults. It is not a professionally verified company rating.

## Spanish documentation stays isolated

The administrative importer explicitly uses `sanitizeFinancialDataStrict`. Draft official facts are not reintroduced through the permissive legacy mode, activated or published. Existing review, approval, revocation and rollback tests remain. None of the new snapshot results depends on the unapproved ByteTravel document drafts.

## Reproducible checks

`npm test` runs the two policies, recovery tests, saved snapshot comparisons, acquisition endpoint replay and original engine tests offline. Set `BULLTRACE_REPORT_DIR` to save comparisons and `tests.json` via Vitest's JSON reporter. Compare the same original snapshots under the old strict policy, v2 legacy fallback and v2 with recovered provenance. Do not treat recovered field/history annotations as a count of distinct fiscal periods.

Direct provider checks were read-only: seven Yahoo annual responses returned HTTP 200, and SEC AAPL facts were retained from the previous direct official download. Runtime test DB/quote calls are mocked. Full compilation still needs the project's Supabase configuration for page-data collection. UI notices have compiled, but have not been tested in an authenticated browser session or on mobile. Provider latency, cache migration at scale and all production checks remain untested. No push, merge or deployment is part of this revision.
