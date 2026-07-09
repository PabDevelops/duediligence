'use client';
import { useState } from 'react';

export default function ShareCard({ ticker, name, score }) {
  const [copied, setCopied] = useState(false);

  const stockUrl = `https://traqcker.com/stock/${ticker}`;
  const scoreNum = Math.max(0, Math.min(100, Math.round(score ?? 50)));

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

  return (
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
  );
}
