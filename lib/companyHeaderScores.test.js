import { describe, expect, it } from 'vitest';
import { getCompanyHeaderScores } from './companyHeaderScores';
import { MIN_INDICATIVE_SCORE_COVERAGE, MIN_SCORE_COVERAGE } from './companyScoreCalibration';
import { computeEasyMode } from './stockScoring';
import { analyzeStock } from './engine';
import { tierForScore } from './engine/tierScale';
import { ALL_SYNTHETIC, bankLike, insurerLike, reitLike, msftLike } from './engine/__fixtures__/companies';
import { CALIBRATION_COMPANIES as COMPANIES } from './__fixtures__/scoreCalibration';

const NOW = '2026-11-05';
function inputs(data) {
  return { easy: computeEasyMode(data, true), analysis: analyzeStock(data, { now: NOW }) };
}
function scores(data) {
  const { easy, analysis } = inputs(data);
  return getCompanyHeaderScores(easy, data, analysis);
}
const robot = COMPANIES['RBT.MC'];
const altia = COMPANIES['ALC.MC'];

describe('calibrated independent company scores', () => {
  function partialQuality(ids, issues = []) {
    const { easy, analysis } = inputs(altia);
    analysis.quality.components = Object.fromEntries(ids.map(id => [id, { score: 80 }]));
    analysis.validation = { hasErrors: issues.some(i => i.severity === 'error'), issues };
    return getCompanyHeaderScores(easy, altia, analysis)[2];
  }

  it('keeps the indicative threshold at 50% and normal grades at 70%', () => {
    expect(MIN_INDICATIVE_SCORE_COVERAGE).toBe(0.5);
    expect(MIN_SCORE_COVERAGE).toBe(0.7);
  });

  it('offers a separate indicative grade above 50% without replacing the calibrated score', () => {
    const result = partialQuality(['returns', 'operatingMargin', 'balance']);
    expect(result.coverage).toBeCloseTo(0.55);
    expect(result.score100).toBeNull();
    expect(result.tier).toBeNull();
    expect(result.indicative.score100).toBe(80);
    expect(result.indicative.tier).toBe(tierForScore(80));
    expect(result.indicative.description).toContain('Confianza baja');
    expect(result.status).toBe('unavailable');
  });

  it.each([
    ['operatingMargin', 'balance'],
    ['returns', 'balance'],
    ['operatingMargin', 'fcfGeneration', 'balance'],
  ])('does not estimate below 50% even with essential indicators: %s', (...ids) => {
    const result = partialQuality(ids);
    expect(result.coverage).toBeLessThan(0.5);
    expect(result.score100).toBeNull();
    expect(result.indicative).toBeNull();
  });

  it('uses the normal calibrated grade at exactly 70%', () => {
    const result = partialQuality(['returns', 'operatingMargin', 'fcfGeneration', 'balance']);
    expect(result.coverage).toBeCloseTo(0.7);
    expect(result.score100).toBe(80);
    expect(result.indicative).toBeNull();
  });

  it('does not estimate with only one component at 50%', () => {
    const { easy, analysis } = inputs(bankLike);
    analysis.quality.components = { returns: { score: 80 } };
    const result = getCompanyHeaderScores(easy, { ...bankLike, roa: null }, analysis)[2];
    expect(result.coverage).toBeCloseTo(0.5);
    expect(result.indicative).toBeNull();
  });

  it('does not estimate quality without essential profitability indicators', () => {
    const result = partialQuality(['fcfGeneration', 'cashConversion', 'marginStability', 'balance']);
    expect(result.coverage).toBeCloseTo(0.6);
    expect(result.indicative).toBeNull();
  });

  it.each(['history', 'opMargin', 'fcf'])('never estimates around incompatible %s inputs', field => {
    expect(partialQuality(['returns', 'operatingMargin', 'balance'], [{ severity: 'error', field }]).indicative).toBeNull();
  });

  it('does not produce an indicative alternative to an existing calibrated grade', () => {
    expect(scores(altia).every(score => score.indicative === null)).toBe(true);
  });

  it.each([
    ['RBT.MC', [60, 51, 74]], ['ALC.MC', [80, 79, 77]], ['INDXA.MC', [93, 0, 86]],
    ['GAM.MC', [52, 72, 71]], ['ART.MC', [65, 26, 68]], ['TSK.MC', [46, 70, 82]],
  ])('regression of frozen BullTrace data for %s', (ticker, expected) => {
    const result = scores(COMPANIES[ticker]);
    expect(result.map(s => s.score100)).toEqual(expected);
    expect(result.map(s => s.tier)).toEqual(expected.map(tierForScore));
    expect(result.every(s => s.confidence === 'media')).toBe(true);
    expect(result.map(s => Math.round(s.coverage * 100))).toEqual(ticker === 'TSK.MC' ? [100, 100, 85] : [100, 100, 100]);
  });

  it('reproduces Robot 95 before calibration and uses its actual deceleration and falling FCF', () => {
    const { easy, analysis } = inputs(robot);
    expect(Math.round(easy.revGrowthScore * 20)).toBe(95);
    const growth = getCompanyHeaderScores(easy, robot, analysis)[0];
    expect(growth.components.find(c => c.id === 'acceleration').score).toBe(20);
    expect(growth.components.find(c => c.id === 'cashEvolution').score).toBe(20);
    const improving = structuredClone(analysis);
    improving.momentum.snapshots.at(-2).revYoY = improving.momentum.snapshots.at(-1).revYoY;
    improving.momentum.snapshots.at(-1).fcf = 1;
    expect(getCompanyHeaderScores(easy, robot, improving)[0].score100).toBeGreaterThan(growth.score100);
  });

  it('has no rule tied to a company name or ticker', () => {
    expect(scores({ ...robot, ticker: 'OTHER', name: 'Different name' })).toEqual(scores(robot));
  });

  it('ignores legacy combined scores, EPS CAGR fallback, other dimension scores and implied returns', () => {
    const { easy, analysis } = inputs(altia);
    const expected = getCompanyHeaderScores(easy, altia, analysis);
    const altered = structuredClone(analysis);
    altered.quality.score = 0;
    altered.valuation.score = 0;
    altered.valuation.impliedReturn = { score: 100 };
    expect(getCompanyHeaderScores({ ...easy, cbs: 1, oppo: 1, gqs: 1, finalNote: 1, score100: 20 }, { ...altia, epsCagr: 999 }, altered)).toEqual(expected);
  });

  it('changing one set of component scores does not reweight the other dimensions', () => {
    const { easy, analysis } = inputs(altia);
    const expected = getCompanyHeaderScores(easy, altia, analysis);
    const cheap = structuredClone(analysis);
    cheap.valuation.methods.forEach(m => { m.score = 100; });
    const result = getCompanyHeaderScores(easy, altia, cheap);
    expect(result[1].score100).toBe(100);
    expect(result[0]).toEqual(expected[0]);
    expect(result[2]).toEqual(expected[2]);
    const weak = structuredClone(analysis);
    Object.values(weak.quality.components).forEach(c => { c.score = 0; });
    expect(getCompanyHeaderScores(easy, altia, weak).slice(0, 2)).toEqual(expected.slice(0, 2));
    expect(getCompanyHeaderScores(easy, altia, weak)[2].score100).toBe(0);
  });

  it('counts P/FCF once, with no inverse yield, forward P/E or implied growth contribution', () => {
    const value = scores(altia)[1];
    expect(value.components.map(c => c.id)).toEqual(['pfcf', 'pe', 'evEbit']);
    expect(scores({ ...altia, fcfYield: 999, pfcf: 0.01, forwardPE: 0.01 })[1].score100).toBe(value.score100);
  });

  it('higher prices cannot improve Value and do not change Growth', () => {
    const higher = scores({ ...altia, currentPrice: altia.currentPrice * 2, marketCap: altia.marketCap * 2 });
    const original = scores(altia);
    expect(higher[1].score100).toBeLessThan(original[1].score100);
    expect(higher[0].score100).toBe(original[0].score100);
  });

  it('shows N/D for no data or one revenue observation, without neutral substitution', () => {
    expect(getCompanyHeaderScores(null, null).every(s => s.score100 === null && s.tier === null)).toBe(true);
    expect(scores({ marketCap: 1e9, currentPrice: 10 }).every(s => s.score100 === null)).toBe(true);
    const growth = scores({ marketCap: 1e9, currentPrice: 10, revGrowth: 25 })[0];
    expect(growth.coverage).toBeCloseTo(0.45);
    expect(growth.score100).toBeNull();
    expect(growth.description).toContain('Cobertura insuficiente');
  });

  it.each([NaN, Infinity, '25'])('never treats invalid numeric inputs %s as measured evidence', invalid => {
    const result = getCompanyHeaderScores(null, { currentPrice: invalid, marketCap: invalid, revGrowth: invalid, roic: invalid, fcfVal: invalid });
    expect(result.every(s => s.score100 === null && s.tier === null)).toBe(true);
  });

  it('requires 70% coverage and two observed components, renormalizes and lowers confidence', () => {
    const { easy, analysis } = inputs(altia);
    const partial = structuredClone(analysis);
    partial.valuation.methods = partial.valuation.methods.filter(m => m.id !== 'pe');
    const value = getCompanyHeaderScores(easy, altia, partial)[1];
    expect(value.coverage).toBeCloseTo(0.70);
    expect(value.score100).toBe(79);
    expect(value.confidence).toBe('baja');
    expect(value.missing).toContain('P/E sobre beneficio observado');
    partial.valuation.methods = analysis.valuation.methods.filter(m => m.id !== 'pfcf');
    expect(getCompanyHeaderScores(easy, altia, partial)[1].score100).toBeNull();
  });

  it('does not equate missing SBC with a reported zero or hide missing margin history', () => {
    expect(scores(altia)[1].limitations.join(' ')).toContain('SBC N/D');
    expect(scores(COMPANIES['GAM.MC'])[1].limitations.join(' ')).not.toContain('SBC N/D');
    expect(scores(COMPANIES['TSK.MC'])[2].missing).toContain('Estabilidad histórica de márgenes');
  });

  it('does not invent acceleration across missing years and accepts consecutive quarters', () => {
    const { easy, analysis } = inputs(robot);
    const gap = structuredClone(analysis);
    gap.momentum.snapshots.at(-2).period = '2023';
    expect(getCompanyHeaderScores(easy, robot, gap)[0].components.find(c => c.id === 'acceleration').score).toBeNull();
    const quarterly = structuredClone(analysis);
    quarterly.momentum.snapshots = [
      { period: '2025Q4', basis: 'trimestral', revYoY: 0.10, fcf: 0 },
      { period: '2026Q1', basis: 'trimestral', revYoY: 0.14, fcf: 1 },
    ];
    expect(getCompanyHeaderScores(easy, robot, quarterly)[0].components.find(c => c.id === 'acceleration').score).toBeCloseTo(80);
  });

  it('uses bank and insurer metrics, excluding industrial cash-flow and debt multiples', () => {
    const bank = scores(bankLike), insurer = scores(insurerLike);
    expect(bank[1].components.map(c => [c.id, c.weight])).toEqual([['pe', 0.4], ['pb', 0.6]]);
    expect(insurer[1].components.map(c => [c.id, c.weight])).toEqual([['pe', 0.6], ['pb', 0.4]]);
    expect(bank[2].components.map(c => c.id)).toEqual(['returns', 'roa', 'operatingMargin']);
    expect(insurer[2].components.map(c => c.id)).toEqual(['returns', 'operatingMargin']);
    expect(bank[2].confidence).toBe('baja');
    expect(insurer[2].confidence).toBe('baja');
    expect(scores({ ...bankLike, fcfVal: -1e12 })[1].score100).toBe(bank[1].score100);
    expect(scores({ ...bankLike, roe: null })[2].score100).toBeNull();
  });

  it('keeps Indexa as an asset manager under its existing classification, not a bank', () => {
    const indexa = scores(COMPANIES['INDXA.MC']);
    expect(indexa[1].components.map(c => c.id)).toEqual(['evEbit', 'pe']);
    expect(indexa[2].components.map(c => c.id)).not.toContain('roa');
  });

  it('uses REIT proxies with low confidence, without invented FFO/AFFO or industrial FCF', () => {
    const reit = scores(reitLike);
    expect(reit[1].components.map(c => c.id)).toEqual(['evEbitda', 'pb']);
    expect(reit[2].components.map(c => c.id)).toEqual(['operatingMargin', 'marginStability', 'balance']);
    expect(reit[0].components.map(c => c.id)).not.toContain('cashEvolution');
    expect(reit[1].confidence).toBe('baja');
    expect(reit[1].description).toContain('FFO/AFFO');
  });

  it('does not use a structurally unsuitable FCF metric for utilities', () => {
    const utility = scores({ ...msftLike, sector: 'Utilities', industry: 'Utilities - Regulated Electric' });
    expect(utility[1].components.map(c => c.id)).toEqual(['evEbit', 'pe']);
  });

  it('preserves legitimate negative cash flow and rejects unusable price data only in Value', () => {
    const { easy, analysis } = inputs(robot);
    const invalid = structuredClone(analysis);
    invalid.validation = { hasErrors: true, issues: [{ severity: 'error', field: 'price' }] };
    invalid.valuation.methods = [];
    const result = getCompanyHeaderScores(easy, robot, invalid);
    expect(result[1].score100).toBeNull();
    expect(result[0].score100).toBe(scores(robot)[0].score100);
    expect(result[2].score100).toBe(scores(robot)[2].score100);
    expect(scores({ ...altia, fcfVal: -1e6 })[1].score100).toBeNull();
  });

  it.each(Object.entries(ALL_SYNTHETIC))('handles the existing %s business fixture with the shared tier scale', (_, data) => {
    for (const score of scores(data)) {
      expect(score.score100 === null || (Number.isInteger(score.score100) && score.score100 >= 0 && score.score100 <= 100)).toBe(true);
      expect(score.tier).toBe(tierForScore(score.score100));
      expect(score.coverage).toBeGreaterThanOrEqual(0);
      expect(score.coverage).toBeLessThanOrEqual(1.000000001);
    }
  });

  it('reusing an existing engine result gives the same scores and never mutates input', () => {
    const easy = computeEasyMode(robot, true), analysis = analyzeStock(robot);
    const before = structuredClone({ data: robot, easy, analysis });
    expect(getCompanyHeaderScores(easy, robot, analysis)).toEqual(getCompanyHeaderScores(easy, robot));
    expect({ data: robot, easy, analysis }).toEqual(before);
  });
});
