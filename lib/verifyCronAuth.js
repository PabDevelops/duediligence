// Accepts either the legacy internal header (server-to-server calls between admin
// routes, e.g. seed-earnings-calendar -> seed-tickers) or the "Authorization: Bearer"
// header Vercel Cron Jobs send automatically when CRON_SECRET is set as an env var.
export function isCronRequest(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const legacyToken = request.headers.get('x-cron-secret');
  if (legacyToken === secret) return true;

  const authHeader = request.headers.get('authorization');
  return authHeader === `Bearer ${secret}`;
}
