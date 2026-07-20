'use client';
import { useRouter } from 'next/navigation';
import Topbar from './components/Topbar';
import { openInNewTab } from '../lib/openInNewTab';

const SUGGESTIONS = ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN'];

export default function NotFound() {
  const router = useRouter();

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', fontFamily: 'Inter, sans-serif' }}>
      <Topbar />
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '100px 24px', textAlign: 'center' }}>

        <div style={{ fontSize: '96px', fontWeight: 900, letterSpacing: '-4px', lineHeight: 1, marginBottom: '8px', background: 'linear-gradient(135deg, #a78bfa22, #60a5fa22)', WebkitBackgroundClip: 'text', color: 'var(--border-2)' }}>
          404
        </div>

        <h1 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.5px', marginBottom: '12px' }}>
          This page doesn't exist
        </h1>
        <p style={{ color: 'var(--text-3)', fontSize: '15px', lineHeight: 1.7, marginBottom: '40px' }}>
          The URL might be wrong, or the stock ticker you're looking for isn't covered yet.
        </p>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '48px', flexWrap: 'wrap' }}>
          <button className="btn-primary" onClick={() => router.push('/')} style={{ padding: '12px 28px' }}>
            Go home
          </button>
          <button className="btn-secondary" onClick={() => router.push('/screener')} style={{ padding: '12px 28px' }}>
            Open screener
          </button>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '32px' }}>
          <div style={{ color: 'var(--text-3)', fontSize: '12px', marginBottom: '14px', letterSpacing: '1px', fontWeight: 700 }}>
            OR ANALYSE ONE OF THESE
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {SUGGESTIONS.map(t => (
              <button key={t} onClick={() => openInNewTab(`/stock/${t}`)}
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-3)', padding: '6px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif', transition: 'border-color 0.15s, color 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-3)'; }}>
                {t}
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
