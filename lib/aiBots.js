// Known AI/LLM crawler user-agent substrings. Shared by app/robots.js (which
// explicitly allowlists them) and middleware.js (which logs their visits to
// bot_crawler_logs).
export const AI_BOT_NAMES = [
  'GPTBot',
  'ChatGPT-User',
  'OAI-SearchBot',
  'ClaudeBot',
  'Claude-Web',
  'anthropic-ai',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'CCBot',
  'Bytespider',
  'Amazonbot',
  'Applebot-Extended',
  'Meta-ExternalAgent',
  'Diffbot',
  'cohere-ai',
];

// Returns the matched bot name (as it appears in the user-agent string), or
// null if the user-agent doesn't match any known AI crawler.
export function detectAiBot(userAgent) {
  if (!userAgent) return null;
  return AI_BOT_NAMES.find((name) => userAgent.includes(name)) || null;
}
