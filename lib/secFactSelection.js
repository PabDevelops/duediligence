import { selectLatestFacts } from './financialIntegrity.js';
import {reconcileSecRevenueScales,revenueConcepts} from './secRevenueScale.js';

export const ANNUAL_FORMS = ['10-K', '20-F', '10-K/A', '20-F/A'];
const STATEMENT_FORMS = [...ANNUAL_FORMS, '10-Q', '10-Q/A'];
const REVENUE_TAGS = new Set(['RevenueFromContractWithCustomerExcludingAssessedTax','Revenues','SalesRevenueNet','RevenueFromContractWithCustomerIncludingAssessedTax']);

// Filter before deduplication: a rounded proxy disclosure must not evict a 10-K.
export function selectStatementFacts(facts, forms = STATEMENT_FORMS) {
  return selectLatestFacts(facts.filter(fact => forms.includes(fact.form)
    && (!fact.filed || !fact.end || fact.end <= fact.filed)));
}

// Select one complete concept series; never splice different tags or units into a TTM.
// Revenue aliases prefer the newest annual anchor. Other concept lists retain their
// existing priority: in particular, pretax income must never outrank operating income.
export function selectFlowSeries(usgaap, keys, recencyAnchor) {
  if(revenueConcepts(keys))usgaap=reconcileSecRevenueScales(usgaap).usgaap;
  const candidates = [];
  for (const tag of keys) {
    const metric = usgaap[tag];
    const unit = ['USD','EUR','shares','pure'].find(u => metric?.units?.[u]);
    if (!unit) continue;
    const periods = selectStatementFacts(metric.units[unit].map(fact => ({...fact,
      tag, unit, currency: ['USD','EUR'].includes(unit) ? unit : null,
    }))).filter(fact => fact.start && fact.end)
      .sort((a,b) => b.end.localeCompare(a.end) || (b.filed || '').localeCompare(a.filed || ''));
    if (!periods.length) continue;
    if (recencyAnchor && (Date.parse(recencyAnchor)-Date.parse(periods[0].end))/31557600000 > 3) continue;
    const annualEnd = periods.filter(fact => ANNUAL_FORMS.includes(fact.form)
      && (Date.parse(fact.end)-Date.parse(fact.start))/86400000 >= 349
      && (Date.parse(fact.end)-Date.parse(fact.start))/86400000 <= 379)
      .map(fact=>fact.end).sort().at(-1) || '';
    candidates.push({periods, annualEnd});
  }
  if (!keys.every(key => REVENUE_TAGS.has(key))) return candidates[0]?.periods || null;
  candidates.sort((a,b) => b.annualEnd.localeCompare(a.annualEnd)
    || b.periods[0].end.localeCompare(a.periods[0].end));
  return candidates[0]?.periods || null;
}
