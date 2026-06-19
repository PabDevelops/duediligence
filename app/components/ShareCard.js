'use client';
import { useRef, useState } from 'react';
import html2canvas from 'html2canvas';

export default function ShareCard({ ticker, name, price, priceChange, score, verdict, fairValue, fairValueNegative, consensus, userVote }) {
  const cardRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [imgLoading, setImgLoading] = useState(false);

  const stockUrl = `https://traqcker.com/stock/${ticker}`;

  const verdictColor = verdict === 'BUY' ? '#34d399' : verdict === 'SELL' ? '#f87171' : '#fbbf24';
  const scoreNum = Math.max(0, Math.min(100, Math.round(score ?? 50)));
  const scoreColor = scoreNum >= 70 ? '#34d399' : scoreNum >= 50 ? '#a78bfa' : '#f87171';
  const circumference = 502.65;
  const dashOffset = circumference - (circumference * scoreNum / 100);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(stockUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const el = document.createElement('input');
      el.value = stockUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShareX = () => {
    const scoreLabel = scoreNum >= 70 ? '🟢' : scoreNum >= 50 ? '🟡' : '🔴';
    const text = `${scoreLabel} ${name} (${ticker}) — Quality Score: ${scoreNum}/100\n\nAnalysis via @traqcker`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(stockUrl)}`, '_blank');
  };

  const handleDownloadImage = async () => {
    if (!cardRef.current) return;
    setImgLoading(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#08090f',
        scale: 2,
        logging: false,
        useCORS: true,
      });
      canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${ticker}-traqcker.png`;
        a.click();
        URL.revokeObjectURL(url);
      });
    } catch {
      alert('Failed to generate image');
    } finally {
      setImgLoading(false);
    }
  };

  return (
    <>
      {/* Hidden card rendered off-screen for html2canvas */}
      <div ref={cardRef} style={{
        position: 'fixed', left: '-9999px',
        width: '800px', background: '#08090f',
        padding: '56px', borderRadius: '24px',
        border: '1px solid rgba(167,139,250,0.3)',
        fontFamily: 'Nunito, sans-serif', color: '#f0f1f5',
        boxSizing: 'border-box',
        boxShadow: '0 0 80px rgba(167,139,250,0.15)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ fontSize: '22px', fontWeight: 900, color: '#f0f1f5', letterSpacing: '-0.5px' }}>
            Traq<span style={{ color: '#a78bfa' }}>●</span>cker
          </div>
        </div>

        {/* Ticker + Name */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ fontSize: '60px', fontWeight: 900, color: '#ffffff', letterSpacing: '-2px', lineHeight: 1 }}>{ticker}</div>
          <div style={{ fontSize: '22px', color: '#b0b7c9', marginTop: '10px', fontWeight: 600 }}>{name}</div>
        </div>

        {/* Price */}
        <div style={{ textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.08)', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '28px 0', marginBottom: '40px' }}>
          <span style={{ fontSize: '52px', fontWeight: 900, color: '#ffffff' }}>${price?.toFixed(2) || '—'}</span>
          {priceChange !== undefined && (
            <span style={{ fontSize: '24px', fontWeight: 700, color: priceChange >= 0 ? '#34d399' : '#f87171', marginLeft: '14px' }}>
              {priceChange >= 0 ? '↑' : '↓'}{Math.abs(priceChange).toFixed(2)}%
            </span>
          )}
          {fairValue != null && !fairValueNegative && (
            <div style={{ fontSize: '16px', color: '#6b7491', marginTop: '10px' }}>
              Fair Value: <span style={{ color: '#a78bfa', fontWeight: 700 }}>${fairValue.toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* Score + Verdict */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '60px', marginBottom: '40px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: '#6b7491', letterSpacing: '2px', marginBottom: '16px' }}>QUALITY SCORE</div>
            <svg width="160" height="160" viewBox="0 0 200 200">
              <circle cx="100" cy="100" r="80" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="14" />
              <circle cx="100" cy="100" r="80" fill="none" stroke={scoreColor} strokeWidth="14"
                strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={dashOffset}
                transform="rotate(-90 100 100)" />
              <text x="100" y="100" textAnchor="middle" dominantBaseline="central"
                fontSize="52" fontWeight="900" fill={scoreColor} fontFamily="Nunito, sans-serif">
                {scoreNum}
              </text>
            </svg>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: '#6b7491', letterSpacing: '2px', marginBottom: '16px' }}>VERDICT</div>
            <div style={{ fontSize: '48px', fontWeight: 900, color: verdictColor, letterSpacing: '-1px' }}>{verdict}</div>
          </div>
        </div>

        {/* Community votes */}
        {consensus && consensus.total > 0 && (
          <div style={{ marginBottom: '32px' }}>
            <div style={{ fontSize: '11px', color: '#6b7491', letterSpacing: '2px', marginBottom: '12px', textAlign: 'center' }}>
              COMMUNITY · {consensus.total} {consensus.total === 1 ? 'VOTE' : 'VOTES'}
            </div>
            <div style={{ display: 'flex', height: '10px', borderRadius: '999px', overflow: 'hidden' }}>
              <div style={{ width: `${consensus.BUY}%`, background: '#34d399' }} />
              <div style={{ width: `${consensus.HOLD}%`, background: '#fbbf24' }} />
              <div style={{ width: `${consensus.SELL}%`, background: '#f87171' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '13px' }}>
              <span style={{ color: '#34d399' }}>{consensus.BUY}% Buy</span>
              <span style={{ color: '#fbbf24' }}>{consensus.HOLD}% Hold</span>
              <span style={{ color: '#f87171' }}>{consensus.SELL}% Sell</span>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', fontSize: '13px', color: '#6b7491', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '20px' }}>
          traqcker.com — Fundamental analysis without noise
        </div>
      </div>

      {/* Share buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* Copy link + Share on X */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-secondary" onClick={handleCopyLink}
            style={{ flex: 1, padding: '11px 16px', fontSize: '13px', textAlign: 'center' }}>
            {copied ? '✓ Copied!' : '🔗 Copy link'}
          </button>
          <button className="btn-secondary" onClick={handleShareX}
            style={{ flex: 1, padding: '11px 16px', fontSize: '13px', textAlign: 'center' }}>
            𝕏 Share on X
          </button>
        </div>

        {/* Download image */}
        <button className="btn-secondary" onClick={handleDownloadImage} disabled={imgLoading}
          style={{ width: '100%', padding: '11px 16px', fontSize: '13px', opacity: imgLoading ? 0.6 : 1 }}>
          {imgLoading ? 'Generating…' : '📸 Download image'}
        </button>
      </div>
    </>
  );
}
