'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import NewNav from '../../components/new/NewNav';
import StockLogo from '../../components/workspace/StockLogo';
import { useTickerSearch } from '../../../lib/hooks/useTickerSearch';
import { openInNewTab } from '../../../lib/openInNewTab';
import { formatCurrency } from '../../../lib/formatters';
import { NEW_COLORS as C } from '../../components/new/theme';

function ResultCard({ s, onClick }) {
  const change = s.priceChangePct;
  const positive = change != null && change >= 0;
  const sym = s.currency === 'EUR' ? '€' : s.currency === 'GBP' ? '£' : '$';

  return (
    <button
      onClick={onClick}
      style={{
        textAlign: 'left',
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: '16px',
        padding: '16px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        fontFamily: 'inherit',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
        <StockLogo ticker={s.ticker} name={s.name} size={32} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontWeight: 700, fontSize: '13px', color: C.ink }}>{s.ticker}</span>
            {s.isEtf && (
              <span style={{ fontWeight: 700, fontSize: '9px', letterSpacing: '0.4px', color: C.text3, border: `1px solid ${C.border}`, borderRadius: '6px', padding: '1px 5px' }}>
                ETF
              </span>
            )}
          </div>
          <div style={{ fontSize: '12px', color: C.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {s.name}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' }}>
        <span style={{ fontSize: '11px', color: C.text3, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {s.exchange}{s.sector ? ` · ${s.sector}` : ''}
        </span>
        {s.currentPrice != null && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', flexShrink: 0 }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: C.ink }}>
              {formatCurrency(s.currentPrice, sym)}
            </span>
            {change != null && (
              <span style={{ fontSize: '11px', fontWeight: 700, color: positive ? C.green : C.red }}>
                {positive ? '+' : ''}{change.toFixed(2)}%
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}

function SearchPageContent() {
  const searchParams = useSearchParams();
  const initialQ = searchParams.get('q') || '';
  const [q, setQ] = useState(initialQ);
  const { suggestions: results, loading } = useTickerSearch(q, { limit: 48 });
  const etfResults = results.filter(s => s.isEtf);
  const stockResults = results.filter(s => !s.isEtf);
  const [searched, setSearched] = useState(false);
  const wasLoading = useRef(false);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (q.trim().length < 1) setSearched(false);
  }, [q]);
  useEffect(() => {
    if (wasLoading.current && !loading) setSearched(true);
    wasLoading.current = loading;
  }, [loading]);

  const goToTicker = (ticker, isEtf = false) => openInNewTab(isEtf ? `/etfs/${ticker}` : `/stock/${ticker}`);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && q.trim()) {
      if (results.length > 0) goToTicker(results[0].ticker, results[0].isEtf);
      else goToTicker(q.trim().toUpperCase());
    }
  };

  return (
    <div style={{ width: '100%', minHeight: '100vh', boxSizing: 'border-box', background: C.bg, color: C.ink, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 'min(1200px, 92vw)', margin: '0 auto', padding: '32px 24px 96px', display: 'flex', flexDirection: 'column', gap: '24px', boxSizing: 'border-box' }}>

        <NewNav active="buscar" />

        <Link href="/home" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: C.text2, textDecoration: 'none', width: 'fit-content' }}>
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
          Volver
        </Link>

        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em' }}>Buscar</h1>
          <div style={{ fontSize: '13px', color: C.text2 }}>Encuentra cualquier acción o fondo cotizado por ticker o nombre.</div>
        </div>

        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '8px', boxSizing: 'border-box' }}>
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Busca por ticker o nombre de empresa..."
            autoComplete="off"
            style={{
              width: '100%',
              height: '56px',
              padding: '0 16px',
              fontSize: '17px',
              fontWeight: 600,
              fontFamily: 'inherit',
              border: 'none',
              background: 'transparent',
              color: C.ink,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {q.trim().length > 0 && (
          <div style={{ fontSize: '12px', color: C.text3, marginTop: '-12px' }}>
            {loading ? 'Buscando…' : `${stockResults.length} acci${stockResults.length === 1 ? 'ón' : 'ones'} · ${etfResults.length} fondo${etfResults.length !== 1 ? 's' : ''} para "${q.trim().toUpperCase()}"`}
          </div>
        )}

        {results.length > 0 && (
          <div className="search-results-columns" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>
            <style dangerouslySetInnerHTML={{ __html: `
              @media (max-width: 900px) {
                .search-results-columns { grid-template-columns: 1fr !important; }
              }
            `}} />

            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: C.text3, letterSpacing: '0.5px', marginBottom: '12px', paddingBottom: '8px', borderBottom: `1px solid ${C.borderSoft}` }}>
                ACCIONES
              </div>
              {stockResults.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
                  {stockResults.map(s => (
                    <ResultCard key={s.ticker} s={s} onClick={() => goToTicker(s.ticker, s.isEtf)} />
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: C.text3, padding: '12px 0' }}>Sin resultados de acciones.</div>
              )}
            </div>

            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: C.text3, letterSpacing: '0.5px', marginBottom: '12px', paddingBottom: '8px', borderBottom: `1px solid ${C.borderSoft}` }}>
                FONDOS (ETFS)
              </div>
              {etfResults.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
                  {etfResults.map(s => (
                    <ResultCard key={s.ticker} s={s} onClick={() => goToTicker(s.ticker, s.isEtf)} />
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: C.text3, padding: '12px 0' }}>Sin resultados de fondos.</div>
              )}
            </div>
          </div>
        )}

        {!loading && searched && results.length === 0 && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', textAlign: 'center', padding: '48px 24px' }}>
            <div style={{ fontSize: '13px', color: C.text2, marginBottom: '16px' }}>
              Sin resultados para &quot;{q.trim().toUpperCase()}&quot;
            </div>
            <button
              onClick={() => goToTicker(q.trim().toUpperCase())}
              style={{ fontSize: '13px', fontWeight: 700, background: C.lime, color: C.ink, border: 'none', borderRadius: '12px', padding: '10px 20px', cursor: 'pointer', fontFamily: 'inherit' }}>
              Probar &quot;{q.trim().toUpperCase()}&quot; como ticker →
            </button>
          </div>
        )}

        {q.trim().length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 24px' }}>
            <div style={{ fontSize: '13px', color: C.text3 }}>
              Empieza a escribir para buscar entre miles de acciones y fondos.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// useSearchParams() opts the whole subtree out of static prerendering unless it's inside a
// Suspense boundary — without this wrapper, `next build` fails prerendering this page instead
// of just falling back to client-side rendering for it.
export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchPageContent />
    </Suspense>
  );
}
