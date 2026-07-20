import { AI_BOT_NAMES } from '../lib/aiBots';

// AI/LLM crawlers explicitly allowed for GEO (Generative Engine Optimization) —
// covered by the catch-all '*' rule too, but named here so it's explicit and
// doesn't silently regress if the catch-all rule ever gets tightened.
const DISALLOW = ['/api/', '/profile', '/sign-in', '/sign-up'];

export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: DISALLOW,
      },
      ...AI_BOT_NAMES.map((userAgent) => ({
        userAgent,
        allow: '/',
        disallow: DISALLOW,
      })),
    ],
    sitemap: 'https://traqcker.com/sitemap.xml',
  };
}
