// Pure scoring/valuation calculations for the stock detail page. Moved out
// of app/(workspace)/stock/[ticker]/page.js verbatim — the formulas below
// are unchanged, only their location and parameters (previously closures
// over component state/props) changed.

export function getDimScore(dim, questions, answers) {
  const indices = questions.map((q, i) => q.dim === dim ? i : -1).filter(i => i >= 0);
  const answered = indices.filter(i => answers[i] === 'YES' || answers[i] === 'NO');
  if (!answered.length) return null;
  return Math.round((answered.filter(i => answers[i] === 'YES').length / answered.length) * 100);
}

export function totalScore(dims, questions, answers) {
  const scores = dims.map(d => getDimScore(d, questions, answers)).filter(s => s !== null);
  if (!scores.length) return null;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

// "Numbers, Simplified" quality score. Returns null when `hasFundamentals`
// is false — computing this on a ticker with no SEC/Finnhub data would just
// produce a plausible-looking but entirely made-up result, since every
// input would default to its neutral midpoint.
export function computeEasyMode(data, hasFundamentals) {
  if (!hasFundamentals) return null;
  const sector = (data.sector || '').toLowerCase();
  const isFinancial = sector.includes('bank') || sector.includes('insurance') || sector.includes('financial');
  const isTech = sector.includes('tech') || sector.includes('software') || sector.includes('semi');
  const isPharma = sector.includes('pharma') || sector.includes('biotech') || sector.includes('health');
  const roicThreshold = isTech ? 0.25 : isPharma ? 0.20 : 0.15;
  const gmThreshold = isTech ? 0.65 : isPharma ? 0.65 : isFinancial ? 0.30 : 0.35;
  const omThreshold = isTech ? 0.20 : isPharma ? 0.20 : isFinancial ? 0.15 : 0.15;
  const roicScore = data.roic == null ? 2.5 : data.roic/100 >= roicThreshold*2 ? 5 : data.roic/100 >= roicThreshold*1.5 ? 4.5 : data.roic/100 >= roicThreshold ? 4 : data.roic/100 >= roicThreshold*0.7 ? 3 : data.roic/100 >= roicThreshold*0.4 ? 2 : 1;
  const gmScore = data.grossMargin == null ? 2.5 : data.grossMargin/100 >= gmThreshold*1.4 ? 5 : data.grossMargin/100 >= gmThreshold*1.15 ? 4.5 : data.grossMargin/100 >= gmThreshold ? 4 : data.grossMargin/100 >= gmThreshold*0.75 ? 3 : data.grossMargin/100 >= gmThreshold*0.5 ? 2 : 1;
  const omScore = data.opMargin == null ? 2.5 : data.opMargin/100 >= omThreshold*2 ? 5 : data.opMargin/100 >= omThreshold*1.5 ? 4.5 : data.opMargin/100 >= omThreshold ? 4 : data.opMargin/100 >= omThreshold*0.65 ? 3 : data.opMargin/100 > 0 ? 2 : 1;
  const deScore = data.debtToEquity == null ? 2.5 : data.debtToEquity < 0.3 ? 5 : data.debtToEquity < 0.7 ? 4.5 : data.debtToEquity < 1.2 ? 4 : data.debtToEquity < 2 ? 3 : data.debtToEquity < 3 ? 2 : 1;
  const cbs = (roicScore*0.4 + gmScore*0.25 + omScore*0.25 + deScore*0.1);
  const pfcfScore = data.pfcf == null || data.pfcf <= 0 ? 1 : data.pfcf < 12 ? 5 : data.pfcf < 18 ? 4.5 : data.pfcf < 25 ? 4 : data.pfcf < 35 ? 3 : data.pfcf < 50 ? 2 : 1;
  const fcfYieldScore = data.fcfYield == null ? 1 : data.fcfYield > 8 ? 5 : data.fcfYield > 5 ? 4.5 : data.fcfYield > 3 ? 4 : data.fcfYield > 1.5 ? 3 : data.fcfYield > 0 ? 2 : 1;
  const oppo = (pfcfScore*0.55 + fcfYieldScore*0.45);
  const revGrowthScore = data.revGrowth == null ? 2.5 : data.revGrowth > 25 ? 5 : data.revGrowth > 15 ? 4.5 : data.revGrowth > 8 ? 4 : data.revGrowth > 3 ? 3 : data.revGrowth > 0 ? 2 : 1;
  const fcfTrend = data.fcfHistory?.length >= 3 ? data.fcfHistory[data.fcfHistory.length-1]?.val > data.fcfHistory[0]?.val ? 1 : 0 : null;
  const marginTrend = data.marginHistory?.length >= 3 ? (data.marginHistory[data.marginHistory.length-1]?.margin||0) > (data.marginHistory[0]?.margin||0) ? 1 : 0 : null;
  const trendBonus = (fcfTrend===1?0.5:0)+(marginTrend===1?0.5:0);
  const gqs = Math.min(5, revGrowthScore*0.6 + (2.5+trendBonus*2)*0.4);
  const finalNote = (cbs*0.45 + oppo*0.30 + gqs*0.25);
  const score100 = Math.round((finalNote / 5) * 100);

  let verdict, verdictColor;
  if (score100 >= 70) { verdict = 'Solid & steady'; verdictColor = 'var(--ws-accent)'; }
  else if (score100 >= 40) { verdict = 'Mixed signals'; verdictColor = 'var(--ws-text-2)'; }
  else { verdict = 'Needs caution'; verdictColor = 'var(--ws-red)'; }

  let summary;
  if (data.revGrowth != null && data.fcfVal != null && data.debtToEquity != null) {
    const growthPart = data.revGrowth > 5 ? `grows revenue at a healthy pace` : data.revGrowth > 0 ? `grows revenue slowly` : `has shrinking revenue`;
    const cashPart = data.fcfVal > 0 ? `generates strong cash flow` : `is burning cash`;
    const debtPart = data.debtToEquity < 1.2 ? `carries manageable debt` : `carries significant debt`;
    summary = `${data.name?.split(' ')[0] || 'This company'} ${growthPart}, ${cashPart}, and ${debtPart}.`;
  } else {
    summary = `Not enough data yet to give a full picture for ${data.name || 'this company'}.`;
  }

  return { score100, verdict, verdictColor, summary };
}

// Graham intrinsic value: V = EPS x (8.5 + 2g), scaled by the original
// formula's 4.4/AAA-bond-yield adjustment (4.4/5.5 here).
export function computeGrahamValue(data) {
  if (!data.eps) return null;
  const cagr = data.epsCagr;
  const g = cagr !== null && !isNaN(cagr) ? Math.max(0, Math.min(Number(cagr), 20)) : 7;
  return +(data.eps * (8.5 + 2 * g) * (4.4 / 5.5)).toFixed(2);
}

export function computeFairValue(grahamValue, price) {
  if (!grahamValue || !price) return null;
  if (grahamValue <= 0) {
    return { pct: 98, tag: 'EXPENSIVE', tagColor: 'var(--ws-red)', estimate: grahamValue, negative: true };
  }
  const ratio = price / grahamValue;
  const pct = Math.max(2, Math.min(98, ((ratio - 0.5) / 1.0) * 100));
  let tag;
  if (ratio < 0.85) tag = 'UNDERVALUED';
  else if (ratio < 1.05) tag = 'FAIR VALUE';
  else if (ratio < 1.3) tag = 'SLIGHTLY EXPENSIVE';
  else tag = 'EXPENSIVE';
  const tagColor = ratio < 0.85 ? 'var(--ws-accent)' : ratio < 1.05 ? 'var(--ws-accent)' : ratio < 1.3 ? 'var(--ws-text-2)' : 'var(--ws-red)';
  return { pct, tag, tagColor, estimate: grahamValue, negative: false };
}
