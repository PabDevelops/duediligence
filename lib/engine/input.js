import { analysisData } from '../financialDataPolicy.js';
// Adapter: turns the `data` object returned by /api/stock into the engine's normalized input,
// attaching provenance. The route reports each flow field's actual basis (genuine TTM roll vs.
// the last fiscal year) via `data.financialPeriods` when it's known; flowPeriodLabel below falls
// back to the honest "no distinguible" hedge only when that per-field data is missing (older
// cached rows from before financialPeriods existed, or a non-SEC/Yahoo-only source).

import { isNum, cleanHistory, round } from './util.js';
import { pickBenchmark, CYCLICAL_KEYS } from './benchmarks.js';

const SRC = 'SEC EDGAR / Yahoo Finance / Finnhub (vía API de BullTrace)';
const flowPeriodLabel = (p) => p?.basis === 'TTM'
  ? `TTM (12 meses hasta ${p.periodEnd || 'fecha no disponible'})`
  : p?.basis === 'FY'
    ? `ejercicio fiscal (${p.periodEnd || 'fecha no disponible'})`
    : 'TTM o último año fiscal (no distinguible con los datos actuales)';

export function normalizeInput(data, opts = {}) {
  const d = analysisData(data,opts.integrityPurpose||'standalone') || {};
  const periodFor = field => d.financialPeriods?.[field+'Val'] || d.financialPeriods?.[field];
  const sourceFor = field => d.financialPeriods?.[field+'Val']?.source || d.financialPeriods?.[field]?.source || d.financialSource || SRC;
  const shares = isNum(d.sharesOutstanding) ? d.sharesOutstanding
    : (isNum(d.marketCap) && isNum(d.currentPrice) && d.currentPrice > 0 ? d.marketCap / d.currentPrice : null);
  const [benchKey, bench] = pickBenchmark(d.sector, d.industry);
  const sector = (d.sector || '').toLowerCase();
  const industry = (d.industry || '').toLowerCase();
  const isCyclicalSector = CYCLICAL_KEYS.some((k) => sector.includes(k) || industry.includes(k));

  const debt = isNum(d.debtVal) ? d.debtVal : null;
  const cash = isNum(d.cashVal) ? d.cashVal : null;
  // Net debt is only computed when BOTH sides are known. A missing cash figure must not turn
  // gross debt into "net debt" (it would overstate leverage) and a missing debt figure must not
  // turn cash into negative net debt (it would hide leverage).
  const netDebt = debt != null && cash != null ? debt - cash : null;
  const ebitda = isNum(d.oiVal) && isNum(d.daVal) ? d.oiVal + d.daVal : null;
  const ev = isNum(d.marketCap) && netDebt != null ? d.marketCap + netDebt : null;

  return {
    ticker: d.ticker ?? null,
    name: d.name ?? null,
    currency: d.currency ?? 'USD',
    sector: d.sector ?? null,
    industry: d.industry ?? null,
    benchKey, bench, isCyclicalSector,
    price: isNum(d.currentPrice) ? d.currentPrice : null,
    marketCap: isNum(d.marketCap) ? d.marketCap : null,
    shares,
    beta: isNum(d.beta) ? d.beta : null,
    riskFreeRate: isNum(d.riskFreeRate) ? d.riskFreeRate : null,
    rev: isNum(d.revVal) ? d.revVal : null,
    gp: isNum(d.gpVal) ? d.gpVal : null,
    oi: isNum(d.oiVal) ? d.oiVal : null,
    ni: isNum(d.niVal) ? d.niVal : null,
    ebt: isNum(d.ebtVal) ? d.ebtVal : null,
    tax: isNum(d.taxVal) ? d.taxVal : null,
    interest: isNum(d.interestVal) ? Math.abs(d.interestVal) : null,
    da: isNum(d.daVal) ? d.daVal : null,
    fcf: isNum(d.fcfVal) ? d.fcfVal : null,
    capex: isNum(d.capexVal) ? Math.abs(d.capexVal) : null,
    sbc: isNum(d.sbcVal) ? d.sbcVal : null,
    rd: isNum(d.rdVal) ? d.rdVal : null,
    dividendsPaid: isNum(d.dividendsPaidVal) ? Math.abs(d.dividendsPaidVal) : null,
    assets: isNum(d.assetsVal) ? d.assetsVal : null,
    equity: isNum(d.equityVal) ? d.equityVal : null,
    currentAssets: isNum(d.currentAssetsVal) ? d.currentAssetsVal : null,
    currentLiabilities: isNum(d.currentLiabilitiesVal) ? d.currentLiabilitiesVal : null,
    debt, cash, netDebt, ebitda, ev,
    eps: isNum(d.eps) ? d.eps : null,
    pe: isNum(d.pe) ? d.pe : null,
    forwardPE: isNum(d.forwardPE) ? d.forwardPE : null,
    evEbitdaReported: isNum(d.evEbitda) ? d.evEbitda : null,
    priceToBook: isNum(d.priceToBook) ? d.priceToBook : null,
    roicReported: isNum(d.roic) ? d.roic / 100 : null,
    roe: isNum(d.roe) ? d.roe / 100 : null,
    roa: isNum(d.roa) ? d.roa / 100 : null,
    grossMargin: isNum(d.grossMargin) ? d.grossMargin / 100 : null,
    opMargin: isNum(d.opMargin) ? d.opMargin / 100 : null,
    netMargin: isNum(d.netMargin) ? d.netMargin / 100 : null,
    revGrowthTTM: isNum(d.revGrowth) ? d.revGrowth / 100 : null,
    shareDilutionPct: isNum(d.shareDilution) ? d.shareDilution / 100 : null,
    shareHistoryYears: cleanHistory(d.sharesHistory).length,
    // Histories (annual, ascending)
    revH: cleanHistory(d.revHistory),
    oiH: cleanHistory(d.oiHistory),
    niH: cleanHistory(d.niHistory),
    fcfH: cleanHistory(d.fcfHistory),
    sharesH: cleanHistory(d.sharesHistory),
    gpH: cleanHistory(d.gpHistory),
    capexH: cleanHistory(d.capexHistory),
    daH: cleanHistory(d.daHistory),
    assetsH: cleanHistory(d.assetsHistory),
    clH: cleanHistory(d.currentLiabilitiesHistory),
    ebtH: cleanHistory(d.ebtHistory),
    taxH: cleanHistory(d.taxHistory),
    debtH: cleanHistory(d.debtHistory),
    equityH: cleanHistory(d.equityHistory),
    // Optional richer inputs (never required, never invented)
    quarterly: d.quarterly ?? opts.quarterly ?? null,
    guidance: d.guidance ?? opts.guidance ?? null,
    organicGrowth: isNum(d.organicGrowthPct) ? d.organicGrowthPct / 100 : null,
    concentration: d.customerConcentration ?? null,
    forwardEps: isNum(d.forwardEps) ? d.forwardEps : null,
    // Publication / freshness metadata, when the caller can supply it
    dayChangePct: isNum(d.dayChangePct) ? d.dayChangePct : (opts.dayChangePct ?? null),
    raw: d,
    asOf: d.asOf ?? opts.asOf ?? null,
    lastFilingDate: d.lastFilingDate ?? null,
    fetchedAt: d.fetchedAt ?? null,
    provenance: {
      price: { source: 'Yahoo Finance / Finnhub', type: 'reportado', unit: 'moneda de cotización' },
      marketCap: { source: SRC, type: 'calculado', note: 'precio x acciones en circulación' },
      rev: { source: sourceFor('rev'), type: 'reportado', period: flowPeriodLabel(periodFor('rev')) },
      oi: { source: sourceFor('oi'), type: 'reportado', period: flowPeriodLabel(periodFor('oi')), note: 'GAAP, incluye remuneración en acciones' },
      fcf: { source: sourceFor('fcf'), type: 'calculado', period: flowPeriodLabel(periodFor('fcf')), note: 'flujo operativo menos inversión en capex' },
      debt: { source: sourceFor('debt'), type: 'reportado', period: 'último balance', note: 'incluye arrendamientos largos según la etiqueta XBRL disponible' },
      cash: { source: sourceFor('cash'), type: 'reportado', period: 'último balance' },
      roic: { source: SRC, type: 'calculado', note: 'NOPAT / (activos totales menos pasivo corriente)' },
    },
    _roundedDebug: round(ev, 0),
  };
}
