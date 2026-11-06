import { computeCompanyScores } from './companyScoreCalibration';
import { analyzeStock } from './engine';

// The header and Numbers share one scoring policy, separate from the valuation engine.
export function getCompanyHeaderScores(easyMode, data, analysis) {
  // Numbers does not pass an existing engine result. Use the same validated
  // dependencies as the fact sheet rather than rebuilding quality on raw inputs.
  const validatedAnalysis = analysis ?? (data?.financialIntegrity?.version === 2 ? analyzeStock(data) : undefined);
  return computeCompanyScores(data, easyMode, validatedAnalysis).map(score => ({
    ...score,
    // Keep production calibration/coverage unchanged. An unrelated missing FCF
    // must not suppress a score its sector-specific policy can still calculate.
    status: score.score100 == null ? 'unavailable'
      : !data?.financialIntegrity ? 'unclassified'
      : data.financialIntegrity.status === 'verified'
        && !score.components.some(component => component.manual)
        && data.financialIntegrity.calculations?.[score.id]?.status === 'verified'
        ? 'verified' : 'provisional',
  }));
}
