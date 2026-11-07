# Growth, Value and Quality calibration

This policy changes only the three independent company scores. It is an explicit scoring proposal, not a statistically fitted model or a prediction of investment returns. It has no ticker-specific rules and produces no global grade. The compact header keeps its existing appearance: category labels and colored letters, without /100.

## Data and isolation

Inputs come exclusively from the existing BullTrace `/api/stock` payload and existing engine computations. No API, provider, cache, classification, benchmark, financial formula or valuation result is changed. `lib/stockScoring.js` and `lib/engine/**` remain untouched: legacy CBS/GQS also feed valuation functions and cannot safely be recalibrated in place.

`lib/companyScoreCalibration.js` reuses `normalizeInput`, `classifyBusiness`, `computeMomentum`, `computeQuality`, `computeValuation` and validation. The header passes its existing engine result; Numbers calculates only these existing components, without running DCF or scenarios again. Both surfaces call `getCompanyHeaderScores` and show the same policy. Per-metric table colors and original financial table values are unchanged. The obsolete claim that the header is a global blend is removed; the existing moat display stays separate and contributes nothing.

The six real examples are frozen API responses captured on 2026-11-05. Their payload identifies the existing international source as Yahoo Finance. They are application snapshots, not independently verified company filings. Public numeric inputs and annual histories are stored in `lib/__fixtures__/scoreCalibration.js`; prices are frozen for reproducible comparisons.

### Existing metrics and provenance

| Inputs | Existing source/calculation | Availability in the six cases |
| --- | --- | --- |
| Revenue, operating/net income, FCF, capex and annual histories | Existing Yahoo route; US listings use the existing SEC/Finnhub paths | Available; 2022–2025 except TSK 2023–2025 |
| Current revenue growth | API `revGrowth`, normalized by the engine | Available in all six |
| Recent revenue-growth median | `computeEasyMode().growthCagrPct` | Available; despite its name it is the median of recent annual growth rates, not a CAGR |
| Acceleration, FCF/EPS direction | `computeMomentum().snapshots` | Annual comparisons available; no quarterly series in these snapshots |
| P/E, EV/EBIT, P/FCF and applicable alternatives | `computeValuation().methods`; uses the existing business profile and benchmarks | P/E and EV/EBIT available in all six; cyclical profiles exclude P/FCF |
| Return, margin, FCF conversion, stability and balance component scores | `computeQuality().components` | Available except TSK margin stability (requires at least four annual points) |
| SBC | Existing `sbcVal` | Reported zero for GAM; N/D for the other five |
| Insider ownership | Existing `insiderOwnershipPct` | N/D in all six; excluded from the new scores |
| Publication date, organic growth, quarterly confirmation | Existing payload fields | N/D in all six; confidence cannot be high |
| Incremental invested capital | Existing assets/current-liability histories | Incomplete; not fabricated or scored |
| EPS CAGR | Existing `epsCagr` | Not used: the API can replace an unusable EPS CAGR with capped revenue growth, so it is not reliable evidence of EPS growth |

FCF is used as supplied by the existing application. Its route has fallbacks when historical capex/FCF is unavailable; the new policy cannot certify provenance that the payload does not distinguish. A missing SBC value is not asserted to be zero: an available P/FCF is labeled as published cash flow, with the unconfirmed SBC adjustment disclosed and confidence limited.

## Weights before and after

| Dimension / metric | Previous header policy | New standard policy |
| --- | --- | --- |
| Growth: current revenue growth | 50% | 45% |
| Growth: recent revenue-growth median | 50% | 25% |
| Growth: acceleration | 0% | 15% |
| Growth: FCF direction | 0% | 15% |
| Value: P/FCF | 55% | 40% |
| Value: FCF yield | 45% (inverse of the same cash-flow multiple) | 0%; never counted as another signal |
| Value: P/E | 0% | 30% |
| Value: EV/EBIT | 0% | 30% |
| Quality: returns | 13–20%, depending on market-cap tier | 25% |
| Quality: operating margin | 13–20% | 15% |
| Quality: FCF generation | Runway score / cash bonus | 15% |
| Quality: cash conversion | 0% | 15% |
| Quality: margin stability | Post-score multiplier | 15% |
| Quality: balance / interest coverage | Separate debt and liquidity scores of 13–20% each | 15% combined |
| Quality: gross margin, insider ownership, dilution and cash bonus | Other variable weights and bonus | No additional contribution |

Previous Quality was CBS: five fundamental components weighted `(1 − capitalDisciplineWeight) / 5`, three discipline components weighted `capitalDisciplineWeight / 3`, a possible +0.2 cash bonus on its 1–5 scale, and a stability multiplier. Discipline weight was 0% for mid/large/mega, 20% small, 30% micro and 35% nano. Those original calculations remain unchanged for their other consumers.

### Growth normalizations

Piecewise linear scoring uses the existing `interp` helper. Values are percentage points; these are scoring anchors, not new financial metrics or forecasts.

- Revenue growth anchors `(growth, score)`: `(-30,0), (-10,10), (0,30), (3,40), (8,55), (15,70), (25,85), (40,97), (60,100)`. Current and historical observations share the same normalization. The old scale already awarded 90 at 15% and 100 at 25%.
- Acceleration anchors `(change in growth, score)`: `(-20,20), (-4,40), (0,60), (4,80), (15,100)`. Only consecutive comparable annual periods or quarters are used; gaps do not become invented trends.
- Existing FCF direction `-1/0/+1` maps to `20/50/85`. The engine compares year-on-year periods and treats crossing zero as a direction, not an infinite percentage growth rate. No FCF CAGR is invented.
- For banks and insurers the existing diluted-EPS direction replaces industrial FCF. `epsCagr` is never used. For REITs the industrial-FCF component is inapplicable; no FFO proxy is invented.

### Sector policies

Update 2026-11-07: documented negative earnings/cash denominators now count as evaluated VALUE components with score 0, without calculating negative multiples. Missing or incompatible evidence remains unavailable. Positive multiple formulas, sector weights, Growth, Quality and legacy valuation are unchanged. See [VALUE_NEGATIVE_RESULTS.md](VALUE_NEGATIVE_RESULTS.md) for eligibility, sector exceptions and the TE comparison.

| Existing business profile | Value | Quality |
| --- | --- | --- |
| Ordinary operating companies | P/FCF 40%, P/E 30%, EV/EBIT 30% | Returns 25%, operating margin 15%, FCF generation 15%, conversion 15%, stability 15%, balance 15% |
| Cyclicals | Existing normalized EV/EBIT 60%, P/E 40% | Standard components, with existing sector normalizations |
| Recovery | P/FCF 40%, EV/EBIT 60%; only existing applicable methods | Standard components and coverage gates |
| Utilities / profiles without a meaningful FCF benchmark | EV/EBIT 60%, P/E 40% | Existing applicable sector components |
| Banks | P/B 60%, P/E 40% | ROE 50%, ROA 30%, net margin 20%; low confidence without regulatory capital, NPL and efficiency data |
| Insurers | P/E 60%, P/B 40% | ROE 60%, net margin 40%; low confidence without solvency and underwriting data |
| Real estate / REIT | EV/EBITDA 60%, P/B 40%; low-confidence proxy without FFO/AFFO and NAV | Operating margin 30%, stability 30%, balance 40%; low-confidence proxy without FFO/AFFO and occupancy |

All multiple bands and existing quality component normalizations are reused unchanged. The new bank ROA scoring anchors are `(-1%,0), (0%,20), (0.5%,45), (1%,70), (1.5%,85), (2%,100)`; this is only a normalization of the ROA already supplied. P/B requires actual positive equity. Forward P/E, EV/sales and implied-return scores are excluded: the new Value score does not blend Growth or extrapolate loss-makers into an apparently cheap valuation.

The current engine classification is preserved, including its limitations. Indexa is an asset manager, not a bank; the engine currently calls its historical profile cyclical, so Value uses that existing normalized EV/EBIT. This policy does not silently change its classification or financial scenarios. Robot is also currently classified as cyclical.

## Coverage, confidence and independence

- Coverage is the sum of observed component weights divided by expected applicable weights. Inapplicable sector metrics are excluded from the denominator; missing applicable metrics are retained as missing.
- At least 70% coverage, two usable components and the dimension's essential inputs are required. Otherwise score and tier are null and the UI shows N/D with reasons.
- Available weights are renormalized only after the coverage gate. Missing inputs receive no invented neutral score. Coverage and missing labels remain explicit; a high partial average does not imply that missing metrics were favorable.
- Confidence: high requires at least 90% coverage and three observed components; 85–90% coverage is medium; 70–85% is low. Unknown filing dates, validation warnings, unknown SBC adjustment or missing growth confirmation can lower confidence further. Banks/insurers' Quality and REIT Value/Quality are low-confidence proxies as described above. Confidence does not fabricate a numeric metric or change financial outputs.
- Growth needs observed revenue growth. Ordinary Quality needs returns or operating profitability, plus cash generation or balance evidence. Bank/insurer Quality requires ROE; REIT Quality requires operating margin and balance. Invalid or stale financial data withholds the affected dimension; a bad price alone does not alter Growth or Quality.
- Every dimension uses its own weighted components and the unchanged `tierForScore`. No score, global grade, implied-return grade, moat bonus or other dimension's result contributes to another score.
- Confidence and missing data appear in the existing header help text and in the three-score block in Numbers. The numeric score remains available internally for tests/comparison, not in the compact header.

## Frozen before/after comparison

| Company | Growth before → after | Value before → after | Quality before → after |
| --- | --- | --- | --- |
| Robot RBT.MC | 95 S+ → 60 B | 88 S → 51 C | 75 A → 74 A |
| Altia ALC.MC | 98 S+ → 80 A | 89 S → 79 A | 71 A → 77 A |
| Indexa INDXA.MC | 100 S+ → 93 S | 34 D → 0 F | 96 S+ → 86 S |
| GAM GAM.MC | 73 A → 52 C | 100 S+ → 72 A | 67 B → 71 A |
| Arteche ART.MC | 90 S → 65 B | 41 C → 26 D | 74 A → 68 B |
| TSK TSK.MC | 32 D → 46 C | 98 S+ → 70 A | 79 A → 82 A |

All six snapshots have medium confidence. Coverage is 100% of selected applicable components except TSK Quality at 85% because margin stability lacks its fourth annual observation. This is component coverage, not a claim that all desirable financial disclosures are available.

Robot's old 95 came from averaging current revenue growth 20.2% and the recent median 20.1869%, giving approximately 20.19345%. The original interpolation maps that to 94.68, rounded to 95. The old header ignored the slowdown from 70.2663% to 20.1869% and FCF falling from EUR 1,004,724 to EUR 835,220 (−16.9%). The new 60 retains credit for strong revenue growth, but its acceleration and FCF components are both 20. A single FCF decline is not presented as a confirmed structural deterioration.

GAM's old Value counted the same large FCF both as a multiple and as its inverse yield. The new score also reads existing earnings and enterprise-value evidence. TSK's source P/E 7.77 differs from the existing engine's capitalisation/annual-profit P/E 21.82; the new score uses the latter existing method and discloses validation warnings, without repairing the source or changing valuation.

## Validation

- 228 tests pass, including frozen six-company regressions, the 16 existing synthetic business profiles, sector applicability, missing/invalid inputs, coverage boundaries, independence, no ticker exceptions and immutable inputs.
- Production build passes. New/changed scoring files and the Numbers page pass ESLint. The stock page retains its three pre-existing hook-related lint errors, without new findings.
- A before/after snapshot covers all legacy scoring outputs, the entire V2 analysis, DCF, relative value and every existing DCF stress table across the six actual snapshots plus 16 synthetic profiles: all 22 are identical. SHA-256: `8cba8763fad2322b694a738c1e8237418670ce584aa5bf9851327403ac7d84b7`.
- No new provider calls, database changes, cache changes or dependency changes.
- Chrome checks on the production build: the six actual snapshots plus mature, loss-making and empty-data profiles at 1280, 390 and 320 pixels (27 header cases), and the six Numbers score blocks. Matching letters and confidence descriptions, no overflow or browser runtime errors.
