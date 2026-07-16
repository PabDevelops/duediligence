// AI/LLM crawlers explicitly allowed for GEO (Generative Engine Optimization) —
// covered by the catch-all '*' rule too, but named here so it's explicit and
// doesn't silently regress if the catch-all rule ever gets tightened.
const AI_BOTS = ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended', 'CCBot', 'anthropic-ai'];
const DISALLOW = ['/api/', '/profile', '/sign-in', '/sign-up', '/es/sign-in', '/es/sign-up'];

export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: DISALLOW,
      },
      ...AI_BOTS.map((userAgent) => ({
        userAgent,
        allow: '/',
        disallow: DISALLOW,
      })),
    ],
    sitemap: 'https://traqcker.com/sitemap.xml',
  };
}
