import { selectStatementFacts } from './secFactSelection.js';
import { validPeriod } from './financialIntegrity.js';

// A cash-equivalents component is sufficient only when an independently tagged
// cash total agrees exactly. Never treat a restricted-cash total alone as liquid cash.
export function corroboratedCashEquivalents(usgaap) {
  const facts = tag => selectStatementFacts((usgaap[tag]?.units?.USD || []).map(p => ({
    ...p, tag, unit: 'USD', currency: 'USD',
  }))).filter(p => !p.start && p.accn && Number.isFinite(p.val) && p.val >= 0);
  const totals = facts('CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents');
  const restricted = ['RestrictedCashAndCashEquivalents','RestrictedCashAndCashEquivalentsCurrent',
    'RestrictedCashAndCashEquivalentsNoncurrent','RestrictedCash','RestrictedCashCurrent','RestrictedCashNoncurrent'].flatMap(facts);
  return facts('CashEquivalentsAtCarryingValue').filter(p => totals.some(total =>
    total.end === p.end && total.accn === p.accn && total.val === p.val)
    && !restricted.some(r => r.end === p.end && r.val > 0))
    .sort((a, b) => b.end.localeCompare(a.end));
}

export function annualFcfEvidence(ocf, capex) {
  if (!ocf || !capex || !Number.isFinite(ocf.val) || !Number.isFinite(capex.val)
    || !ocf.currency || !ocf.unit || ocf.start !== capex.start || ocf.end !== capex.end
    || ocf.currency !== capex.currency || ocf.unit !== capex.unit) return null;
  const period = p => ({ basis: 'FY', periodStart: p.start, periodEnd: p.end,
    currency: p.currency, unit: p.unit, scope: 'consolidated', source: 'SEC EDGAR',
    publicationDate: p.filed, accession: p.accn, tag: p.tag });
  if (!validPeriod(period(ocf))) return null;
  return { ...period(ocf), cashFlowInputs: {
    operatingCF: { ...period(ocf), val: ocf.val }, capex: { ...period(capex), val: capex.val },
  } };
}
