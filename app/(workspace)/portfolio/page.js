'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useUser } from '../../components/AuthProvider';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Sparkline from '../../components/Sparkline';
import MarketStatusDot from '../../components/workspace/MarketStatusDot';
import StockLogo from '../../components/workspace/StockLogo';

import { formatCurrency } from '../../../lib/formatters';
import { useCurrencyRates } from '../../../lib/hooks/useCurrencyRates';
import ImportCsvModal from '../../components/workspace/portfolio/ImportCsvModal';
import AddHoldingModal from '../../components/workspace/portfolio/AddHoldingModal';
import SellModal from '../../components/workspace/portfolio/SellModal';
import GrowthChart from '../../components/workspace/portfolio/GrowthChart';
import AllocationChart from '../../components/workspace/portfolio/AllocationChart';

const fmt = (val) => formatCurrency(val, '$');

const CURRENCIES = { USD: '$', EUR: '€', GBP: '£' };

export default function WorkspacePortfolio() {
  const { isSignedIn } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [holdings, setHoldings] = useState([]);
  const [stocks, setStocks] = useState({});
  const [sparklines, setSparklines] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [buyTicker, setBuyTicker] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [editLot, setEditLot] = useState(null);
  const [sellPosition, setSellPosition] = useState(null);
  const [snapshots, setSnapshots] = useState([]);
  const [currency, setCurrency] = useState('USD');
  const { rates, toUSD } = useCurrencyRates();

  useEffect(() => {
    const saved = localStorage.getItem('portfolio_currency');
    if (saved && CURRENCIES[saved]) setCurrency(saved);
  }, []);

  // Deep link from other pages (e.g. /etfs) that want to open the buy modal directly,
  // via /portfolio?buy=TICKER. Strip the param once consumed so a refresh doesn't reopen it.
  useEffect(() => {
    const buyParam = searchParams.get('buy');
    if (buyParam) {
      setBuyTicker(buyParam.toUpperCase());
      router.replace('/portfolio');
    }
  }, [searchParams, router]);

  const changeCurrency = (c) => { setCurrency(c); localStorage.setItem('portfolio_currency', c); };
  const rate = currency === 'USD' ? 1 : (rates[currency] || 1);
  const symbol = CURRENCIES[currency];
  const fmtC = (val) => formatCurrency(val == null ? null : val * rate, symbol);

  useEffect(() => {
    if (!isSignedIn) return;
    fetch('/api/portfolio/snapshot').then(r => r.json()).then(d => setSnapshots(d.snapshots || [])).catch(() => {});
  }, [isSignedIn]);

  const load = ({ refresh = false } = {}) => {
    if (!isSignedIn) return;
    fetch('/api/portfolio').then(async r => {
      const d = await r.json();
      if (!r.ok) { setLoadError(d.error || 'Failed to load portfolio.'); setLoading(false); return; }
      setLoadError(null);
      setHoldings(d.holdings || []);
      setLoading(false);
      const tickers = [...new Set((d.holdings || []).map(h => h.ticker))];
      tickers.forEach(ticker => {
        fetch(`/api/stock?ticker=${ticker}${refresh ? '&refresh=true' : ''}`).then(r => r.json()).then(data => setStocks(prev => ({ ...prev, [ticker]: data })));
        fetch(`/api/sparkline?ticker=${ticker}`).then(r => r.json()).then(data => setSparklines(prev => ({ ...prev, [ticker]: data.candles }))).catch(() => {});
      });
    });
  };

  useEffect(() => {
    load({ refresh: false });
  }, [isSignedIn]);

  // Keep holding prices reasonably live — reload isn't the only way to see a move.
  // Paused while the tab is backgrounded, and re-run immediately on refocus, so an idle
  // background tab doesn't keep re-fetching a stock+sparkline call per holding every minute.
  useEffect(() => {
    if (!isSignedIn) return;
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
  }, [isSignedIn]);

  const existingPies = useMemo(() => [...new Set(holdings.map(h => h.pie).filter(Boolean))].sort(), [holdings]);

  const positions = useMemo(() => {
    const byTicker = {};
    holdings.forEach(h => {
      const p = byTicker[h.ticker] ||= { ticker: h.ticker, shares: 0, cost: 0, costNative: 0, lots: [] };
      p.shares += Number(h.shares);
      p.cost += Number(h.shares) * toUSD(Number(h.cost_basis), h.cost_basis_currency);
      p.costNative += Number(h.shares) * Number(h.cost_basis); // only valid when all lots share one currency
      p.lots.push(h);
    });
    return Object.values(byTicker).map(p => {
      const s = stocks[p.ticker];
      const avgCost = p.cost / p.shares;
      // Avg cost / price are shown in their real trading currency (no conversion) — only
      // the aggregate value/gain figures get converted to your reporting currency below.
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
      const pie = p.lots.find(l => l.pie)?.pie || null;
      return {
        ...p, avgCost, price, marketValue, gain, gainPct,
        avgCostNative, costCurrency, priceNative, priceCurrency, marketValueNative,
        name: s?.name, sector: s?.sector, pie, pe: s?.pe, dividendYield: s?.dividendYield, dayChangePct: s?.priceChangePct,
      };
    });
  }, [holdings, stocks, rates]);

  const totals = useMemo(() => {
    const cost = positions.reduce((a, p) => a + p.cost, 0);
    const value = positions.reduce((a, p) => a + (p.marketValue ?? p.cost), 0);
    const gain = value - cost;
    const gainPct = cost > 0 ? (gain / cost) * 100 : 0;
    return { cost, value, gain, gainPct };
  }, [positions]);

  useEffect(() => {
    if (positions.length === 0 || totals.value === 0) return;
    if (!positions.every(p => p.marketValue != null)) return;
    fetch('/api/portfolio/snapshot', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: totals.value, cost: totals.cost }),
    }).catch(() => {});
  }, [positions, totals.value, totals.cost]);

  const byTickerChart = useMemo(() => {
    if (totals.value === 0) return [];
    return positions
      .map(p => ({ name: p.ticker, value: ((p.marketValue ?? p.cost) / totals.value) * 100 }))
      .sort((a, b) => b.value - a.value);
  }, [positions, totals.value]);

  const bySectorChart = useMemo(() => {
    if (totals.value === 0) return [];
    const bySector = {};
    positions.forEach(p => {
      const key = p.sector || 'Unknown';
      bySector[key] = (bySector[key] || 0) + ((p.marketValue ?? p.cost) / totals.value) * 100;
    });
    return Object.entries(bySector).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [positions, totals.value]);

  const byPieChart = useMemo(() => {
    if (totals.value === 0) return [];
    const byPie = {};
    positions.forEach(p => {
      const key = p.pie || 'Unassigned';
      byPie[key] = (byPie[key] || 0) + ((p.marketValue ?? p.cost) / totals.value) * 100;
    });
    return Object.entries(byPie).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [positions, totals.value]);

  const groupedByPie = useMemo(() => {
    const groups = {};
    positions.forEach(p => {
      const key = p.pie || 'Unassigned';
      (groups[key] ||= []).push(p);
    });
    return Object.entries(groups)
      .map(([name, items]) => {
        const cost = items.reduce((a, p) => a + p.cost, 0);
        const value = items.reduce((a, p) => a + (p.marketValue ?? p.cost), 0);
        const gain = value - cost;
        const gainPct = cost > 0 ? (gain / cost) * 100 : 0;
        return { name, items: items.sort((a, b) => (b.marketValue ?? 0) - (a.marketValue ?? 0)), cost, value, gain, gainPct };
      })
      .sort((a, b) => (a.name === 'Unassigned' ? 1 : b.name === 'Unassigned' ? -1 : b.value - a.value));
  }, [positions]);

  const hasPies = groupedByPie.length > 1 || (groupedByPie.length === 1 && groupedByPie[0].name !== 'Unassigned');

  const removeLot = async (id) => {
    await fetch('/api/portfolio', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    load();
  };

  const removePosition = async (ticker) => {
    if (confirm(`Are you sure you want to remove all holdings for ${ticker}?`)) {
      await fetch('/api/portfolio', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ticker }) });
      load();
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ border: '1px solid var(--ws-border)', background: 'var(--ws-bg-1)', marginBottom: '20px', overflow: 'hidden' }}>
        <div className="bg-ws-bg-2 border-b border-ws-border px-4 py-[7px]">
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: 'var(--ws-accent)', fontWeight: 700, letterSpacing: '1px' }}>
            $ traq portfolio
          </span>
        </div>
        <div style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ws-text)' }}>Portfolio</div>
            <div style={{ fontSize: '13px', color: 'var(--ws-text-2)' }}>Track your holdings and performance.</div>
          </div>
          {isSignedIn && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <div className="flex border border-ws-border overflow-hidden shrink-0">
                {Object.keys(CURRENCIES).map(c => (
                  <button key={c} onClick={() => changeCurrency(c)}
                    style={{
                      height: '32px', padding: '0 10px', fontSize: '11px', fontWeight: 700, border: 'none', cursor: 'pointer',
                      background: currency === c ? 'var(--ws-accent)' : 'var(--ws-bg-1)',
                      color: currency === c ? 'var(--ws-bg-1)' : 'var(--ws-text-2)',
                      flexShrink: 0,
                    }}>
                    {c}
                  </button>
                ))}
              </div>
              <button onClick={() => setShowImport(true)}
                className="ws-btn-secondary"
                style={{ height: '34px', padding: '0 14px' }}>
                Import CSV
              </button>
              <button onClick={() => setShowModal(true)}
                className="ws-btn"
                style={{ height: '34px', padding: '0 16px' }}>
                + Add holding
              </button>
            </div>
          )}
        </div>
      </div>

      {!isSignedIn ? (
        <div className="border border-ws-border p-12 text-center">
          <div style={{ color: 'var(--ws-text-2)', fontSize: '14px', marginBottom: '16px' }}>Sign in to track your portfolio</div>
          <Link href="/sign-in" className="ws-btn" style={{ padding: '9px 20px', textDecoration: 'none' }}>Sign in →</Link>
        </div>
      ) : loading ? (
        <div style={{ color: 'var(--ws-text-3)', fontSize: '13px', padding: '30px 0' }}>Loading…</div>
      ) : loadError ? (
        <div style={{ border: '1px solid var(--ws-red)', padding: '20px', color: 'var(--ws-red)', fontSize: '13px' }}>
          Couldn't load your portfolio: {loadError}
        </div>
      ) : positions.length === 0 ? (
        <div className="border border-ws-border p-12 text-center">
          <div style={{ color: 'var(--ws-text)', fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>No holdings yet</div>
          <div style={{ color: 'var(--ws-text-3)', fontSize: '12px', marginBottom: '16px' }}>Add your first position to start tracking.</div>
          <button onClick={() => setShowModal(true)}
            className="ws-btn"
            style={{ padding: '9px 20px' }}>
            + Add holding
          </button>
        </div>
      ) : (
        <>
          <div className="portfolio-overview-grid">
            <div className="border border-ws-border p-3.5">
              <div style={{ fontSize: '10px', color: 'var(--ws-text-3)', letterSpacing: '0.5px', marginBottom: '4px' }}>MARKET VALUE</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ws-text)' }}>{fmtC(totals.value)}</div>
            </div>
            <div className="border border-ws-border p-3.5">
              <div style={{ fontSize: '10px', color: 'var(--ws-text-3)', letterSpacing: '0.5px', marginBottom: '4px' }}>COST BASIS</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ws-text)' }}>{fmtC(totals.cost)}</div>
            </div>
            <div className="border border-ws-border p-3.5">
              <div style={{ fontSize: '10px', color: 'var(--ws-text-3)', letterSpacing: '0.5px', marginBottom: '4px' }}>TOTAL GAIN/LOSS</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: totals.gain >= 0 ? 'var(--ws-accent)' : 'var(--ws-red)' }}>
                {totals.gain >= 0 ? '+' : ''}{fmtC(totals.gain)} ({totals.gainPct >= 0 ? '+' : ''}{totals.gainPct.toFixed(1)}%)
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '18px' }}>
            <GrowthChart snapshots={snapshots} currentValue={totals.value} currentCost={totals.cost} rate={rate} symbol={symbol} />
          </div>

          <div className="portfolio-allocations-grid" style={{ gridTemplateColumns: `repeat(${1 + (bySectorChart.length > 1 ? 1 : 0) + (hasPies ? 1 : 0)}, 1fr)` }}>
            <AllocationChart title="ALLOCATION BY STOCK" data={byTickerChart} />
            {bySectorChart.length > 1 && <AllocationChart title="ALLOCATION BY SECTOR" data={bySectorChart} />}
            {hasPies && <AllocationChart title="ALLOCATION BY PIE" data={byPieChart} />}
          </div>

          {groupedByPie.map(group => {
            const groupAllocation = totals.value > 0 ? (group.value / totals.value) * 100 : 0;
            return (
              <div key={group.name} style={{ marginBottom: '18px' }}>
                {hasPies && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 4px', marginBottom: '2px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ws-text)' }}>{group.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--ws-text-3)' }}>{group.items.length} holding{group.items.length !== 1 ? 's' : ''} · {groupAllocation.toFixed(1)}% of portfolio</div>
                    <div style={{ marginLeft: 'auto', fontSize: '12px', fontWeight: 600, color: 'var(--ws-text)' }}>{fmtC(group.value)}</div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: group.gain >= 0 ? 'var(--ws-accent)' : 'var(--ws-red)' }}>
                      {group.gain >= 0 ? '+' : ''}{fmtC(group.gain)} ({group.gainPct >= 0 ? '+' : ''}{group.gainPct.toFixed(1)}%)
                    </div>
                  </div>
                )}
                <div className="responsive-table-container" style={{ border: '1px solid var(--ws-border)', background: 'var(--ws-bg-1)' }}>
                  <table className="responsive-table" style={{ fontSize: '12px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--ws-border)', background: 'var(--ws-bg-1)' }}>
                        {['Stock', '1M', 'Shares', 'Avg cost', 'Price', 'Day', 'P/E', 'Div yield', 'Market value', 'Gain/loss', 'Allocation', ''].map(h => (
                          <th key={h} className={h === 'Stock' ? 'sticky-col' : ''} style={{ padding: '9px 12px', textAlign: h === 'Stock' ? 'left' : h === '1M' ? 'center' : 'right', fontWeight: 600, fontSize: '10px', color: 'var(--ws-text-3)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map(p => {
                        const allocation = totals.value > 0 ? ((p.marketValue ?? p.cost) / totals.value) * 100 : 0;
                        const lastLot = [...p.lots].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
                        return (
                          <tr key={p.ticker} onClick={() => router.push(`/stock/${p.ticker}`)}
                            style={{ borderBottom: '1px solid var(--ws-border)', cursor: 'pointer', background: 'var(--ws-bg-1)' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--ws-bg-2)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'var(--ws-bg-1)'}>
                            <td className="sticky-col" style={{ padding: '10px 12px' }}>
                              <div className="flex items-center gap-2">
                                <StockLogo ticker={p.ticker} size={24} />
                                <div>
                                  <div style={{ fontWeight: 600, color: 'var(--ws-text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    {p.ticker}
                                    <MarketStatusDot ticker={p.ticker} />
                                  </div>
                                  <div style={{ color: 'var(--ws-text-3)', fontSize: '11px' }}>{p.name || '…'}</div>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                              {sparklines[p.ticker] && <Sparkline data={sparklines[p.ticker]} width={64} height={22} />}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right' }}>{p.shares.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right' }}>{p.avgCostNative != null ? formatCurrency(p.avgCostNative, CURRENCIES[p.costCurrency] || p.costCurrency) : fmtC(p.avgCost)}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>{p.priceNative != null ? formatCurrency(p.priceNative, CURRENCIES[p.priceCurrency] || p.priceCurrency) : '—'}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', color: p.dayChangePct == null ? 'var(--ws-text-3)' : p.dayChangePct >= 0 ? 'var(--ws-accent)' : 'var(--ws-red)' }}>
                              {p.dayChangePct != null ? `${p.dayChangePct >= 0 ? '+' : ''}${p.dayChangePct.toFixed(2)}%` : '—'}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--ws-text-2)' }}>{p.pe ? p.pe.toFixed(1) : '—'}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--ws-text-2)' }}>{p.dividendYield ? `${p.dividendYield.toFixed(2)}%` : '—'}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>{fmtC(p.marketValue ?? p.cost)}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', color: p.gain == null ? 'var(--ws-text-3)' : p.gain >= 0 ? 'var(--ws-accent)' : 'var(--ws-red)', fontWeight: 600 }}>
                              {p.gain == null ? '—' : `${p.gain >= 0 ? '+' : ''}${fmtC(p.gain)} (${p.gainPct >= 0 ? '+' : ''}${p.gainPct.toFixed(1)}%)`}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--ws-text-2)' }}>{allocation.toFixed(1)}%</td>
                             <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                               <button onClick={() => setBuyTicker(p.ticker)} title="Buy shares"
                                 className="ws-btn"
                                 style={{ fontSize: '10px', padding: '5px 10px', marginRight: '4px' }}>
                                 Buy
                               </button>
                               <button onClick={() => setSellPosition(p)} title="Sell shares"
                                 className="ws-btn-secondary"
                                 style={{ fontSize: '10px', padding: '4px 8px', marginRight: '4px' }}>
                                 Sell
                               </button>
                               <button onClick={() => setEditLot(lastLot)} title={`Edit last entry: ${lastLot.shares} sh @ ${lastLot.cost_basis} ${lastLot.cost_basis_currency} on ${lastLot.purchase_date}`}
                                 style={{ background: 'none', border: 'none', color: 'var(--ws-text-3)', cursor: 'pointer', fontSize: '13px', marginLeft: '2px' }}>
                                 ✎
                               </button>
                               <button onClick={() => removePosition(p.ticker)} title={`Remove entire ${p.ticker} position`}
                                 style={{ background: 'none', border: 'none', color: 'var(--ws-text-3)', cursor: 'pointer', fontSize: '13px', marginLeft: '6px' }}>
                                 ✕
                               </button>
                             </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </>
      )}

      {(showModal || buyTicker) && <AddHoldingModal presetTicker={buyTicker} onClose={() => { setShowModal(false); setBuyTicker(null); }} onAdded={() => { setShowModal(false); setBuyTicker(null); load(); }} existingPies={existingPies} defaultCurrency={currency} />}
      {showImport && <ImportCsvModal onClose={() => setShowImport(false)} onImported={() => { setShowImport(false); load(); }} defaultCurrency={currency} />}
      {editLot && <AddHoldingModal onClose={() => setEditLot(null)} onAdded={() => { setEditLot(null); load(); }} existingPies={existingPies} defaultCurrency={currency} editLot={editLot} />}
      {sellPosition && <SellModal position={sellPosition} onClose={() => setSellPosition(null)} onSold={() => { setSellPosition(null); load(); }} />}
    </div>
  );
}
