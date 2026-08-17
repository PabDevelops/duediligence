// Everything (marketing + terminal) now lives on a single host (bulltrace.app) — no
// terminal.bulltrace.app subdomain to share auth cookies with anymore, so cookies just use
// the browser's default (exact host) scope. Kept as a function, not inlined at call sites,
// in case a subdomain split comes back later.
export function getCookieDomain(host) {
  return undefined;
}
