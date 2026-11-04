'use client';
import { use, Suspense, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import NewNav from '../../../components/new/NewNav';
import StockLogo from '../../../components/workspace/StockLogo';
import StockChart from '../../../components/StockChart';
import { useUser } from '../../../components/AuthProvider';
import { useStockData } from '../../../../lib/hooks/useStockData';
import { useEntryPriceProjection } from '../../../../lib/hooks/useEntryPriceProjection';
import { isInGuestWatchlist, addToGuestWatchlist, removeFromGuestWatchlist } from '../../../../lib/guestWatchlist';
import { computeEasyMode } from '../../../../lib/stockScoring';
import { stockVerdict, investigateQuestions } from '../../../../lib/verdict';
import { formatCurrency, formatTimeAgo } from '../../../../lib/formatters';
import { NEW_COLORS as C, VERDICT_BADGE } from '../../../components/new/theme';

const hasFundamentals = (d) => d.revVal != null || d.niVal != null || d.marketCap != null
  || d.roic != null || d.grossMargin != null || (d.revHistory?.length ?? 0) > 0;

// SEC Form 4 transaction codes — P/S are genuine open-market trades, everything else
// (grants, exercises, tax withholding, gifts...) moves shares for administrative reasons,
// not a real buy/sell signal.
const TXN_CODE_LABELS = {
  P: 'COMPRA', S: 'VENTA', A: 'CONCESIÓN', M: 'EJERCICIO', F: 'RETENCIÓN FISCAL', G: 'REGALO', C: 'CONVERSIÓN',
};

// Same 0-5 scale and >=4/>=3 breakpoints the Numbers page's stats and the quality-note
// pillars already color with — kept in sync so a stat means the same thing everywhere it
// shows up, not a second invented scale.
const scoreColor = (s) => s == null ? C.ink : s >= 4 ? C.green : s >= 3 ? C.ink : C.red;

const EARNINGS_HOUR_LABELS = { bmo: 'antes de la apertura', amc: 'después del cierre', dmh: 'durante el mercado' };

const formatEarningsDate = (dateStr) => {
  const d = new Date(`${dateStr}T00:00:00`);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', ...(sameYear ? {} : { year: 'numeric' }) });
};

// StockChart reads its colors from --ws-* CSS custom properties (so it can follow whichever
// theme it's rendered inside) instead of hardcoding a palette — this wrapper feeds it the
// cream/lime palette so the real chart (with real data) drops in without forking it.
const CHART_RANGES = [
  { value: '1d', label: '1D' },
  { value: '1w', label: '1S' },
  { value: '1m', label: '1M' },
  { value: '3m', label: '3M' },
  { value: '1y', label: '1A' },
  { value: 'max', label: 'Todo' },
];

const CHART_THEME_VARS = {
  '--ws-bg-1': C.surface,
  '--ws-bg-2': C.bg,
  '--ws-accent': C.lime,
  '--ws-text-3': C.text3,
  '--ws-border': C.border,
  '--ws-red': C.red,
};

function Shell({ children }) {
  return (
    <div style={{ width: '100%', minHeight: '100vh', boxSizing: 'border-box', background: C.bg, color: C.ink, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 'min(1200px, 92vw)', margin: '0 auto', padding: '32px 24px 96px', display: 'flex', flexDirection: 'column', gap: '28px', boxSizing: 'border-box' }}>
        <NewNav active="inicio" />
        {children}
      </div>
    </div>
  );
}

export default function NewStockPage({ params }) {
  return (
    <Suspense fallback={null}>
      <NewStockPageContent params={params} />
    </Suspense>
  );
}

function NewStockPageContent({ params }) {
  const { ticker: rawTicker } = use(params);
  const ticker = rawTicker.toUpperCase();
  const router = useRouter();
  const { isSignedIn, isLoaded } = useUser();
  const { data, error, loading, refreshing, refetch } = useStockData(ticker);

  const [following, setFollowing] = useState(false);
  const [followError, setFollowError] = useState('');
  const [chartRange, setChartRange] = useState('1m');
  const [insiderTrades, setInsiderTrades] = useState(null);
  const [showAllInsiders, setShowAllInsiders] = useState(false);
  const [news, setNews] = useState(null);
  const [nextEarnings, setNextEarnings] = useState(null);

  // /api/stock only knows a ticker is a fund once /api/etfs has processed it at least once
  // (that flag lives on the same stock_cache row) — a ticker nobody has ever opened via
  // /etfs before comes back here looking like a stock with every fundamental blank. If this
  // one's already flagged, bounce immediately; if it just has no fundamentals at all (the
  // same shape a never-seen ETF has), probe /api/etfs in the background — a real thin stock
  // just errors out of that probe and this page renders normally, but a fund gets seeded
  // and this redirects to its real page instead of showing a wall of "N/D".
  useEffect(() => {
    if (!data) return;
    if (data.isEtf) { router.replace(`/etfs/${ticker}`); return; }
    if (hasFundamentals(data)) return;
    let active = true;
    fetch('/api/etfs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ticker }) })
      .then(r => r.json())
      .then(d => { if (active && !d.error) router.replace(`/etfs/${ticker}`); })
      .catch(() => {});
    return () => { active = false; };
  }, [data, ticker, router]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { setFollowing(isInGuestWatchlist(ticker)); return; }
    let active = true;
    fetch('/api/watchlist').then(r => r.json()).then(d => {
      if (active) setFollowing((d.tickers || []).some(t => t.ticker === ticker));
    }).catch(() => {});
    return () => { active = false; };
  }, [isLoaded, isSignedIn, ticker]);

  useEffect(() => {
    let active = true;
    setShowAllInsiders(false);
    fetch(`/api/insider-trades?ticker=${ticker}&limit=20`).then(r => r.json()).then(d => {
      if (active) setInsiderTrades(d.transactions || []);
    }).catch(() => { if (active) setInsiderTrades([]); });
    return () => { active = false; };
  }, [ticker]);

  useEffect(() => {
    let active = true;
    fetch(`/api/company-news?ticker=${ticker}&limit=5`).then(r => r.json()).then(d => {
      if (active) setNews(d.articles || []);
    }).catch(() => { if (active) setNews([]); });
    return () => { active = false; };
  }, [ticker]);

  useEffect(() => {
    let active = true;
    setNextEarnings(null);
    fetch(`/api/earnings?ticker=${ticker}`).then(r => r.json()).then(d => {
      if (!active) return;
      const todayStr = new Date().toISOString().slice(0, 10);
      const upcoming = (d.earnings || [])
        .filter(e => e.date >= todayStr)
        .sort((a, b) => a.date.localeCompare(b.date));
      setNextEarnings(upcoming[0] || null);
    }).catch(() => { if (active) setNextEarnings(null); });
    return () => { active = false; };
  }, [ticker]);

  const toggleFollow = async () => {
    const next = !following;
    setFollowing(next);
    setFollowError('');
    if (!isSignedIn) {
      if (next) addToGuestWatchlist(ticker); else removeFromGuestWatchlist(ticker);
      return;
    }
    const res = next
      ? await fetch('/api/watchlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ticker }) })
      : await fetch('/api/watchlist', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ticker }) });
    // The optimistic toggle above is wrong if the request actually failed — revert so the
    // button reflects what's really saved instead of silently drifting from it.
    if (!res.ok) {
      setFollowing(!next);
      const body = await res.json().catch(() => ({}));
      if (body.error) setFollowError(body.error);
    }
  };

  // Five-dimension analysis and 5-year fundamental scenarios (lib/engine). Called ahead of the
  // loading/error early returns below, since it's a hook, and it tolerates `data` being null.
  const entryProjection = useEntryPriceProjection({ ticker, data });

  if (loading) {
    return <Shell><div style={{ fontSize: '13px', color: C.text3 }}>Cargando…</div></Shell>;
  }
  if (error || !data) {
    return (
      <Shell>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '28px', textAlign: 'center', fontSize: '13px', color: C.text2 }}>
          No encontramos {ticker} — comprueba el ticker e inténtalo de nuevo.
        </div>
      </Shell>
    );
  }

  const price = data.currentPrice;
  const sym = data.currency === 'EUR' ? '€' : data.currency === 'GBP' ? '£' : '$';
  const easyMode = computeEasyMode(data, hasFundamentals(data));
  const companyName = (data.name || ticker).split(' ')[0];
  const verdict = easyMode ? stockVerdict(easyMode, companyName) : null;
  const badge = verdict ? VERDICT_BADGE[verdict.tier] : null;
  const investigateQs = easyMode ? investigateQuestions(easyMode) : [];
  // The headline number next to the price — now the V2 engine's own quality score (lib/engine),
  // not computeEasyMode's score100, so it agrees with the "Calidad" figure on /analisis instead
  // of showing two different numbers for "quality" on the same ticker. verdict/investigateQs
  // below still read computeEasyMode: that card's text (ROIC commentary, "qué investigar")
  // isn't part of this swap. Hidden rather than falling back to the old score when the engine
  // can't compute one — showing a number from a different scale would be its own confusion.
  const qualityScore = entryProjection.engine?.quality?.score ?? null;

  return (
    <Shell>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <Link href="/home" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: C.text2, textDecoration: 'none', width: 'fit-content' }}>
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
          Volver
        </Link>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
          <button type="button" onClick={toggleFollow} style={{
            height: '36px', padding: '0 16px', borderRadius: '12px', fontWeight: 700, fontSize: '12px', fontFamily: 'inherit', cursor: 'pointer',
            border: following ? 'none' : `1px solid ${C.ink}`, background: following ? C.lime : 'transparent', color: C.ink,
          }}>
            {following ? '✓ Siguiendo' : '+ Seguir'}
          </button>
          {followError && <div style={{ fontSize: '11px', color: C.red, maxWidth: '220px', textAlign: 'right' }}>{followError}</div>}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
          <StockLogo ticker={ticker} name={data.name} size={52} />
          <div style={{ minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, letterSpacing: '-0.02em' }}>{data.name || ticker}</h1>
            <div style={{ fontSize: '13px', color: C.text2, fontWeight: 600 }}>{ticker}{data.exchange ? ` · ${data.exchange}` : ''}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '26px', flexWrap: 'wrap', flex: '1 1 240px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '26px', fontWeight: 800 }}>{price != null ? formatCurrency(price, sym) : 'N/D'}</div>
            {data.priceChangePct != null && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px', fontSize: '13px', fontWeight: 700, color: data.priceChangePct >= 0 ? C.green : C.red }}>
                {data.priceChangePct >= 0 ? '+' : ''}{data.priceChangePct.toFixed(2)}% hoy
              </div>
            )}
          </div>
          {qualityScore != null && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: C.text3, letterSpacing: '0.02em', marginBottom: '6px' }}>NOTA DE CALIDAD</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                <div aria-hidden="true" style={{ width: '52px', height: '8px', borderRadius: '20px', background: C.borderSoft, overflow: 'hidden' }}>
                  <div style={{ width: `${qualityScore}%`, height: '100%', borderRadius: '20px', background: C.lime }} />
                </div>
                <span style={{ fontSize: '16px', fontWeight: 800 }}>{qualityScore}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {nextEarnings && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: C.text2, background: C.surface, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '10px 16px', width: 'fit-content', boxSizing: 'border-box' }}>
          <span aria-hidden="true">📅</span>
          Próxima presentación de resultados: <strong style={{ color: C.ink, fontWeight: 700 }}>{formatEarningsDate(nextEarnings.date)}</strong>
          {EARNINGS_HOUR_LABELS[nextEarnings.hour] ? ` (${EARNINGS_HOUR_LABELS[nextEarnings.hour]})` : ''}
        </div>
      )}

      {verdict && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '26px', display: 'flex', flexDirection: 'column', gap: '18px', boxSizing: 'border-box' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '7px 16px', borderRadius: '20px', background: badge.bg, width: 'fit-content' }}>
            <span aria-hidden="true" style={{ width: '8px', height: '8px', borderRadius: '50%', background: badge.dot }} />
            <span style={{ fontSize: '13px', fontWeight: 800, color: badge.text }}>{verdict.label}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '14px', lineHeight: 1.6, color: '#45413A' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: C.text3, letterSpacing: '0.02em', marginBottom: '5px' }}>CALIDAD DEL NEGOCIO</div>
              {verdict.dimensions.quality}
            </div>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: C.text3, letterSpacing: '0.02em', marginBottom: '5px' }}>VALORACIÓN</div>
              {verdict.dimensions.valuation}
            </div>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: C.text3, letterSpacing: '0.02em', marginBottom: '5px' }}>RIESGOS</div>
              {verdict.dimensions.risks}
            </div>
          </div>
          <div style={{ fontSize: '12px', color: C.text3, paddingTop: '10px', borderTop: `1px solid ${C.borderSoft}` }}>
            Esto no es consejo de inversión, es un punto de partida — investiga más antes de decidir.
          </div>
        </div>
      )}

      {investigateQs.length > 0 && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '22px 26px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ fontSize: '15px', fontWeight: 800 }}>Qué deberías investigar ahora</div>
          <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', lineHeight: 1.5, color: '#45413A' }}>
            {investigateQs.map((q, i) => <li key={i}>{q}</li>)}
          </ul>
        </div>
      )}

      {/* Four numbers, one plain-language badge, nothing else — the full five-dimension
          breakdown (lib/engine) lives on /analisis instead. A beginner deciding "is this worth
          digging into" shouldn't have to wade through WACC/EV-EBITDA/discount rates to get
          there; someone who wants that depth can tap through for it. */}
      {entryProjection.maxEntryPrice != null && entryProjection.cagr5y != null && price != null && (() => {
        const mos = entryProjection.marginOfSafety;
        const tier = mos == null ? 'caution' : mos >= 0.10 ? 'good' : mos >= -0.10 ? 'caution' : 'bad';
        const priceBadge = VERDICT_BADGE[tier];
        const priceLabel = tier === 'good' ? 'Con margen de seguridad' : tier === 'caution' ? 'En su precio justo' : 'Por encima de lo recomendado';
        return (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '22px 26px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: C.text3, letterSpacing: '0.02em' }}>
              A 5 AÑOS VISTA (estimación fundamental, no una promesa)
            </div>

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '7px 16px', borderRadius: '20px', background: priceBadge.bg, width: 'fit-content' }}>
              <span aria-hidden="true" style={{ width: '8px', height: '8px', borderRadius: '50%', background: priceBadge.dot }} />
              <span style={{ fontSize: '13px', fontWeight: 800, color: priceBadge.text }}>{priceLabel}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '18px' }}>
              <div>
                <div style={{ fontSize: '12px', color: C.text2, marginBottom: '4px' }}>Precio actual</div>
                <div style={{ fontSize: '20px', fontWeight: 800 }}>{formatCurrency(price, sym)}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: C.text2, marginBottom: '4px' }}>Precio máximo de entrada</div>
                <div style={{ fontSize: '20px', fontWeight: 800 }}>{formatCurrency(entryProjection.maxEntryPrice, sym)}</div>
                <div style={{ fontSize: '11px', color: C.text3, marginTop: '2px' }}>para exigir un 15%/año</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: C.text2, marginBottom: '4px' }}>Margen de seguridad</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: mos == null ? C.ink : mos >= 0 ? C.green : C.red }}>
                  {mos == null ? 'N/D' : `${mos >= 0 ? '+' : ''}${(mos * 100).toFixed(0)}%`}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: C.text2, marginBottom: '4px' }}>Rentabilidad anual esperada</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: entryProjection.cagr5y >= 0 ? C.green : C.red }}>
                  {entryProjection.cagr5y >= 0 ? '+' : ''}{(entryProjection.cagr5y * 100).toFixed(1)}%
                </div>
                <div style={{ fontSize: '11px', color: C.text3, marginTop: '2px' }}>al año, en los próximos 5 años</div>
              </div>
            </div>

            <Link href={`/stock/${ticker}/analisis`} style={{ fontSize: '12px', fontWeight: 700, color: C.ink, textDecoration: 'none', width: 'fit-content' }}>
              Investigar a fondo →
            </Link>
          </div>
        );
      })()}

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', boxSizing: 'border-box', overflow: 'hidden', ...CHART_THEME_VARS }}>
        {/* The chart's own built-in range/mode selector (1D-MAX + LINE/CANDLES, 9 buttons in
            one unwrapped row) overflows on a phone-width screen — verified: the CANDLES
            button gets squeezed off entirely below ~400px. isMultichart suppresses that
            internal row; this one is a handful of options that always fit on one line. */}
        <div style={{ display: 'flex', gap: '6px', padding: '16px 16px 0' }}>
          {CHART_RANGES.map(r => (
            <button key={r.value} type="button" onClick={() => setChartRange(r.value)} style={{
              height: '28px', padding: '0 12px', borderRadius: '20px', border: 'none', cursor: 'pointer',
              fontSize: '11px', fontWeight: 700, fontFamily: 'inherit',
              background: chartRange === r.value ? C.ink : C.bg,
              color: chartRange === r.value ? '#FFFFFF' : C.text2,
            }}>
              {r.label}
            </button>
          ))}
        </div>
        <StockChart ticker={ticker} currency={data.currency} height={280} range={chartRange} isMultichart />
      </div>

      {(() => {
        const keyStats = [
          // A negative P/E (net loss) isn't "cheap" — it's not a multiple at all, so it's
          // omitted here the same way any other unavailable stat is, instead of showing a
          // confusing signed number with no color to explain it. Same threshold as Numbers.
          { label: 'P/E', value: data.pe != null && data.pe > 0 && data.pe <= 300 ? data.pe.toFixed(1) : null },
          { label: 'Capitalización', value: data.marketCap != null ? formatCurrency(data.marketCap, sym) : null },
          { label: 'Ingresos (interanual)', value: data.revGrowth != null ? `${data.revGrowth > 0 ? '+' : ''}${data.revGrowth.toFixed(1)}%` : null, color: scoreColor(easyMode?.revGrowthScore) },
          { label: 'ROIC', value: data.roic != null ? `${data.roic.toFixed(1)}%` : null, color: scoreColor(easyMode?.roicScore) },
        ].filter(s => s.value != null);
        // The "ver más" link to Numbers lives here now (no more separate card for it) — so
        // even a ticker with none of these four stats available still gets a way to reach the
        // full breakdown, just without the grid above the footer.
        return (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '22px 26px', boxSizing: 'border-box' }}>
            {keyStats.length > 0 && (
              <>
                <div style={{ fontSize: '11px', fontWeight: 700, color: C.text3, letterSpacing: '0.02em', marginBottom: '14px' }}>LO ESENCIAL</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '18px' }}>
                  {keyStats.map(s => (
                    <div key={s.label}>
                      <div style={{ fontSize: '12px', color: C.text2, marginBottom: '4px' }}>{s.label}</div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: s.color ?? C.ink }}>{s.value}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap',
              marginTop: keyStats.length > 0 ? '14px' : 0, paddingTop: keyStats.length > 0 ? '12px' : 0,
              borderTop: keyStats.length > 0 ? `1px solid ${C.borderSoft}` : 'none',
            }}>
              {keyStats.length > 0 ? (
                <div style={{ fontSize: '11px', color: C.text3 }}>
                  En <span style={{ color: C.green, fontWeight: 700 }}>verde</span> lo que va bien, en <span style={{ color: C.red, fontWeight: 700 }}>rojo</span> lo que conviene vigilar.
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 800, marginBottom: '4px' }}>Ver números</div>
                  <div style={{ fontSize: '12px', color: C.text2 }}>Valoración, crecimiento, rentabilidad y salud financiera — todas las estadísticas.</div>
                </div>
              )}
              <Link href={`/stock/${ticker}/numbers`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 700, color: C.ink, textDecoration: 'none', flexShrink: 0 }}>
                Ver más
                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 6 15 12 9 18"></polyline></svg>
              </Link>
            </div>
          </div>
        );
      })()}

      {data.description && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '26px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 800 }}>¿A qué se dedica {companyName}?</h2>
          <p style={{ margin: 0, fontSize: '13px', color: '#45413A', lineHeight: 1.6 }}>{data.description}</p>
        </div>
      )}

      {news && news.length > 0 && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '22px 26px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 800 }}>Noticias recientes</h2>
            <div style={{ fontSize: '12px', color: C.text2 }}>Últimos 30 días, de más a menos reciente — no es una selección por relevancia, solo por fecha.</div>
          </div>
          <div>
            {news.map((a, i) => (
              <a
                key={i}
                href={a.url || undefined}
                target={a.url ? '_blank' : undefined}
                rel={a.url ? 'noopener noreferrer' : undefined}
                style={{
                  display: 'block', padding: '10px 0', borderTop: i > 0 ? `1px solid ${C.borderSoft}` : 'none',
                  textDecoration: 'none', color: 'inherit', cursor: a.url ? 'pointer' : 'default',
                }}>
                <div style={{ fontSize: '13px', fontWeight: 700, lineHeight: 1.4, marginBottom: '4px' }}>{a.headline}</div>
                <div style={{ fontSize: '11px', color: C.text3 }}>
                  {a.source}{a.source && ' · '}{formatTimeAgo(a.publishedAt)}
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {insiderTrades && insiderTrades.length > 0 && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '22px 26px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 800 }}>Actividad de insiders</h2>
            <div style={{ fontSize: '12px', color: C.text2 }}>Últimos movimientos declarados por directivos y consejeros de {companyName} (SEC Form 4).</div>
          </div>
          <div>
            {(showAllInsiders ? insiderTrades : insiderTrades.slice(0, 5)).map((t, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px',
                padding: '10px 0', borderTop: i > 0 ? `1px solid ${C.borderSoft}` : 'none',
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.insider}</div>
                  <div style={{ fontSize: '11px', color: C.text3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.role ? `${t.role} · ` : ''}{t.date}
                  </div>
                </div>
                <div style={{ fontSize: '12px', fontWeight: 800, color: t.isOpenMarket ? (t.type === 'BUY' ? C.green : C.red) : C.text3, flexShrink: 0, textAlign: 'right' }}>
                  {t.type === 'BUY' ? '▲' : '▼'} {TXN_CODE_LABELS[t.code] || t.type} · {t.shares >= 1000 ? `${Math.round(t.shares / 1000)}K` : t.shares} acciones
                </div>
              </div>
            ))}
          </div>
          {insiderTrades.length > 5 && (
            <button
              type="button"
              onClick={() => setShowAllInsiders(v => !v)}
              style={{
                alignSelf: 'flex-start', background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                fontSize: '12px', fontWeight: 700, color: C.ink, fontFamily: 'inherit',
              }}>
              {showAllInsiders ? 'Ver menos' : `Ver ${insiderTrades.length - 5} más`}
            </button>
          )}
        </div>
      )}

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '22px 26px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ fontSize: '13px', fontWeight: 800 }}>Cómo se ha calculado todo esto</div>
        <div style={{ fontSize: '12px', color: C.text2, lineHeight: 1.6 }}>
          {data.updatedAt && <>Datos financieros actualizados {formatTimeAgo(data.updatedAt)}. </>}
          La proyección a 5 años se construye desde el negocio: ingresos, márgenes, impuestos,
          reinversión, deuda neta y número de acciones. No usa la evolución pasada de la cotización
          ni los objetivos de los analistas para proyectar. Los tres escenarios (conservador,
          central y optimista) no llevan probabilidades. Nunca se inventan cifras: cuando un dato
          no está disponible para esta empresa, se muestra como N/D y se explica por qué.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <Link href={`/stock/${ticker}/analisis`} style={{ fontSize: '12px', fontWeight: 700, color: C.ink, textDecoration: 'none', width: 'fit-content' }}>
            Ver el análisis completo (calidad, valoración, riesgo) →
          </Link>
          <Link href={`/stock/${ticker}/numbers`} style={{ fontSize: '12px', fontWeight: 700, color: C.ink, textDecoration: 'none', width: 'fit-content' }}>
            Ver qué datos faltan y sus límites →
          </Link>
        </div>
      </div>

      <button type="button" onClick={refetch} disabled={refreshing} style={{
        padding: '12px', borderRadius: '12px', border: `1px solid ${C.border}`, background: C.surface,
        color: C.text2, fontFamily: 'inherit', fontSize: '12px', fontWeight: 700,
        cursor: refreshing ? 'not-allowed' : 'pointer', opacity: refreshing ? 0.6 : 1,
      }}>
        {refreshing ? 'Actualizando…' : '↻ Actualizar datos'}
      </button>
    </Shell>
  );
}
