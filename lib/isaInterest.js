// ISA cash pot growth — a deposit compounds daily at the portfolio's current
// annual rate from its transaction date until now. There's no daily accrual
// job: this is recomputed on every load, and a rate change applies to the
// whole history retroactively (like re-pricing a variable-rate savings pot),
// not just from the day it was changed.
const MS_PER_DAY = 86400000;

function dailyFactor(annualRatePct) {
  const rate = Number(annualRatePct) || 0;
  return Math.pow(1 + rate / 100, 1 / 365);
}

// entry: { amount, date, portfolio_id }
export function isaEntryValue(entry, annualRatePct, asOf = new Date()) {
  const days = Math.max(0, Math.floor((asOf - new Date(entry.date)) / MS_PER_DAY));
  return Number(entry.amount) * Math.pow(dailyFactor(annualRatePct), days);
}

// ratesByPortfolioId: { [portfolio_id]: annualRatePct }
export function sumIsaValue(entries, ratesByPortfolioId, asOf = new Date()) {
  return entries.reduce((total, e) => total + isaEntryValue(e, ratesByPortfolioId[e.portfolio_id], asOf), 0);
}
