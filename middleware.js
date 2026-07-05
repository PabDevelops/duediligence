import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

// Marketing/informational pages that live on the apex domain (traqcker.com).
// Everything else is the app/workspace terminal, served from
// terminal.traqcker.com instead.
const MARKETING_PREFIXES = [
  '/', '/about', '/pricing', '/privacy', '/terms',
  '/sign-in', '/sign-up', '/auth', '/start-trial', '/success',
];

// Blog is hidden for now (not deleted) — redirect it to home on both hosts.
function isHiddenPath(pathname) {
  return pathname === '/blog' || pathname.startsWith('/blog/');
}

function isMarketingPath(pathname) {
  return MARKETING_PREFIXES.some(p => p === '/' ? pathname === '/' : (pathname === p || pathname.startsWith(p + '/')));
}

function domainRedirect(request) {
  const host = request.headers.get('host') || '';
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith('/api')) return null;

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

export async function middleware(request) {
  const redirect = domainRedirect(request);
  if (redirect) return redirect;

  let response = NextResponse.next({ request });

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
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
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
