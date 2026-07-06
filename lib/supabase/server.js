import { createServerClient } from '@supabase/ssr';
import { cookies, headers } from 'next/headers';
import { getCookieDomain } from '../cookieDomain';

export async function createClient() {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const cookieDomain = getCookieDomain(headerStore.get('host'));

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, cookieDomain ? { ...options, domain: cookieDomain } : options)
            );
          } catch {
            // called from a Server Component; middleware refreshes the session instead
          }
        },
      },
    }
  );
}
