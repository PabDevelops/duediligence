import { createBrowserClient } from '@supabase/ssr';
import { getCookieDomain } from '../cookieDomain';

export function createClient() {
  const cookieDomain = typeof window !== 'undefined' ? getCookieDomain(window.location.hostname) : undefined;

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    cookieDomain ? { cookieOptions: { domain: cookieDomain } } : undefined
  );
}
