'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import NewNav from '../../components/new/NewNav';
import StockLogo from '../../components/workspace/StockLogo';
import Sparkline from '../../components/Sparkline';
import { useUser } from '../../components/AuthProvider';
import { getGuestWatchlist, addToGuestWatchlist, removeFromGuestWatchlist } from '../../../lib/guestWatchlist';
import { formatCurrency } from '../../../lib/formatters';
import { NEW_COLORS as C, VERDICT_BADGE } from '../../components/new/theme';

// Same curated ticker baskets as app/api/explore/route.js (THEMES) — ids must match what
// that endpoint accepts. Labels here are the Spanish display text; the API's own `label`
// field (English) isn't used for display.
const THEME_GROUPS = [
  {
    title: 'Temático', items: [
      { id: 'bigtech', label: 'Grandes Tecnológicas' },
      { id: 'ai', label: 'IA y Semiconductores' },
      { id: 'defence', label: 'Defensa' },
      { id: 'quantum', label: 'Computación Cuántica' },
      { id: 'evs', label: 'Coches Eléctricos' },
      { id: 'banks', label: 'Bancos y Financieras' },
      { id: 'dividends', label: 'Aristócratas del Dividendo' },
      { id: 'cybersecurity', label: 'Ciberseguridad' },
      { id: 'biotech', label: 'Biotecnología y Farma' },
      { id: 'energy', label: 'Petróleo y Gas' },
    ],
  },
  {
    title: 'Industrias', items: [
      { id: 'bigpharma', label: 'Grandes Farmacéuticas' },
      { id: 'reit', label: 'REITs (Inmobiliario)' },
      { id: 'airlines', label: 'Aerolíneas' },
      { id: 'automotive', label: 'Automoción' },
      { id: 'chipmakers', label: 'Fabricantes de Chips' },
      { id: 'insurance', label: 'Grandes Aseguradoras' },
      { id: 'hotels', label: 'Hoteles' },
      { id: 'restaurants', label: 'Restauración' },
      { id: 'regionalbanks', label: 'Bancos Regionales' },
      { id: 'mining', label: 'Minería' },
      { id: 'chemicals', label: 'Química Industrial' },
      { id: 'railroads', label: 'Ferrocarriles' },
      { id: 'motionpictures', label: 'Cine y Estudios' },
      { id: 'broadcasting', label: 'Televisión y Cable' },
      { id: 'grocery', label: 'Supermercados' },
      { id: 'footwear', label: 'Calzado' },
      { id: 'fashion', label: 'Moda' },
      { id: 'robotics', label: 'Robótica' },
      { id: 'crypto', label: 'Cripto y Blockchain' },
      { id: 'spac', label: 'Nacidas de SPAC' },
    ],
  },
];

const scoreTier = (score) => score == null ? null : score >= 70 ? 'good' : score >= 40 ? 'caution' : 'bad';

function AddButton({ ticker, active, onToggle }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggle(ticker); }}
      aria-label={active ? `Quitar ${ticker} de seguimiento` : `Seguir ${ticker}`}
      title={active ? 'Dejar de seguir' : 'Seguir'}
      style={{
        width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
        border: `1px solid ${active ? C.lime : C.border}`,
        background: active ? C.lime : 'transparent',
        color: C.ink, fontSize: '14px', fontWeight: 800, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
      }}>
      {active ? '✓' : '+'}
    </button>
  );
}

function IndexCard({ m }) {
  const isUp = m.changePct >= 0;
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '14px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, color: C.text3 }}>{m.label}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: '16px', fontWeight: 800 }}>
            {m.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          {m.changePct != null && (
            <div style={{ fontSize: '12px', fontWeight: 700, color: isUp ? C.green : C.red }}>
              {isUp ? '+' : ''}{m.changePct.toFixed(2)}%
            </div>
          )}
        </div>
        {m.candles?.length > 1 && <Sparkline data={m.candles} width={64} height={22} color={isUp ? C.green : C.red} />}
      </div>
    </div>
  );
}

function MoverRow({ s, watching, onToggle }) {
  const isUp = s.priceChangePct >= 0;
  return (
    <a href={`/stock/${s.ticker}`} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 4px', textDecoration: 'none', color: 'inherit' }}>
      <StockLogo ticker={s.ticker} name={s.name} size={30} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: '13px', fontWeight: 700 }}>{s.ticker}</div>
        <div style={{ fontSize: '11px', color: C.text3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 700 }}>{s.currentPrice != null ? formatCurrency(s.currentPrice, '$') : '—'}</div>
        {s.priceChangePct != null && (
          <div style={{ fontSize: '11px', fontWeight: 700, color: isUp ? C.green : C.red }}>
            {isUp ? '+' : ''}{s.priceChangePct.toFixed(2)}%
          </div>
        )}
      </div>
      <AddButton ticker={s.ticker} active={watching} onToggle={onToggle} />
    </a>
  );
}

function LeaderRow({ s, watching, onToggle }) {
  const tier = scoreTier(s.score);
  const badge = tier ? VERDICT_BADGE[tier] : null;
  return (
    <a href={`/stock/${s.ticker}`} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 4px', textDecoration: 'none', color: 'inherit' }}>
      <StockLogo ticker={s.ticker} name={s.name} size={30} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: '13px', fontWeight: 700 }}>{s.ticker}</div>
        <div style={{ fontSize: '11px', color: C.text3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
      </div>
      {badge && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '20px', background: badge.bg, flexShrink: 0 }}>
          <span aria-hidden="true" style={{ width: '6px', height: '6px', borderRadius: '50%', background: badge.dot }} />
          <span style={{ fontSize: '11px', fontWeight: 700, color: badge.text }}>{s.score.toFixed(0)}</span>
        </div>
      )}
      <AddButton ticker={s.ticker} active={watching} onToggle={onToggle} />
    </a>
  );
}

function BasketCard({ s, watching, onToggle }) {
  const isUp = s.priceChangePct != null && s.priceChangePct >= 0;
  return (
    <a href={`/stock/${s.ticker}`} style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: '16px', padding: '16px',
      display: 'flex', flexDirection: 'column', gap: '12px', textDecoration: 'none', color: 'inherit', minWidth: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
        <StockLogo ticker={s.ticker} name={s.name} size={32} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: '13px', fontWeight: 700 }}>{s.ticker}</div>
          <div style={{ fontSize: '12px', color: C.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
        </div>
        <AddButton ticker={s.ticker} active={watching} onToggle={onToggle} />
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
        <span style={{ fontSize: '14px', fontWeight: 700 }}>{s.currentPrice != null ? formatCurrency(s.currentPrice, '$') : 'N/D'}</span>
        {s.priceChangePct != null && (
          <span style={{ fontSize: '12px', fontWeight: 700, color: isUp ? C.green : C.red }}>
            {isUp ? '+' : ''}{s.priceChangePct.toFixed(2)}%
          </span>
        )}
      </div>
    </a>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div>
        <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>{title}</h2>
        {subtitle && <div style={{ fontSize: '12px', color: C.text2, marginTop: '2px' }}>{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

export default function RadarPage() {
  const { isSignedIn } = useUser();
  const [loading, setLoading] = useState(true);
  const [movers, setMovers] = useState(null);
  const [markets, setMarkets] = useState([]);
  const [watchlistTickers, setWatchlistTickers] = useState([]);

  const [basketCategory, setBasketCategory] = useState('bigtech');
  const [basketCache, setBasketCache] = useState({});
  const [loadingBasket, setLoadingBasket] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([fetch('/api/movers').then(r => r.json()), fetch('/api/market').then(r => r.json())])
      .then(([moversData, marketsData]) => {
        if (!active) return;
        setMovers(moversData);
        setMarkets((marketsData.markets || []).filter(m => m.symbol !== '^VIX'));
      })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (isSignedIn) {
      fetch('/api/watchlist').then(r => r.json()).then(d => setWatchlistTickers((d.tickers || []).map(t => t.ticker))).catch(() => {});
    } else {
      setWatchlistTickers(getGuestWatchlist());
    }
  }, [isSignedIn]);

  useEffect(() => {
    if (basketCache[basketCategory]) return;
    setLoadingBasket(true);
    fetch(`/api/explore?category=${basketCategory}`)
      .then(r => r.json())
      .then(data => {
        setBasketCache(prev => ({ ...prev, [basketCategory]: data.stocks || [] }));
        (data.missing || []).forEach(ticker => { fetch(`/api/stock?ticker=${ticker}`).catch(() => {}); });
      })
      .catch(() => setBasketCache(prev => ({ ...prev, [basketCategory]: [] })))
      .finally(() => setLoadingBasket(false));
  }, [basketCategory, basketCache]);

  const toggleWatchlist = useCallback(async (ticker) => {
    const inWatchlist = watchlistTickers.includes(ticker);
    if (!isSignedIn) {
      if (inWatchlist) { removeFromGuestWatchlist(ticker); setWatchlistTickers(prev => prev.filter(t => t !== ticker)); }
      else { const { added } = addToGuestWatchlist(ticker); if (added) setWatchlistTickers(prev => [...prev, ticker]); }
      return;
    }
    setWatchlistTickers(prev => inWatchlist ? prev.filter(t => t !== ticker) : [...prev, ticker]);
    try {
      await fetch('/api/watchlist', {
        method: inWatchlist ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker }),
      });
    } catch {}
  }, [isSignedIn, watchlistTickers]);

  const gainers = useMemo(() => (movers?.gainers || []).slice(0, 5), [movers]);
  const losers = useMemo(() => (movers?.losers || []).slice(0, 5), [movers]);
  const leaders = useMemo(() => (movers?.topScore || []).slice(0, 8), [movers]);
  const basketStocks = basketCache[basketCategory] || [];

  return (
    <div style={{ width: '100%', minHeight: '100vh', boxSizing: 'border-box', background: C.bg, color: C.ink, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 'min(1200px, 92vw)', margin: '0 auto', padding: '32px 24px 96px', display: 'flex', flexDirection: 'column', gap: '32px', boxSizing: 'border-box' }}>

        <NewNav active="radar" />

        <div>
          <h1 style={{ margin: '0 0 6px', fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em' }}>Radar</h1>
          <p style={{ margin: 0, fontSize: '13px', color: C.text2, maxWidth: '560px' }}>
            Qué se mueve hoy, qué destaca por calidad fundamental, y cestas de empresas para explorar por tema.
          </p>
        </div>

        {loading ? (
          <div style={{ fontSize: '13px', color: C.text3 }}>Cargando…</div>
        ) : (
          <>
            {markets.length > 0 && (
              <Section title="Pulso del mercado">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
                  {markets.map(m => <IndexCard key={m.symbol} m={m} />)}
                </div>
              </Section>
            )}

            <div className="new-radar-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>
              <style dangerouslySetInnerHTML={{ __html: `
                @media (max-width: 860px) {
                  .new-radar-2col { grid-template-columns: 1fr !important; }
                }
              `}} />

              <Section title="Top subidas" subtitle="Mayor subida hoy entre acciones con datos recientes.">
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '16px', padding: '6px 14px' }}>
                  {gainers.length > 0 ? gainers.map((s, i) => (
                    <div key={s.ticker} style={{ borderTop: i > 0 ? `1px solid ${C.borderSoft}` : 'none' }}>
                      <MoverRow s={s} watching={watchlistTickers.includes(s.ticker)} onToggle={toggleWatchlist} />
                    </div>
                  )) : <div style={{ padding: '16px 4px', fontSize: '12px', color: C.text3 }}>Sin datos todavía.</div>}
                </div>
              </Section>

              <Section title="Top bajadas" subtitle="Mayor caída hoy entre acciones con datos recientes.">
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '16px', padding: '6px 14px' }}>
                  {losers.length > 0 ? losers.map((s, i) => (
                    <div key={s.ticker} style={{ borderTop: i > 0 ? `1px solid ${C.borderSoft}` : 'none' }}>
                      <MoverRow s={s} watching={watchlistTickers.includes(s.ticker)} onToggle={toggleWatchlist} />
                    </div>
                  )) : <div style={{ padding: '16px 4px', fontSize: '12px', color: C.text3 }}>Sin datos todavía.</div>}
                </div>
              </Section>
            </div>

            <Section title="Líderes por calidad" subtitle="Las mejor puntuadas hoy según el mismo modelo de calidad que ves en cada ficha de acción.">
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '16px', padding: '6px 14px' }}>
                {leaders.length > 0 ? leaders.map((s, i) => (
                  <div key={s.ticker} style={{ borderTop: i > 0 ? `1px solid ${C.borderSoft}` : 'none' }}>
                    <LeaderRow s={s} watching={watchlistTickers.includes(s.ticker)} onToggle={toggleWatchlist} />
                  </div>
                )) : <div style={{ padding: '16px 4px', fontSize: '12px', color: C.text3 }}>Sin datos todavía.</div>}
              </div>
            </Section>

            <Section title="Explora por tema" subtitle="Cestas de empresas agrupadas por sector o temática.">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {THEME_GROUPS.map(group => (
                  <div key={group.title} style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: C.text3, marginRight: '4px' }}>{group.title}:</span>
                    {group.items.map(cat => (
                      <button key={cat.id} type="button" onClick={() => setBasketCategory(cat.id)} style={{
                        padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
                        border: basketCategory === cat.id ? 'none' : `1px solid ${C.border}`,
                        background: basketCategory === cat.id ? C.ink : 'transparent',
                        color: basketCategory === cat.id ? '#FFFFFF' : C.text2,
                      }}>
                        {cat.label}
                      </button>
                    ))}
                  </div>
                ))}
              </div>

              {loadingBasket ? (
                <div style={{ fontSize: '13px', color: C.text3, padding: '12px 0' }}>Cargando…</div>
              ) : basketStocks.length === 0 ? (
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '16px', padding: '28px', textAlign: 'center', fontSize: '13px', color: C.text2 }}>
                  Sin datos para esta cesta todavía.
                </div>
              ) : (
                <div className="new-card-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '14px' }}>
                  {basketStocks.map(s => (
                    <BasketCard key={s.ticker} s={s} watching={watchlistTickers.includes(s.ticker)} onToggle={toggleWatchlist} />
                  ))}
                </div>
              )}
            </Section>
          </>
        )}
      </div>
    </div>
  );
}
