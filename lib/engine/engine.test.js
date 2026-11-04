import { describe, it, expect } from 'vitest';
import { analyzeStock } from './index.js';
import { normalizeInput } from './input.js';
import { classifyBusiness, methodsForProfile } from './profile.js';
import { validateInput } from './validation.js';
import { classifyMomentum, computeMomentum } from './momentum.js';
import { computeRisk } from './risk.js';
import { computePotential, WEIGHT_SETS } from './potential.js';
import { runScenario, DEFAULT_CONFIG } from './scenarios.js';
import { interp, cagr, div, median } from './util.js';
import * as F from './__fixtures__/companies.js';

const NOW = '2025-11-04';
const run = (d, o = {}) => analyzeStock(d, { now: NOW, ...o });

function walk(v, path, bad) {
  if (typeof v === 'number' && !Number.isFinite(v)) bad.push(path);
  else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`, bad));
  else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => walk(x, `${path}.${k}`, bad));
}

describe('util', () => {
  it('div returns null instead of inventing numbers', () => {
    expect(div(1, 0)).toBeNull();
    expect(div(null, 5)).toBeNull();
    expect(div(10, 4)).toBe(2.5);
  });
  it('cagr is null across a sign change', () => {
    expect(cagr(-5, 10, 3)).toBeNull();
    expect(cagr(100, 121, 2)).toBeCloseTo(0.1, 6);
  });
  it('interp is flat outside anchors', () => {
    expect(interp(-9, [[0, 10], [1, 20]])).toBe(10);
    expect(interp(9, [[0, 10], [1, 20]])).toBe(20);
    expect(interp(0.5, [[0, 10], [1, 20]])).toBe(15);
    expect(median([3, 1, 2])).toBe(2);
  });
});

describe('every synthetic profile runs without NaN/Infinity', () => {
  Object.entries(F.ALL_SYNTHETIC).forEach(([name, d]) => {
    it(name, () => {
      const r = run(d);
      const bad = [];
      walk(r, 'result', bad);
      expect(bad).toEqual([]);
      expect(JSON.stringify(r)).not.toContain('undefined');
      expect(r.disclaimer).toContain('no recomienda');
    });
  });
});

describe('business profile classification', () => {
  const kind = (d) => classifyBusiness(normalizeInput(d)).kind;
  it('mature profitable', () => expect(kind(F.cokeLike)).toBe('profitable'));
  it('bank is financial', () => expect(kind(F.bankLike)).toBe('financial'));
  it('REIT', () => expect(kind(F.reitLike)).toBe('reit'));
  it('auto maker is cyclical', () => expect(kind(F.fordLike)).toBe('cyclical'));
  it('loss-making with losses in every year is structural', () => expect(kind(F.negEbitda)).toBe('structurallyUnprofitable'));
  it('fast grower with improving profits is growth', () => expect(kind(F.dilutive)).toBe('growth'));
  it('a single year of profit after losses is recovery, not confirmed anything', () => {
    const d = { ...F.msftLike, oiHistory: F.hist(2025, [-5e9, 123e9]) };
    d.sector = 'Technology'; d.industry = 'Software - Infrastructure';
    expect(kind({ ...d, oiHistory: F.hist(2025, [-5e9, 3e9, -2e9, 1e9, -1e9, 123e9]) })).toBe('recovery');
  });
  it('profitable-then-loss is temporary, not structural', () => {
    const d = { ...F.negEbitda, oiHistory: F.hist(2025, [30e6, 25e6, 10e6, -5e6, -40e6]) };
    expect(kind(d)).toBe('temporarilyUnprofitable');
  });
  it('unknown when revenue or operating income is missing', () => expect(kind({ ticker: 'X', sector: 'Technology' })).toBe('unknown'));
  it('a fee-based asset manager is NOT forced into the bank model just for carrying a generic "Financial Services" label (TROW pattern)', () => {
    expect(kind(F.assetManagerLike)).not.toBe('financial');
  });
  it('a true insurer stays "financial" — book value is a meaningful anchor for it, same as a bank (PGR pattern)', () => {
    expect(kind(F.insurerLike)).toBe('financial');
  });
  it('the asset manager gets real valuation methods (FCF, multiples) instead of being limited to P/E and P/B only', () => {
    const inp = normalizeInput(F.assetManagerLike);
    const prof = classifyBusiness(inp);
    const m = methodsForProfile(prof.kind, inp);
    expect(m.applicable).toContain('fcfYield');
    expect(m.applicable.length).toBeGreaterThan(2);
  });
  it('the asset manager runs the general DCF, not the bank P/book-value model', () => {
    const r = run(F.assetManagerLike);
    expect(r.scenarios.model).not.toBe('bank_justified_pb');
  });
  it('dry-bulk shipping ("Marine" industry label) is recognized as cyclical, not just "Shipping" (GLBS pattern)', () => {
    const d = { ...F.fordLike, sector: 'Industrials', industry: 'Marine' };
    expect(kind(d)).toBe('cyclical');
  });
  it('4 years of sharply swinging margins is enough to flag cyclicality by data alone, not just 5+ (GLBS: marginSd 0.193 over exactly 4 years) — sector text deliberately non-cyclical, to isolate the data-only path from the sector-keyword one above', () => {
    const d = {
      ...F.msftLike, sector: 'Technology', industry: 'Software - Application',
      revVal: 44206000, oiVal: 2378000,
      revHistory: F.hist(2025, [61755000, 31205000, 34870000, 44206000]),
      oiHistory: F.hist(2025, [23632000, -1999000, 1506000, 2378000]),
    };
    const r = classifyBusiness(normalizeInput(d));
    expect(r.kind).toBe('cyclical');
    expect(r.flags).toContain('cíclico por la historia de sus ingresos o márgenes');
  });
});

describe('validation', () => {
  const v = (d) => validateInput(normalizeInput(d), new Date(NOW));
  it('flags market cap inconsistent with price x shares', () => {
    const r = v({ ...F.msftLike, marketCap: F.msftLike.marketCap * 1.5 });
    expect(r.issues.some((i) => i.code === 'MKTCAP_MISMATCH')).toBe(true);
    expect(r.hasErrors).toBe(true);
  });
  it('legitimate negatives are information, never errors', () => {
    const r = v(F.negEbitda);
    const codes = r.issues.map((i) => i.code);
    expect(codes).toContain('LOSS_MAKING');
    expect(codes).toContain('NEGATIVE_FCF');
    expect(r.issues.find((i) => i.code === 'LOSS_MAKING').severity).toBe('info');
    expect(r.hasErrors).toBe(false);
  });
  it('negative published EV/EBITDA is explained, not treated as an error', () => {
    const r = v(F.negEbitda);
    expect(r.issues.find((i) => i.code === 'EVEBITDA_NEGATIVE').severity).toBe('info');
  });
  it('net debt and EV are not computed when cash is missing (no silent zero)', () => {
    const inp = normalizeInput({ ...F.msftLike, cashVal: null });
    expect(inp.netDebt).toBeNull();
    expect(inp.ev).toBeNull();
    expect(v({ ...F.msftLike, cashVal: null }).issues.some((i) => i.code === 'NETDEBT_INCOMPLETE')).toBe(true);
  });
  it('EV is built exactly once as market cap + debt - cash', () => {
    const inp = normalizeInput(F.msftLike);
    expect(inp.ev).toBe(inp.marketCap + inp.debt - inp.cash);
    expect(inp.netDebt).toBe(inp.debt - inp.cash);
  });
  it('EPS inconsistent with net income / shares is flagged', () => {
    expect(v({ ...F.msftLike, eps: 40 }).issues.some((i) => i.code === 'EPS_DENOMINATOR')).toBe(true);
    expect(v(F.msftLike).issues.some((i) => i.code === 'EPS_DENOMINATOR')).toBe(false);
  });
  it('impossible values are errors', () => {
    expect(v({ ...F.msftLike, revVal: -1 }).issues.some((i) => i.code === 'REV_NEGATIVE')).toBe(true);
    expect(v({ ...F.msftLike, gpVal: 400e9 }).issues.some((i) => i.code === 'GP_GT_REV')).toBe(true);
  });
  it('SBC without share history is not turned into dilution', () => {
    const r = v({ ...F.msftLike, shareDilution: null, sharesHistory: [] });
    expect(r.issues.some((i) => i.code === 'DILUTION_UNKNOWN')).toBe(true);
  });
  it('stale filings are flagged and unknown filing dates are admitted', () => {
    expect(v({ ...F.msftLike, lastFilingDate: '2024-01-01' }).issues.some((i) => i.code === 'STALE_FILING')).toBe(true);
    expect(v({ ...F.msftLike, lastFilingDate: null }).issues.some((i) => i.code === 'FILING_DATE_UNKNOWN')).toBe(true);
  });
  it('captive finance debt suspected on auto makers', () => {
    expect(v(F.fordLike).issues.some((i) => i.code === 'CAPTIVE_FINANCE_SUSPECT')).toBe(true);
  });
});

describe('quality is independent of price and never made up', () => {
  it('a 20.8% ROIC is not described as mediocre: it beats the cost of capital by a wide margin', () => {
    const r = run(F.crctSynthetic);
    expect(r.quality.roicSpread).toBeGreaterThan(0.08);
    expect(r.quality.components.returns.score).toBeGreaterThanOrEqual(85);
    expect(JSON.stringify(r.explanations.quality)).not.toMatch(/mediocr|floja/i);
  });
  it('changing only the share price does not change the quality score', () => {
    const a = run(F.cokeLike).quality.score;
    const b = run({ ...F.cokeLike, currentPrice: 31, marketCap: F.cokeLike.marketCap / 2 }).quality.score;
    expect(b).toBe(a);
  });
  it('no score without essential data (instead of neutral defaults)', () => {
    const r = run(F.crctQuotedOnly);
    expect(r.quality.score).toBeNull();
    expect(r.quality.reasonNull).toMatch(/No hay datos suficientes/);
    expect(r.potential.score).toBeNull();
  });
  it('moat is never asserted from financial ratios', () => {
    const r = run(F.msftLike);
    expect(r.quality.moat.status).toBe('no_determinable');
    expect(r.quality.moat.label).toMatch(/No puede determinarse/);
  });
  it('a ROIC that contradicts negative operating income is discarded', () => {
    const r = run(F.mntnSynthetic);
    expect(r.validation.issues.some((i) => i.code === 'ROIC_SIGN_MISMATCH')).toBe(true);
    expect(r.quality.roic).toBeNull();
  });
});

describe('valuation chooses methods by business model', () => {
  it('EV/EBITDA is discarded for negative EBITDA and never read as an opportunity', () => {
    const inp = normalizeInput(F.negEbitda);
    const prof = classifyBusiness(inp);
    const m = methodsForProfile(prof.kind, inp);
    expect(m.applicable).not.toContain('evEbitda');
    const r = run(F.negEbitda);
    expect(r.valuation.score).toBeNull();
    expect(r.valuation.methods.find((x) => x.id === 'evEbitda')).toBeUndefined();
  });
  it('banks use P/E and P/B, not EV multiples or P/FCF', () => {
    const r = run(F.bankLike);
    const ids = r.valuation.methods.map((m) => m.id);
    expect(ids).toEqual(expect.arrayContaining(['pe', 'pb']));
    expect(ids).not.toContain('evEbitda');
    expect(ids).not.toContain('pfcf');
    expect(r.valuation.discarded.some((d) => d.method === 'evEbitda')).toBe(true);
  });
  it('P/FCF deducts stock-based compensation', () => {
    const r = run(F.msftLike);
    expect(r.valuation.multiples.pfcf).toBeGreaterThan(r.valuation.multiples.pfcfUnadjusted);
  });
  it('a low P/FCF does not make an expensive-for-its-model company cheap by itself', () => {
    const r = run(F.dilutive);
    expect(r.valuation.score).toBeLessThan(40);
  });
  it('REIT does not use P/E or P/FCF', () => {
    const r = run(F.reitLike);
    const ids = r.valuation.methods.map((m) => m.id);
    expect(ids).not.toContain('pe');
    expect(ids).not.toContain('pfcf');
  });
  it('valuation does not depend on quality inputs it should not see', () => {
    const a = run(F.cokeLike).valuation.score;
    const b = run({ ...F.cokeLike, roic: 3, grossMargin: 5 }).valuation.score;
    expect(b).toBe(a);
  });
});

describe('momentum classification (explicit criteria)', () => {
  const c = (value, positives, negatives, n = 6) => ({ value, positives, negatives, n });
  it('one strong period alone is a possible improvement, never confirmed', () => {
    expect(classifyMomentum(c(0.7, 5, 0), null)).toBe('possible_improvement');
    expect(classifyMomentum(c(0.7, 5, 0), c(0.0, 1, 1))).toBe('possible_improvement');
  });
  it('two consecutive improving periods are confirmed', () => {
    expect(classifyMomentum(c(0.6, 5, 0), c(0.4, 4, 0))).toBe('confirmed_improvement');
  });
  it('mirror for deterioration', () => {
    expect(classifyMomentum(c(-0.7, 0, 5), null)).toBe('possible_deterioration');
    expect(classifyMomentum(c(-0.6, 0, 5), c(-0.4, 0, 4))).toBe('confirmed_deterioration');
  });
  it('mixed and stable and insufficient', () => {
    expect(classifyMomentum(c(0.1, 3, 2), null)).toBe('mixed');
    expect(classifyMomentum(c(0.0, 1, 0), null)).toBe('stable');
    expect(classifyMomentum(c(0.9, 2, 0, 2), null)).toBe('insufficient');
  });
  it('real series: a single good annual jump after declines is not "confirmed"', () => {
    const d = { ...F.msftLike,
      revHistory: F.hist(2025, [100, 98, 95, 92, 90, 120].map((x) => x * 1e9)),
      oiHistory: F.hist(2025, [30, 28, 26, 24, 22, 40].map((x) => x * 1e9)),
      niHistory: F.hist(2025, [20, 19, 18, 17, 16, 30].map((x) => x * 1e9)),
      fcfHistory: F.hist(2025, [20, 19, 18, 17, 16, 30].map((x) => x * 1e9)),
      sharesHistory: F.hist(2025, [5, 5, 5, 5, 5, 4.9].map((x) => x * 1e9)),
    };
    const m = computeMomentum(normalizeInput(d));
    expect(m.status).not.toBe('confirmed_improvement');
    expect(['possible_improvement', 'mixed']).toContain(m.status);
  });
  it('quarterly series use year-over-year to neutralise seasonality', () => {
    const q = Array.from({ length: 12 }, (_, i) => ({ period: `Q${i}`, val: (100 + (i % 4) * 30) * (1 + 0.02 * Math.floor(i / 4)) }));
    const m = computeMomentum(normalizeInput({ ...F.msftLike, quarterly: { revenue: q } }));
    expect(m.basis).toMatch(/trimestral/);
    expect(m.latest.revenueYoY).toBeCloseTo(0.02, 2);
  });
  it('insufficient history yields an explicit label, not a guess', () => {
    const m = computeMomentum(normalizeInput({ ticker: 'X', revVal: 1, oiVal: 1, revHistory: F.hist(2025, [1]) }));
    expect(m.status).toBe('insufficient');
  });
});

describe('risk: absence of information is not absence of risk', () => {
  it('categories without data are "not_evaluable" and keep the overall verdict honest', () => {
    const r = run(F.msftLike).risk;
    const cc = r.items.find((i) => i.id === 'customerConcentration');
    expect(cc.status).toBe('not_evaluable');
    expect(r.caveat).toMatch(/no se pueden evaluar/);
    expect(r.overall).not.toBe('bajo' === r.overall && r.coverage < 0.5 ? 'bajo' : 'x');
  });
  it('a bank with almost nothing evaluable is "no concluyente", not "bajo"', () => {
    expect(run(F.bankLike).risk.overall).toBe('no_concluyente');
  });
  it('confirmed risks are detected from data', () => {
    const r = run(F.dilutive).risk;
    expect(r.items.find((i) => i.id === 'dilution').status).toBe('confirmed');
    expect(['elevado', 'alto']).toContain(r.overall);
  });
  it('cash-burning with short runway is a confirmed liquidity risk', () => {
    const r = run({ ...F.negEbitda, cashVal: 20e6 }).risk;
    expect(r.items.find((i) => i.id === 'liquidity').status).toBe('confirmed');
  });
});

describe('five-year fundamental scenarios', () => {
  const central = (d) => run(d).scenarios.scenarios.find((s) => s.key === 'central');

  it('the model does NOT depend on the share price: with no debt, moving price +-40% leaves fair value, year-5 value and max entry exactly unchanged', () => {
    const base = central(F.crctSynthetic);
    for (const k of [0.6, 1.4]) {
      const alt = central({ ...F.crctSynthetic, currentPrice: F.crctSynthetic.currentPrice * k, marketCap: F.crctSynthetic.marketCap * k });
      expect(alt.valueYear5).toBe(base.valueYear5);
      expect(alt.fairValueToday).toBe(base.fairValueToday);
      expect(alt.maxEntryPrice).toBe(base.maxEntryPrice);
    }
  });
  it('with debt, the only channel from price to value is the market-weight of the WACC, and it is small (<4%)', () => {
    const base = central(F.cokeLike);
    for (const k of [0.6, 1.4]) {
      const alt = central({ ...F.cokeLike, currentPrice: F.cokeLike.currentPrice * k, marketCap: F.cokeLike.marketCap * k });
      expect(Math.abs(alt.valueYear5 / base.valueYear5 - 1)).toBeLessThan(0.04);
      expect(Math.abs(alt.maxEntryPrice / base.maxEntryPrice - 1)).toBeLessThan(0.04);
    }
  });
  it('only the CAGR and the margin of safety react to the price', () => {
    const lo = central({ ...F.cokeLike, currentPrice: 30, marketCap: 30 * 4.3e9 });
    const hi = central({ ...F.cokeLike, currentPrice: 90, marketCap: 90 * 4.3e9 });
    expect(lo.cagr).toBeGreaterThan(hi.cagr);
    expect(lo.marginOfSafety).toBeGreaterThan(hi.marginOfSafety);
  });
  it('max entry price = value5 / (1 + required return)^5, with 15% default and configurable', () => {
    const r = run(F.cokeLike).scenarios;
    const c = r.scenarios.find((s) => s.key === 'central');
    expect(r.requiredReturn).toBe(0.15);
    expect(c.maxEntryPrice).toBeCloseTo(c.valueYear5 / Math.pow(1.15, 5), 1);
    const r10 = run(F.cokeLike, { requiredReturn: 0.10 }).scenarios.scenarios.find((s) => s.key === 'central');
    expect(r10.maxEntryPrice).toBeCloseTo(r10.valueYear5 / Math.pow(1.10, 5), 1);
    expect(r10.maxEntryPrice).toBeGreaterThan(c.maxEntryPrice);
  });
  it('fair value today, future value and max entry price are three different things; margin of safety is vs fair value', () => {
    const r = run(F.msftLike);
    const c = r.scenarios.central;
    expect(c.fairValueToday).not.toBe(c.valueYear5);
    expect(c.maxEntryPrice).not.toBe(c.fairValueToday);
    expect(c.marginOfSafety).toBeCloseTo((c.fairValueToday - r.price) / c.fairValueToday, 3);
    expect(r.entry.priceVsMaxEntry).toBeCloseTo(r.price / c.maxEntryPrice - 1, 6);
  });
  it('scenarios are ordered conservative <= central <= optimistic and carry no probabilities', () => {
    for (const d of [F.msftLike, F.cokeLike, F.dilutive, F.crctSynthetic]) {
      const r = run(d).scenarios;
      const v = ['conservative', 'central', 'optimistic'].map((k) => r.scenarios.find((s) => s.key === k).valueYear5);
      expect(v[0]).toBeLessThanOrEqual(v[1]);
      expect(v[1]).toBeLessThanOrEqual(v[2]);
      expect(r.notProbabilities).toMatch(/no tienen probabilidades/);
      r.scenarios.forEach((s) => { expect(s).not.toHaveProperty('probability'); });
    }
  });
  it('each scenario shows growth, margin, shares, discount rate/multiple, value, CAGR', () => {
    const s = run(F.msftLike).scenarios.scenarios[1];
    expect(s.assumptions.growthYear1).toBeTypeOf('number');
    expect(s.assumptions.marginYear5).toBeTypeOf('number');
    expect(s.assumptions.discountRate).toBeTypeOf('number');
    expect(s.sharesYear5).toBeTypeOf('number');
    expect(s.valueYear5).toBeTypeOf('number');
    expect(s.cagr).toBeTypeOf('number');
  });
  it('cash and debt are counted once: extra net cash raises fair value by exactly cash/shares', () => {
    const inp0 = normalizeInput({ ...F.cokeLike, cashVal: 14e9 });
    const inp1 = normalizeInput({ ...F.cokeLike, cashVal: 14e9 + 4.3e9 * 3 });
    const prof = classifyBusiness(inp0);
    const a = run({ ...F.cokeLike, cashVal: 14e9 }).scenarios.central;
    const b = run({ ...F.cokeLike, cashVal: 14e9 + 4.3e9 * 3 }).scenarios.central;
    expect(prof.kind).toBe('profitable');
    expect(inp1.netDebt).toBe(inp0.netDebt - 4.3e9 * 3);
    // 3 dollars per share of extra cash => exactly +3 in fair value today
    expect(b.fairValueToday - a.fairValueToday).toBeCloseTo(3, 1);
  });
  it('terminal value share and implied exit multiple are disclosed', () => {
    const c = run(F.msftLike).scenarios.central;
    expect(c.terminalValueShare).toBeGreaterThan(0);
    expect(c.impliedTerminalEvEbit).toBeGreaterThan(0);
  });
  it('sensitivity grid is returned and flags fragile results', () => {
    const s = run(F.msftLike).scenarios.sensitivity;
    expect(s.growthMargin).toHaveLength(9);
    expect(s.waccTerminal).toHaveLength(9);
    expect(s.spreadGrowthMargin).toBeGreaterThan(0);
  });
  it('stock-based compensation is not double counted in the share count', () => {
    const c = run({ ...F.msftLike, shareDilution: 10 }).scenarios.central; // dilution below the SBC yield (0.3%/yr)
    expect(c.sharesYear5).toBeGreaterThanOrEqual(c.sharesToday);
    const c2 = run({ ...F.msftLike, shareDilution: -1.5 }).scenarios.central;
    expect(c2.sharesYear5).toBe(c2.sharesToday);
  });
  it('excess issuance beyond SBC is projected progressively: conservative >= central >= optimistic', () => {
    const r = run(F.dilutive).scenarios;
    const sh = ['conservative', 'central', 'optimistic'].map((k) => r.scenarios.find((s) => s.key === k).sharesYear5);
    expect(sh[0]).toBeGreaterThan(sh[1]);
    expect(sh[1]).toBeGreaterThan(sh[2]);
  });
  it('cyclicals use a terminal multiple on normalised margins, not a perpetual growth', () => {
    const d = { ...F.fordLike, debtVal: 20e9, cashVal: 30e9, sector: 'Consumer Cyclical', industry: 'Auto Manufacturers' };
    const r = run(d).scenarios;
    expect(r.status).toBe('ok');
    expect(r.model).toBe('cyclical_multiple');
    expect(r.warnings.join(' ')).toMatch(/cíclica/);
  });
  it('captive-finance style debt yields an explicit refusal, not a negative price', () => {
    const r = run(F.fordLike).scenarios;
    expect(r.status).toBe('insufficient');
    expect(r.reason).toMatch(/deuda neta/);
  });
  it('loss-making companies get NO invented value, but do get the conditions required', () => {
    const r = run(F.negEbitda).scenarios;
    expect(r.status).toBe('insufficient');
    expect(r.scenarios).toEqual([]);
    expect(r.requiredConditions.requiredRevenueGrowth).toBeGreaterThan(0);
    expect(r.requiredConditions.text).toMatch(/no una previsión/);
  });
  it('a loss-making company whose net cash alone covers the 5-year target gets a real message, not NaN%', () => {
    const r = run(F.negEbitdaCashRich).scenarios;
    expect(r.status).toBe('insufficient');
    expect(r.requiredConditions).not.toBeNull();
    expect(r.requiredConditions.requiredRevenueGrowth).toBeNull();
    expect(r.requiredConditions.text).not.toMatch(/NaN/);
    expect(r.requiredConditions.text).toMatch(/caja neta ya cubre/);
  });
  it('REITs are not forced into a universal formula', () => {
    expect(run(F.reitLike).scenarios.status).toBe('insufficient');
  });
  it('banks use a book-value model with explicit labelling', () => {
    const r = run(F.bankLike).scenarios;
    expect(r.model).toBe('bank_justified_pb');
    expect(r.modelLabel).toMatch(/simplificado/);
  });
  it('missing debt or cash blocks the equity bridge', () => {
    const r = run({ ...F.msftLike, cashVal: null }).scenarios;
    expect(r.status).toBe('insufficient');
    expect(r.reason).toMatch(/deuda o la caja/);
  });
  it('the model is deterministic and does not read price history fields', () => {
    const a = JSON.stringify(run(F.msftLike));
    const b = JSON.stringify(run({ ...F.msftLike, priceHistory: [1, 2, 3], historicalCagr: 9.9, analystTarget: 9999 }));
    expect(a).toBe(b);
  });
  it('runScenario is pure', () => {
    const inp = normalizeInput(F.cokeLike);
    const p = { key: 'x', label: 'x', tax: 0.2, margin0: 0.28, g0: 0.03, gT: 0.025, marginTarget: 0.28, roicInc: 0.15, roicT: 0.1, wacc: 0.08, terminalMethod: 'gordon', exitMultiple: 15, excessDilution: 0 };
    expect(JSON.stringify(runScenario(inp, p, DEFAULT_CONFIG))).toBe(JSON.stringify(runScenario(inp, p, DEFAULT_CONFIG)));
  });
});

describe('potential integrates without confusing the dimensions', () => {
  it('an excellent company at a stretched price is flagged as such and capped', () => {
    const r = run({ ...F.msftLike, currentPrice: 900, marketCap: 900 * 7.4e9, pe: 66, forwardPE: 60 });
    expect(r.quality.score).toBeGreaterThanOrEqual(70);
    expect(r.valuation.score).toBeLessThan(40);
    expect(r.potential.pattern.id).toBe('good_business_expensive');
    expect(r.potential.score).toBeLessThanOrEqual(64);
  });
  it('quality and valuation are different numbers for the same company', () => {
    const r = run(F.msftLike);
    expect(r.quality.score).not.toBe(r.valuation.score);
  });
  it('a weak business that looks cheap is not promoted', () => {
    const r = run({ ...F.cokeLike, roic: 2, opMargin: 3, grossMargin: 20, oiVal: 1.4e9, niVal: 1e9, fcfVal: 0.5e9, currentPrice: 8, marketCap: 8 * 4.3e9, pe: 8, forwardPE: 8 });
    expect(r.potential.score === null || r.potential.score <= 55).toBe(true);
  });
  it('weights are documented and the sensitivity to weights is reported', () => {
    const r = run(F.cokeLike).potential;
    expect(Object.values(WEIGHT_SETS.base).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
    expect(r.sensitivity.byWeightSet).toHaveProperty('qualityHeavy');
    expect(r.sensitivity.spread).toBeTypeOf('number');
  });
  it('no score is produced when an essential pillar is missing', () => {
    expect(run(F.negEbitda).potential.score).toBeNull();
    expect(run(F.crctQuotedOnly).potential.score).toBeNull();
  });
  it('data errors withhold the potential score', () => {
    const r = run({ ...F.msftLike, marketCap: F.msftLike.marketCap * 2 });
    expect(r.validation.hasErrors).toBe(true);
    expect(r.potential.score).toBeNull();
  });
  it('is reproducible', () => {
    expect(JSON.stringify(run(F.amznLike).potential)).toBe(JSON.stringify(run(F.amznLike).potential));
  });
});

describe('early signals need structured data and carry their evidence', () => {
  it('each signal has data, period, source, comparison, interpretation, confidence, confirm and invalidate', () => {
    const d = { ...F.msftLike,
      revHistory: F.hist(2025, [100, 90, 85, 100].map((x) => x * 1e9)),
      oiHistory: F.hist(2025, [20, 15, 14, 22].map((x) => x * 1e9)),
      niHistory: F.hist(2025, [15, 11, 10, 17].map((x) => x * 1e9)),
      fcfHistory: F.hist(2025, [10, 11, 14, 18].map((x) => x * 1e9)),
      sharesHistory: F.hist(2025, [5, 5, 5, 5].map((x) => x * 1e9)),
    };
    const sig = run(d).signals.signals;
    expect(sig.length).toBeGreaterThan(0);
    sig.forEach((s) => {
      ['value', 'period', 'source', 'comparison', 'interpretation', 'confidence', 'confirms', 'invalidates'].forEach((k) => expect(s[k]).toBeTruthy());
      expect(['alta', 'media', 'baja']).toContain(s.confidence);
    });
  });
  it('no guidance data means no guidance signal (nothing invented)', () => {
    const ids = run(F.msftLike).signals.signals.map((s) => s.id);
    expect(ids).not.toContain('guidance_up');
    expect(ids).not.toContain('guidance_down');
  });
  it('structured guidance revisions produce a signal', () => {
    const ids = run({ ...F.msftLike, guidance: { source: 'Comunicado de resultados', revisions: [{ period: '2025Q2', direction: 'up' }, { period: '2025Q3', direction: 'up' }] } }).signals.signals.map((s) => s.id);
    expect(ids).toContain('guidance_up');
  });
  it('dilution increase is detected', () => {
    expect(run(F.dilutive).signals.signals.map((s) => s.id)).toContain('dilution_increase');
  });
});

describe('incoherent data blocks projections instead of producing impossible numbers', () => {
  it('operating income above revenue in the history is an error and nothing is projected', () => {
    const r = run({ ...F.msftLike, revHistory: F.hist(2025, [100, 90, 85, 100].map((x) => x * 1e9)) });
    expect(r.validation.issues.some((i) => i.code === 'HISTORY_INCONSISTENT')).toBe(true);
    expect(r.scenarios.status).toBe('insufficient');
    expect(r.scenarios.reason).toMatch(/errores de coherencia/);
    expect(r.entry).toBeNull();
    expect(r.potential.score).toBeNull();
  });
  it('an operating loss more than 5x revenue is a warning, not a hard error that blocks potential (LCID pattern: a real early-stage, heavy-capex loss, not a mismatched period)', () => {
    const r = run({ ...F.negEbitda, oiHistory: F.hist(2025, [-60e6, -62e6, -58e6, -50e6, -1.8e9]), niHistory: F.hist(2025, [-62e6, -65e6, -60e6, -52e6, -1.85e9]), fcfHistory: F.hist(2025, [-50e6, -55e6, -45e6, -30e6, -1.9e9]), revVal: 300e6, oiVal: -1.8e9, niVal: -1.85e9, fcfVal: -1.9e9 });
    const issue = r.validation.issues.find((i) => i.code === 'HISTORY_EXTREME_LOSS');
    expect(issue).toBeDefined();
    expect(issue.severity).toBe('warning');
    expect(r.validation.hasErrors).toBe(false);
  });
  it('operating income above revenue stays an error even in the same history (the two checks are independent)', () => {
    const r = run({ ...F.msftLike, oiHistory: F.hist(2025, [53e9, 70e9, 83e9, 89e9, 109e9, 300e9]) });
    expect(r.validation.issues.some((i) => i.code === 'HISTORY_INCONSISTENT')).toBe(true);
    expect(r.validation.hasErrors).toBe(true);
  });
  it('no projected operating margin can exceed 100% for any clean fixture', () => {
    Object.values(F.ALL_SYNTHETIC).forEach((d) => {
      const r = run(d);
      if (r.scenarios.status === 'ok' && r.scenarios.model === 'dcf') r.scenarios.scenarios.forEach((s) => expect(s.assumptions.marginYear5).toBeLessThanOrEqual(1));
    });
  });
});

describe('presentation of figures (Spanish from Spain, beginner friendly)', () => {
  it('no scientific notation and no decimal points inside user-facing text', () => {
    const r = run({ ...F.msftLike, fcfHistory: F.hist(2025, [10, 11, 14, 18].map((x) => x * 1e9)) });
    const texts = JSON.stringify([r.explanations, r.signals.signals, r.risk.items, r.validation.issues, r.scenarios.conditions, r.scenarios.warnings]);
    const strings = [];
    JSON.parse(texts, (k, val) => { if (typeof val === 'string') strings.push(val); return val; });
    const joined = strings.join(' | ');
    expect(joined).not.toMatch(/\de\+\d/);
    expect(joined).not.toMatch(/\d\.\d/);
  });
  it('words are Spanish from Spain, not Latin American', () => {
    const r = run(F.crctSynthetic);
    expect(JSON.stringify(r.explanations)).not.toMatch(/computadora|plata|acá|ahorita|celular|carro/i);
  });
});

describe('required cases from the brief', () => {
  it('CRCT with only the quoted figures: N/D everywhere essential, no invented entry price', () => {
    const r = run(F.crctQuotedOnly);
    expect(r.quality.score).toBeNull();
    expect(r.valuation.score).toBeNull();
    expect(r.scenarios.status).toBe('insufficient');
    expect(r.entry).toBeNull();
  });
  it('CRCT-like: revenue decline is reflected and the old price-driven -12.9% drift is gone', () => {
    const r = run(F.crctSynthetic);
    expect(r.profile.kind).toBe('profitable');
    expect(r.scenarios.central.assumptions.growthYear1).toBeLessThan(0);
    expect(r.momentum.latest.revenueYoY).toBeLessThan(0);
    expect(r.quality.score).toBeGreaterThanOrEqual(70);
    expect(r.potential.pattern.id).not.toBe('good_business_fair_price');
  });
  it('CRCT-like: a +47.57% price jump changes the CAGR/margin of safety but never the value of the business', () => {
    const before = run({ ...F.crctSynthetic, currentPrice: 8.81 / 1.4757, marketCap: F.crctSynthetic.marketCap / 1.4757 });
    const after = run(F.crctSynthetic);
    expect(after.scenarios.central.valueYear5).toBe(before.scenarios.central.valueYear5);
    expect(after.scenarios.central.maxEntryPrice).toBe(before.scenarios.central.maxEntryPrice);
    expect(after.scenarios.central.cagr).toBeLessThan(before.scenarios.central.cagr);
  });
  it('MNTN-like: incoherent periods are flagged, no bullish conclusion is forced', () => {
    const r = run(F.mntnSynthetic);
    const codes = r.validation.issues.map((i) => i.code);
    expect(codes).toContain('ROIC_SIGN_MISMATCH');
    expect(codes).toContain('EVEBITDA_NEGATIVE');
    expect(r.scenarios.status).toBe('insufficient');
    expect(r.potential.score).toBeNull();
    expect(r.valuation.score).toBeNull();
    expect(r.risk.items.find((i) => i.id === 'dilution').status).toBe('confirmed');
    expect(r.risk.items.find((i) => i.id === 'stockCompensation').status).toBe('confirmed');
    expect(r.entry).toBeNull();
  });
});

// Phase 1 of the "validación multisectorial" audit: fixes confirmed against real tickers
// (DAVE/MNTN audit + a 24-company, 12-category survey) via a read-only scratch harness, never
// against a hunch. Each test below reproduces the real-data pattern that proved the bug.
describe('validación multisectorial — fase 1', () => {
  const v = (d) => validateInput(normalizeInput(d), new Date(NOW));
  const kind = (d) => classifyBusiness(normalizeInput(d)).kind;

  it('a 13-year-stale history is an error, not just an info-level filing-date gap (VALE pattern)', () => {
    const stale = {
      ...F.cokeLike, lastFilingDate: null,
      revHistory: F.hist(2012, [33e9, 38.7e9, 43e9, 45.8e9, 47e9, 47.6e9]),
      oiHistory: F.hist(2012, [9.8e9, 10.3e9, 10.9e9, 12.8e9, 13.1e9, 13.2e9]),
      niHistory: F.hist(2012, [7.7e9, 9.8e9, 9.5e9, 10.7e9, 10.6e9, 10.7e9]),
    };
    const r = v(stale);
    const issue = r.issues.find((i) => i.code === 'HISTORY_STALE');
    expect(issue).toBeDefined();
    expect(issue.severity).toBe('error');
    expect(r.hasErrors).toBe(true);
  });
  it('a 2-year lag is only a warning, not an error (a legitimate reporting lag is not 13-year-old data)', () => {
    const mildlyStale = {
      ...F.cokeLike, lastFilingDate: null,
      revHistory: F.hist(2023, [33e9, 38.7e9, 43e9, 45.8e9, 47e9, 47.6e9]),
      oiHistory: F.hist(2023, [9.8e9, 10.3e9, 10.9e9, 12.8e9, 13.1e9, 13.2e9]),
    };
    const r = v(mildlyStale);
    expect(r.issues.find((i) => i.code === 'HISTORY_STALE').severity).toBe('warning');
    expect(r.hasErrors).toBe(false);
  });

  it('a hard data error withholds the valuation score the same way it already withholds scenarios and potential (NLY pattern)', () => {
    const r = run({ ...F.msftLike, marketCap: F.msftLike.marketCap * 1.5 });
    expect(r.validation.hasErrors).toBe(true);
    expect(r.valuation.score).toBeNull();
    expect(r.valuation.reasonNull).toMatch(/errores de coherencia/);
    expect(r.scenarios.status).toBe('insufficient');
    expect(r.potential.score).toBeNull();
  });

  it('a cyclical-sector company currently loss-making still gets kind "cyclical", not "temporarilyUnprofitable" (INTC-vs-TSM pattern)', () => {
    const troughYear = {
      ...F.fordLike, oiVal: -3e9, ebtVal: -2e9, niVal: -2.5e9,
      oiHistory: F.hist(2025, [2.8e9, -1.8e9, 7.5e9, -3e9, 5.2e9, -3e9]),
    };
    expect(kind(troughYear)).toBe('cyclical');
  });
  it('a loss-making company outside a cyclical sector is unaffected (no regression on the existing recovery/unprofitable split)', () => {
    const d = { ...F.negEbitda, oiHistory: F.hist(2025, [30e6, 25e6, 10e6, -5e6, -40e6]) };
    expect(kind(d)).toBe('temporarilyUnprofitable');
  });

  it('a reported P/E that diverges from the one actually used is explained, not silently swapped (DAVE/HUBS/PNC pattern)', () => {
    const r = run({ ...F.msftLike, pe: 45 });
    expect(r.valuation.notes.some((n) => /P\/E de la ficha/.test(n))).toBe(true);
  });
  it('a reported P/E close to the one actually used gets no such note', () => {
    const r = run(F.msftLike);
    expect(r.valuation.notes.some((n) => /P\/E de la ficha/.test(n))).toBe(false);
  });

  it('a utility with structurally negative FCF is scored on earnings yield, not penalized by a multiple its own sector band marks not-applicable (SO pattern)', () => {
    const r = run(F.utilityLike);
    expect(r.profile.kind).toBe('profitable');
    expect(r.valuation.impliedReturn.yield).toBeGreaterThan(0);
    expect(r.valuation.impliedReturn.note).toMatch(/no es el indicador adecuado/);
  });
});

// A number shown as "67/100" implies a precision the model doesn't have (see the user-facing
// potential.sensitivity check above). This phase surfaces that as a word, widened into a range
// only when a different reasonable weighting actually lands on a different word — verified both
// ways: a real spread is shown, and a dominant cap (which previously only applied to the base
// weighting) is no longer mistaken for weighting sensitivity once every alternate weighting is
// capped the same way.
describe('potencial se muestra como palabra (+ rango), no como número suelto', () => {
  it('a real spread across weightings produces a word range, not a bare number implying false precision', () => {
    const r = computePotential({
      quality: { score: 100 },
      valuation: { score: 30 },
      momentum: { status: 'confirmed_deterioration' },
      risk: { overall: 'moderado', level: 60 },
      scenarios: { status: 'insufficient' },
      dataQuality: { hasErrors: false },
    });
    expect(r.caps).toEqual([]);
    expect(r.score).toBe(50);
    expect(r.sensitivity.byWeightSet).toEqual({ base: 50, qualityHeavy: 62, valuationHeavy: 44, equal: 46 });
    expect(r.sensitivity.spread).toBe(18);
    expect(r.sensitivity.dependsOnWeights).toBe(true);
    expect(r.sensitivity.labelRange).toEqual({ low: 'Potencial limitado', high: 'Potencial moderado' });
  });
  it('a dominant cap (negative central CAGR) collapses the weighting range to a single word, not a wide spread (previously only the base weighting was capped)', () => {
    const r = computePotential({
      quality: { score: 80 },
      valuation: { score: 75 },
      momentum: { status: 'confirmed_improvement' },
      risk: { overall: 'bajo', level: 10 },
      scenarios: { status: 'ok', scenarios: [{ key: 'central', cagr: -0.05 }] },
      dataQuality: { hasErrors: false },
    });
    expect(r.caps.length).toBeGreaterThan(0);
    expect(r.score).toBe(45);
    expect(Object.values(r.sensitivity.byWeightSet).every((v) => v === 45)).toBe(true);
    expect(r.sensitivity.dependsOnWeights).toBe(false);
    expect(r.sensitivity.labelRange).toBeNull();
  });
  it('no range when every weighting lands on the same word', () => {
    const r = run(F.msftLike);
    expect(r.potential.sensitivity.labelRange).toBeNull();
  });
});

// Same mechanism as Potencial, now built for Calidad: a word instead of a bare number, widened
// into a range only when a different reasonable weighting of the 9 quality components actually
// lands on a different word. Every expected number below was read off a real run against the
// existing synthetic fixtures (not hand-derived), to avoid asserting a guess.
describe('calidad se muestra como palabra (+ rango)', () => {
  it('a stable, uniformly strong business shows one word, no range (msftLike)', () => {
    const r = run(F.msftLike);
    expect(r.quality.label).toBe('Calidad sólida');
    expect(r.quality.sensitivity.labelRange).toBeNull();
  });
  it('a case close to the débil/aceptable boundary shows a range (fordLike)', () => {
    const r = run(F.fordLike);
    expect(r.quality.label).toBe('Calidad aceptable');
    expect(r.quality.sensitivity.labelRange).toEqual({ low: 'Calidad débil', high: 'Calidad aceptable' });
  });
  it('a >15-point spread that never crosses a word boundary flags "depends on weights" without implying a word range (dilutive)', () => {
    const r = run(F.dilutive);
    expect(r.quality.sensitivity.dependsOnWeights).toBe(true);
    expect(r.quality.sensitivity.labelRange).toBeNull();
  });
  it('a case where both the numeric spread and the word itself are unstable shows both signals (insurerLike)', () => {
    const r = run(F.insurerLike);
    expect(r.quality.sensitivity.dependsOnWeights).toBe(true);
    expect(r.quality.sensitivity.labelRange).toEqual({ low: 'Calidad aceptable', high: 'Calidad sólida' });
  });
  it('a weight set with too little data to score is left out of the range, not treated as 0 (reitLike: returnsHeavy needs reinvestment/capitalEvolution data it lacks)', () => {
    const r = run(F.reitLike);
    expect(r.quality.sensitivity.byWeightSet.returnsHeavy).toBeNull();
    expect(r.quality.sensitivity.labelRange).toBeNull();
  });
  it('no sensitivity object when there is no base score to begin with', () => {
    expect(run(F.mntnSynthetic).quality.sensitivity).toBeNull();
    expect(run(F.crctQuotedOnly).quality.sensitivity).toBeNull();
  });
});
