import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { getCookieDomain } from '../../../lib/cookieDomain';

// Every hit here carries a single-use OAuth code and mints a real session —
// letting Next.js cache a GET response would replay someone else's redirect
// (and silently drop the Set-Cookie) for every subsequent visitor.
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') || '/';

  if (code) {
    // Cookies are written straight onto this response (not via the generic
    // next/headers cookie store from lib/supabase/server.js) because that
    // store no-ops outside a mutable request context, and silently swallowing
    // the session cookie here means exchangeCodeForSession() looks like it
    // succeeded while the browser never actually gets signed in.
    const response = NextResponse.redirect(`${origin}${next}`);
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
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, cookieDomain ? { ...options, domain: cookieDomain } : options)
            );
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error('OAuth code exchange failed:', error.message);
      return NextResponse.redirect(`${origin}/sign-in?error=${encodeURIComponent(error.message)}`);
    }
    return response;
  }

  return NextResponse.redirect(`${origin}${next}`);
}
