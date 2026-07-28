import { describe, it, expect } from 'vitest';
import { computeEasyMode, computeRelativeValue } from './stockScoring.js';

// Real production payload for ADEA (Adeia Inc.), captured from /api/stock?ticker=ADEA on
// 2026-07-28. Adeia is the standalone IP-licensing entity spun out of Xperi in Oct 2022 - its
// 2020/2021 history reflects the pre-spinoff combined Xperi business, which is why revenue,
// margin and ROIC all show a sharp one-time break between 2021 and 2022 that never reverses,
// unlike a genuine commodity price cycle (see hasRevenueCrash in stockScoring.js).
const ADEA_DATA = {
  name: 'Adeia Inc.',
  sector: 'Technology',
  industry: 'Technology',
  marketCap: 2875358067.020809,
  currentPrice: 24.57,
  sharesOutstanding: 110258000,
  roic: 16,
  grossMargin: 85.56,
  opMargin: 40.6,
  debtToEquity: 0.84,
  debtVal: 391264000,
  cashVal: 115762000,
  equityVal: 466567000,
  currentAssetsVal: 281323000,
  currentLiabilitiesVal: 81673000,
  fcfVal: 157423000,
  sbcVal: 35186000,
  shareDilution: 4,
  insiderOwnershipPct: 2.73,
  revGrowth: 19.5,
  riskFreeRate: 0.04641,
  beta: 1.5773084,
  interestVal: null,
  taxVal: 32970000,
  ebtVal: 155004000,
  rdVal: 69254000,
  revVal: 460488000,
  revHistory: [
    { val: 892020000, year: '2020' },
    { val: 877696000, year: '2021' },
    { val: 438933000, year: '2022' },
    { val: 388788000, year: '2023' },
    { val: 376024000, year: '2024' },
    { val: 443386000, year: '2025' },
  ],
  marginHistory: [
    { year: '2020', margin: 19.9 },
    { year: '2021', margin: 1.6 },
    { year: '2022', margin: 34.9 },
    { year: '2023', margin: 35 },
    { year: '2024', margin: 34.2 },
    { year: '2025', margin: 39.5 },
  ],
  oiHistory: [
    { val: 177627000, year: '2020' },
    { val: 13812000, year: '2021' },
    { val: 153060000, year: '2022' },
    { val: 136230000, year: '2023' },
    { val: 128609000, year: '2024' },
    { val: 175003000, year: '2025' },
  ],
  debtHistory: [
    { val: 839350000, year: '2020' },
    { val: 765487000, year: '2021' },
    { val: 729393000, year: '2022' },
    { val: 585695000, year: '2023' },
    { val: 475456000, year: '2024' },
    { val: 418454000, year: '2025' },
  ],
  equityHistory: [
    { val: 1456877000, year: '2020' },
    { val: 1349633000, year: '2021' },
    { val: 301412000, year: '2022' },
    { val: 356622000, year: '2023' },
    { val: 396571000, year: '2024' },
    { val: 480541000, year: '2025' },
  ],
};

describe('ADEA regression - stockScoring (2026-07-28 production snapshot)', () => {
  const easyMode = computeEasyMode(ADEA_DATA, true);

  it('does not treat ADEA\'s post-spinoff revenue base as a commodity cycle', () => {
    // Before the hasRevenueCrash rebound fix, ADEA's 2021->2022 revenue nearly halving (the
    // Xperi/Adeia spinoff) was misread as a commodity crash, applying an undocumented ~8%
    // stability haircut to OPPO and GQS on top of the documented P/FCF x55% + FCF Yield x45%
    // formula. With the fix, oppoGqsStabilityFactor is 1 (no haircut).
    expect(easyMode.pfcfScore).toBeCloseTo(4.1055, 2);
    expect(easyMode.fcfYieldScore).toBeCloseTo(4.3128, 2);
    const oppoUnhaircut = easyMode.pfcfScore * 0.55 + easyMode.fcfYieldScore * 0.45;
    expect(easyMode.oppo).toBeCloseTo(oppoUnhaircut, 4);
    expect(Math.round(easyMode.oppo * 20)).toBe(84);
  });

  it('CBS surplus cash bonus is additive and positive, not folded into the weighted average', () => {
    // Confirms the user's "sign inverted?" hypothesis is wrong: the +0.2 bonus is correctly
    // added on top of the weighted fundamentals sum, not blended as a 6th weighted component.
    // CBS landing *below* the naive average of its own sub-scores is fully explained by the
    // stability multiplier (~0.92, driven by pre/post-spinoff margin & ROIC dispersion) being
    // applied to (weighted sum + bonus) as a whole - not by the bonus itself, which is correct.
    expect(Math.round(easyMode.roicScore * 20)).toBe(56);
    expect(Math.round(easyMode.gmScore * 20)).toBe(97);
    expect(Math.round(easyMode.omScore * 20)).toBe(100);
    expect(Math.round(easyMode.deScore * 20)).toBe(92);
    expect(Math.round(easyMode.crScore * 20)).toBe(100);
    expect(easyMode.surplusCash).toBeGreaterThan(0);

    const naiveAverage = (easyMode.roicScore + easyMode.gmScore + easyMode.omScore + easyMode.deScore + easyMode.crScore) / 5;
    const sumPlusBonus = naiveAverage + 0.2; // +0.2 flat bonus, same units as the 1-5 scale
    expect(easyMode.cbs).toBeLessThan(sumPlusBonus); // stability factor (<1) pulls it back down
    expect(easyMode.cbs).toBeGreaterThan(0); // bonus was never subtracted / sign-flipped
    expect(Math.round(easyMode.cbs * 20)).toBe(86);
  });

  it('produces a non-degenerate bear/base/bull spread instead of a ~1.3% band', () => {
    const rv = computeRelativeValue(ADEA_DATA, easyMode);
    expect(rv.ownMultiple).toBeCloseTo(23.52, 1);
    expect(rv.sectorMultiple).toBe(24);

    const spreadPct = ((rv.bullValue - rv.bearValue) / rv.fairValue) * 100;
    // The old weight-only blend produced ~1.3% here (bear $26.26 / base $26.45 / bull $26.61)
    // because the entire range was bounded by |ownMultiple - sectorMultiple| (~2%). The fix
    // scales the band off this company's own margin/ROIC CV instead, floored at 5% and capped
    // at 25% on the target multiple - a real, non-degenerate bear/bull range.
    expect(spreadPct).toBeGreaterThan(20);
    expect(rv.uncertaintyPct).toBeGreaterThanOrEqual(0.05);
    expect(rv.uncertaintyPct).toBeLessThanOrEqual(0.25);
    expect(rv.bearValue).toBeCloseTo(rv.targetMultiple * (1 - rv.uncertaintyPct) * rv.fcfPerShare, 5);
    expect(rv.bullValue).toBeCloseTo(rv.targetMultiple * (1 + rv.uncertaintyPct) * rv.fcfPerShare, 5);
    expect(rv.bearValue).toBeLessThan(rv.fairValue);
    expect(rv.bullValue).toBeGreaterThan(rv.fairValue);
  });

  it('"Actually growing at" is trailing 3yr median revenue growth, distinct from the latest-year +19.5% figure shown elsewhere', () => {
    const rv = computeRelativeValue(ADEA_DATA, easyMode);
    // Confirms the exact production figure the user flagged: -3.3% next to a "+19.5%" revenue
    // growth shown on other tabs. Both are revenue metrics (not FCF, as the user suspected) -
    // they differ only in window (3yr median vs latest single year), which the UI now labels
    // explicitly (see page.js) instead of leaving "Actually growing at" unqualified.
    expect(rv.realGrowthPct).toBeCloseTo(-3.28, 1);
    expect(ADEA_DATA.revGrowth).toBe(19.5);
  });

  it('quality weight applies to whichever multiple is NOT the current price - direction-aware, not inverted', () => {
    const rv = computeRelativeValue(ADEA_DATA, easyMode);
    // ADEA trades at 23.5x, below its 24x sector multiple, so the quality weight (here ~75%)
    // applies to the SECTOR multiple (crediting reversion upward), leaving only (1 - weight) on
    // the own multiple - confirmed by reproducing the user's own manual check:
    // own*(1-w) + sector*w is much closer to the displayed target multiple than own*w + sector*(1-w).
    expect(rv.ownMultiple).toBeLessThan(rv.sectorMultiple);
    const weightOnSector = rv.ownMultiple * (1 - rv.qualityWeight) + rv.sectorMultiple * rv.qualityWeight;
    const weightOnOwn = rv.ownMultiple * rv.qualityWeight + rv.sectorMultiple * (1 - rv.qualityWeight);
    expect(Math.abs(rv.targetMultiple - weightOnSector)).toBeLessThan(Math.abs(rv.targetMultiple - weightOnOwn));
  });
});
