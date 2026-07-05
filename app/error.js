'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Topbar from './components/Topbar';

export default function Error({ error, reset }) {
  const router = useRouter();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', fontFamily: 'Inter, sans-serif' }}>
      <Topbar />
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '100px 24px', textAlign: 'center' }}>

        <div style={{ fontSize: '96px', fontWeight: 900, letterSpacing: '-4px', lineHeight: 1, marginBottom: '8px', background: 'linear-gradient(135deg, #a78bfa22, #60a5fa22)', WebkitBackgroundClip: 'text', color: 'var(--border-2)' }}>
          Oops
        </div>

        <h1 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.5px', marginBottom: '12px' }}>
          Something went wrong
        </h1>
        <p style={{ color: 'var(--text-3)', fontSize: '15px', lineHeight: 1.7, marginBottom: '40px' }}>
          That's on us, not you. Try again, or head back home.
        </p>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn-primary" onClick={() => reset()} style={{ padding: '12px 28px' }}>
            Try again
          </button>
          <button className="btn-secondary" onClick={() => router.push('/')} style={{ padding: '12px 28px' }}>
            Go home
          </button>
        </div>

      </div>
    </div>
  );
}
