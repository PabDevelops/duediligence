// Palette for the beginner-friendly redesign (cream/lime, Plus Jakarta Sans) — a distinct
// visual system from the dark `--ws-*` workspace theme, scoped to pages under /new instead
// of becoming a global theme swap. Values match the Design canvas mockup this was built from.
export const NEW_COLORS = {
  bg: '#FAF7F0',
  surface: '#FFFFFF',
  border: '#ECE1C9',
  borderSoft: '#F0E9D8',
  ink: '#1C1B18',
  text2: '#726C5E',
  text3: '#9A9484',
  avatarBg: '#EEE8D9',
  lime: '#C7FF38',
  green: '#2E8B47',
  red: '#C14A3C',
};

// Badge styling for the three stockVerdict() tiers (lib/verdict.js) — bg/dot/text per tier,
// matching the mockup's watchlist-card verdict pill exactly.
export const VERDICT_BADGE = {
  good: { bg: '#E4F3DE', dot: '#2E8B47', text: '#2E6B3A' },
  caution: { bg: '#FBEFD9', dot: '#C98A1F', text: '#8A5E12' },
  bad: { bg: '#F8DFDA', dot: '#C14A3C', text: '#9A3A2F' },
};

// Solid badge color per tier letter (lib/engine/tierScale.js) — a red-to-green ramp, ordered
// worst (F) to best (S+), used for the letter chip wherever a tier is shown (Calidad, Valoración,
// Riesgo, Potencial) so the same letter always reads with the same color across the app.
export const TIER_COLORS = {
  F: '#C14A3C', D: '#D97F3D', C: '#C98A1F', B: '#9BAF3A', A: '#5FA83C', S: '#2E8B47', 'S+': '#1F7A4C',
};
