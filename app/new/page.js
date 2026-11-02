'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import NewNav from '../components/new/NewNav';
import StockLogo from '../components/workspace/StockLogo';
import { useUser } from '../components/AuthProvider';
import { useTickerSearch } from '../../lib/hooks/useTickerSearch';
import { getGuestWatchlist } from '../../lib/guestWatchlist';
import { computeEasyMode } from '../../lib/stockScoring';
import { stockVerdict } from '../../lib/verdict';
import { formatCurrency } from '../../lib/formatters';
import { NEW_COLORS as C, VERDICT_BADGE } from '../components/new/theme';

const LEARN_FALLBACK_ICON = (
  <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.ink} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
  </svg>
);

const WATCHLIST_PREVIEW_LIMIT = 3;
const MARKET_PREVIEW_LIMIT = 3;
const LEARN_PREVIEW_LIMIT = 3;
const EARNINGS_PREVIEW_LIMIT = 3;
const EARNINGS_RANGE_DAYS = 13;
const MOVERS_PREVIEW_LIMIT = 4;
const NEWS_PREVIEW_LIMIT = 3;

const hasFundamentals = (d) => d.revVal != null || d.niVal != null || d.marketCap != null
  || d.roic != null || d.grossMargin != null || (d.revHistory?.length ?? 0) > 0;

const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const toDateStr = (d) => d.toISOString().slice(0, 10);

// Same short labels used on /new/calendar — "Antes de abrir"/"Después del cierre" is too
// long for a one-line preview row at this width.
const timingLabelShort = (hour) => hour === 'bmo' ? 'Apertura' : hour === 'amc' ? 'Cierre' : 'Sin confirmar';

function shortDateLabel(dateStr) {
  const today = new Date();
  const todayStr = toDateStr(today);
  const tomorrowStr = toDateStr(new Date(today.getTime() + 86400000));
  if (dateStr === todayStr) return 'Hoy';
  if (dateStr === tomorrowStr) return 'Mañana';
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

// /api/filings' RSS-sourced relative-time strings ("2h ago") come pre-formatted in English —
// translating in place is simpler than re-deriving it from a timestamp this page doesn't have.
function esRelativeTime(time) {
  const m = /^(\d+)([mhd]) ago$/.exec(time || '');
  if (!m) return time || '';
  const unit = m[2] === 'm' ? 'min' : m[2];
  return `hace ${m[1]}${unit}`;
}

function WatchlistCard({ item }) {
  const easyMode = computeEasyMode(item, hasFundamentals(item));
  const companyName = (item.name || item.ticker).split(' ')[0];
  const verdict = easyMode ? stockVerdict(easyMode, companyName) : null;
  const badge = verdict ? VERDICT_BADGE[verdict.tier] : null;
  const changeColor = item.priceChangePct == null ? C.text2 : item.priceChangePct >= 0 ? C.green : C.red;

  return (
    <Link href={`/new/stock/${item.ticker}`} style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: '16px', padding: '18px',
      display: 'flex', flexDirection: 'column', gap: '12px', boxSizing: 'border-box', minWidth: 0,
      textDecoration: 'none', color: 'inherit',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
        <StockLogo ticker={item.ticker} name={item.name} size={32} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name || item.ticker}</div>
          <div style={{ fontSize: '12px', color: C.text2 }}>{item.ticker}</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '17px', fontWeight: 700 }}>
          {item.currentPrice != null ? formatCurrency(item.currentPrice, item.currency === 'EUR' ? '€' : item.currency === 'GBP' ? '£' : '$') : 'N/D'}
        </span>
        {item.priceChangePct != null && (
          <span style={{ fontSize: '12px', fontWeight: 700, color: changeColor }}>
            {item.priceChangePct >= 0 ? '+' : ''}{item.priceChangePct.toFixed(2)}%
          </span>
        )}
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

export default function NewDashboardPage() {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useUser();

  const [query, setQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const { suggestions } = useTickerSearch(query, { limit: 8 });

  const goToTicker = (ticker) => {
    setQuery('');
    setShowSuggestions(false);
    router.push(`/new/stock/${ticker.trim().toUpperCase()}`);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (suggestions.length > 0) { goToTicker(suggestions[0].ticker); return; }
    if (query.trim()) goToTicker(query);
  };

  const [watchlist, setWatchlist] = useState(null); // null = loading, [] = empty
  useEffect(() => {
    if (!isLoaded) return;
    let active = true;
    const load = async () => {
      try {
        let url;
        if (isSignedIn) {
          url = '/api/watchlist?full=true';
        } else {
          const guestTickers = getGuestWatchlist();
          if (guestTickers.length === 0) { if (active) setWatchlist([]); return; }
          url = `/api/watchlist?full=true&tickers=${guestTickers.join(',')}`;
        }
        const res = await fetch(url);
        const d = await res.json();
        if (active) setWatchlist((d.tickers || []).slice(0, WATCHLIST_PREVIEW_LIMIT));
      } catch {
        if (active) setWatchlist([]);
      }
    };
    load();
    return () => { active = false; };
  }, [isLoaded, isSignedIn]);

  const [markets, setMarkets] = useState(null);
  useEffect(() => {
    let active = true;
    fetch('/api/market').then(r => r.json()).then(d => {
      if (active) setMarkets((d.markets || []).slice(0, MARKET_PREVIEW_LIMIT));
    }).catch(() => { if (active) setMarkets([]); });
    return () => { active = false; };
  }, []);

  const [earnings, setEarnings] = useState(null);
  useEffect(() => {
    let active = true;
    const today = new Date();
    const from = toDateStr(today);
    const to = toDateStr(new Date(today.getTime() + EARNINGS_RANGE_DAYS * 86400000));
    fetch(`/api/earnings?from=${from}&to=${to}`).then(r => r.json()).then(d => {
      if (!active) return;
      const sorted = [...(d.earnings || [])].sort((a, b) => a.date.localeCompare(b.date));
      setEarnings(sorted.slice(0, EARNINGS_PREVIEW_LIMIT));
    }).catch(() => { if (active) setEarnings([]); });
    return () => { active = false; };
  }, []);

  const [movers, setMovers] = useState(null);
  useEffect(() => {
    let active = true;
    fetch('/api/movers').then(r => r.json()).then(d => {
      if (active) setMovers((d.bigCapMovers || []).slice(0, MOVERS_PREVIEW_LIMIT));
    }).catch(() => { if (active) setMovers([]); });
    return () => { active = false; };
  }, []);

  const [news, setNews] = useState(null);
  useEffect(() => {
    let active = true;
    fetch('/api/filings').then(r => r.json()).then(d => {
      if (active) setNews((d.filings || []).slice(0, NEWS_PREVIEW_LIMIT));
    }).catch(() => { if (active) setNews([]); });
    return () => { active = false; };
  }, []);

  const [learnPosts, setLearnPosts] = useState(null);
  useEffect(() => {
    let active = true;
    fetch('/api/blog').then(r => r.json()).then(d => {
      if (active) setLearnPosts((d.posts || []).slice(0, LEARN_PREVIEW_LIMIT));
    }).catch(() => { if (active) setLearnPosts([]); });
    return () => { active = false; };
  }, []);

  return (
    <div style={{ width: '100%', minHeight: '100vh', boxSizing: 'border-box', background: C.bg, color: C.ink, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 'min(1680px, 94vw)', margin: '0 auto', padding: '32px 24px 96px', display: 'flex', flexDirection: 'column', gap: '40px', boxSizing: 'border-box' }}>

        <NewNav active="inicio" />

        <div>
          <h1 style={{ margin: '0 0 10px', fontSize: '34px', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.15 }}>¿Qué quieres saber hoy?</h1>
          <p style={{ margin: 0, fontSize: '15px', color: C.text2, maxWidth: '520px', lineHeight: 1.55 }}>
            Te han hablado de una acción, quieres ver cómo te va o aprender algo nuevo. Empieza por aquí.
          </p>
        </div>

        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '28px', display: 'flex', flexDirection: 'column', gap: '16px', boxSizing: 'border-box', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <span style={{ fontSize: '15px', fontWeight: 700 }}>Comprueba un consejo</span>
          </div>
          <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <label className="sr-only" htmlFor="ticker-check" style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>Nombre de la empresa o ticker</label>
            <input
              id="ticker-check"
              type="text"
              value={query}
              onChange={e => { setQuery(e.target.value); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              autoComplete="off"
              placeholder="Ej: Tesla, PLTR, un ETF..."
              style={{ flex: '1 1 260px', height: '48px', borderRadius: '12px', border: `1px solid ${C.border}`, padding: '0 16px', fontSize: '14px', fontFamily: 'inherit', background: '#FDFBF6', boxSizing: 'border-box', color: C.ink }}
            />
            <button type="submit" style={{ height: '48px', padding: '0 24px', borderRadius: '12px', border: 'none', background: C.lime, color: C.ink, fontWeight: 700, fontSize: '14px', fontFamily: 'inherit', cursor: 'pointer' }}>
              Comprobar
            </button>
          </form>
          {showSuggestions && query.trim() && suggestions.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: '28px', right: '28px', zIndex: 20, marginTop: '4px',
              border: `1px solid ${C.border}`, borderRadius: '12px', overflow: 'hidden', background: C.surface,
              boxShadow: '0 12px 30px rgba(28,27,24,0.12)',
            }}>
              {suggestions.map(s => (
                <button key={s.ticker} onClick={() => goToTicker(s.ticker)} type="button" style={{
                  display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 14px',
                  border: 'none', borderBottom: `1px solid ${C.borderSoft}`, background: 'transparent',
                  cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                }}>
                  <StockLogo ticker={s.ticker} name={s.name} size={24} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: C.ink }}>
                      {s.name} <span style={{ color: C.text2, fontWeight: 600 }}>· {s.ticker}</span>
                    </div>
                    {s.sector && <div style={{ fontSize: '11px', color: C.text3 }}>{s.sector}</div>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '14px' }}>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>Lo que sigues</h2>
            <Link href="/new/watchlist" style={{ fontSize: '13px', color: C.text2, textDecoration: 'none', fontWeight: 700 }}>Ver todo →</Link>
          </div>
          {watchlist === null ? (
            <div style={{ fontSize: '13px', color: C.text3 }}>Cargando…</div>
          ) : watchlist.length === 0 ? (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '16px', padding: '20px', fontSize: '13px', color: C.text2 }}>
              Aún no sigues ninguna empresa — prueba a comprobar un consejo arriba.
            </div>
          ) : (
            <div className="new-card-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '14px' }}>
              {watchlist.map(item => <WatchlistCard key={item.ticker} item={item} />)}
            </div>
          )}
        </div>

        <div className="new-dash-2col" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '14px' }}>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '22px 24px', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '6px' }}>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>Próximos resultados</h2>
              <Link href="/new/calendar" style={{ fontSize: '13px', color: C.text2, textDecoration: 'none', fontWeight: 700 }}>Ver todo →</Link>
            </div>
            {earnings === null ? (
              <div style={{ fontSize: '13px', color: C.text3 }}>Cargando…</div>
            ) : earnings.length === 0 ? (
              <div style={{ fontSize: '13px', color: C.text2, padding: '10px 0' }}>No hay resultados próximos en los próximos días.</div>
            ) : (
              <div>
                {earnings.map(e => (
                  <Link key={`${e.ticker}-${e.date}`} href={`/new/stock/${e.ticker}`} style={{
                    display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0',
                    textDecoration: 'none', color: 'inherit', borderBottom: `1px solid ${C.borderSoft}`,
                  }}>
                    <StockLogo ticker={e.ticker} name={e.name} size={32} />
                    <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name || e.ticker}</div>
                      <div style={{ fontSize: '11px', color: C.text2 }}>{e.ticker}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: '12px', fontWeight: 700 }}>{shortDateLabel(e.date)}</div>
                      <div style={{ fontSize: '11px', color: C.text2 }}>{timingLabelShort(e.hour)}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '22px 24px', boxSizing: 'border-box' }}>
            <h2 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 800 }}>Movimientos de hoy</h2>
            {movers === null ? (
              <div style={{ fontSize: '13px', color: C.text3 }}>Cargando…</div>
            ) : movers.length === 0 ? (
              <div style={{ fontSize: '13px', color: C.text2, padding: '10px 0' }}>Sin datos de mercado recientes.</div>
            ) : (
              <div>
                {movers.map(m => {
                  const up = m.priceChangePct >= 0;
                  const color = up ? C.green : C.red;
                  return (
                    <Link key={m.ticker} href={`/new/stock/${m.ticker}`} style={{
                      display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0',
                      textDecoration: 'none', color: 'inherit', borderBottom: `1px solid ${C.borderSoft}`,
                    }}>
                      <StockLogo ticker={m.ticker} name={m.name} size={32} />
                      <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name || m.ticker}</div>
                        <div style={{ fontSize: '11px', color: C.text2 }}>{m.ticker}</div>
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color, flexShrink: 0 }}>
                        {up ? '+' : ''}{m.priceChangePct.toFixed(2)}%
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {markets && markets.length > 0 && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '22px 24px', boxSizing: 'border-box' }}>
            <h2 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 800 }}>El mercado hoy</h2>
            <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
              {markets.map(m => {
                const up = m.changePct != null && m.changePct >= 0;
                const color = m.changePct == null ? C.text2 : up ? C.green : C.red;
                return (
                  <div key={m.symbol} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {m.changePct != null && (
                      up ? (
                        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 17 9 11 13 15 21 7"></polyline><polyline points="14 7 21 7 21 14"></polyline></svg>
                      ) : (
                        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.red} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 7 9 13 13 9 21 17"></polyline><polyline points="14 17 21 17 21 10"></polyline></svg>
                      )
                    )}
                    <div>
                      <div style={{ fontSize: '13px', color: C.text2 }}>{m.label}</div>
                      <div style={{ fontSize: '15px', fontWeight: 700, color }}>
                        {m.changePct != null ? `${m.changePct >= 0 ? '+' : ''}${m.changePct.toFixed(1)}%` : 'N/D'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {news && news.length > 0 && (
          <div>
            <h2 style={{ margin: '0 0 14px', fontSize: '18px', fontWeight: 800 }}>Últimas noticias</h2>
            <div className="new-card-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '14px' }}>
              {news.map(n => (
                <a key={n.id} href={n.url} target="_blank" rel="noopener noreferrer" style={{
                  textDecoration: 'none', color: 'inherit', background: C.surface, border: `1px solid ${C.border}`,
                  borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
                }}>
                  {n.image && (
                    <img src={n.image} alt="" style={{ width: '100%', height: '140px', objectFit: 'cover', display: 'block' }}
                      onError={e => { e.currentTarget.style.display = 'none'; }} />
                  )}
                  <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                      {n.title}
                    </div>
                    <div style={{ fontSize: '11px', color: C.text3 }}>{n.source} · {esRelativeTime(n.time)}</div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {learnPosts && learnPosts.length > 0 && (
          <div>
            <h2 style={{ margin: '0 0 14px', fontSize: '18px', fontWeight: 800 }}>Aprende algo nuevo</h2>
            <div className="new-card-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '14px' }}>
              {learnPosts.map(post => (
                <Link key={post.slug} href={`/new/aprende/${post.slug}`} style={{
                  textDecoration: 'none', color: 'inherit', background: C.surface, border: `1px solid ${C.border}`,
                  borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px', boxSizing: 'border-box',
                }}>
                  {LEARN_FALLBACK_ICON}
                  <div style={{ fontSize: '14px', fontWeight: 700 }}>{post.title}</div>
                  <div style={{ fontSize: '12px', color: C.text2, lineHeight: 1.55, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {post.description}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
