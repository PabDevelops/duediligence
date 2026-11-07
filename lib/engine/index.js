// Entry point of the V2 analysis engine. analyzeStock(data) runs everything on the object
// returned by /api/stock and returns the five dimensions plus validations, scenarios,
// early signals and beginner explanations. Pure and deterministic: same input, same output.

import { normalizeInput } from './input.js';
import {scopeFinancialEntity} from '../listingIdentity.js';
import { valuationCashFlow } from '../valuationCashFlow.js';
import { validateInput } from './validation.js';
import {manualValidation} from '../manualCalculationPolicy.js';
import { classifyBusiness } from './profile.js';
import { computeQuality } from './quality.js';
import { computeMomentum } from './momentum.js';
import { computeValuation, insufficientValuation } from './valuation.js';
import { computeRisk } from './risk.js';
import { computeScenarios, insufficient, DEFAULT_CONFIG } from './scenarios.js';
import { computeSignals } from './signals.js';
import { computePotential } from './potential.js';
import { localizeDecimals } from './util.js';
import { explainQuality, explainMomentum, explainValuation, explainRisk, explainScenarios } from './explain.js';

export const ENGINE_VERSION = '2.0.0';

export function analyzeStock(data, opts = {}) {
  data=scopeFinancialEntity(data);
  const inp = normalizeInput(data, opts);
  const validation = manualValidation(validateInput(inp, opts.now ? new Date(opts.now) : new Date()),data);
  const profile = classifyBusiness(inp);
  const qualityInput = data?.financialIntegrity?.version===2 ? normalizeInput(data,{...opts,integrityPurpose:'quality'}) : inp;
  const quality = computeQuality(qualityInput, profile);
  const momentum = computeMomentum(inp);
  const cashFlowSelection=valuationCashFlow(data);
  const valuationInput=cashFlowSelection.data===data?inp:normalizeInput(cashFlowSelection.data,opts);
  const valuation = validation.hasErrors
    ? insufficientValuation('Hay errores de coherencia en los datos (ver validaciones): no se valora hasta resolverlos, para no puntuar sobre cifras que no cuadran.')
    : computeValuation(valuationInput, profile);
  if(cashFlowSelection.basis){
    valuation.cashFlowBasis=cashFlowSelection.basis;
    valuation.notes||=[];
    valuation.notes.push(cashFlowSelection.basis.status==='matched'
      ?`P/FCF después de SBC: ${cashFlowSelection.basis.basis}, ${cashFlowSelection.basis.periodStart} → ${cashFlowSelection.basis.periodEnd}, ${cashFlowSelection.basis.currency}, ${cashFlowSelection.basis.scope}. No equivale al H1 más reciente.`
      :cashFlowSelection.basis.reason);
  }
  const scenarios = validation.hasErrors || data?.financialIntegrity?.calculations?.[profile.kind==='financial'?'bankProjections':'projections']?.status === 'blocked'
    ? insufficient('Hay errores de coherencia en los datos (ver validaciones): no se proyecta nada hasta resolverlos, para no construir un valor sobre cifras que no cuadran.')
    : computeScenarios(inp, profile, { requiredReturn: opts.requiredReturn ?? DEFAULT_CONFIG.requiredReturn });
  const risk = computeRisk(qualityInput, profile, { momentum, valuation });
  const signals = computeSignals(inp, momentum);
  const potential = computePotential({ quality, valuation, momentum, risk, scenarios, dataQuality: validation });
  const sym = inp.currency === 'EUR' ? '€' : inp.currency === 'GBP' ? '£' : '$';
  const explanations = {
    quality: explainQuality(quality, qualityInput, profile),
    momentum: explainMomentum(momentum),
    valuation: explainValuation(valuation, inp, scenarios, quality),
    risk: explainRisk(risk),
    scenarios: explainScenarios(scenarios, inp, sym),
  };
  // Spanish-from-Spain decimals in every user-facing string (numbers and ids are untouched).
  Object.assign(explanations, localizeDecimals(explanations));
  quality.components = localizeDecimals(quality.components);
  quality.notes = localizeDecimals(quality.notes);
  valuation.notes = localizeDecimals(valuation.notes);
  if (valuation.impliedReturn) valuation.impliedReturn.note = localizeDecimals(valuation.impliedReturn.note);
  risk.items = localizeDecimals(risk.items);
  signals.signals = localizeDecimals(signals.signals);
  validation.issues = localizeDecimals(validation.issues);
  if (scenarios.conditions) scenarios.conditions = localizeDecimals(scenarios.conditions);
  if (scenarios.warnings) scenarios.warnings = localizeDecimals(scenarios.warnings);
  if (scenarios.requiredConditions) scenarios.requiredConditions.text = localizeDecimals(scenarios.requiredConditions.text);
  if (scenarios.reason) scenarios.reason = localizeDecimals(scenarios.reason);
  const central = scenarios.status === 'ok' ? scenarios.scenarios.find((s) => s.key === 'central') : null;
  return {
    version: ENGINE_VERSION,
    ticker: inp.ticker, name: inp.name, currency: inp.currency, price: inp.price,
    profile, validation, quality, momentum, valuation, risk, scenarios, signals, potential, explanations,
    entry: central
      ? {
        fairValueToday: central.fairValueToday, valueYear5: central.valueYear5, maxEntryPrice: central.maxEntryPrice,
        marginOfSafety: central.marginOfSafety, cagr: central.cagr, requiredReturn: scenarios.requiredReturn,
        priceVsMaxEntry: central.maxEntryPrice > 0 ? inp.price / central.maxEntryPrice - 1 : null,
      }
      : null,
    sources: {
      financials: 'SEC EDGAR / Yahoo Finance / Finnhub (vía API de BullTrace)',
      lastFilingDate: inp.lastFilingDate, asOf: inp.asOf, fetchedAt: inp.fetchedAt,
      dataStatus:data?.financialIntegrity?.status||'unclassified',
      warning:data?.financialIntegrity?.warning||null,
      periodNote: data?.financialIntegrity ? 'La procedencia distingue fechas contrastadas, cierres comunicados y etiquetas anuales heredadas. Los campos incompletos son provisionales.' : 'Las cifras de flujo (ingresos, beneficios, caja) son TTM o del último año fiscal según lo último publicado; la fuente actual no distingue cuál.',
      benchmarkNote: 'Las referencias sectoriales son rangos orientativos fijos, no datos de mercado en vivo.',
    },
    provenance: inp.provenance,
    disclaimer: 'BullTrace no recomienda comprar ni vender. Las estimaciones no son hechos.',
  };
}

export { DEFAULT_CONFIG };
