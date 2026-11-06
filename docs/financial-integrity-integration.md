# Financial integrity integration

Prepared on production `main` commit `2961c57b23bb66a3bafe84bb484d1f5336559188`,
including its score-calibration change (#48). This is an input-quality correction,
not a replacement scoring policy.

## Scope and preservation

- Integrates the financial-period corrections (`7e12e85`), provisional policy
  (`695425e`), screener pagination checks (`48724c6`) and response projection
  (`54dc23e`). The shared provider statement helpers from `8e7db47` are included;
  its document importer, drafts and administrative workflow are excluded.
- `stockScoring.js`, `companyScoreCalibration.js`, the production calibration
  fixtures/tests/documentation, sector rules and all engine arithmetic modules
  are identical to the production base. Only input normalization, validation,
  dependency guards and quality-status presentation change around them.
- Resolves the overlapping Numbers import while retaining `getCompanyHeaderScores`
  from #48. A regression test also demonstrated that Numbers could recompute
  Quality without the fact sheet's cross-period dependency mask. The adapter now
  reuses the same validated engine result in both views; no weights or formulas
  were changed.
- Provisional status is additional evidence, not a different grade. Sector-specific
  scores remain available when an unrelated industrial FCF dependency is absent.
  Invalid inputs can legitimately change a result or make it unavailable.

## Data, cache and existing users

- No database migration, table/column/index/RLS change, dependency addition or
  account/authentication change. Portfolio transactions, cash, cost basis, imports,
  Trading 212 credentials/synchronization and watchlist mutation handlers are not
  changed. Watchlist GET applies financial validation to the shared cached quote
  data; its user/list assignments are retained.
- Financial validation is applied to `stock_cache` reads and ordinary existing
  cache refresh writes. Provenance/quality metadata are additive JSON fields;
  incompatible originals are retained as rejected evidence. There is no bulk
  rewrite, cache deletion or forced refresh. Revalidation is idempotent.
- Period recovery reuses SEC/Yahoo responses already fetched by the normal data
  acquisition path. It adds no provider request to an ordinary cache hit. Legacy
  records can remain provisional until their normal refresh recovers metadata.
- The screener still reads 1,000-row pages and memoizes the result for 60 seconds.
  It validates server-side and caches/returns only the displayed/filter fields and
  compact status, rather than rejected histories or provenance for every row.
  Cold reads still require financial evidence from the database. This PR does not
  claim that the database scan became faster; the measured improvement concerns
  the HTTP payload and serialization. No live database load test was repeated.

## Validation on the integrated tree

- 292 automated tests pass, including production calibration, the eight saved
  international/Spanish financial snapshots, acquisition replay, cache idempotence,
  11,232-row pagination/cache-TTL and bounded screener response tests.
- Full `npm run build` succeeds using the pre-existing valid local development
  configuration, pointed at the paused isolated Supabase project. No project was
  resumed, no credential invented, and no production database used.
- On identical synthetic 11,232-row inputs, the production field projection is
  5,371,457 bytes, unrestricted validated output 112,568,713 bytes, and integrated
  compact output 3,600,330 bytes. These are local serialization measurements,
  not live production traffic or database timings.
- ESLint over changed JavaScript finds 11 errors and two warnings already present
  in the corresponding `main` source. Comparing rule IDs and source statements
  shows no new or changed findings. The existing CI lint scope remains unchanged.
- The source and test-only document importers, PDF tools, official-report drafts,
  Spanish automation proof of concept and staging-specific configuration are not
  part of this integration.

`vercel.json` disables Git deployment for this PR branch only. Production's `main`
deployment rule and cron configuration are unchanged. Review/merge and deployment
remain separate user-controlled steps; this work does neither.
