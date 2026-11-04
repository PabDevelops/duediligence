import { describe, it, expect } from 'vitest';
import { pointInTimeView, assertNoLookahead, runBacktest, spearman, splitDates } from './backtest.js';
import { cokeLike, hist } from './__fixtures__/companies.js';

// Fully synthetic universe: it exists to test the MECHANICS of the harness (no look-ahead,
// split, universe changes, validity labelling), not to claim anything about real markets.
function makeTicker(i, { delistedOn = null } = {}) {
  const scale = 0.5 + (i % 7) * 0.2;
  const filings = [];
  for (let y = 2017; y <= 2024; y++) {
    const revs = [];
    for (let k = 0; k < 6; k++) revs.push((30 + (y - 2017 - 5 + k) * (1 + (i % 5)) * 0.4 + 20) * 1e9 * scale);
    filings.push({
      fiscalPeriod: 'FY', periodEnd: `${y}-12-31`, filed: `${y + 1}-02-20`,
      data: {
        ...cokeLike, ticker: `T${i}`, sharesOutstanding: 1e9, marketCap: null, currentPrice: null,
        revVal: revs[5], oiVal: revs[5] * 0.2, niVal: revs[5] * 0.15, fcfVal: revs[5] * 0.14, gpVal: revs[5] * 0.5,
        revHistory: hist(y, revs), oiHistory: hist(y, revs.map((r) => r * 0.2)), niHistory: hist(y, revs.map((r) => r * 0.15)),
        fcfHistory: hist(y, revs.map((r) => r * 0.14)), sharesHistory: hist(y, [1, 1, 1, 1, 1, 1].map((x) => x * 1e9)),
        opMargin: 20, netMargin: 15, grossMargin: 50, revGrowth: 5, roic: 15, shareDilution: 0, eps: 0.15 * revs[5] / 1e9, pe: 20,
        debtVal: 5e9, cashVal: 4e9, assetsVal: 90e9, currentLiabilitiesVal: 20e9, currentAssetsVal: 25e9, equityVal: 40e9, lastFilingDate: `${y + 1}-02-20`,
      },
    });
  }
  const prices = [];
  for (let y = 2018; y <= 2026; y++) for (const m of ['01-15', '04-15', '07-15', '10-15']) prices.push({ date: `${y}-${m}`, close: 20 + ((i * 7 + y * 3 + parseInt(m, 10)) % 15) + (y - 2018) });
  return { ticker: `T${i}`, listedOn: '2015-01-01', delistedOn, filings, prices };
}
const universe = Array.from({ length: 32 }, (_, i) => makeTicker(i, i === 31 ? { delistedOn: '2022-06-30' } : {}));
const dates = ['2020-04-15', '2021-04-15', '2022-04-15', '2023-04-15', '2024-04-15'];

describe('point-in-time reconstruction', () => {
  it('only uses filings published on or before the analysis date', () => {
    const item = universe[0];
    const v = pointInTimeView(item, '2021-01-15'); // FY2020 is filed 2021-02-20, so it is NOT visible yet
    expect(v.filedUsed).toBe('2020-02-20');
    expect(v.data.lastFilingDate).toBe('2020-02-20');
    expect(() => assertNoLookahead(v, '2021-01-15')).not.toThrow();
    const years = v.data.revHistory.map((h) => h.year);
    expect(years).not.toContain('2020');
  });
  it('the latest visible filing flips exactly at the publication date', () => {
    expect(pointInTimeView(universe[0], '2021-02-19').filedUsed).toBe('2020-02-20');
    expect(pointInTimeView(universe[0], '2021-02-20').filedUsed).toBe('2021-02-20');
  });
  it('uses the price at or before the date, never after', () => {
    const v = pointInTimeView(universe[0], '2021-04-20');
    expect(v.priceDate <= '2021-04-20').toBe(true);
  });
  it('refuses data without real publication dates (cannot rule out look-ahead)', () => {
    const bad = { ...universe[0], filings: universe[0].filings.map((f, i) => (i === 3 ? { ...f, filed: null } : f)) };
    expect(() => pointInTimeView(bad, '2021-04-15')).toThrow(/sin fecha de publicación/);
  });
  it('detects a forced look-ahead', () => {
    expect(() => assertNoLookahead({ filedUsed: '2022-01-01', priceDate: '2020-01-01' }, '2021-01-01')).toThrow(/Look-ahead/);
  });
});

describe('harness', () => {
  it('spearman and splits behave', () => {
    expect(spearman([1, 2, 3, 4, 5], [10, 20, 30, 40, 50])).toBeCloseTo(1, 6);
    expect(spearman([1, 2, 3, 4, 5], [50, 40, 30, 20, 10])).toBeCloseTo(-1, 6);
    expect(spearman([1, 2], [1, 2])).toBeNull();
    const s = splitDates(dates, '2021-12-31');
    expect(s.train).toEqual(['2020-04-15', '2021-04-15']);
    expect(s.test).toEqual(['2022-04-15', '2023-04-15', '2024-04-15']);
  });
  it('runs on a point-in-time dataset, records universe changes and keeps train/test apart', () => {
    const r = runBacktest({ universe, dates, horizonYears: 1, trainEnd: '2021-12-31', survivorshipFree: true });
    expect(r.records.length).toBeGreaterThan(0);
    expect(r.testDates).toEqual(['2022-04-15', '2023-04-15', '2024-04-15']);
    const removed = r.universeChanges.flatMap((u) => u.removed);
    expect(removed).toContain('T31'); // the delisted name leaves the universe, and was in it before
    expect(r.universeChanges[0].added.length).toBeGreaterThan(30);
    expect(r.informationCoefficient.perDate).toHaveLength(3);
    expect(r.note).toMatch(/Nunca se optimizan/);
  });
  it('is only "valido_condicional" when survivorship-free, large enough and with enough test dates', () => {
    const ok = runBacktest({ universe, dates, trainEnd: '2021-12-31', survivorshipFree: true });
    expect(ok.validity).toBe('valido_condicional');
    const surv = runBacktest({ universe, dates, trainEnd: '2021-12-31', survivorshipFree: false });
    expect(surv.validity).toBe('indicativo');
    expect(surv.validityReasons.join(' ')).toMatch(/supervivencia/);
    const small = runBacktest({ universe: universe.slice(0, 5), dates, trainEnd: '2021-12-31', survivorshipFree: false });
    expect(small.validity).toBe('no_valido');
    const noTest = runBacktest({ universe, dates, trainEnd: '2025-12-31', survivorshipFree: true });
    expect(noTest.validity).toBe('no_valido');
  });
  it('is deterministic', () => {
    const a = JSON.stringify(runBacktest({ universe, dates, trainEnd: '2021-12-31', survivorshipFree: true }).informationCoefficient);
    const b = JSON.stringify(runBacktest({ universe, dates, trainEnd: '2021-12-31', survivorshipFree: true }).informationCoefficient);
    expect(a).toBe(b);
  });
  it('the engine sees no future data: shifting future filings does not change past scores', () => {
    const tampered = universe.map((u) => ({ ...u, filings: u.filings.map((f) => (f.filed > '2023-01-01' ? { ...f, data: { ...f.data, revVal: 1, oiVal: -1e9 } } : f)) }));
    const a = runBacktest({ universe, dates: ['2021-04-15', '2022-04-15'], trainEnd: '2020-12-31', survivorshipFree: true }).records.map((r) => [r.ticker, r.date, r.potential, r.quality]);
    const b = runBacktest({ universe: tampered, dates: ['2021-04-15', '2022-04-15'], trainEnd: '2020-12-31', survivorshipFree: true }).records.map((r) => [r.ticker, r.date, r.potential, r.quality]);
    expect(b).toEqual(a);
  });
});
