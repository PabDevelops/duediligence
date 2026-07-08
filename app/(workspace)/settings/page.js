'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SettingsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/profile');
  }, [router]);

  return (
    <div style={{ padding: '40px', color: 'var(--ws-text-3)', fontSize: '13px', fontFamily: 'monospace' }}>
      Redirecting to Profile & Settings...
    </div>
  );
}
