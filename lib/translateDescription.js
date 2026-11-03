import Anthropic from '@anthropic-ai/sdk';

// Same SDK/model already used by app/api/admin/auto-post-educational/route.js for the blog —
// ANTHROPIC_API_KEY is already configured in production for that, so this needs no new key.
const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;

// Company descriptions arrive in English from every source (Yahoo, AlphaVantage, Finnhub).
// Translating them is a paid API call, so callers should only invoke this once per description
// and cache the translated result (see descriptionTranslated in app/api/stock/route.js) rather
// than re-translating on every cache refresh. Falls back to the original English text on any
// failure — missing key, rate limit, network error — so a translation hiccup never means losing
// the description entirely.
export async function translateDescription(text) {
  if (!text || !anthropic) return text;
  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Traduce la siguiente descripción de una empresa al español, de forma natural y profesional, sin añadir ni quitar información ni opiniones. Responde únicamente con el texto traducido, sin comentarios, comillas ni explicaciones adicionales:\n\n${text}`,
      }],
    });
    const translated = message.content?.[0]?.type === 'text' ? message.content[0].text.trim() : null;
    return translated || text;
  } catch {
    return text;
  }
}
