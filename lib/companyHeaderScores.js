import { computeCompanyScores } from './companyScoreCalibration';

// The header and Numbers share one scoring policy, separate from the valuation engine.
export function getCompanyHeaderScores(easyMode, data, analysis) {
  return computeCompanyScores(data, easyMode, analysis);
}
