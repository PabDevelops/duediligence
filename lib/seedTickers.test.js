import { expect, it } from 'vitest';
import { planSeed } from './seedTickers';

const DAY = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 10, 12);
const iso = (daysAgo) => new Date(now - daysAgo * DAY).toISOString();

it('skips fresh tickers and puts missing ones before stale ones, stalest first', () => {
  const plan = planSeed(
    ['FRESH', 'OLD', 'MISSING', 'OLDER', 'MISSING2'],
    [
      { ticker: 'FRESH', updated_at: iso(1) },
      { ticker: 'OLD', updated_at: iso(10) },
      { ticker: 'OLDER', updated_at: iso(30) },
    ],
    { staleDays: 7, now }
  );
  expect(plan.pending).toEqual(['MISSING', 'MISSING2', 'OLDER', 'OLD']);
  expect(plan.fresh).toBe(1);
  expect(plan.total).toBe(5);
});

it('dedupes and ignores empty tickers', () => {
  const plan = planSeed(['A', 'A', null, 'B'], [], { now });
  expect(plan.pending).toEqual(['A', 'B']);
  expect(plan.total).toBe(2);
});
