'use client';
import { useRef } from 'react';
import html2canvas from 'html2canvas';

export default function ShareCard({ ticker, name, price, priceChange, metrics, score, verdict, fairValue, fairValueNegative, consensus }) {
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

  const verdictColor = verdict === 'BUY' ? '#22c55e' : verdict === 'SELL' ? '#ef4444' : '#eab308';
  const scoreNum = Math.max(0, Math.min(100, Math.round(score ?? 50)));
  const scoreColor = scoreNum >= 70 ? '#22c55e' : scoreNum >= 50 ? '#a78bfa' : '#ef4444';

  const rotation = (scoreNum / 100) * 360;
  const rightRotation = Math.min(rotation, 180);
  const leftRotation = Math.max(0, rotation - 180);

  return (
    <>
      {/* Hidden card for rendering to image */}
      <div ref={cardRef} style={{
        position: 'fixed',
        left: '-9999px',
        width: '800px',
        height: '1050px',
        background: '#0B0E14',
        padding: '60px',
        borderRadius: '24px',
        border: '3px solid #a78bfa',
        fontFamily: 'JetBrains Mono, monospace',
        color: '#e0e7ff',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        boxSizing: 'border-box'
      }}>
        {/* Top Section - Logo + Ticker + Name */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: '48px', fontWeight: 700, color: '#a78bfa', marginBottom: '20px', fontFamily: 'Space Grotesk, sans-serif', letterSpacing: '2px' }}>
            Traq●cker
          </div>
          <div style={{ fontSize: '64px', fontWeight: 700, color: '#ffffff', marginBottom: '8px', fontFamily: 'Space Grotesk, sans-serif', letterSpacing: '1px' }}>
            {ticker}
          </div>
          <div style={{ fontSize: '24px', color: '#cbd5e1' }}>
            {name}
          </div>
        </div>

        {/* Price Section */}
        <div style={{ textAlign: 'center', marginBottom: '20px', borderTop: '2px solid #a78bfa', borderBottom: '2px solid #a78bfa', paddingTop: '25px', paddingBottom: '25px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{ fontSize: '56px', fontWeight: 700, color: '#ffffff' }}>
              ${price?.toFixed(2) || '—'}
            </div>
            {priceChange !== undefined && (
              <div style={{ fontSize: '28px', color: priceChange >= 0 ? '#22c55e' : '#ef4444', fontWeight: 700 }}>
                {priceChange >= 0 ? '↑' : '↓'} {Math.abs(priceChange).toFixed(2)}%
              </div>
            )}
          </div>

          {fairValue !== null && fairValue !== undefined && (
            <div style={{ fontSize: '20px', color: '#94a3b8' }}>
              Traqcker Fair Value: {fairValueNegative ? (
                <span style={{ color: '#ef4444', fontWeight: 700 }}>N/A (negative earnings)</span>
              ) : (
                <span style={{ color: '#a78bfa', fontWeight: 700 }}>${fairValue.toFixed(2)}</span>
              )}
            </div>
          )}
        </div>

        {/* Score Ring - using flex centering wrapper for perfect alignment */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: '14px', color: '#94a3b8', letterSpacing: '2px', marginBottom: '20px' }}>
            EASY MODE SCORE
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: '180px', height: '180px', borderRadius: '50%', position: 'relative', background: '#1e293b' }}>
              {/* Right half (0-180deg) */}
              <div style={{
                position: 'absolute',
                width: '180px',
                height: '180px',
                borderRadius: '50%',
                clip: 'rect(0px, 180px, 180px, 90px)',
                background: scoreColor,
                transform: `rotate(${rightRotation}deg)`,
                transformOrigin: '90px 90px'
              }} />
              {/* Left half (180-360deg) */}
              {rotation > 180 && (
                <div style={{
                  position: 'absolute',
                  width: '180px',
                  height: '180px',
                  borderRadius: '50%',
                  clip: 'rect(0px, 90px, 180px, 0px)',
                  background: scoreColor,
                  transform: `rotate(${leftRotation}deg)`,
                  transformOrigin: '90px 90px'
                }} />
              )}
              {/* Inner hole + centered number - flex centering, no absolute positioning issues */}
              <div style={{
                position: 'absolute',
                top: '15px',
                left: '15px',
                width: '150px',
                height: '150px',
                borderRadius: '50%',
                background: '#0B0E14',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center'
              }}>
                <div style={{
                  fontSize: '56px',
                  fontWeight: 700,
                  color: scoreColor,
                  lineHeight: 1,
                  width: '100%'
                }}>
                  {scoreNum}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Verdict */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: '14px', color: '#94a3b8', letterSpacing: '2px', marginBottom: '12px' }}>
            VERDICT
          </div>
          <div style={{ fontSize: '44px', fontWeight: 700, color: verdictColor }}>
            {verdict}
          </div>
        </div>

        {/* Community Sentiment */}
        {consensus && consensus.total > 0 && (
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <div style={{ fontSize: '14px', color: '#94a3b8', letterSpacing: '2px', marginBottom: '14px' }}>
              COMMUNITY SENTIMENT ({consensus.total} {consensus.total === 1 ? 'vote' : 'votes'})
            </div>
            {/* Consensus bar */}
            <div style={{ display: 'flex', height: '20px', borderRadius: '10px', overflow: 'hidden', marginBottom: '12px' }}>
              <div style={{ width: `${consensus.BUY}%`, background: '#22c55e' }} />
              <div style={{ width: `${consensus.HOLD}%`, background: '#eab308' }} />
              <div style={{ width: `${consensus.SELL}%`, background: '#ef4444' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px' }}>
              <span style={{ color: '#22c55e' }}>● {consensus.BUY}% Buy</span>
              <span style={{ color: '#eab308' }}>● {consensus.HOLD}% Hold</span>
              <span style={{ color: '#ef4444' }}>● {consensus.SELL}% Sell</span>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ fontSize: '13px', color: '#64748b', letterSpacing: '0.5px', textAlign: 'center' }}>
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
