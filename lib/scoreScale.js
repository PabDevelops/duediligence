// easyMode.finalNote (and /api/movers' topScore.score, which is the same finalNote) is on a
// 1-5 scale — convert to the 0-100 score100 scale shown everywhere else in the app before
// applying the same 70/40 "good/caution/bad" breakpoints, so a number means the same thing
// wherever it's shown instead of a second invented scale.
export const toScore100 = (finalNote) => finalNote == null ? null : Math.round((finalNote / 5) * 100);
export const scoreTier = (score100) => score100 == null ? null : score100 >= 70 ? 'good' : score100 >= 40 ? 'caution' : 'bad';
