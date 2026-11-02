'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import NewNav from '../../components/new/NewNav';
import StockLogo from '../../components/workspace/StockLogo';
import { computeETFQualityScore } from '../../../lib/etfQuality';
import { NEW_COLORS as C, VERDICT_BADGE } from '../../components/new/theme';

const CATEGORIES = [
  { id: 'all', label: 'Todo' },
  { id: 'equity', label: 'Renta variable EEUU' },
  { id: 'sector', label: 'Sectorial' },
  { id: 'international', label: 'Internacional' },
  { id: 'fixed', label: 'Bonos y oro' },
];

// Same 70/40 thresholds the quality score itself already used (lib/etfQuality.js and the old
// ETF Quality tab) — just mapped onto the same good/caution/bad badge the stock pages use,
// instead of a separate STRONG/FAIR/WEAK vocabulary.
function etfVerdict(composite) {
  if (composite == null) return null;
  if (composite >= 70) return { tier: 'good', label: 'Fondo sólido' };
  if (composite >= 40) return { tier: 'caution', label: 'Normalito' };
  return { tier: 'bad', label: 'Cuidado' };
}

function EtfCard({ etf }) {
  const quality = computeETFQualityScore(etf);
  const verdict = etfVerdict(quality?.composite);
  const badge = verdict ? VERDICT_BADGE[verdict.tier] : null;

  return (
    <Link href={`/etfs/${etf.ticker}`} style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: '16px', padding: '18px',
      display: 'flex', flexDirection: 'column', gap: '12px', boxSizing: 'border-box', minWidth: 0,
      textDecoration: 'none', color: 'inherit',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
        <StockLogo ticker={etf.ticker} name={etf.name} size={32} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{etf.name}</div>
          <div style={{ fontSize: '12px', color: C.text2 }}>{etf.ticker}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '20px' }}>
        <div>
          <div style={{ fontSize: '10px', color: C.text3, fontWeight: 700 }}>GASTOS</div>
          <div style={{ fontSize: '14px', fontWeight: 700 }}>{etf.expenseRatio}</div>
        </div>
        <div>
          <div style={{ fontSize: '10px', color: C.text3, fontWeight: 700 }}>RENTABILIDAD</div>
          <div style={{ fontSize: '14px', fontWeight: 700 }}>{etf.yield}</div>
        </div>
      </div>
      {badge && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', borderRadius: '20px', background: badge.bg, width: 'fit-content' }}>
          <span aria-hidden="true" style={{ width: '7px', height: '7px', borderRadius: '50%', background: badge.dot }} />
          <span style={{ fontSize: '11px', fontWeight: 700, color: badge.text }}>{verdict.label}</span>
        </div>
      )}
    </Link>
  );
}

export default function NewEtfsPage() {
  const router = useRouter();
  const [etfsList, setEtfsList] = useState(null); // null = loading
  const [activeCategory, setActiveCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/api/etfs').then(r => r.json()).then(d => {
      if (active) setEtfsList(d.etfs || []);
    }).catch(() => { if (active) setEtfsList([]); });
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => {
    if (!etfsList) return [];
    if (activeCategory === 'all') return etfsList;
    return etfsList.filter(e => e.category === activeCategory);
  }, [etfsList, activeCategory]);

  const handleSearch = async (e) => {
    e.preventDefault();
    setSearchError('');
    const ticker = query.trim().toUpperCase();
    if (!ticker) return;
    if (etfsList?.some(e => e.ticker === ticker)) { router.push(`/etfs/${ticker}`); return; }
    setSearching(true);
    try {
      const res = await fetch('/api/etfs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ticker }),
      });
      const d = await res.json();
      if (d.error) { setSearchError(`No encontramos ningún ETF con el ticker "${ticker}".`); return; }
      router.push(`/etfs/${d.ticker}`);
    } catch {
      setSearchError('No se pudo comprobar ese ticker ahora mismo.');
    } finally {
      setSearching(false);
    }
  };

  return (
    <div style={{ width: '100%', minHeight: '100vh', boxSizing: 'border-box', background: C.bg, color: C.ink, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 'min(1200px, 92vw)', margin: '0 auto', padding: '32px 24px 96px', display: 'flex', flexDirection: 'column', gap: '24px', boxSizing: 'border-box' }}>
        <NewNav active="etfs" />

        <div>
          <h1 style={{ margin: '0 0 6px', fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em' }}>Fondos (ETFs)</h1>
          <p style={{ margin: 0, fontSize: '13px', color: C.text2, maxWidth: '560px' }}>
            Un ETF reparte tu dinero entre muchas empresas a la vez, en vez de apostar por una sola.
          </p>
        </div>

        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <input
            type="text" value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Busca un ETF por ticker, ej: VOO, SCHD..."
            style={{ flex: '1 1 260px', height: '46px', borderRadius: '12px', border: `1px solid ${C.border}`, padding: '0 16px', fontSize: '14px', fontFamily: 'inherit', background: C.surface, boxSizing: 'border-box', color: C.ink }}
          />
          <button type="submit" disabled={searching} style={{ height: '46px', padding: '0 22px', borderRadius: '12px', border: 'none', background: C.lime, color: C.ink, fontWeight: 700, fontSize: '14px', fontFamily: 'inherit', cursor: 'pointer', opacity: searching ? 0.6 : 1 }}>
            {searching ? 'Buscando…' : 'Buscar'}
          </button>
        </form>
        {searchError && <div style={{ fontSize: '12px', color: C.red, marginTop: '-12px' }}>{searchError}</div>}

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {CATEGORIES.map(cat => (
            <button key={cat.id} type="button" onClick={() => setActiveCategory(cat.id)} style={{
              padding: '8px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
              border: activeCategory === cat.id ? 'none' : `1px solid ${C.border}`,
              background: activeCategory === cat.id ? C.ink : 'transparent',
              color: activeCategory === cat.id ? '#FFFFFF' : C.text2,
            }}>
              {cat.label}
            </button>
          ))}
        </div>

        {etfsList === null ? (
          <div style={{ fontSize: '13px', color: C.text3 }}>Cargando…</div>
        ) : filtered.length === 0 ? (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '16px', padding: '28px', textAlign: 'center', fontSize: '13px', color: C.text2 }}>
            Ningún ETF en esta categoría todavía — prueba a buscar uno arriba.
          </div>
        ) : (
          <div className="new-card-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '14px' }}>
            {filtered.map(etf => <EtfCard key={etf.ticker} etf={etf} />)}
          </div>
        )}
      </div>
    </div>
  );
}
