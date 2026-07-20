'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { openInNewTab } from '../../lib/openInNewTab';

export default function MobileHeader() {
  const router = useRouter();
  const [searchQ, setSearchQ] = useState('');
  const [ticker, setTicker] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Fetch suggestions while typing
  useEffect(() => {
    if (searchQ.length < 1) { setSuggestions([]); return; }
    const timeout = setTimeout(() => {
      fetch(`/api/search?q=${searchQ}`)
        .then(r => r.json())
        .then(d => setSuggestions(d.results || []))
        .catch(() => {});
    }, 200);
    return () => clearTimeout(timeout);
  }, [searchQ]);

  const handleSelect = (t) => {
    openInNewTab(`/stock/${t}`);
    setShowSuggestions(false);
    setSearchQ('');
    setTicker('');
  };

  return (
    <header className="mobile-header" style={{
      display: 'flex',
      padding: '12px 16px',
      borderBottom: '1px solid var(--border)',
      background: 'var(--bg)',
      position: 'sticky',
      top: 0,
      zIndex: 40,
      width: '100%',
      boxSizing: 'border-box',
      gap: '12px',
      alignItems: 'center'
    }}>
      {/* Logo */}
      <div onClick={() => router.push('/')} style={{
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '3px',
        fontFamily: 'Space Grotesk, sans-serif',
        fontSize: '14px',
        fontWeight: 700,
        color: 'var(--text)',
        flexShrink: 0
      }}>
        Traq
        <span style={{ color: 'var(--accent)', display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)' }} />
        cker
      </div>

      {/* Search bar */}
      <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
        <input
          type="text"
          placeholder="Search..."
          value={searchQ}
          onChange={e => { const v = e.target.value; setSearchQ(v); setTicker(v.toUpperCase()); setShowSuggestions(true); }}
          onFocus={() => searchQ.length > 0 && setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          style={{
            width: '100%',
            padding: '8px 12px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            background: 'var(--bg-2)',
            color: 'var(--accent)',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '13px',
            outline: 'none',
            minWidth: 0
          }}
        />
        
        {/* Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: 'var(--bg-1)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            maxHeight: '250px',
            overflowY: 'auto',
            zIndex: 9999,
            marginTop: '4px',
            boxSizing: 'border-box'
          }}>
            {suggestions.map(s => (
              <div
                key={s.ticker}
                onTouchEnd={() => handleSelect(s.ticker)}
                onClick={() => handleSelect(s.ticker)}
                style={{
                  padding: '10px 12px',
                  borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                onTouchStart={e => e.currentTarget.style.background = 'var(--bg-2)'}
                onTouchEnd={e => e.currentTarget.style.background = 'transparent'}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ color: 'var(--accent)', fontSize: '12px', fontWeight: 700, minWidth: '45px', flexShrink: 0 }}>
                  {s.ticker}
                </span>
                <span style={{ color: 'var(--text-2)', fontSize: '11px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.name}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @media (min-width: 768px) {
          .mobile-header {
            display: none !important;
          }
        }
      `}</style>
    </header>
  );
}
