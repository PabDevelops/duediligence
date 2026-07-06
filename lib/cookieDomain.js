// Auth cookies must be shared between the marketing apex (traqcker.com) and
// the terminal subdomain (terminal.traqcker.com), otherwise a user who signs
// in on the apex has no session once redirected to the terminal. We only
// widen the cookie domain on the real production hosts — never in local dev
// or on Vercel preview deployments, where a `.traqcker.com` Domain attribute
// would just make the browser silently drop the cookie.
export function getCookieDomain(host) {
  if (!host) return undefined;
  const bareHost = host.split(':')[0];
  return bareHost === 'traqcker.com' || bareHost.endsWith('.traqcker.com') ? '.traqcker.com' : undefined;
}
