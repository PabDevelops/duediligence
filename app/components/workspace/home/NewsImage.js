'use client';
import { useState } from 'react';

// Smart news image — renders normally, hides container if image is a logo (wide ratio)
export default function NewsImage({ src, alt, ticker, large }) {
  const [hasError, setHasError] = useState(false);
  const [isLogo, setIsLogo] = useState(false);

  if (!src || hasError || isLogo) return null;

  const handleLoad = (e) => {
    const img = e.currentTarget;
    if (img.naturalWidth && img.naturalHeight) {
      const ratio = img.naturalWidth / img.naturalHeight;
      // Logos are banner-shaped (> 2.5:1). Real thumbnails: 16:9=1.77, 4:3=1.33, 1:1=1
      if (ratio > 2.5) {
        setIsLogo(true);
      }
    }
  };

  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderBottom: '1px solid var(--ws-border)' }}>
      <img
        src={src}
        alt={alt}
        style={large
          ? { width: '100%', height: '260px', objectFit: 'cover', display: 'block' }
          : { width: '100%', height: 'auto', display: 'block' }}
        onLoad={handleLoad}
        onError={() => setHasError(true)}
      />
      {ticker && (
        <div style={{
          position: 'absolute',
          top: '14px',
          right: '-34px',
          width: '130px',
          transform: 'rotate(45deg)',
          background: 'var(--ws-accent)',
          color: '#fff',
          fontSize: '10px',
          fontWeight: 800,
          textAlign: 'center',
          padding: '3px 4px',
          letterSpacing: '0.5px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          {ticker}
        </div>
      )}
    </div>
  );
}
