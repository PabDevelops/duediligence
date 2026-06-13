'use client';
import { useRef } from 'react';
import html2canvas from 'html2canvas';

export default function ShareCard({ ticker, name, price, priceChange, metrics, score, verdict }) {
  const cardRef = useRef(null);

  const handleShare = async () => {
    if (!cardRef.current) return;
    
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#0B0E14',
        scale: 2,
        logging: false,
        useCORS: true
      });
      
      canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${ticker}-traqcker.png`;
        a.click();
        URL.revokeObjectURL(url);
      });
    } catch (e) {
      console.error('Share failed:', e);
      alert('Failed to generate image');
    }
  };

  const verdictColor = verdict === 'BUY' ? 'var(--green)' : verdict === 'SELL' ? 'var(--red)' : 'var(--amber)';

  return (
    <>
      {/* Hidden card for rendering to image */}
      <div ref={cardRef} style={{
        position: 'fixed',
        left: '-9999px',
        width: '600px',
        background: 'linear-gradient(135deg, var(--bg) 0%, var(--bg-1) 100%)',
        padding: '40px',
        borderRadius: '20px',
        border: '2px solid var(--accent)',
        fontFamily: 'JetBrains Mono, monospace',
        color: 'var(--text)'
      }}>
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '14px', color: 'var(--accent)', fontWeight: 700, letterSpacing: '2px', marginBottom: '8px' }}>
            TRAQCKER
          </div>
          <div style={{ fontSize: '32px', fontWeight: 700, marginBottom: '4px', fontFamily: 'Space Grotesk, sans-serif' }}>
            {ticker}
          </div>
          <div style={{ fontSize: '16px', color: 'var(--text-2)' }}>
            {name}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '24px' }}>
          <div style={{ fontSize: '28px', fontWeight: 700 }}>
            ${price?.toFixed(2) || 'N/A'}
          </div>
          <div style={{ fontSize: '16px', color: priceChange >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
            {priceChange >= 0 ? '↑' : '↓'} {Math.abs(priceChange || 0).toFixed(2)}%
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px', paddingBottom: '24px', borderBottom: '1px solid var(--border)' }}>
          {metrics && metrics.map((m, i) => (
            <div key={i}>
              <div style={{ fontSize: '11px', color: 'var(--text-3)', letterSpacing: '1px', marginBottom: '4px' }}>
                {m.label}
              </div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--accent)' }}>
                {m.value}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-3)', letterSpacing: '1px', marginBottom: '4px' }}>
              EASY MODE SCORE
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--accent)' }}>
              {score}/100
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-3)', letterSpacing: '1px', marginBottom: '4px' }}>
              VERDICT
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: verdictColor }}>
              {verdict}
            </div>
          </div>
        </div>

        <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border)', fontSize: '11px', color: 'var(--text-3)', textAlign: 'center' }}>
          traqcker.com — Fundamental analysis without noise
        </div>
      </div>

      {/* Visible Share Button - Downloads PNG */}
      <button onClick={handleShare}
        style={{
          width: '100%',
          padding: '16px',
          marginBottom: '16px',
          borderRadius: '12px',
          border: '1px solid var(--accent)',
          background: 'var(--accent-dim)',
          color: 'var(--accent)',
          cursor: 'pointer',
          fontSize: '14px',
          fontFamily: 'Space Grotesk, sans-serif',
          fontWeight: 700,
          transition: 'all 0.2s',
          letterSpacing: '0.5px'
        }}
        onMouseEnter={e => {
          e.target.style.background = 'var(--accent)';
          e.target.style.color = '#0B0E14';
        }}
        onMouseLeave={e => {
          e.target.style.background = 'var(--accent-dim)';
          e.target.style.color = 'var(--accent)';
        }}>
        📸 Share as Image
      </button>
    </>
  );
}
