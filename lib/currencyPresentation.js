// Presentation only. Never infer currencies from exchange suffixes or fetch FX here.
export function currencySymbol(currency) {
  return {
    USD: '$',
    EUR: '€',
    GBP: '£',
    GBp: 'GBp ',
    JPY: '¥',
    CNY: 'CN¥',
    HKD: 'HK$',
    CAD: 'CA$',
    AUD: 'A$',
    CHF: 'CHF '
  }[currency] || (currency ? `${currency} ` : 'moneda N/D ');
}
export const quoteCurrency = data => data?.currency || null;

// Reverse only an explicitly recorded conversion, for display of original statements.
// Numeric inputs to scoring, multiples, DCF and scenarios are never changed.
export function financialAmount(value, period, data) {
  if (!Number.isFinite(value)) return {
    value: null,
    currency: null
  };
  const currency = period?.currency || data?.currency || null;
  if (period?.originalCurrency && period.originalCurrency !== currency) {
    if (!(Number.isFinite(period.fxRate) && period.fxRate > 0)) return {
      value: null,
      currency: period.originalCurrency
    };
    return {
      value: value / period.fxRate,
      currency: period.originalCurrency
    };
  }
  if (data?.financialCurrency && currency && data.financialCurrency !== currency && !period?.currency) {
    return {
      value: null,
      currency: data.financialCurrency
    };
  }
  return {
    value,
    currency: period?.originalCurrency || period?.currency || data?.financialCurrency || currency
  };
}
export function financialText(value, period, data, compact = false) {
  const amount = financialAmount(value, period, data);
  if (amount.value == null) return 'N/D';
  const magnitude = Math.abs(amount.value);
  const divisor = compact && magnitude >= 1e9 ? 1e9 : compact && magnitude >= 1e6 ? 1e6 : 1;
  const suffix = divisor === 1e9 ? ' mil M' : divisor === 1e6 ? ' M' : '';
  return `${(amount.value / divisor).toLocaleString('es-ES', {
    maximumFractionDigits: compact ? 1 : 2
  })}${suffix} ${amount.currency || 'moneda N/D'}`;
}

// The engine's legacy explanatory strings default to dollars. Adapt strings only;
// keep every numeric result and scoring decision exactly as supplied by the engine.
export function presentAnalysis(engine, data) {
  if (!engine) return null;
  const sym = currencySymbol(quoteCurrency(data)).trim();
  const text = value => typeof value === 'string' ? value.replaceAll('$', sym) : Array.isArray(value) ? value.map(text) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, text(v)])) : value;
  const result = {
    ...engine,
    explanations: text(engine.explanations),
    validation: {
      ...engine.validation,
      issues: text(engine.validation?.issues)
    },
    risk: {
      ...engine.risk,
      items: text(engine.risk?.items)
    },
    signals: {
      ...engine.signals,
      signals: text(engine.signals?.signals)
    }
  };
  for (const signal of result.signals?.signals || []) {
    const field = signal.id.startsWith('fcf_') ? 'fcfHistory' : signal.id === 'earnings_worsening' ? 'niHistory' : signal.id === 'debt_reduction' ? 'debtHistory' : null;
    const points = field ? (data[field] || []).filter(p => Number.isFinite(p.val)).slice(field === 'fcfHistory' ? -4 : -3) : [];
    if (points.length > 1) signal.comparison = `De ${financialText(points[0].val, points[0], data, true)} a ${financialText(points.at(-1).val, points.at(-1), data, true)}.`;
  }
  for (const item of result.risk.items || []) {
    if (item.id === 'liquidity' && Number.isFinite(data?.fcfVal) && data.fcfVal < 0) {
      item.evidence = item.evidence.replace(/^Quema .+? al año/, `Quema ${financialText(Math.abs(data.fcfVal), data.financialPeriods?.fcfVal, data, true)} al año`);
    }
  }
  return result;
}

// Display convention requested by the product: difference relative to today's price.
// Keep the engine's conventional marginOfSafety and all model outputs unchanged.
export function priceRelativeValue(fairValue, price) {
  return Number.isFinite(fairValue) && fairValue >= 0 && Number.isFinite(price) && price > 0
    ? (fairValue - price) / price : null;
}
