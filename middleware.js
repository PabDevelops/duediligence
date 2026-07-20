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

// Blog is hidden for now (not deleted) — redirect it to home on both hosts.
function isHiddenPath(pathname) {
  return pathname === '/blog' || pathname.startsWith('/blog/');
}

function isMarketingPath(pathname) {
  return MARKETING_PREFIXES.some(p => p === '/' ? pathname === '/' : (pathname === p || pathname.startsWith(p + '/')));
}

// The site used to be bilingual (en/es) via an /es path prefix — that's gone, English only
// now, but old /es/... links (bookmarks, search results already indexed) should age out with
// a redirect to their bare equivalent instead of a 404.
function isSpanishPath(pathname) {
  return pathname === '/es' || pathname.startsWith('/es/');
}
function stripSpanishPrefix(pathname) {
  return pathname === '/es' ? '/' : pathname.slice(3);
}

// Root-level static/metadata files Next.js serves identically regardless of host —
// crawlers (Googlebot, AdSense's Mediapartners-Google, etc.) fetch these from whichever
// domain they found the site on, so redirecting them cross-domain breaks robots.txt/ads.txt
// discovery and, in turn, AdSense's "can the crawler access the site" verification check.
const CRAWLER_STATIC_FILES = ['/ads.txt', '/robots.txt', '/sitemap.xml'];

function domainRedirect(request, hasVisitedBefore) {
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

  if (isSpanishPath(pathname)) {
    const dest = request.nextUrl.clone();
    dest.pathname = stripSpanishPrefix(pathname);
    if (host === 'terminal.traqcker.com') dest.host = 'traqcker.com';
    return NextResponse.redirect(dest, 308);
  }

  // Only enforce the domain split on the real production hostnames — never in
  // local dev or on Vercel preview deployments, where there's only one domain.
  const isApex = host === 'traqcker.com' || host === 'www.traqcker.com';
  const isTerminal = host === 'terminal.traqcker.com';
  if (!isApex && !isTerminal) return null;

  // Anyone who's already been to the site before (carries the tq_gid guest cookie,
  // minted on their very first-ever request regardless of host — see below) skips the
  // marketing landing entirely and goes straight into the terminal. Cookie-less visitors
  // (first real touch, or stateless crawlers/SEO bots) still see the landing normally, so
  // organic acquisition and indexing are unaffected. Checked before the marketing-path
  // rules below so it also short-circuits the pointless terminal-root -> apex -> terminal
  // bounce that isMarketingPath('/') would otherwise trigger.
  if (pathname === '/' && hasVisitedBefore) {
    return NextResponse.redirect(new URL('https://terminal.traqcker.com/home', request.url), 307);
  }

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

  // Anonymous visitor id, used to scope rate limits and usage caps for guests browsing
  // the Terminal without an account, and (see domainRedirect) as the "has this browser
  // been here before" signal that skips the marketing landing. Minted once and kept for
  // a year; never overwritten once set.
  const existingGuestId = request.cookies.get('tq_gid')?.value;

  const redirect = domainRedirect(request, !!existingGuestId);
  if (redirect) return redirect;

  const guestId = existingGuestId || crypto.randomUUID();

  const buildResponse = () => NextResponse.next({ request });

  let response = buildResponse();
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
