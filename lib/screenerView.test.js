import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { sanitizeFinancialData } from './financialIntegrity.js';
import { screenerView, SCREENER_FIELDS, SCREENER_PROVISIONAL_WARNING } from './screenerView.js';

describe('screener response projection after financial validation', () => {
  for (const ticker of ['BYTE.MC', 'ALC.MC', 'RBT.MC', 'SCO.MC', 'GRI.MC', 'ART.MC', 'AAPL', 'LLOY.L']) {
    it(`preserves validated filters, displayed values and warning for ${ticker}`, () => {
      const raw = JSON.parse(readFileSync(new URL(`./__fixtures__/integrity-baseline/${ticker}.json`, import.meta.url), 'utf8'));
      const validated = sanitizeFinancialData(raw);
      const view = screenerView(validated);
      for (const field of SCREENER_FIELDS) expect(view[field]).toEqual(validated[field] ?? null);
      expect(view.financialIntegrity).toEqual({
        status: validated.financialIntegrity.status,
      });
      if (validated.financialIntegrity.status === 'provisional') expect(SCREENER_PROVISIONAL_WARNING).toBe(validated.financialIntegrity.warning);
      expect(view).not.toHaveProperty('financialPeriods');
      expect(view.financialIntegrity).not.toHaveProperty('rejected');
      expect(Buffer.byteLength(JSON.stringify(view))).toBeLessThan(Buffer.byteLength(JSON.stringify(validated)));
    });
  }

  it('never resurrects an incompatible ratio from rejected originals', () => {
    const view = screenerView({ pe: null, financialIntegrity: { version: 2, status: 'partial', warning: null, rejected: { pe: 15 } } });
    expect(view.pe).toBeNull();
    expect(view.financialIntegrity.status).toBe('partial');
  });

  it('preserves legitimate zeroes and handles an empty cache record', () => {
    expect(screenerView({ opMargin: 0 }).opMargin).toBe(0);
    expect(screenerView(null).pe).toBeNull();
  });

  it('keeps a full 11232-row screener below the hosting response limit', () => {
    const sample = JSON.parse(readFileSync(new URL('./__fixtures__/integrity-baseline/AAPL.json', import.meta.url), 'utf8'));
    const validated = sanitizeFinancialData(sample);
    const stocks = Array.from({ length: 11232 }, (_, i) => ({
      ...screenerView(validated), ticker: `QA${i}`, updatedAt: '2026-11-05T00:00:00Z',
    }));
    // Headroom under Vercel's 4.5 MB limit, without relying on compression.
    expect(Buffer.byteLength(JSON.stringify({ stocks, limited: false }))).toBeLessThan(4_500_000);
  });
});
