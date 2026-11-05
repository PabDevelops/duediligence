// Shared 7-tier letter scale (S+/S/A/B/C/D/F), used consistently across every dimension that
// shows a 0-100 "higher is better" score (Calidad, Valoración, Potencial) instead of each one
// inventing its own cutoffs and wording — the same letter means the same thing wherever it shows
// up in the app. Riesgo (whose own scale runs the other way, higher = worse) inverts its score
// before calling tierForScore, rather than getting a second set of cutoffs.
export const TIER_LABELS = ['F', 'D', 'C', 'B', 'A', 'S', 'S+'];

export const TIER_NAMES = {
  'S+': 'Excepcional', S: 'Sobresaliente', A: 'Muy buena', B: 'Buena',
  C: 'Mejorable', D: 'Débil', F: 'Muy débil',
};

export const TIER_DESCRIPTIONS = {
  'S+': 'Resultado extraordinario', S: 'Resultado excelente', A: 'Resultado sólido',
  B: 'Resultado favorable', C: 'Hay debilidades importantes', D: 'Riesgos o limitaciones elevados',
  F: 'Resultado claramente desfavorable',
};

export function tierForScore(score) {
  if (score == null) return null;
  if (score >= 95) return 'S+';
  if (score >= 85) return 'S';
  if (score >= 70) return 'A';
  if (score >= 55) return 'B';
  if (score >= 40) return 'C';
  if (score >= 25) return 'D';
  return 'F';
}
