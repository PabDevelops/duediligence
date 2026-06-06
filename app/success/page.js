'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Topbar from '../components/Topbar';

export default function Success() {
  const router = useRouter();

  useEffect(() => {
    setTimeout(() => router.push('/'), 5000);
  }, []);

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', fontFamily: 'IBM Plex Mono, monospace' }}>
      <Topbar />
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '100px 24px', textAlign: 'center' }}>
        <div style={{ color: 'var(--green)', fontSize: '48px', marginBottom: '24px' }}>✓</div>
        <div style={{ color: 'var(--accent)', fontSize: '10px', letterSpacing: '3px', marginBottom: '12px' }}>PAYMENT SUCCESSFUL</div>
        <h1 style={{ fontSize: '28px', fontWeight: 600, marginBottom: '12px' }}>Welcome to Traqcker Pro</h1>
        <p style={{ color: 'var(--text-2)', fontSize: '13px', lineHeight: 1.7, marginBottom: '32px' }}>
          Your subscription is now active. You have full access to all Pro features.
        </p>
        <div style={{ color: 'var(--text-3)', fontSize: '10px', letterSpacing: '1px' }}>
          Redirecting to home in 5 seconds...
        </div>
      </div>
    </div>
  );
}