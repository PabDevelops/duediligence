'use client';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useUser } from './AuthProvider';

const ALLOWED_PATHS = ['/start-trial', '/sign-in', '/sign-up', '/pricing', '/success', '/terms', '/privacy'];

function isAllowed(pathname) {
  return ALLOWED_PATHS.some(p => pathname === p || pathname.startsWith(p + '/')) || pathname.startsWith('/api/');
}

export default function TrialGate() {
  const { isSignedIn, isLoaded } = useUser();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded || !isSignedIn || isAllowed(pathname)) return;

    let cancelled = false;
    fetch('/api/subscription')
      .then(res => res.json())
      .then(data => {
        if (!cancelled && data.needsTrial) router.replace('/start-trial');
      });

    return () => { cancelled = true; };
  }, [isLoaded, isSignedIn, pathname, router]);

  return null;
}
