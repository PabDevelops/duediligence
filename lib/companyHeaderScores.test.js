import { describe, expect, it } from 'vitest';
import { getCompanyHeaderScores } from './companyHeaderScores';
import { computeEasyMode } from './stockScoring';
import { ALL_SYNTHETIC, msftLike } from './engine/__fixtures__/companies';
import { toScore100 } from './scoreScale';
import { tierForScore } from './engine/tierScale';

const evidence = { revGrowth: 25, grossMargin: 50 };
const scores = { revGrowthScore: 4.5, oppo: 1, cbs: 4, truePfcf: 100 };

describe('company header presentation adapter', () => {
  it.each(Object.entries(ALL_SYNTHETIC))('reuses the original measured sub-scores for %s', (_, data) => {
    const original = computeEasyMode(data, true);
    const snapshot = structuredClone(original);
    const cards = getCompanyHeaderScores(original, data);
    expect(cards.map(card => card.source)).toEqual(['revGrowthScore', 'oppo', 'cbs']);
    for (const card of cards) {
      if (card.score100 != null) {
        expect(card.score100).toBe(toScore100(original[card.source]));
        expect(card.tier).toBe(tierForScore(card.score100));
      }
    }
    // Every fixture has revenue history and at least one actual business input.
    expect(cards[0].score100).toBe(toScore100(original.revGrowthScore));
    expect(cards[2].score100).toBe(toScore100(original.cbs));
    expect(cards[1].score100).toBe(
      Number.isFinite(original.truePfcf) || Number.isFinite(original.trueFcfYield)
        ? toScore100(original.oppo) : null,
    );
    expect(original).toEqual(snapshot);
  });

  it('can show GROWTH S, VALUE F and QUALITY A independently', () => {
    const cards = getCompanyHeaderScores(scores, evidence);
    expect(cards.map(({ score100, tier }) => ({ score100, tier }))).toEqual([
      { score100: 90, tier: 'S' }, { score100: 20, tier: 'F' }, { score100: 80, tier: 'A' },
    ]);
  });

  it('ignores GQS, the global blend and unrelated dimensions', () => {
    const original = getCompanyHeaderScores(scores, evidence);
    expect(getCompanyHeaderScores({ ...scores, gqs: 1, finalNote: 1, score100: 20 }, evidence)).toEqual(original);
    const changed = getCompanyHeaderScores({ ...scores, oppo: 5 }, evidence);
    expect(changed[0]).toEqual(original[0]);
    expect(changed[2]).toEqual(original[2]);
    expect(changed[1].score100).toBe(100);
    expect(getCompanyHeaderScores({ ...scores, cbs: 1 }, evidence).slice(0, 2)).toEqual(original.slice(0, 2));
    expect(getCompanyHeaderScores({ ...scores, revGrowthScore: 1 }, evidence).slice(1)).toEqual(original.slice(1));
  });

  it.each([20, 25, 40, 55, 70, 85, 95, 100])('uses the shared tier conversion at %i/100', score100 => {
    const cards = getCompanyHeaderScores({ ...scores, revGrowthScore: score100 / 20 }, evidence);
    expect(cards[0].score100).toBe(score100);
    expect(cards[0].tier).toBe(tierForScore(score100));
  });

  it('does not expose neutral fallback scores when there are no measured inputs', () => {
    const data = { marketCap: 1e9 };
    const easyMode = computeEasyMode(data, true);
    expect(easyMode.revGrowthScore).toBe(2.5);
    expect(easyMode.oppo).toBe(2.5);
    const cards = getCompanyHeaderScores(easyMode, data);
    expect(cards.every(card => card.score100 === null && card.tier === null)).toBe(true);
    expect(cards.every(card => card.description.startsWith('Faltan datos') || card.description.startsWith('Faltan P/FCF'))).toBe(true);
  });

  it('accepts zero growth, zero margins and negative measured FCF yield', () => {
    const cards = getCompanyHeaderScores(
      { ...scores, truePfcf: null, trueFcfYield: -5 }, { revGrowth: 0, grossMargin: 0 },
    );
    expect(cards.every(card => card.score100 !== null)).toBe(true);
  });

  it('accepts the existing historical revenue CAGR when YoY growth is missing', () => {
    const data = { ...msftLike, revGrowth: null };
    const easyMode = computeEasyMode(data, true);
    expect(easyMode.growthCagrPct).toBeGreaterThan(0);
    expect(getCompanyHeaderScores(easyMode, data)[0].score100).toBe(toScore100(easyMode.revGrowthScore));
  });

  it.each([null, undefined, NaN, Infinity, -1, 6, '4'])('shows N/D for invalid scores: %s', invalid => {
    const cards = getCompanyHeaderScores({ ...scores, revGrowthScore: invalid, oppo: invalid, cbs: invalid }, evidence);
    expect(cards.every(card => card.score100 === null && card.tier === null)).toBe(true);
    expect(cards.every(card => card.description.startsWith('Falta la subpuntuación'))).toBe(true);
  });

  it('handles a missing scoring result and never mutates its inputs', () => {
    expect(getCompanyHeaderScores(null, null).every(card => card.score100 === null)).toBe(true);
    expect(() => getCompanyHeaderScores(Object.freeze({ ...scores }), Object.freeze({ ...evidence }))).not.toThrow();
  });
});
