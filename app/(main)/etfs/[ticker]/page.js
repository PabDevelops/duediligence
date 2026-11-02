'use client';
import { use, Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import NewNav from '../../../components/new/NewNav';
import StockLogo from '../../../components/workspace/StockLogo';
import StockChart from '../../../components/StockChart';
import { useUser } from '../../../components/AuthProvider';
import { useStockData } from '../../../../lib/hooks/useStockData';
import { isInGuestWatchlist, addToGuestWatchlist, removeFromGuestWatchlist } from '../../../../lib/guestWatchlist';
import { computeETFQualityScore } from '../../../../lib/etfQuality';
import { formatCurrency } from '../../../../lib/formatters';
import { NEW_COLORS as C, VERDICT_BADGE } from '../../../components/new/theme';

const CHART_RANGES = [
  { value: '1d', label: '1D' },
  { value: '1w', label: '1S' },
  { value: '1m', label: '1M' },
  { value: 'max', label: 'Todo' },
];
const CHART_THEME_VARS = {
  '--ws-bg-1': C.surface, '--ws-bg-2': C.bg, '--ws-accent': C.lime,
  '--ws-text-3': C.text3, '--ws-border': C.border, '--ws-red': C.red,
};

function etfVerdict(composite) {
  if (composite == null) return null;
  if (composite >= 70) return { tier: 'good', label: 'Fondo sólido' };
  if (composite >= 40) return { tier: 'caution', label: 'Normalito' };
  return { tier: 'bad', label: 'Cuidado' };
}

function WeightBars({ title, items, emptyLabel, barColor }) {
  if (!items || items.length === 0) {
    return (
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '22px 26px', boxSizing: 'border-box' }}>
        <h2 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 800 }}>{title}</h2>
        <div style={{ fontSize: '12px', color: C.text3 }}>{emptyLabel}</div>
      </div>
    );
  }
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '22px 26px', boxSizing: 'border-box', minWidth: 0 }}>
      <h2 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 800 }}>{title}</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {items.map((item, i) => {
          const pct = parseFloat(item.weight) || 0;
          return (
            <div key={i}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700, marginBottom: '5px', gap: '8px' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                <span style={{ flexShrink: 0, color: C.text2 }}>{item.weight}</span>
              </div>
              <div style={{ height: '6px', background: C.borderSoft, borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: barColor, borderRadius: '4px' }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Shell({ children }) {
  return (
    <div style={{ width: '100%', minHeight: '100vh', boxSizing: 'border-box', background: C.bg, color: C.ink, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 'min(1200px, 92vw)', margin: '0 auto', padding: '32px 24px 96px', display: 'flex', flexDirection: 'column', gap: '28px', boxSizing: 'border-box' }}>
        <NewNav active="etfs" />
        {children}
      </div>
    </div>
  );
}

export default function NewEtfPage({ params }) {
  return (
    <Suspense fallback={null}>
      <NewEtfPageContent params={params} />
    </Suspense>
  );
}

function NewEtfPageContent({ params }) {
  const { ticker: rawTicker } = use(params);
  const ticker = rawTicker.toUpperCase();
  const { isSignedIn, isLoaded } = useUser();
  const { data: priceData } = useStockData(ticker);

  const [etf, setEtf] = useState(undefined); // undefined = loading, null = not found
  const [following, setFollowing] = useState(false);
  const [chartRange, setChartRange] = useState('1m');

  useEffect(() => {
    let active = true;
    setEtf(undefined);
    fetch('/api/etfs').then(r => r.json()).then(async (d) => {
      if (!active) return;
      const list = d.etfs || [];
      const found = list.find(e => e.ticker === ticker);
      if (found) { setEtf(found); return; }
      const res = await fetch('/api/etfs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ticker }) });
      const added = await res.json();
      if (!active) return;
      setEtf(added.error ? null : added);
    }).catch(() => { if (active) setEtf(null); });
    return () => { active = false; };
  }, [ticker]);

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

  if (etf === undefined) {
    return <Shell><div style={{ fontSize: '13px', color: C.text3 }}>Cargando…</div></Shell>;
  }
  if (etf === null) {
    return (
      <Shell>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '28px', textAlign: 'center', fontSize: '13px', color: C.text2 }}>
          No encontramos ningún ETF con el ticker {ticker} — comprueba que esté bien escrito.
        </div>
      </Shell>
    );
  }

  const price = priceData?.currentPrice;
  const sym = priceData?.currency === 'EUR' ? '€' : priceData?.currency === 'GBP' ? '£' : '$';
  const quality = computeETFQualityScore(etf);
  const verdict = etfVerdict(quality.composite);
  const badge = verdict ? VERDICT_BADGE[verdict.tier] : null;

  const essentials = [
    { label: 'Gastos al año', value: etf.expenseRatio },
    { label: 'Patrimonio gestionado', value: etf.aum },
    { label: 'Rentabilidad por dividendo', value: etf.yield },
    { label: 'PER promedio', value: etf.pe },
    { label: 'Volumen medio diario', value: etf.volume },
    { label: 'Beta', value: etf.beta },
  ].filter(s => s.value && s.value !== 'N/A' && s.value !== 'See Prospectus');

  return (
    <Shell>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <Link href="/etfs" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: C.text2, textDecoration: 'none', width: 'fit-content' }}>
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
          <StockLogo ticker={ticker} name={etf.name} size={52} />
          <div style={{ minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, letterSpacing: '-0.02em' }}>{etf.name}</h1>
            <div style={{ fontSize: '13px', color: C.text2, fontWeight: 600 }}>{ticker} · Fondo (ETF){etf.issuer ? ` · ${etf.issuer}` : ''}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '26px', flexWrap: 'wrap', flex: '1 1 240px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '26px', fontWeight: 800 }}>{price != null ? formatCurrency(price, sym) : 'N/D'}</div>
            {priceData?.priceChangePct != null && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px', fontSize: '13px', fontWeight: 700, color: priceData.priceChangePct >= 0 ? C.green : C.red }}>
                {priceData.priceChangePct >= 0 ? '+' : ''}{priceData.priceChangePct.toFixed(2)}% hoy
              </div>
            )}
          </div>
          {quality.composite != null && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: C.text3, letterSpacing: '0.02em', marginBottom: '6px' }}>NOTA DE CALIDAD</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                <div aria-hidden="true" style={{ width: '52px', height: '8px', borderRadius: '20px', background: C.borderSoft, overflow: 'hidden' }}>
                  <div style={{ width: `${quality.composite}%`, height: '100%', borderRadius: '20px', background: C.lime }} />
                </div>
                <span style={{ fontSize: '16px', fontWeight: 800 }}>{Math.round(quality.composite)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {verdict && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '26px', display: 'flex', flexDirection: 'column', gap: '12px', boxSizing: 'border-box' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '7px 16px', borderRadius: '20px', background: badge.bg, width: 'fit-content' }}>
            <span aria-hidden="true" style={{ width: '8px', height: '8px', borderRadius: '50%', background: badge.dot }} />
            <span style={{ fontSize: '13px', fontWeight: 800, color: badge.text }}>{verdict.label}</span>
          </div>
          <div style={{ fontSize: '12px', color: C.text3, paddingTop: '6px', borderTop: `1px solid ${C.borderSoft}` }}>
            Basado en coste, liquidez y diversificación — no es una recomendación de inversión.
          </div>
        </div>
      )}

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', boxSizing: 'border-box', overflow: 'hidden', ...CHART_THEME_VARS }}>
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
        <StockChart ticker={ticker} currency={priceData?.currency} height={280} range={chartRange} isMultichart />
      </div>

      {essentials.length > 0 && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '22px 26px', boxSizing: 'border-box' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: C.text3, letterSpacing: '0.02em', marginBottom: '14px' }}>LO ESENCIAL</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '18px' }}>
            {essentials.map(s => (
              <div key={s.label}>
                <div style={{ fontSize: '12px', color: C.text2, marginBottom: '4px' }}>{s.label}</div>
                <div style={{ fontSize: '18px', fontWeight: 800 }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Link href={`/etfs/${ticker}/numbers`} style={{
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '22px 26px', boxSizing: 'border-box',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', textDecoration: 'none', color: 'inherit',
      }}>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 800, marginBottom: '4px' }}>Ver números</div>
          <div style={{ fontSize: '12px', color: C.text2 }}>Coste, rendimiento, riesgo y de qué se compone la nota de calidad.</div>
        </div>
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.text2} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><polyline points="9 6 15 12 9 18"></polyline></svg>
      </Link>

      <div className="new-dash-2col" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '14px' }}>
        <WeightBars title="Principales posiciones" items={etf.holdings} emptyLabel="El fondo no reporta sus posiciones." barColor={C.lime} />
        <WeightBars title="Por sector" items={etf.sectors} emptyLabel="El fondo no reporta su reparto por sector." barColor={C.ink} />
      </div>
    </Shell>
  );
}
