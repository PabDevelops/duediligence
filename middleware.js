import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { getCookieDomain } from './lib/cookieDomain';
import { detectAiBot } from './lib/aiBots';
import { logBotVisit } from './lib/botLogger';

// Marketing/informational pages that live on the apex domain (traqcker.com).
// Everything else is the app/workspace terminal, served from
// terminal.traqcker.com instead.
const MARKETING_PREFIXES = [
  '/', '/about', '/pricing', '/faq', '/privacy', '/terms',
  '/sign-in', '/sign-up', '/auth', '/start-trial', '/success',
];

// Subset of MARKETING_PREFIXES that actually has translated (/es) content.
// /auth is excluded — it's an OAuth callback URL with no UI, registered as-is
// with the auth provider, and must never move under a locale prefix.
const LOCALIZABLE_PREFIXES = [
  '/', '/about', '/pricing', '/faq', '/privacy', '/terms',
  '/sign-in', '/sign-up', '/start-trial', '/success',
];

// Blog is hidden for now (not deleted) — redirect it to home on both hosts.
function isHiddenPath(pathname) {
  return pathname === '/blog' || pathname.startsWith('/blog/');
}

function isMarketingPath(pathname) {
  return MARKETING_PREFIXES.some(p => p === '/' ? pathname === '/' : (pathname === p || pathname.startsWith(p + '/')));
}

function isLocalizablePath(pathname) {
  const bare = stripLocalePrefix(pathname);
  return LOCALIZABLE_PREFIXES.some(p => p === '/' ? bare === '/' : (bare === p || bare.startsWith(p + '/')));
}

// '/es/about' -> '/about', '/es' -> '/', '/en/about' -> '/about', '/about' -> '/about'
function stripLocalePrefix(pathname) {
  if (pathname === '/es' || pathname === '/en') return '/';
  if (pathname.startsWith('/es/')) return pathname.slice(3);
  if (pathname.startsWith('/en/')) return pathname.slice(3);
  return pathname;
}

// The NEXT_LOCALE cookie is authoritative once set (so a user who already
// chose Spanish never silently falls back to English on a bare-path visit).
// Only when there's no cookie yet do we look at Accept-Language.
function resolveLocale(request) {
  const cookie = request.cookies.get('NEXT_LOCALE')?.value;
  if (cookie === 'en' || cookie === 'es') return { locale: cookie, isFirstTouch: false };
  const accept = (request.headers.get('accept-language') || '').toLowerCase();
  const locale = accept.includes('es') ? 'es' : 'en';
  return { locale, isFirstTouch: true };
}

// Root-level static/metadata files Next.js serves identically regardless of host —
// crawlers (Googlebot, AdSense's Mediapartners-Google, etc.) fetch these from whichever
// domain they found the site on, so redirecting them cross-domain breaks robots.txt/ads.txt
// discovery and, in turn, AdSense's "can the crawler access the site" verification check.
const CRAWLER_STATIC_FILES = ['/ads.txt', '/robots.txt', '/sitemap.xml'];

function domainRedirect(request) {
  const host = request.headers.get('host') || '';
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith('/api')) return null;
  if (CRAWLER_STATIC_FILES.includes(pathname)) return null;

  if (isHiddenPath(pathname)) {
    const dest = request.nextUrl.clone();
    dest.pathname = '/';
    dest.search = '';
    if (host === 'terminal.traqcker.com') dest.host = 'traqcker.com';
    return NextResponse.redirect(dest, 307);
  }

  // Only enforce the domain split on the real production hostnames — never in
  // local dev or on Vercel preview deployments, where there's only one domain.
  const isApex = host === 'traqcker.com' || host === 'www.traqcker.com';
  const isTerminal = host === 'terminal.traqcker.com';
  if (!isApex && !isTerminal) return null;

  if (isApex && !isMarketingPath(pathname)) {
    return NextResponse.redirect(new URL(`https://terminal.traqcker.com${pathname}${search}`, request.url), 307);
  }
  if (isTerminal && isMarketingPath(pathname)) {
    return NextResponse.redirect(new URL(`https://traqcker.com${pathname}${search}`, request.url), 307);
  }
  return null;
}

export async function middleware(request, event) {
  const userAgent = request.headers.get('user-agent') || '';
  const botName = detectAiBot(userAgent);
  if (botName) {
    event.waitUntil(
      logBotVisit({
        path: request.nextUrl.pathname,
        botName,
        userAgent,
        referrer: request.headers.get('referer'),
      })
    );
  }

  const redirect = domainRedirect(request);
  if (redirect) return redirect;

  const { pathname } = request.nextUrl;
  let rewriteUrl = null;        // internal target when default-locale content is served bare
  let localeCookieToSet = null; // 'en' | 'es' | null

  // Anonymous visitor id, used to scope rate limits and usage caps for
  // guests browsing the Terminal without an account. Minted once and kept
  // for a year; never overwritten once set.
  const existingGuestId = request.cookies.get('tq_gid')?.value;
  const guestId = existingGuestId || crypto.randomUUID();

  if (!pathname.startsWith('/api') && isLocalizablePath(pathname)) {
    const bare = stripLocalePrefix(pathname);

    if (pathname === '/es' || pathname.startsWith('/es/')) {
      // Real route already — just keep the cookie in sync.
      localeCookieToSet = 'es';
    } else if (pathname === '/en' || pathname.startsWith('/en/')) {
      // /en is an internal rewrite target only — never indexable/bookmarkable.
      const dest = request.nextUrl.clone();
      dest.pathname = bare;
      return NextResponse.redirect(dest, 308);
    } else {
      const { locale, isFirstTouch } = resolveLocale(request);
      if (locale === 'es') {
        const dest = request.nextUrl.clone();
        dest.pathname = `/es${bare === '/' ? '' : bare}`;
        const res = NextResponse.redirect(dest, 307);
        res.cookies.set('NEXT_LOCALE', 'es', { path: '/', maxAge: 31536000 });
        return res;
      }
      rewriteUrl = request.nextUrl.clone();
      rewriteUrl.pathname = `/en${bare === '/' ? '' : bare}`;
      if (isFirstTouch) localeCookieToSet = 'en';
    }
  }

  // Mutated in place (same technique the Supabase cookie sync below already
  // relies on for `request.cookies`) so buildResponse() keeps seeing fresh
  // headers no matter when it's called — including from inside `setAll`.
  request.headers.set('x-locale', pathname.startsWith('/es') ? 'es' : 'en');
  const buildResponse = () =>
    rewriteUrl ? NextResponse.rewrite(rewriteUrl, { request }) : NextResponse.next({ request });

  let response = buildResponse();
  if (localeCookieToSet) response.cookies.set('NEXT_LOCALE', localeCookieToSet, { path: '/', maxAge: 31536000 });
  if (!existingGuestId) response.cookies.set('tq_gid', guestId, { path: '/', maxAge: 31536000, httpOnly: true, sameSite: 'lax' });

  const cookieDomain = getCookieDomain(request.headers.get('host'));

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = buildResponse();
          if (localeCookieToSet) response.cookies.set('NEXT_LOCALE', localeCookieToSet, { path: '/', maxAge: 31536000 });
          if (!existingGuestId) response.cookies.set('tq_gid', guestId, { path: '/', maxAge: 31536000, httpOnly: true, sameSite: 'lax' });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, cookieDomain ? { ...options, domain: cookieDomain } : options);
          });
        },
      },
    }
  );

  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
};
