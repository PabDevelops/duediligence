'use client';
import { use, Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import NewNav from '../../../components/new/NewNav';
import StockLogo from '../../../components/workspace/StockLogo';
import StockChart from '../../../components/StockChart';
import { useUser } from '../../../components/AuthProvider';
import { useStockData } from '../../../../lib/hooks/useStockData';
import { isInGuestWatchlist, addToGuestWatchlist, removeFromGuestWatchlist } from '../../../../lib/guestWatchlist';
import { computeEasyMode } from '../../../../lib/stockScoring';
import { stockVerdict } from '../../../../lib/verdict';
import { formatCurrency } from '../../../../lib/formatters';
import { NEW_COLORS as C, VERDICT_BADGE } from '../../../components/new/theme';

const hasFundamentals = (d) => d.revVal != null || d.niVal != null || d.marketCap != null
  || d.roic != null || d.grossMargin != null || (d.revHistory?.length ?? 0) > 0;

// StockChart reads its colors from --ws-* CSS custom properties (so it can follow whichever
// theme it's rendered inside) instead of hardcoding a palette — this wrapper feeds it the
// cream/lime palette so the real chart (with real data) drops in without forking it.
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
      <div style={{ maxWidth: '880px', margin: '0 auto', padding: '32px 24px 96px', display: 'flex', flexDirection: 'column', gap: '28px', boxSizing: 'border-box' }}>
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
  const { isSignedIn, isLoaded } = useUser();
  const { data, error, loading } = useStockData(ticker);

  const [following, setFollowing] = useState(false);
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
        <Link href="/new" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: C.text2, textDecoration: 'none', width: 'fit-content' }}>
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
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '26px', flexWrap: 'wrap' }}>
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

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', boxSizing: 'border-box', overflow: 'hidden', ...CHART_THEME_VARS }}>
        <StockChart ticker={ticker} currency={data.currency} height={280} />
      </div>

      <Link href={`/new/stock/${ticker}/numbers`} style={{
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
