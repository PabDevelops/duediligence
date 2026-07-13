'use client';
import { usePathname } from 'next/navigation';

// Derives locale purely from the URL — this is what keeps shared components
// (Topbar, CookieBanner) English on workspace routes, which never carry /es.
export function useLocale() {
  const pathname = usePathname();
  return pathname.startsWith('/es') ? 'es' : 'en';
}
