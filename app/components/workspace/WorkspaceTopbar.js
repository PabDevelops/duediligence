'use client';
import { useState, useEffect, useRef } from 'react';
import UserMenu from './UserMenu';
import { openInNewTab } from '../../../lib/openInNewTab';

export default function WorkspaceTopbar() {
  const [searchQ, setSearchQ] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (searchQ.length < 1) { setSuggestions([]); return; }
    const timeout = setTimeout(() => {
      fetch(`/api/search?q=${searchQ}`).then(r => r.json()).then(d => setSuggestions(d.results || [])).catch(() => {});
    }, 200);
    return () => clearTimeout(timeout);
  }, [searchQ]);

  const onSelect = (ticker) => { openInNewTab(`/stock/${ticker}`); setSearchQ(''); setShowSuggestions(false); };

  const runDiscover = async () => {
    const res = await fetch('/api/random');
    if (res.status === 429) {
      const d = await res.json();
      alert(d.isAnon ? 'Sign in to get 3 daily discovers. Pro gets unlimited.' : 'Daily limit reached. Upgrade to Pro for unlimited discovers.');
      return;
    }
    const { ticker } = await res.json();
    openInNewTab(`/stock/${ticker}`);
  };

  return (
    <div style={{
      height: '48px',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '0 16px',
      borderBottom: '1px solid var(--ws-border)',
      background: 'var(--ws-bg-1)',
      position: 'sticky',
      top: 0,
      zIndex: 10,
    }}>
      {/* Terminal command search */}
      <div style={{ position: 'relative', flex: 1, maxWidth: '480px', display: 'flex', alignItems: 'center' }}>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '12px',
          color: focused ? 'var(--ws-accent)' : 'var(--ws-text-3)',
          fontWeight: 700,
          padding: '0 10px',
          height: '32px',
          display: 'flex',
          alignItems: 'center',
          background: focused ? 'var(--ws-bg-2)' : 'var(--ws-bg-2)',
          borderRadius: 'var(--ws-radius) 0 0 var(--ws-radius)',
          border: `1px solid ${focused ? 'var(--ws-accent)' : 'var(--ws-border)'}`,
          borderRight: 'none',
          userSelect: 'none',
          letterSpacing: '1px',
          transition: 'all 0.15s ease',
          flexShrink: 0,
        }}>
          &gt;_
        </span>
        <input
          ref={inputRef}
          value={searchQ}
          onChange={e => { setSearchQ(e.target.value); setShowSuggestions(true); }}
          onKeyDown={e => {
            if (e.key === 'Enter' && searchQ) { openInNewTab(`/stock/${searchQ.toUpperCase()}`); setSearchQ(''); setShowSuggestions(false); }
            if (e.key === 'Escape') { setShowSuggestions(false); inputRef.current?.blur(); }
          }}
          onBlur={() => { setTimeout(() => setShowSuggestions(false), 200); setFocused(false); }}
          onFocus={() => { if (searchQ) setShowSuggestions(true); setFocused(true); }}
          placeholder="SEARCH TICKER OR COMPANY..."
          style={{
            flex: 1,
            height: '32px',
            padding: '0 10px',
            fontSize: '12px',
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: '0.5px',
            border: `1px solid ${focused ? 'var(--ws-accent)' : 'var(--ws-border)'}`,
            borderLeft: 'none',
            borderRadius: '0 var(--ws-radius) var(--ws-radius) 0',
            background: 'var(--ws-bg-2)',
            color: 'var(--ws-text)',
            outline: 'none',
            transition: 'all 0.15s ease',
          }}
        />
        {!focused && !searchQ && (
          <span style={{
            position: 'absolute',
            right: '10px',
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: '10px',
            fontFamily: "'JetBrains Mono', monospace",
            color: 'var(--ws-text-3)',
            pointerEvents: 'none',
            border: '1px solid var(--ws-border)',
            borderRadius: '4px',
            padding: '1px 5px',
          }}>
            /
          </span>
        )}

        {suggestions.length > 0 && showSuggestions && (
          <div style={{
            position: 'absolute',
            top: '36px',
            left: 0,
            right: 0,
            background: 'var(--ws-bg-1)',
            border: '1px solid var(--ws-border)',
            borderRadius: 'var(--ws-radius)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            maxHeight: '320px',
            overflowY: 'auto',
            zIndex: 20,
          }}>
            <div style={{ padding: '6px 10px', borderBottom: '1px solid var(--ws-border)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '9px', fontFamily: "'JetBrains Mono', monospace", color: 'var(--ws-text-3)', letterSpacing: '1px' }}>RESULTS</span>
            </div>
            {suggestions.map(s => (
              <div key={s.ticker} onMouseDown={() => onSelect(s.ticker)}
                style={{ padding: '9px 12px', cursor: 'pointer', display: 'flex', gap: '10px', alignItems: 'baseline', fontSize: '12px', transition: 'background 0.1s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--ws-bg-2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <span style={{ color: 'var(--ws-accent)', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", minWidth: '48px' }}>{s.ticker}</span>
                <span style={{ color: 'var(--ws-text-2)', flex: 1 }}>{s.name}</span>
                <span style={{ color: 'var(--ws-text-3)', fontSize: '10px', fontFamily: "'JetBrains Mono', monospace" }}>{s.exchange}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Discover as terminal command */}
      <button
        onClick={runDiscover}
        style={{
          height: '32px',
          padding: '0 14px',
          fontSize: '11px',
          fontFamily: "'JetBrains Mono', monospace",
          fontWeight: 700,
          letterSpacing: '1px',
          color: 'var(--ws-text-3)',
          background: 'transparent',
          border: '1px solid var(--ws-border)',
          borderRadius: 'var(--ws-radius)',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = 'var(--ws-accent)';
          e.currentTarget.style.color = 'var(--ws-accent)';
          e.currentTarget.style.background = 'var(--ws-accent-dim)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = 'var(--ws-border)';
          e.currentTarget.style.color = 'var(--ws-text-3)';
          e.currentTarget.style.background = 'transparent';
        }}
      >
        RANDOM
      </button>

      <div style={{ marginLeft: 'auto' }}>
        <UserMenu variant="light" />
      </div>
    </div>
  );
}
