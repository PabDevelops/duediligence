'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import StockLogo from '../components/workspace/StockLogo';
import MarketStatusDot from '../components/workspace/MarketStatusDot';
import { formatCurrency } from '../../lib/formatters';
import { computeEasyMode, computeFundamentalGrowth } from '../../lib/stockScoring';
import { useEntryPriceProjection } from '../../lib/hooks/useEntryPriceProjection';
import { stockVerdict } from '../../lib/verdict';

function etfVerdict(fund) {
  const expensePct = parseFloat(fund.expenseRatio);
  const hasExpense = !Number.isNaN(expensePct);
  const cheap = hasExpense && expensePct <= 0.2;
  const pricey = hasExpense && expensePct > 0.5;

  let tier, label, emoji;
  if (cheap) { tier = 'good'; label = 'Comisión baja, pinta razonable'; emoji = '✅'; }
  else if (pricey) { tier = 'caution'; label = 'Comisión alta para ser un fondo'; emoji = '⚠️'; }
  else { tier = 'caution'; label = 'Revisa la comisión antes de entrar'; emoji = '⚠️'; }

  const reasons = [];
  reasons.push(hasExpense
    ? `Comisión anual del ${fund.expenseRatio} — ${cheap ? 'está entre las bajas' : pricey ? 'es alta comparada con fondos similares' : 'es una comisión normal'}.`
    : 'No encontramos la comisión anual de este fondo — revísala en el folleto antes de invertir.');
  reasons.push(`Es un fondo (${fund.holdings?.length || 'varias'} posiciones), no una empresa suelta — reparte el riesgo en vez de apostarlo todo a una.`);
  if (fund.aum && fund.aum !== 'See Prospectus') reasons.push(`Tiene ${fund.aum} gestionados — un fondo grande suele ser más fácil de comprar/vender sin perder dinero en el camino.`);

  return { tier, label, emoji, reasons };
}

const TIER_COLOR = { good: 'var(--ws-accent)', caution: '#eab308', bad: 'var(--ws-red)' };

function SuggestionRow({ s, onPick }) {
  return (
    <button onClick={() => onPick(s)} style={{
      display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 14px',
      border: 'none', borderBottom: '1px solid var(--ws-border)', background: 'var(--ws-bg-1)',
      cursor: 'pointer', textAlign: 'left',
    }}>
      <StockLogo ticker={s.ticker} name={s.name} size={24} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ws-text)' }}>
          {s.name} <span style={{ color: 'var(--ws-text-3)', fontWeight: 600 }}>· {s.ticker}</span>
        </div>
        {s.sector && <div style={{ fontSize: '11px', color: 'var(--ws-text-3)' }}>{s.sector}</div>}
      </div>
      {s.isEtf && <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--ws-text-2)', border: '1px solid var(--ws-border)', borderRadius: '10px', padding: '2px 8px' }}>ETF</span>}
    </button>
  );
}

// Phil Town-style sticker price: reuses the same Monte Carlo projector the real stock page's
// Price Projection section charts, fixed to a 5-year horizon, to answer "what would I pay
// today for a 15%/yr return" and "what return does the median path actually imply" — two
// concrete numbers for someone deciding whether a tip is still worth acting on at today's
// price, without building a second scoring system next to the verdict above.
function EntryPriceStat({ ticker, data }) {
  const fundamentalGrowth = computeFundamentalGrowth(data);
  const { maxEntryPrice, cagr5y } = useEntryPriceProjection({
    ticker, price: data.currentPrice, beta: data.beta, riskFreeRate: data.riskFreeRate,
    analystTarget: data.analystTarget, fundamentalGrowth,
  });

  if (maxEntryPrice == null || cagr5y == null) return null;
  const sym = data.currency === 'EUR' ? '€' : data.currency === 'GBP' ? '£' : '$';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--ws-border)' }}>
      <div>
        <div style={{ fontSize: '10px', color: 'var(--ws-text-3)', fontWeight: 700 }}>PRECIO MÁXIMO DE ENTRADA</div>
        <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--ws-text)', marginTop: '2px' }}>{formatCurrency(maxEntryPrice, sym)}</div>
        <div style={{ fontSize: '10px', color: 'var(--ws-text-3)', marginTop: '2px' }}>para exigir un 15%/año</div>
      </div>
      <div>
        <div style={{ fontSize: '10px', color: 'var(--ws-text-3)', fontWeight: 700 }}>CAGR ESPERADO A 5 AÑOS</div>
        <div style={{ fontSize: '15px', fontWeight: 700, color: cagr5y >= 0 ? 'var(--ws-accent)' : 'var(--ws-red)', marginTop: '2px' }}>
          {cagr5y >= 0 ? '+' : ''}{(cagr5y * 100).toFixed(1)}%
        </div>
        <div style={{ fontSize: '10px', color: 'var(--ws-text-3)', marginTop: '2px' }}>al precio actual</div>
      </div>
    </div>
  );
}

export default function StartPage() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [picked, setPicked] = useState(null); // { ticker, name, isEtf }
  const [result, setResult] = useState(null); // { data, easyMode | fund }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim() || picked) return;
    debounceRef.current = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query.trim())}&limit=8`)
        .then(r => r.json())
        .then(d => setSuggestions(d.results || []))
        .catch(() => setSuggestions([]));
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, picked]);

  // Suggestions only ever render while there's live, non-picked query text — avoids
  // clearing state synchronously inside the effect above just to blank the dropdown
  // when the box empties or a result is picked (pick() already clears it directly).
  const visibleSuggestions = query.trim() && !picked ? suggestions : [];

  const check = useCallback(async (target) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/stock?ticker=${encodeURIComponent(target.ticker)}`);
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'No encontramos esa empresa o fondo.');

      if (data.isEtf) {
        const fundRes = await fetch('/api/etfs', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticker: target.ticker }),
        });
        const fund = await fundRes.json();
        if (!fundRes.ok || fund.error) throw new Error(fund.error || 'No encontramos los datos de ese fondo.');
        setResult({ data, fund, verdict: etfVerdict(fund) });
      } else {
        const hasFundamentals = data.revVal != null || data.niVal != null || data.marketCap != null
          || data.roic != null || data.grossMargin != null || (data.revHistory?.length ?? 0) > 0;
        const easyMode = computeEasyMode(data, hasFundamentals);
        const companyName = (data.name || target.ticker).split(' ')[0];
        setResult({ data, verdict: easyMode ? stockVerdict(easyMode, companyName) : null });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const pick = (s) => {
    setPicked(s);
    setQuery(`${s.name} (${s.ticker})`);
    setShowSuggestions(false);
    setSuggestions([]);
    check(s);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (suggestions.length > 0) { pick(suggestions[0]); return; }
    if (picked) { check(picked); return; }
  };

  const reset = () => {
    setPicked(null);
    setResult(null);
    setError(null);
    setQuery('');
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--ws-bg)', color: 'var(--ws-text)', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: '520px', margin: '0 auto', padding: '48px 16px 64px' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <Link href="/" style={{ fontSize: '13px', color: 'var(--ws-text-3)', textDecoration: 'none' }}>← Bulltrace</Link>
          <div style={{ fontSize: '22px', fontWeight: 700, marginTop: '14px' }}>¿Es buena inversión?</div>
          <div style={{ fontSize: '13px', color: 'var(--ws-text-2)', marginTop: '4px' }}>
            Te han hablado de una acción o un fondo — compruébalo antes de meter tu dinero.
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ position: 'relative', marginBottom: '24px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              value={query}
              onChange={e => { setQuery(e.target.value); setPicked(null); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Ej: Tesla, PLTR, un ETF..."
              autoComplete="off"
              className="ws-input"
              style={{ flex: 1, height: '44px', fontSize: '14px' }}
            />
            <button type="submit" className="ws-btn" style={{ height: '44px', padding: '0 20px', fontWeight: 700 }}>
              Comprobar
            </button>
          </div>
          {showSuggestions && visibleSuggestions.length > 0 && (
            <div style={{
              position: 'absolute', top: '48px', left: 0, right: 0, zIndex: 20,
              border: '1px solid var(--ws-border)', borderRadius: '8px', overflow: 'hidden',
              boxShadow: '0 12px 30px rgba(0,0,0,0.25)',
            }}>
              {visibleSuggestions.map(s => <SuggestionRow key={s.ticker} s={s} onPick={pick} />)}
            </div>
          )}
        </form>

        {loading && (
          <div style={{ textAlign: 'center', color: 'var(--ws-text-3)', fontSize: '13px', padding: '20px' }}>Comprobando…</div>
        )}

        {error && (
          <div style={{ border: '1px solid var(--ws-red)', borderRadius: '10px', padding: '14px 18px', color: 'var(--ws-red)', fontSize: '13px' }}>
            {error}
          </div>
        )}

        {result && !loading && (
          <div style={{ border: '1px solid var(--ws-border)', borderRadius: '10px', padding: '18px', background: 'var(--ws-bg-1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <StockLogo ticker={result.data.ticker || picked?.ticker} name={result.data.name} size={40} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '15px' }}>
                  {result.data.name} <span style={{ color: 'var(--ws-text-3)', fontWeight: 600 }}>({picked?.ticker})</span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--ws-text-3)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {result.data.currentPrice != null ? (
                    <>
                      {formatCurrency(result.data.currentPrice, result.data.currency === 'EUR' ? '€' : result.data.currency === 'GBP' ? '£' : '$')}
                      {result.data.priceChangePct != null && (
                        <span style={{ color: result.data.priceChangePct >= 0 ? 'var(--ws-accent)' : 'var(--ws-red)' }}>
                          {result.data.priceChangePct >= 0 ? '+' : ''}{result.data.priceChangePct.toFixed(2)}% hoy
                        </span>
                      )}
                      <MarketStatusDot ticker={picked?.ticker} />
                    </>
                  ) : 'Precio no disponible'}
                </div>
              </div>
            </div>

            {result.verdict ? (
              <>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 14px', borderRadius: '20px',
                  background: `color-mix(in srgb, ${TIER_COLOR[result.verdict.tier]} 15%, transparent)`,
                  color: TIER_COLOR[result.verdict.tier], fontWeight: 700, fontSize: '13px', marginBottom: '12px',
                }}>
                  {result.verdict.emoji} {result.verdict.label}
                </div>
                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', lineHeight: 1.7, color: 'var(--ws-text-2)' }}>
                  {result.verdict.reasons.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </>
            ) : (
              <div style={{ fontSize: '13px', color: 'var(--ws-text-2)' }}>
                Todavía no tenemos datos suficientes de esta empresa para dar un veredicto — solo el precio.
              </div>
            )}

            {result.verdict && !result.fund && (
              <EntryPriceStat ticker={picked?.ticker} data={result.data} />
            )}

            <div style={{ fontSize: '11px', color: 'var(--ws-text-3)', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--ws-border)' }}>
              Esto no es consejo de inversión, es un punto de partida — investiga más antes de decidir.
            </div>

            <button onClick={reset} className="ws-btn-secondary" style={{ marginTop: '14px', width: '100%', height: '36px', fontSize: '12px' }}>
              Comprobar otra
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
