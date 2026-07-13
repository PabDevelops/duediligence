export const LOCALES = ['en', 'es'];
export const DEFAULT_LOCALE = 'en';

// Strips a leading /es (or /en) segment, returning the bare marketing path.
// '/es/about' -> '/about', '/es' -> '/', '/about' -> '/about'
export function stripLocale(pathname) {
  if (pathname === '/es' || pathname === '/en') return '/';
  if (pathname.startsWith('/es/')) return pathname.slice(3);
  if (pathname.startsWith('/en/')) return pathname.slice(3);
  return pathname;
}

// Prefixes a bare marketing path with /es when needed. English stays unprefixed.
export function localizeHref(path, locale) {
  if (locale !== 'es') return path;
  if (path.startsWith('#') || path.startsWith('http')) return path;
  return `/es${path === '/' ? '' : path}`;
}
