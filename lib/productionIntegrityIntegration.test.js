import { describe, expect, it } from 'vitest';
import { CALIBRATION_COMPANIES } from './__fixtures__/scoreCalibration';
import { bankLike } from './engine/__fixtures__/companies';
import { analyzeStock } from './engine';
import { getCompanyHeaderScores } from './companyHeaderScores';
import { computeEasyMode as originalEasy, computeDCFValue as originalDcf } from './stockScoring';
import { computeEasyMode, computeDCFValue } from './financialCalculations';
import { sanitizeFinancialData } from './financialIntegrity';
import byte from './__fixtures__/integrity-baseline/BYTE.MC.json';

const annotate = (data, calculations = {}) => ({ ...data,
  financialIntegrity: { version: 2, status: 'provisional', calculations },
});

describe('production calibration with integrated integrity controls', () => {
  it('keeps Numbers and the fact sheet consistent when incompatible inputs are masked', () => {
    const data = sanitizeFinancialData(byte), easy = computeEasyMode(data, true);
    expect(getCompanyHeaderScores(easy, data)).toEqual(getCompanyHeaderScores(easy, data, analyzeStock(data)));
  });
  it('uses the same quality dependency mask for a cross-period operating margin in both views', () => {
    const fy = year => ({ basis: 'FY', periodStart: `${year}-01-01`, periodEnd: `${year}-12-31`, currency: 'EUR', scope: 'consolidated', source: 'regression fixture' });
    const data = sanitizeFinancialData({ ...CALIBRATION_COMPANIES['ALC.MC'],
      financialPeriods: { revVal: fy(2026), oiVal: fy(2025) },
    });
    const easy = computeEasyMode(data, true);
    expect(data.financialIntegrity.calculations.opMargin.status).toBe('blocked');
    expect(getCompanyHeaderScores(easy, data)).toEqual(getCompanyHeaderScores(easy, data, analyzeStock(data)));
  });
  it.each(Object.entries(CALIBRATION_COMPANIES))('adding provenance warnings preserves the production scores for %s', (_, data) => {
    const easy = originalEasy(data, true), analysis = analyzeStock(data);
    const expected = getCompanyHeaderScores(easy, data, analysis);
    const actual = getCompanyHeaderScores(easy, annotate(data), analysis);
    expect(actual.map(({ status, ...score }) => score))
      .toEqual(expected.map(({ status, ...score }) => score));
    expect(actual.every(s => s.status === (s.score100 == null ? 'unavailable' : 'provisional'))).toBe(true);
  });

  it('does not erase a bank Value score because an industrial FCF dependency is missing', () => {
    const easy = originalEasy(bankLike, true), analysis = analyzeStock(bankLike);
    const before = getCompanyHeaderScores(easy, bankLike, analysis);
    const after = getCompanyHeaderScores(easy, annotate(bankLike, {
      value: { status: 'blocked', reasonCode: 'missing-components' },
    }), analysis);
    expect(before[1].score100).not.toBeNull();
    expect(after[1].score100).toBe(before[1].score100);
    expect(after[1].status).toBe('provisional');
  });

  it('preserves original arithmetic for compatible inputs and blocks only DCF when required', () => {
    const data = CALIBRATION_COMPANIES['ALC.MC'];
    const provisional = annotate(data), before = structuredClone(provisional);
    expect(computeEasyMode(provisional, true)).toEqual(originalEasy(data, true));
    expect(computeDCFValue(provisional, .04)).toEqual(originalDcf(data, .04));
    const blocked = annotate(data, { dcf: { status: 'blocked' } });
    expect(computeDCFValue(blocked, .04)).toBeNull();
    expect(computeEasyMode(blocked, true)).toEqual(originalEasy(data, true));
    expect(provisional).toEqual(before);
  });
});
