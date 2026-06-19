// Simple in-memory rate limiter, fine for a single Next.js server instance.
// Not distributed-safe — if you scale to multiple instances, move this to Redis/Upstash.
const hits = new Map();

export function rateLimit(key, { limit = 5, windowMs = 60_000 } = {}) {
  const now = Date.now();
  const entry = hits.get(key);

  if (!entry || now - entry.start > windowMs) {
    hits.set(key, { count: 1, start: now });
    return { ok: true };
  }

  entry.count++;
  if (entry.count > limit) {
    return { ok: false, retryAfterMs: windowMs - (now - entry.start) };
  }
  return { ok: true };
}

export function getClientIp(req) {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim()
    || req.headers.get('x-real-ip')
    || 'unknown';
}
