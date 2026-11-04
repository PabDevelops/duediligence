'use client';
import { useState, useEffect, useMemo, Suspense } from 'react';
import { useUser } from '../../components/AuthProvider';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import NewNav from '../../components/new/NewNav';
import Sparkline from '../../components/Sparkline';
import MarketStatusDot from '../../components/workspace/MarketStatusDot';
import StockLogo from '../../components/workspace/StockLogo';

import { formatCurrency } from '../../../lib/formatters';
import { useCurrencyRates } from '../../../lib/hooks/useCurrencyRates';
import AddHoldingModal from '../../components/new/portfolio/AddHoldingModal';
import SellModal from '../../components/new/portfolio/SellModal';
import CashModal from '../../components/new/portfolio/CashModal';
import GrowthChart from '../../components/new/portfolio/GrowthChart';
import AllocationChart from '../../components/new/portfolio/AllocationChart';
import PortfolioRing from '../../components/new/portfolio/PortfolioRing';
import { openInNewTab } from '../../../lib/openInNewTab';
import { NEW_COLORS as C } from '../../components/new/theme';

// Only used to show amounts in a stock's own native currency (e.g. a GBP-quoted VOD.L) —
// there's no reporting-currency picker anymore, everything aggregates in USD.
const CURRENCY_SYMBOLS = { USD: '$', EUR: '€', GBP: '£' };
const fmtC = (val) => formatCurrency(val, '$');

function NewPortfolioPageContent() {
  const { isSignedIn, isLoaded } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Portfolio is a Pro feature — old (workspace) layout gated the whole route group via a
  // global PaywallModal; the new (main) layout has no such gate (every other page there is
  // free), so this page checks for itself instead.
  const [isPro, setIsPro] = useState(null); // null = still checking
  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { setIsPro(false); return; }
    fetch('/api/subscription').then(r => r.json()).then(d => setIsPro(!!d?.isPro)).catch(() => setIsPro(false));
  }, [isLoaded, isSignedIn]);

  const [allHoldings, setAllHoldings] = useState([]);
  const [allCashTransactions, setAllCashTransactions] = useState([]);
  const [portfolios, setPortfolios] = useState([]);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState('all');

  const holdings = useMemo(() => {
    if (selectedPortfolioId === 'all') return allHoldings;
    return allHoldings.filter(h => h.portfolio_id === selectedPortfolioId);
  }, [allHoldings, selectedPortfolioId]);

  const [stocks, setStocks] = useState({});
  const [sparklines, setSparklines] = useState({});
  const [loading, setLoading] = useState(true);
  const [creatingPortfolio, setCreatingPortfolio] = useState(false);
  const [newPortfolioName, setNewPortfolioName] = useState('');
  const [loadError, setLoadError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showCashModal, setShowCashModal] = useState(false);
  const [buyTicker, setBuyTicker] = useState(null);
  const [editLot, setEditLot] = useState(null);
  const [sellPosition, setSellPosition] = useState(null);
  const [snapshots, setSnapshots] = useState([]);
  const { rates, toUSD, toUSDStable, fxReady } = useCurrencyRates();

  const loadPortfolios = async () => {
    if (!isSignedIn) return;
    const r = await fetch('/api/portfolios');
    const d = await r.json();
    setPortfolios(d.portfolios || []);
    if (d.portfolios?.length > 0 && !selectedPortfolioId) {
      setSelectedPortfolioId(d.portfolios[0].id);
    }
  };

  useEffect(() => {
    if (isPro) loadPortfolios();
  }, [isSignedIn, isPro]);

  const createPortfolio = async () => {
    if (!newPortfolioName.trim()) return;
    const res = await fetch('/api/portfolios', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newPortfolioName })
    });
    if (res.ok) {
      const d = await res.json();
      setPortfolios(prev => [...prev, d.portfolio]);
      setSelectedPortfolioId(d.portfolio.id);
      setCreatingPortfolio(false);
      setNewPortfolioName('');
    } else {
      const e = await res.json();
      alert(e.error || 'No se pudo crear el portfolio');
    }
  };

  // Deep link from other pages (e.g. /etfs) that want to open the buy modal directly,
  // via /portfolio?buy=TICKER. Strip the param once consumed so a refresh doesn't reopen it.
  useEffect(() => {
    const buyParam = searchParams.get('buy');
    if (buyParam) {
      setBuyTicker(buyParam.toUpperCase());
      router.replace('/portfolio');
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (!isPro) return;
    fetch('/api/portfolio/snapshot').then(r => r.json()).then(d => setSnapshots(d.snapshots || [])).catch(() => {});
  }, [isPro]);

  const load = ({ refresh = false } = {}) => {
    if (!isPro || !selectedPortfolioId) return;
    Promise.all([
      fetch(`/api/portfolio?portfolioId=all`),
      fetch(`/api/portfolio/cash?portfolioId=all`)
    ]).then(async ([rHoldings, rCash]) => {
      const dHoldings = await rHoldings.json();
      const dCash = await rCash.json();
      if (!rHoldings.ok) { setLoadError(dHoldings.error || 'No se pudo cargar tu portfolio.'); setLoading(false); return; }
      setLoadError(null);
      setAllHoldings(dHoldings.holdings || []);
      setAllCashTransactions(dCash.transactions || []);
      setLoading(false);
      const tickers = [...new Set((dHoldings.holdings || []).map(h => h.ticker))];
      tickers.forEach(ticker => {
        fetch(`/api/stock?ticker=${ticker}${refresh ? '&refresh=true' : ''}`).then(r => r.json()).then(data => setStocks(prev => ({ ...prev, [ticker]: data })));
        fetch(`/api/sparkline?ticker=${ticker}`).then(r => r.json()).then(data => setSparklines(prev => ({ ...prev, [ticker]: data.candles }))).catch(() => {});
      });
    });
  };

  useEffect(() => {
    if (isPro && selectedPortfolioId) load({ refresh: false });
  }, [isPro, selectedPortfolioId]);

  // Keep holding prices reasonably live — reload isn't the only way to see a move.
  // Paused while the tab is backgrounded, and re-run immediately on refocus, so an idle
  // background tab doesn't keep re-fetching a stock+sparkline call per holding every minute.
  useEffect(() => {
    if (!isPro) return;
    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      load({ refresh: false });
    };
    const interval = setInterval(refresh, 180000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [isPro]);

  const buildPositions = (holdingsArray) => {
    const byTicker = {};
    holdingsArray.forEach(h => {
      const p = byTicker[h.ticker] ||= { ticker: h.ticker, shares: 0, cost: 0, costNative: 0, lots: [] };
      p.shares += Number(h.shares);
      p.cost += Number(h.shares) * toUSDStable(Number(h.cost_basis), h.cost_basis_currency);
      p.costNative += Number(h.shares) * Number(h.cost_basis); // only valid when all lots share one currency
      p.lots.push(h);
    });
    return Object.values(byTicker).map(p => {
      const s = stocks[p.ticker];
      const avgCost = p.cost / p.shares;
      // Avg cost / price are shown in their real trading currency (no conversion) — only
      // the aggregate value/gain figures get converted to USD below.
      const costCurrency = p.lots[0]?.cost_basis_currency || 'USD';
      const sameCostCurrency = p.lots.every(l => (l.cost_basis_currency || 'USD') === costCurrency);
      const avgCostNative = sameCostCurrency ? p.costNative / p.shares : null;
      const priceCurrency = s?.currency || 'USD';
      const priceNative = s?.currentPrice ?? null;
      // Most tickers quote in USD, but international ones (via the Yahoo fallback) report
      // their own currency in s.currency — normalize to USD to make gain/loss math currency-safe.
      const price = s?.currentPrice != null ? toUSD(s.currentPrice, priceCurrency) : null;
      const marketValue = price != null ? price * p.shares : null;
      const marketValueNative = priceNative != null ? priceNative * p.shares : null;
      const gain = marketValue != null ? marketValue - p.cost : null;
      const gainPct = marketValue != null && p.cost > 0 ? (gain / p.cost) * 100 : null;
      return {
        ...p, avgCost, price, marketValue, gain, gainPct,
        avgCostNative, costCurrency, priceNative, priceCurrency, marketValueNative,
        name: s?.name, sector: s?.sector, pe: s?.pe, dividendYield: s?.dividendYield ?? s?.yield, dayChangePct: s?.priceChangePct,
      };
    }).sort((a, b) => (b.marketValue ?? b.cost) - (a.marketValue ?? a.cost));
  };

  const positions = useMemo(() => buildPositions(holdings), [holdings, stocks, rates]);
  const allPositions = useMemo(() => buildPositions(allHoldings), [allHoldings, stocks, rates]);

  // Cash is one simple balance per account (no ISA bucket).
  const cashTotal = useMemo(() => {
    const transactions = selectedPortfolioId === 'all' ? allCashTransactions : allCashTransactions.filter(t => t.portfolio_id === selectedPortfolioId);
    return transactions.reduce((total, t) => total + toUSD(Number(t.amount), t.currency), 0);
  }, [allCashTransactions, selectedPortfolioId, rates]);

  const allCashTotal = useMemo(() =>
    allCashTransactions.reduce((total, t) => total + toUSD(Number(t.amount), t.currency), 0),
    [allCashTransactions, rates]);

  const totals = useMemo(() => {
    const cost = positions.reduce((a, p) => a + p.cost, 0);
    const investedValue = positions.reduce((a, p) => a + (p.marketValue ?? p.cost), 0);
    const value = investedValue + cashTotal;
    const gain = investedValue - cost;
    const gainPct = cost > 0 ? (gain / cost) * 100 : 0;
    return { cost, value, gain, gainPct, investedValue };
  }, [positions, cashTotal]);

  // Today's performance, for the ring's center figure: a value-weighted average of each
  // priced position's own day change, same spirit as totals.gainPct but for a single day
  // instead of since-purchase. Cash isn't priced day to day, so it's simply left out of both
  // the weight and the sum rather than treated as 0% (which would understate a real move).
  const todayPct = useMemo(() => {
    const priced = positions.filter(p => p.dayChangePct != null && p.marketValue != null && p.marketValue > 0);
    const weightTotal = priced.reduce((a, p) => a + p.marketValue, 0);
    if (weightTotal === 0) return null;
    const weightedSum = priced.reduce((a, p) => a + p.marketValue * p.dayChangePct, 0);
    return weightedSum / weightTotal;
  }, [positions]);

  const netWorthTotals = useMemo(() => {
    const cost = allPositions.reduce((a, p) => a + p.cost, 0);
    const investedValue = allPositions.reduce((a, p) => a + (p.marketValue ?? p.cost), 0);
    const value = investedValue + allCashTotal;
    const gain = investedValue - cost;
    const gainPct = cost > 0 ? (gain / cost) * 100 : 0;
    return { cost, value, gain, gainPct, investedValue };
  }, [allPositions, allCashTotal]);

  // One card per account — invested value plus its cash balance.
  const accountCards = useMemo(() => portfolios.map(p => {
    const pPositions = buildPositions(allHoldings.filter(h => h.portfolio_id === p.id));
    const investedValue = pPositions.reduce((a, x) => a + (x.marketValue ?? x.cost), 0);
    const cash = allCashTransactions.filter(t => t.portfolio_id === p.id).reduce((sum, t) => sum + toUSD(Number(t.amount), t.currency), 0);
    return { id: p.id, name: p.name, icon: /sipp/i.test(p.name) ? '🏦' : '📈', value: investedValue + cash };
  }), [portfolios, allHoldings, allCashTransactions, stocks, rates]);

  useEffect(() => {
    // fxReady — without it, this can fire while fxRates is still the hardcoded fallback
    // guess, posting a GBP/EUR holding's USD value computed off an approximation instead
    // of the live rate.
    if (positions.length === 0 || totals.value === 0 || !fxReady) return;
    if (!positions.every(p => p.marketValue != null)) return;
    fetch('/api/portfolio/snapshot', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: netWorthTotals.value, cost: netWorthTotals.cost }),
    }).catch(() => {});
  }, [positions, netWorthTotals.value, netWorthTotals.cost, fxReady]);

  const bySectorChart = useMemo(() => {
    if (totals.investedValue === 0) return [];
    const bySector = {};
    positions.forEach(p => {
      const key = p.sector || 'Desconocido';
      const val = Math.max(0, p.marketValue ?? p.cost);
      if (val > 0) {
        bySector[key] = (bySector[key] || 0) + (val / Math.abs(totals.investedValue)) * 100;
      }
    });
    return Object.entries(bySector).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [positions, totals.investedValue]);

  const removePosition = async (ticker) => {
    if (confirm(`¿Seguro que quieres eliminar todas las posiciones de ${ticker}?`)) {
      await fetch('/api/portfolio', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ticker }) });
      load();
    }
  };

  // Clicking a position's pill on the ring is a shortcut into the same edit flow as the
  // table's own pencil icon — opens the most recent lot for that ticker.
  const editFromRing = (ticker) => {
    const position = positions.find(p => p.ticker === ticker);
    if (!position) return;
    const lastLot = [...position.lots].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
    setEditLot(lastLot);
  };

  const connectTrading212 = () => {
    alert('La conexión con Trading 212 llega pronto — de momento añade tus posiciones a mano.');
  };

  const pageShellStyle = { width: '100%', minHeight: '100vh', boxSizing: 'border-box', background: C.bg, color: C.ink, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", overflowX: 'hidden' };
  const innerStyle = { maxWidth: 'min(1200px, 92vw)', margin: '0 auto', padding: '32px 24px 96px', display: 'flex', flexDirection: 'column', gap: '24px', boxSizing: 'border-box' };

  // Loading / signed-out / not-Pro gates — no page content is fetched until isPro resolves
  // true, since the real data fetch below is itself gated on it.
  if (isPro !== true) {
    return (
      <div style={pageShellStyle}>
        <div style={innerStyle}>
          <NewNav active="portfolio" />
          <Link href="/home" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: C.text2, textDecoration: 'none', width: 'fit-content' }}>
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
            Volver
          </Link>
          <div>
            <h1 style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em' }}>Portfolio</h1>
            <div style={{ fontSize: '13px', color: C.text2 }}>Sigue tus posiciones y su rendimiento.</div>
          </div>
          {isPro === null ? (
            <div style={{ fontSize: '13px', color: C.text3 }}>Cargando…</div>
          ) : !isSignedIn ? (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '36px 28px', textAlign: 'center' }}>
              <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '8px' }}>Inicia sesión para ver tu portfolio</div>
              <div style={{ fontSize: '13px', color: C.text2, marginBottom: '18px' }}>Guarda tus posiciones, coste y rendimiento en un solo sitio.</div>
              <Link href="/sign-in" style={{ display: 'inline-block', padding: '10px 22px', borderRadius: '12px', background: C.lime, color: C.ink, fontWeight: 700, fontSize: '13px', textDecoration: 'none' }}>Iniciar sesión →</Link>
            </div>
          ) : (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '36px 28px', textAlign: 'center' }}>
              <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '8px' }}>El portfolio es cosa de Bulltrace Pro</div>
              <div style={{ fontSize: '13px', color: C.text2, marginBottom: '18px', maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto' }}>
                Lleva el seguimiento de tus posiciones reales, coste medio y rendimiento — 14 días gratis para probarlo.
              </div>
              <Link href="/pricing" style={{ display: 'inline-block', padding: '10px 22px', borderRadius: '12px', background: C.lime, color: C.ink, fontWeight: 700, fontSize: '13px', textDecoration: 'none' }}>Ver planes →</Link>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={pageShellStyle}>
      <div style={innerStyle}>
        <NewNav active="portfolio" />

        <Link href="/home" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: C.text2, textDecoration: 'none', width: 'fit-content' }}>
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
          Volver
        </Link>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <h1 style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em' }}>Portfolio</h1>
            <div style={{ fontSize: '13px', color: C.text2 }}>Sigue tus posiciones y su rendimiento.</div>
          </div>
          <button type="button" onClick={() => setShowCashModal(true)}
            style={{ height: '40px', padding: '0 18px', borderRadius: '12px', border: 'none', background: C.lime, color: C.ink, fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>
            ⇄ Gestionar caja
          </button>
        </div>

        {loading ? (
          <div style={{ fontSize: '13px', color: C.text3 }}>Cargando…</div>
        ) : loadError ? (
          <div style={{ background: '#F8DFDA', borderRadius: '20px', padding: '20px', color: C.red, fontSize: '13px' }}>
            No se pudo cargar tu portfolio: {loadError}
          </div>
        ) : positions.length === 0 ? (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '36px 28px', textAlign: 'center' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '6px' }}>Aún no tienes posiciones</div>
            <div style={{ fontSize: '13px', color: C.text2, marginBottom: '18px' }}>Añade tu primera posición para empezar a seguirla.</div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button type="button" onClick={() => setShowModal(true)}
                style={{ padding: '10px 22px', borderRadius: '12px', border: 'none', background: C.lime, color: C.ink, fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>
                + Añadir posición
              </button>
              <button type="button" onClick={connectTrading212}
                style={{ padding: '10px 22px', borderRadius: '12px', border: `1px solid ${C.border}`, background: 'transparent', color: C.text2, fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>
                🔌 Conectar Trading 212
              </button>
            </div>
          </div>
        ) : (
          <>
            <div>
              <PortfolioRing positions={positions} todayPct={todayPct} onSelectTicker={editFromRing} />
              <div onClick={() => setSelectedPortfolioId('all')} style={{ textAlign: 'center', cursor: 'pointer', marginTop: '14px' }}>
                <div style={{ fontSize: '10px', color: C.text3, letterSpacing: '1px', marginBottom: '4px', fontWeight: 700, textTransform: 'uppercase' }}>Patrimonio neto</div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: selectedPortfolioId === 'all' ? C.green : C.ink }}>{fmtC(netWorthTotals.value)}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px' }}>
              {accountCards.map(card => {
                const selected = selectedPortfolioId === card.id;
                return (
                  <div key={card.id}
                    onClick={() => setSelectedPortfolioId(card.id)}
                    style={{
                      cursor: 'pointer', borderRadius: '16px', padding: '14px', boxSizing: 'border-box',
                      border: `1px solid ${selected ? C.lime : C.border}`,
                      background: selected ? '#F4FFD6' : C.surface,
                    }}>
                    <div style={{ fontSize: '20px', marginBottom: '8px' }}>{card.icon}</div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: C.ink, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{card.name}</div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: C.text2 }}>{fmtC(card.value)}</div>
                  </div>
                );
              })}

              {portfolios.length < 3 && (creatingPortfolio ? (
                <div style={{ borderRadius: '16px', padding: '14px', boxSizing: 'border-box', border: `1px dashed ${C.border}` }}>
                  <input autoFocus value={newPortfolioName} onChange={e => setNewPortfolioName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && createPortfolio()}
                    placeholder="Nombre de la cuenta"
                    style={{ width: '100%', height: '30px', fontSize: '12px', marginBottom: '8px', borderRadius: '8px', border: `1px solid ${C.border}`, padding: '0 10px', fontFamily: 'inherit', boxSizing: 'border-box', background: '#FDFBF6', color: C.ink }} />
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button type="button" onClick={createPortfolio} disabled={!newPortfolioName.trim()}
                      style={{ flex: 1, height: '28px', padding: '0 8px', fontSize: '11px', borderRadius: '8px', border: 'none', background: C.lime, color: C.ink, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Guardar</button>
                    <button type="button" onClick={() => { setCreatingPortfolio(false); setNewPortfolioName(''); }}
                      style={{ height: '28px', padding: '0 8px', fontSize: '11px', borderRadius: '8px', border: `1px solid ${C.border}`, background: 'transparent', color: C.text2, cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => setCreatingPortfolio(true)}
                  style={{
                    cursor: 'pointer', borderRadius: '16px', padding: '14px', boxSizing: 'border-box', border: `1px dashed ${C.border}`,
                    background: 'transparent', color: C.text3, fontFamily: 'inherit',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px',
                  }}>
                  <div style={{ fontSize: '22px', lineHeight: 1 }}>+</div>
                  <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Nueva cuenta</div>
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
              <button type="button" onClick={connectTrading212}
                style={{ height: '34px', padding: '0 16px', borderRadius: '12px', border: `1px solid ${C.border}`, background: 'transparent', color: C.text2, fontWeight: 700, fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}>
                🔌 Conectar Trading 212
              </button>
              {selectedPortfolioId !== 'all' && (
                <button type="button" onClick={() => setShowModal(true)}
                  style={{ height: '34px', padding: '0 16px', borderRadius: '12px', border: 'none', background: C.lime, color: C.ink, fontWeight: 700, fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}>
                  + Añadir posición a {portfolios.find(p => p.id === selectedPortfolioId)?.name}
                </button>
              )}
            </div>

            <div className="new-portfolio-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              <div style={{ minWidth: 0, background: C.surface, border: `1px solid ${C.border}`, borderRadius: '16px', padding: '14px', boxSizing: 'border-box' }}>
                <div style={{ fontSize: '10px', color: C.text3, letterSpacing: '0.5px', marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase' }}>Valor de mercado</div>
                <div style={{ fontSize: '19px', fontWeight: 800, color: C.ink }}>{fmtC(totals.investedValue)}</div>
              </div>
              <div style={{ minWidth: 0, background: C.surface, border: `1px solid ${C.border}`, borderRadius: '16px', padding: '14px', boxSizing: 'border-box' }}>
                <div style={{ fontSize: '10px', color: C.text3, letterSpacing: '0.5px', marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase' }}>Coste</div>
                <div style={{ fontSize: '19px', fontWeight: 800, color: C.ink }}>{fmtC(totals.cost)}</div>
              </div>
              <div style={{ minWidth: 0, background: C.surface, border: `1px solid ${C.border}`, borderRadius: '16px', padding: '14px', boxSizing: 'border-box' }}>
                <div style={{ fontSize: '10px', color: C.text3, letterSpacing: '0.5px', marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase' }}>Ganancia/pérdida total</div>
                <div style={{ fontSize: '19px', fontWeight: 800, color: totals.gain >= 0 ? C.green : C.red }}>
                  {totals.gain >= 0 ? '+' : ''}{fmtC(totals.gain)} ({totals.gainPct >= 0 ? '+' : ''}{totals.gainPct.toFixed(1)}%)
                </div>
              </div>
            </div>

            <GrowthChart snapshots={snapshots} currentValue={netWorthTotals.value} currentCost={netWorthTotals.cost} rate={1} symbol="$" />

            {bySectorChart.length > 1 && <AllocationChart title="ASIGNACIÓN POR SECTOR" data={bySectorChart} />}

            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', overflowX: 'auto', boxSizing: 'border-box' }}>
              <div style={{ minWidth: '860px' }}>
                <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', borderBottom: `1px solid ${C.borderSoft}`, fontSize: '10px', fontWeight: 700, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  <div style={{ flex: '1 1 220px', textAlign: 'left' }}>Acción</div>
                  <div style={{ width: '56px', textAlign: 'center' }}>1M</div>
                  <div style={{ width: '80px', textAlign: 'right' }}>Acciones</div>
                  <div style={{ width: '90px', textAlign: 'right' }}>Coste medio</div>
                  <div style={{ width: '80px', textAlign: 'right' }}>Precio</div>
                  <div style={{ width: '70px', textAlign: 'right' }}>Día</div>
                  <div style={{ width: '110px', textAlign: 'right' }}>Valor de mercado</div>
                  <div style={{ width: '140px', textAlign: 'right' }}>Ganancia/pérdida</div>
                  <div style={{ width: '140px', textAlign: 'right' }}></div>
                </div>
                {positions.map(p => {
                  const lastLot = [...p.lots].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
                  return (
                    <div key={p.ticker} onClick={() => openInNewTab(`/stock/${p.ticker}`)}
                      style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderTop: `1px solid ${C.borderSoft}`, cursor: 'pointer' }}>
                      <div style={{ flex: '1 1 220px', display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                        <StockLogo ticker={p.ticker} size={28} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700, color: C.ink, display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                            {p.ticker}
                            <MarketStatusDot ticker={p.ticker} />
                          </div>
                          <div style={{ color: C.text3, fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name || '…'}</div>
                        </div>
                      </div>
                      <div style={{ width: '56px', textAlign: 'center' }}>
                        {sparklines[p.ticker] && <Sparkline data={sparklines[p.ticker]} width={44} height={22} />}
                      </div>
                      <div style={{ width: '80px', textAlign: 'right', fontSize: '12px', color: C.ink }}>{p.shares.toLocaleString(undefined, { maximumFractionDigits: 4 })}</div>
                      <div style={{ width: '90px', textAlign: 'right', fontSize: '12px', color: C.ink }}>{p.avgCostNative != null ? formatCurrency(p.avgCostNative, CURRENCY_SYMBOLS[p.costCurrency] || p.costCurrency) : fmtC(p.avgCost)}</div>
                      <div style={{ width: '80px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: C.ink }}>{p.priceNative != null ? formatCurrency(p.priceNative, CURRENCY_SYMBOLS[p.priceCurrency] || p.priceCurrency) : '—'}</div>
                      <div style={{ width: '70px', textAlign: 'right', fontSize: '12px', color: p.dayChangePct == null ? C.text3 : p.dayChangePct >= 0 ? C.green : C.red }}>
                        {p.dayChangePct != null ? `${p.dayChangePct >= 0 ? '+' : ''}${p.dayChangePct.toFixed(2)}%` : '—'}
                      </div>
                      <div style={{ width: '110px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: C.ink }}>{fmtC(p.marketValue ?? p.cost)}</div>
                      <div style={{ width: '140px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: p.gain == null ? C.text3 : p.gain >= 0 ? C.green : C.red }}>
                        {p.gain == null ? '—' : `${p.gain >= 0 ? '+' : ''}${fmtC(p.gain)} (${p.gainPct >= 0 ? '+' : ''}${p.gainPct.toFixed(1)}%)`}
                      </div>
                      <div style={{ width: '140px', textAlign: 'right', whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                        <button type="button" onClick={() => setBuyTicker(p.ticker)} title="Comprar más acciones"
                          style={{ fontSize: '10px', padding: '6px 10px', marginRight: '4px', borderRadius: '8px', border: 'none', background: C.lime, color: C.ink, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                          Comprar
                        </button>
                        <button type="button" onClick={() => setSellPosition(p)} title="Vender acciones"
                          style={{ fontSize: '10px', padding: '5px 9px', marginRight: '4px', borderRadius: '8px', border: `1px solid ${C.border}`, background: 'transparent', color: C.text2, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                          Vender
                        </button>
                        <button type="button" onClick={() => setEditLot(lastLot)} title={`Editar última entrada: ${lastLot.shares} acc. @ ${lastLot.cost_basis} ${lastLot.cost_basis_currency} el ${lastLot.purchase_date}`}
                          style={{ background: 'none', border: 'none', color: C.text3, cursor: 'pointer', fontSize: '13px', marginLeft: '2px' }}>
                          ✎
                        </button>
                        <button type="button" onClick={() => removePosition(p.ticker)} title={`Eliminar toda la posición de ${p.ticker}`}
                          style={{ background: 'none', border: 'none', color: C.text3, cursor: 'pointer', fontSize: '13px', marginLeft: '8px' }}>
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {(showModal || buyTicker) && <AddHoldingModal presetTicker={buyTicker} onClose={() => { setShowModal(false); setBuyTicker(null); }} onAdded={() => { setShowModal(false); setBuyTicker(null); load(); }} portfolioId={selectedPortfolioId} portfolios={portfolios} />}
        {showCashModal && <CashModal portfolioId={selectedPortfolioId} portfolios={portfolios} transactions={selectedPortfolioId === 'all' ? allCashTransactions : allCashTransactions.filter(t => t.portfolio_id === selectedPortfolioId)} onClose={() => setShowCashModal(false)} onAdded={() => { load(); }} />}
        {editLot && <AddHoldingModal onClose={() => setEditLot(null)} onAdded={() => { setEditLot(null); load(); }} editLot={editLot} portfolioId={selectedPortfolioId} portfolios={portfolios} />}
        {sellPosition && <SellModal position={sellPosition} onClose={() => setSellPosition(null)} onSold={() => { setSellPosition(null); load(); }} portfolioId={selectedPortfolioId} />}
      </div>
    </div>
  );
}

// useSearchParams() opts the whole subtree out of static prerendering unless it's inside a
// Suspense boundary — without this wrapper, `next build` fails prerendering this page instead
// of just falling back to client-side rendering for it (same pattern as app/(main)/search/page.js).
export default function NewPortfolioPage() {
  return (
    <Suspense fallback={null}>
      <NewPortfolioPageContent />
    </Suspense>
  );
}
