'use client';
import { useState } from 'react';

export default function StockLogo({ ticker, name, size = 20 }) {
  const [error, setError] = useState(false);

  if (error || !ticker) {
    return (
      <div style={{
        width: size,
        height: size,
        background: 'var(--ws-bg-2)',
        border: '1px solid var(--ws-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '9px',
        fontWeight: 700,
        color: 'var(--ws-accent)',
        flexShrink: 0
      }}>
        {ticker ? ticker.slice(0, 2).toUpperCase() : '??'}
      </div>
    );
  }

  return (
    <img
      src={`https://img.logo.dev/ticker/${ticker.toUpperCase()}?token=pk_B4aaLZF6S4G1YbCgqZq2Ug`}
      alt={name || ticker}
      style={{
        width: size,
        height: size,
        border: '1px solid var(--ws-border)',
        objectFit: 'contain',
        background: '#fff',
        flexShrink: 0
      }}
      onError={() => setError(true)}
    />
  );
}
