'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTickerSearch } from '../../../lib/hooks/useTickerSearch';

function StockCard({ s, onClick }) {
  const [imgError, setImgError] = useState(false);
  const change = s.priceChangePct;
  const positive = change != null && change >= 0;

  return (
    <button
      onClick={onClick}
      style={{
        textAlign: 'left',
        background: 'var(--ws-bg-1)',
        border: '1px solid var(--ws-border)',
        borderRadius: 'var(--ws-radius)',
        padding: '16px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--ws-accent)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.06)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--ws-border)'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'white', border: '1px solid var(--ws-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
          {!imgError ? (
            <img
              src={`https://img.logo.dev/ticker/${s.ticker}?token=pk_B4aaLZF6S4G1YbCgqZq2Ug`}
              alt={s.name}
              style={{ width: '28px', height: '28px', objectFit: 'contain' }}
              onError={() => setImgError(true)}
            />
          ) : (
            <span style={{ color: 'var(--ws-accent)', fontWeight: 700, fontSize: '13px', fontFamily: "'JetBrains Mono', monospace" }}>{s.ticker.slice(0, 2)}</span>
          )}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: '13px', color: 'var(--ws-accent)', letterSpacing: '0.5px' }}>
            {s.ticker}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--ws-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {s.name}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' }}>
        <span style={{ fontSize: '10px', color: 'var(--ws-text-3)', letterSpacing: '0.5px', textTransform: 'uppercase', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {s.exchange}{s.sector ? ` · ${s.sector}` : ''}
        </span>
        {s.currentPrice != null && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', flexShrink: 0 }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', fontWeight: 700, color: 'var(--ws-text)' }}>
              ${s.currentPrice.toFixed(2)}
            </span>
            {change != null && (
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 700, color: positive ? 'var(--ws-accent)' : 'var(--ws-red)' }}>
                {positive ? '+' : ''}{change.toFixed(2)}%
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}

export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQ = searchParams.get('q') || '';
  const [q, setQ] = useState(initialQ);
  const { suggestions: results, loading } = useTickerSearch(q, { limit: 24 });
  const [searched, setSearched] = useState(false);
  const wasLoading = useRef(false);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Mirrors the original fetch-then-flag behavior: `searched` flips true only
  // once a search actually completes (loading true -> false), and resets
  // immediately when the query is cleared.
  useEffect(() => {
    if (q.trim().length < 1) setSearched(false);
  }, [q]);
  useEffect(() => {
    if (wasLoading.current && !loading) setSearched(true);
    wasLoading.current = loading;
  }, [loading]);

  const goToTicker = (ticker) => router.push(`/stock/${ticker}`);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && q.trim()) {
      if (results.length > 0) goToTicker(results[0].ticker);
      else goToTicker(q.trim().toUpperCase());
    }
  };

  return (
    <div style={{ padding: '24px' }}>

      {/* Big search bar */}
      <div style={{ marginBottom: '32px', marginTop: '24px', maxWidth: '720px' }}>
        <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--ws-border)', borderRadius: 'var(--ws-radius)', background: 'var(--ws-bg-1)', overflow: 'hidden' }}>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '22px',
            color: 'var(--ws-accent)',
            fontWeight: 700,
            padding: '0 0 0 20px',
            userSelect: 'none',
          }}>
            &gt;_
          </span>
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="SEARCH TICKER OR COMPANY NAME..."
            style={{
              flex: 1,
              height: '68px',
              padding: '0 20px',
              fontSize: '20px',
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: '0.5px',
              fontWeight: 600,
              border: 'none',
              background: 'transparent',
              color: 'var(--ws-text)',
              outline: 'none',
            }}
          />
        </div>
        {q.trim().length > 0 && (
          <div style={{ marginTop: '10px', fontSize: '11px', color: 'var(--ws-text-3)', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.5px', paddingLeft: '4px' }}>
            {loading ? 'SEARCHING...' : `${results.length} RESULT${results.length !== 1 ? 'S' : ''} FOR "${q.trim().toUpperCase()}"`}
          </div>
        )}
      </div>

      {/* Results grid */}
      {results.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
          {results.map(s => (
            <StockCard key={s.ticker} s={s} onClick={() => goToTicker(s.ticker)} />
          ))}
        </div>
      )}

      {/* Empty / no results states */}
      {!loading && searched && results.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 24px' }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: 'var(--ws-text-3)', letterSpacing: '1px', marginBottom: '16px' }}>
            NO RESULTS FOR "{q.trim().toUpperCase()}"
          </div>
          <button
            onClick={() => goToTicker(q.trim().toUpperCase())}
            style={{ fontSize: '12px', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px', background: 'var(--ws-text)', color: 'var(--ws-bg)', border: 'none', borderRadius: 'var(--ws-radius)', fontWeight: 700, padding: '10px 20px', cursor: 'pointer' }}>
            TRY "{q.trim().toUpperCase()}" AS TICKER →
          </button>
        </div>
      )}

      {q.trim().length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 24px' }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: 'var(--ws-text-3)', letterSpacing: '1px' }}>
            START TYPING TO SEARCH THOUSANDS OF STOCKS
          </div>
        </div>
      )}
    </div>
  );
}
