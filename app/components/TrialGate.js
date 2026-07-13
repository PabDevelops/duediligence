'use client';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useUser } from './AuthProvider';
import { stripLocale, localizeHref } from '../../lib/i18n/locale';
import { useLocale } from '../../lib/i18n/useLocale';

const ALLOWED_PATHS = ['/start-trial', '/sign-in', '/sign-up', '/pricing', '/success', '/terms', '/privacy'];

function isAllowed(pathname) {
  const bare = stripLocale(pathname);
  return ALLOWED_PATHS.some(p => bare === p || bare.startsWith(p + '/')) || pathname.startsWith('/api/');
}

export default function TrialGate() {
  const { isSignedIn, isLoaded } = useUser();
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale();

  useEffect(() => {
    if (!isLoaded || !isSignedIn || isAllowed(pathname)) return;

    let cancelled = false;
    fetch('/api/subscription')
      .then(res => res.json())
      .then(data => {
        if (!cancelled && data.needsTrial) router.replace(localizeHref('/start-trial', locale));
      });

    return () => { cancelled = true; };
  }, [isLoaded, isSignedIn, pathname, router, locale]);

  return null;
}
