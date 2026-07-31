// Auth cookies must be shared between the marketing apex (bulltrace.app) and
// the terminal subdomain (terminal.bulltrace.app), otherwise a user who signs
// in on the apex has no session once redirected to the terminal. We only
// widen the cookie domain on the real production hosts — never in local dev
// or on Vercel preview deployments, where a `.bulltrace.app` Domain attribute
// would just make the browser silently drop the cookie.
export function getCookieDomain(host) {
  if (!host) return undefined;
  const bareHost = host.split(':')[0];
  return bareHost === 'bulltrace.app' || bareHost.endsWith('.bulltrace.app') ? '.bulltrace.app' : undefined;
}
