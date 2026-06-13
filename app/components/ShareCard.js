'use client';
import { useRef } from 'react';
import html2canvas from 'html2canvas';

export default function ShareCard({ ticker, name, price, priceChange, metrics, score, verdict, fairValue, fairValueNegative, consensus, userVote }) {
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

  // SVG circle: r=80, circumference = 2*pi*80 = 502.65
  const circumference = 502.65;
  const dashOffset = circumference - (circumference * scoreNum / 100);

  return (
    <>
      {/* Hidden card for rendering to image */}
      <div ref={cardRef} style={{
        position: 'fixed',
        left: '-9999px',
        width: '800px',
        background: '#0B0E14',
        padding: '60px',
        borderRadius: '24px',
        border: '3px solid #a78bfa',
        fontFamily: 'JetBrains Mono, monospace',
        color: '#e0e7ff',
        boxSizing: 'border-box'
      }}>
        {/* Top Section - Logo + Ticker + Name */}
        <div style={{ textAlign: 'center', width: '100%', marginBottom: '36px' }}>
          <div style={{ fontSize: '48px', fontWeight: 700, color: '#a78bfa', marginBottom: '24px', fontFamily: 'Space Grotesk, sans-serif', letterSpacing: '2px' }}>
            Traq●cker
          </div>
          <div style={{ fontSize: '64px', fontWeight: 700, color: '#ffffff', marginBottom: '12px', fontFamily: 'Space Grotesk, sans-serif', letterSpacing: '1px' }}>
            {ticker}
          </div>
          <div style={{ fontSize: '24px', color: '#cbd5e1' }}>
            {name}
          </div>
        </div>

        {/* Price Section */}
        <div style={{ textAlign: 'center', width: '100%', marginBottom: '36px', borderTop: '2px solid #a78bfa', borderBottom: '2px solid #a78bfa', paddingTop: '32px', paddingBottom: '32px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tr>
              <td style={{ textAlign: 'center', padding: 0 }}>
                <span style={{ fontSize: '56px', fontWeight: 700, color: '#ffffff' }}>
                  ${price?.toFixed(2) || '—'}
                </span>
                {priceChange !== undefined && (
                  <span style={{ fontSize: '28px', color: priceChange >= 0 ? '#22c55e' : '#ef4444', fontWeight: 700, marginLeft: '16px' }}>
                    {priceChange >= 0 ? '↑' : '↓'} {Math.abs(priceChange).toFixed(2)}%
                  </span>
                )}
              </td>
            </tr>
          </table>

          {fairValue !== null && fairValue !== undefined && (
            <div style={{ fontSize: '20px', color: '#94a3b8', marginTop: '18px', textAlign: 'center' }}>
              Traqcker Fair Value: {fairValueNegative ? (
                <span style={{ color: '#ef4444', fontWeight: 700 }}>N/A (negative earnings)</span>
              ) : (
                <span style={{ color: '#a78bfa', fontWeight: 700 }}>${fairValue.toFixed(2)}</span>
              )}
            </div>
          )}
        </div>

        {/* Score Ring - SVG with stroke-dasharray (no rotate transform needed) */}
        <div style={{ textAlign: 'center', width: '100%', marginBottom: '36px' }}>
          <div style={{ fontSize: '14px', color: '#94a3b8', letterSpacing: '2px', marginBottom: '24px' }}>
            EASY MODE SCORE
          </div>
          
          <div style={{ width: '200px', margin: '0 auto' }}>
            <svg width="200" height="200" viewBox="0 0 200 200">
              {/* Background track */}
              <circle cx="100" cy="100" r="80" fill="none" stroke="#1e293b" strokeWidth="16" />
              {/* Progress arc - starts at top (12 o'clock), goes clockwise */}
              <circle 
                cx="100" cy="100" r="80" 
                fill="none" 
                stroke={scoreColor} 
                strokeWidth="16" 
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                transform="rotate(-90 100 100)"
              />
              {/* Centered number - directly in SVG */}
              <text 
                x="100" 
                y="100" 
                textAnchor="middle" 
                dominantBaseline="central"
                fontSize="56" 
                fontWeight="700" 
                fill={scoreColor}
                fontFamily="JetBrains Mono, monospace"
              >
                {scoreNum}
              </text>
            </svg>
          </div>
        </div>

        {/* Verdict */}
        <div style={{ textAlign: 'center', width: '100%', marginBottom: '36px' }}>
          <div style={{ fontSize: '14px', color: '#94a3b8', letterSpacing: '2px', marginBottom: '18px' }}>
            VERDICT
          </div>
          <div style={{ fontSize: '44px', fontWeight: 700, color: verdictColor }}>
            {verdict}
          </div>
        </div>

        {/* User's Own Vote */}
        {userVote && (
          <div style={{ textAlign: 'center', width: '100%', marginBottom: '36px' }}>
            <div style={{ 
              display: 'inline-block',
              padding: '12px 28px',
              borderRadius: '12px',
              border: `2px solid ${userVote === 'BUY' ? '#22c55e' : userVote === 'SELL' ? '#ef4444' : '#eab308'}`,
              background: userVote === 'BUY' ? 'rgba(34,197,94,0.1)' : userVote === 'SELL' ? 'rgba(239,68,68,0.1)' : 'rgba(234,179,8,0.1)',
              textAlign: 'center',
              lineHeight: '1.6'
            }}>
              <span style={{ fontSize: '18px', color: '#94a3b8', verticalAlign: 'middle' }}>This week I voted: </span>
              <span style={{ 
                fontSize: '22px', 
                fontWeight: 700, 
                color: userVote === 'BUY' ? '#22c55e' : userVote === 'SELL' ? '#ef4444' : '#eab308',
                verticalAlign: 'middle'
              }}>{userVote}</span>
            </div>
          </div>
        )}

        {/* Community Sentiment */}
        {consensus && consensus.total > 0 && (
          <div style={{ textAlign: 'center', width: '100%', marginBottom: '36px' }}>
            <div style={{ fontSize: '14px', color: '#94a3b8', letterSpacing: '2px', marginBottom: '20px' }}>
              COMMUNITY SENTIMENT ({consensus.total} {consensus.total === 1 ? 'vote' : 'votes'})
            </div>
            <div style={{ display: 'flex', height: '20px', borderRadius: '10px', overflow: 'hidden', marginBottom: '18px' }}>
              <div style={{ width: `${consensus.BUY}%`, background: '#22c55e' }} />
              <div style={{ width: `${consensus.HOLD}%`, background: '#eab308' }} />
              <div style={{ width: `${consensus.SELL}%`, background: '#ef4444' }} />
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tr>
                <td style={{ textAlign: 'left', color: '#22c55e', fontSize: '16px' }}>● {consensus.BUY}% Buy</td>
                <td style={{ textAlign: 'center', color: '#eab308', fontSize: '16px' }}>● {consensus.HOLD}% Hold</td>
                <td style={{ textAlign: 'right', color: '#ef4444', fontSize: '16px' }}>● {consensus.SELL}% Sell</td>
              </tr>
            </table>
          </div>
        )}

        {/* Footer */}
        <div style={{ fontSize: '13px', color: '#64748b', letterSpacing: '0.5px', textAlign: 'center', width: '100%', marginTop: '24px' }}>
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
