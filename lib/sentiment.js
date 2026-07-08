// Fear & Greed index calculation, moved out of compare/page.js's
// SentimentBreadth component verbatim.

export function computeFearGreedScore(vixPrice, sp500Change, advanceDeclineRatio) {
  let score = 50;
  // VIX contribution
  if (vixPrice) {
    if (vixPrice < 12) score += 20;
    else if (vixPrice < 15) score += 10;
    else if (vixPrice < 20) score += 0;
    else if (vixPrice < 25) score -= 10;
    else if (vixPrice < 30) score -= 20;
    else score -= 30;
  }
  // S&P 500 trend contribution
  if (sp500Change) {
    score += sp500Change * 4;
  }
  // Breadth contribution
  if (advanceDeclineRatio) {
    score += (advanceDeclineRatio - 0.5) * 50;
  }
  return Math.min(100, Math.max(0, Math.round(score)));
}

export function getFearGreedLabel(score) {
  if (score <= 25) return { text: 'EXTREME FEAR', color: 'var(--ws-red)' };
  if (score <= 45) return { text: 'FEAR', color: 'var(--ws-text-2)' };
  if (score <= 55) return { text: 'NEUTRAL', color: 'var(--ws-text-2)' };
  if (score <= 75) return { text: 'GREED', color: 'var(--ws-accent)' };
  return { text: 'EXTREME GREED', color: 'var(--ws-accent)' };
}
