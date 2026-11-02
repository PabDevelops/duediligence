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
import { computeEasyMode, computeFundamentalGrowth } from '../../../../lib/stockScoring';
import { stockVerdict } from '../../../../lib/verdict';
import { formatCurrency } from '../../../../lib/formatters';
import { NEW_COLORS as C, VERDICT_BADGE } from '../../../components/new/theme';

const hasFundamentals = (d) => d.revVal != null || d.niVal != null || d.marketCap != null
  || d.roic != null || d.grossMargin != null || (d.revHistory?.length ?? 0) > 0;

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
  const { data, error, loading } = useStockData(ticker);

  const [following, setFollowing] = useState(false);
  const [chartRange, setChartRange] = useState('1m');

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

  const toggleFollow = async () => {
    const next = !following;
    setFollowing(next);
    if (!isSignedIn) {
      if (next) addToGuestWatchlist(ticker); else removeFromGuestWatchlist(ticker);
      return;
    }
    if (next) {
      await fetch('/api/watchlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ticker }) });
    } else {
      await fetch('/api/watchlist', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ticker }) });
    }
  };

  // Phil Town-style sticker price — reuses the same Monte Carlo projector /start and the
  // dark-theme stock page already use, fixed to a 5-year horizon. Called here, ahead of the
  // loading/error early returns below, since it's a hook — guarded with `data?.` since `data`
  // is still null on the first render(s).
  const entryProjection = useEntryPriceProjection({
    ticker, price: data?.currentPrice ?? null, beta: data?.beta ?? null,
    riskFreeRate: data?.riskFreeRate, analystTarget: data?.analystTarget,
    fundamentalGrowth: data ? computeFundamentalGrowth(data) : null,
  });

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

  return (
    <Shell>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <Link href="/home" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: C.text2, textDecoration: 'none', width: 'fit-content' }}>
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
          Volver
        </Link>
        <button type="button" onClick={toggleFollow} style={{
          height: '36px', padding: '0 16px', borderRadius: '12px', fontWeight: 700, fontSize: '12px', fontFamily: 'inherit', cursor: 'pointer',
          border: following ? 'none' : `1px solid ${C.ink}`, background: following ? C.lime : 'transparent', color: C.ink,
        }}>
          {following ? '✓ Siguiendo' : '+ Seguir'}
        </button>
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
          {easyMode && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: C.text3, letterSpacing: '0.02em', marginBottom: '6px' }}>NOTA DE CALIDAD</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                <div aria-hidden="true" style={{ width: '52px', height: '8px', borderRadius: '20px', background: C.borderSoft, overflow: 'hidden' }}>
                  <div style={{ width: `${easyMode.score100}%`, height: '100%', borderRadius: '20px', background: C.lime }} />
                </div>
                <span style={{ fontSize: '16px', fontWeight: 800 }}>{easyMode.score100}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {verdict && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '26px', display: 'flex', flexDirection: 'column', gap: '16px', boxSizing: 'border-box' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '7px 16px', borderRadius: '20px', background: badge.bg, width: 'fit-content' }}>
            <span aria-hidden="true" style={{ width: '8px', height: '8px', borderRadius: '50%', background: badge.dot }} />
            <span style={{ fontSize: '13px', fontWeight: 800, color: badge.text }}>{verdict.label}</span>
          </div>
          <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '9px', fontSize: '14px', lineHeight: 1.6, color: '#45413A' }}>
            {verdict.reasons.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
          <div style={{ fontSize: '12px', color: C.text3, paddingTop: '10px', borderTop: `1px solid ${C.borderSoft}` }}>
            Esto no es consejo de inversión, es un punto de partida — investiga más antes de decidir.
          </div>
        </div>
      )}

      {entryProjection.maxEntryPrice != null && price != null && (() => {
        // Margin of safety: how far today's price sits from the max you'd pay to still
        // demand a 15%/yr return — positive means price is below that ceiling (cheap),
        // negative means you're paying more than the model justifies (expensive). This is
        // the one number that actually answers "is it cheap or expensive right now", which
        // maxEntryPrice/cagr5y alone made a reader work out for themselves.
        const marginPct = ((entryProjection.maxEntryPrice - price) / price) * 100;
        const priceTier = marginPct >= 10 ? 'good' : marginPct >= -10 ? 'caution' : 'bad';
        const priceBadge = VERDICT_BADGE[priceTier];
        const priceLabel = priceTier === 'good' ? 'Con margen de seguridad' : priceTier === 'caution' ? 'En su precio justo' : 'Por encima de lo recomendado';
        return (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '22px 26px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: C.text3, letterSpacing: '0.02em' }}>
              A 5 AÑOS VISTA (proyección, no una promesa)
            </div>

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '7px 16px', borderRadius: '20px', background: priceBadge.bg, width: 'fit-content' }}>
              <span aria-hidden="true" style={{ width: '8px', height: '8px', borderRadius: '50%', background: priceBadge.dot }} />
              <span style={{ fontSize: '13px', fontWeight: 800, color: priceBadge.text }}>{priceLabel}</span>
            </div>

            <div style={{ fontSize: '13px', color: '#45413A', lineHeight: 1.6 }}>
              {marginPct >= 0
                ? `El precio de hoy está un ${marginPct.toFixed(0)}% por debajo de lo máximo que pagarías para exigir un 15%/año — hay margen de seguridad.`
                : `El precio de hoy está un ${Math.abs(marginPct).toFixed(0)}% por encima de lo máximo que pagarías para exigir un 15%/año — según este modelo, estarías pagando de más.`}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '18px', paddingTop: '4px', borderTop: `1px solid ${C.borderSoft}` }}>
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
                <div style={{ fontSize: '20px', fontWeight: 800, color: marginPct >= 0 ? C.green : C.red }}>
                  {marginPct >= 0 ? '+' : ''}{marginPct.toFixed(1)}%
                </div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: C.text2, marginBottom: '4px' }}>CAGR esperado</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: entryProjection.cagr5y >= 0 ? C.green : C.red }}>
                  {entryProjection.cagr5y >= 0 ? '+' : ''}{(entryProjection.cagr5y * 100).toFixed(1)}%
                </div>
                <div style={{ fontSize: '11px', color: C.text3, marginTop: '2px' }}>al precio actual</div>
              </div>
            </div>
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
          { label: 'P/E', value: data.pe != null ? data.pe.toFixed(1) : null },
          { label: 'Capitalización', value: data.marketCap != null ? formatCurrency(data.marketCap, sym) : null },
          { label: 'Ingresos (interanual)', value: data.revGrowth != null ? `${data.revGrowth > 0 ? '+' : ''}${data.revGrowth.toFixed(1)}%` : null },
          { label: 'ROIC', value: data.roic != null ? `${data.roic.toFixed(1)}%` : null },
        ].filter(s => s.value != null);
        if (keyStats.length === 0) return null;
        return (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '22px 26px', boxSizing: 'border-box' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: C.text3, letterSpacing: '0.02em', marginBottom: '14px' }}>LO ESENCIAL</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '18px' }}>
              {keyStats.map(s => (
                <div key={s.label}>
                  <div style={{ fontSize: '12px', color: C.text2, marginBottom: '4px' }}>{s.label}</div>
                  <div style={{ fontSize: '18px', fontWeight: 800 }}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      <Link href={`/stock/${ticker}/numbers`} style={{
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '22px 26px', boxSizing: 'border-box',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', textDecoration: 'none', color: 'inherit',
      }}>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 800, marginBottom: '4px' }}>Ver números</div>
          <div style={{ fontSize: '12px', color: C.text2 }}>Valoración, crecimiento, rentabilidad y salud financiera — todas las estadísticas.</div>
        </div>
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.text2} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><polyline points="9 6 15 12 9 18"></polyline></svg>
      </Link>

      {data.description && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '26px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 800 }}>¿A qué se dedica {companyName}?</h2>
          <p style={{ margin: 0, fontSize: '13px', color: '#45413A', lineHeight: 1.6 }}>{data.description}</p>
        </div>
      )}
    </Shell>
  );
}
