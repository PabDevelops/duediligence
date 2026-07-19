'use client';
import { useState, useEffect, useMemo, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import StockChart from '../../../components/StockChart';
import SparklineHeader from '../../../components/SparklineHeader';
import MarketStatusDot from '../../../components/workspace/MarketStatusDot';
import ETFQualityTab from '../../../components/workspace/etfs/ETFQualityTab';
import ETFCompareTab from '../../../components/workspace/etfs/ETFCompareTab';
import { useUser } from '../../../components/AuthProvider';
import { useStockData } from '../../../../lib/hooks/useStockData';
import { computeETFQualityScore } from '../../../../lib/etfQuality';

const CURRENCY_SYMBOLS = { USD: '$', EUR: '€', GBP: '£', JPY: '¥', CNY: '¥', CHF: 'CHF ', CAD: 'C$', AUD: 'A$', HKD: 'HK$', INR: '₹', KRW: '₩', SEK: 'kr', NOK: 'kr', DKK: 'kr' };
const curSym = (code) => !code || code === 'USD' ? '$' : (CURRENCY_SYMBOLS[code] || `${code} `);

const NAV = [
  { key: 'overview', label: 'OVERVIEW' },
  { key: 'quality', label: 'QUALITY' },
  { key: 'compare', label: 'COMPARE' },
];

const scoreColor = (s) => s == null ? 'var(--ws-text-3)' : s >= 70 ? 'var(--ws-accent)' : s >= 40 ? 'var(--ws-text)' : 'var(--ws-red)';
const scoreVerdict = (s) => s == null ? 'NO DATA' : s >= 70 ? 'STRONG' : s >= 40 ? 'FAIR' : 'WEAK';

export default function ETFTickerPage({ params }) {
  const { ticker: rawTicker } = use(params);
  const ticker = rawTicker.toUpperCase();
  const router = useRouter();
  const { isSignedIn } = useUser();

  const [etfsList, setEtfsList] = useState([]);
  const [loadingEtf, setLoadingEtf] = useState(true);
  const [etfError, setEtfError] = useState(null);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [tab, setTab] = useState('overview');
  const [compareSelection, setCompareSelection] = useState([ticker]);

  const { data: rawPriceData, error: priceFetchError, loading: loadingPrice } = useStockData(ticker);

  // Loads the full seeded list once (also feeds the Compare tab's "addable ETFs" pool), then
  // finds this ticker. If it's not there yet (a fund nobody's viewed before), POST fetches
  // and caches it on demand — same fetch-and-cache-on-first-view flow the old screener's
  // search bar used.
  useEffect(() => {
    let active = true;
    setLoadingEtf(true);
    setEtfError(null);
    fetch('/api/etfs')
      .then(res => res.json())
      .then(async (data) => {
        if (!active) return;
        const list = data.etfs || [];
        if (list.some(e => e.ticker === ticker)) {
          setEtfsList(list);
          setLoadingEtf(false);
          return;
        }
        const res = await fetch('/api/etfs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticker }),
        });
        const added = await res.json();
        if (!active) return;
        if (added.error) {
          setEtfError(added.error);
          setEtfsList(list);
        } else {
          setEtfsList([added, ...list]);
        }
        setLoadingEtf(false);
      })
      .catch(() => {
        if (active) { setEtfError('Failed to load ETF data'); setLoadingEtf(false); }
      });
    return () => { active = false; };
  }, [ticker]);

  useEffect(() => {
    setCompareSelection([ticker]);
    setTab('overview');
  }, [ticker]);

  useEffect(() => {
    fetch('/api/watchlist')
      .then(res => res.json())
      .then(data => {
        const tickers = data.tickers?.map(t => t.ticker) || [];
        setInWatchlist(tickers.includes(ticker));
      })
      .catch(() => {});
  }, [ticker, isSignedIn]);

  const etf = useMemo(() => etfsList.find(e => e.ticker === ticker), [etfsList, ticker]);
  const quality = useMemo(() => etf ? computeETFQualityScore(etf) : null, [etf]);

  const price = rawPriceData?.currentPrice;
  const change = rawPriceData?.priceChangePct;
  const isPositive = change != null && change >= 0;
  const currency = rawPriceData?.currency || 'USD';

  const toggleWatchlist = async () => {
    if (!isSignedIn) { window.location.href = '/sign-in'; return; }
    const method = inWatchlist ? 'DELETE' : 'POST';
    await fetch('/api/watchlist', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker }),
    });
    setInWatchlist(!inWatchlist);
  };

  const goToBuy = () => {
    if (!isSignedIn) { window.location.href = '/sign-in'; return; }
    router.push(`/portfolio?buy=${ticker}`);
  };

  const addCompareTicker = (t) => {
    setCompareSelection(prev => (prev.length >= 4 || prev.includes(t)) ? prev : [...prev, t]);
  };
  const removeCompareTicker = (t) => {
    setCompareSelection(prev => prev.filter(x => x !== t));
  };

  if (loadingEtf) {
    return (
      <div style={{ padding: '24px', fontFamily: "'JetBrains Mono', monospace" }}>
        <div style={{ border: '1px solid var(--ws-border)', background: 'var(--ws-bg-1)', overflow: 'hidden' }}>
          <div style={{ background: 'var(--ws-bg-2)', borderBottom: '1px solid var(--ws-border)', padding: '7px 16px' }}>
            <span style={{ fontSize: '11px', color: 'var(--ws-accent)', fontWeight: 700, letterSpacing: '1px' }}>$ traq etfs {ticker}</span>
          </div>
          <div style={{ padding: '24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {['CONNECTING TO ETF DATABASE...', 'FETCHING FUND DATA...'].map((line, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ color: 'var(--ws-accent)', fontSize: '11px' }}>▶</span>
                  <span style={{ color: 'var(--ws-text-3)', fontSize: '11px', letterSpacing: '1px' }}>{line}</span>
                </div>
              ))}
              <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: 'var(--ws-text-3)', fontSize: '11px' }}>█░░░░░░░░░</span>
                <span style={{ color: 'var(--ws-text-3)', fontSize: '10px', letterSpacing: '1px' }}>LOADING {ticker}...</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (etfError || !etf) {
    return (
      <div style={{ padding: '24px', fontFamily: "'JetBrains Mono', monospace" }}>
        <div style={{ border: '1px solid var(--ws-border)', background: 'var(--ws-bg-1)', overflow: 'hidden', maxWidth: '560px' }}>
          <div style={{ background: 'var(--ws-bg-2)', borderBottom: '1px solid var(--ws-border)', padding: '7px 16px' }}>
            <span style={{ fontSize: '10px', color: 'var(--ws-red)', letterSpacing: '1px' }}>$ traq etfs {ticker} — ERROR</span>
          </div>
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <span style={{ color: 'var(--ws-red)', fontSize: '11px', marginTop: '1px' }}>✗</span>
              <span style={{ color: 'var(--ws-text-3)', fontSize: '11px', letterSpacing: '0.5px', lineHeight: 1.7 }}>
                TICKER {ticker} WAS NOT FOUND OR FAILED TO LOAD.{'\n'}
                MAKE SURE IT IS A VALID US OR INTERNATIONAL ETF SYMBOL.
              </span>
            </div>
            <div style={{ borderTop: '1px solid var(--ws-border)', paddingTop: '16px', display: 'flex', gap: '8px' }}>
              <Link href="/etfs" style={{ textDecoration: 'none', fontSize: '11px', letterSpacing: '1px', background: 'var(--ws-text)', color: 'var(--ws-bg)', border: 'none', fontWeight: 700, padding: '8px 16px' }}>
                ETF DIRECTORY
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">

      {/* TERMINAL HERO */}
      <div style={{ border: '1px solid var(--ws-border)', background: 'var(--ws-bg-1)', marginBottom: '20px', overflow: 'hidden' }}>
        <div style={{ background: 'var(--ws-bg-2)', borderBottom: '1px solid var(--ws-border)', padding: '7px 16px' }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: 'var(--ws-accent)', fontWeight: 700, letterSpacing: '1px' }}>
            $ traq etfs {ticker}
          </span>
        </div>

        <div style={{ padding: '20px 24px' }}>
          <div className="stock-hero" style={{ padding: 0 }}>
            {/* Left: identity + price */}
            <div className="stock-hero-left" style={{ gap: '16px' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', color: 'var(--ws-text-3)', letterSpacing: '1.5px' }}>
                    {ticker} · {rawPriceData?.exchange || 'NASDAQ'} · ETF FUND SUMMARY
                  </span>
                </div>
                <h1 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.5px', marginBottom: '10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.2, color: 'var(--ws-text)' }}>{etf.name}</h1>
                {loadingPrice ? (
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '20px', color: 'var(--ws-text-3)' }}>LOADING...</span>
                ) : price != null ? (
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '28px', fontWeight: 700, letterSpacing: '-1px', color: 'var(--ws-text)' }}>{curSym(currency)}{price.toFixed(2)}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', fontWeight: 700, color: isPositive ? 'var(--ws-accent)' : 'var(--ws-red)' }}>
                      {isPositive ? '+' : ''}{change?.toFixed(2)}%
                    </span>
                    <MarketStatusDot ticker={ticker} showLabel />
                  </div>
                ) : (
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', color: 'var(--ws-text-3)' }}>
                    {priceFetchError ? 'PRICE N/A' : ''}
                  </span>
                )}
              </div>
            </div>

            {/* Middle: price chart */}
            <div className="stock-hero-chart">
              <SparklineHeader ticker={ticker} currency={currency} />
            </div>

            {/* Right: quality score block */}
            <div className="stock-hero-score" style={{ alignItems: 'flex-start', gap: '10px' }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '9px', letterSpacing: '2px', color: 'var(--ws-text-3)', fontWeight: 700 }}>QUALITY SCORE</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '28px', fontWeight: 700, color: scoreColor(quality?.composite), lineHeight: 1 }}>
                  {quality?.composite != null ? Math.round(quality.composite) : 'N/A'}
                </span>
              </div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 700, color: scoreColor(quality?.composite), letterSpacing: '1px' }}>
                {scoreVerdict(quality?.composite)}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--ws-text-3)', maxWidth: '200px', lineHeight: 1.6, borderLeft: '2px solid var(--ws-border)', paddingLeft: '10px', marginTop: '2px' }}>
                Based on cost, liquidity &amp; diversification — see the Quality tab.
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 0 40px' }}>

        {/* TAB NAV */}
        <div className="stock-tab-nav" style={{ display: 'flex', borderBottom: '1px solid var(--ws-border)', marginBottom: '24px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {NAV.map(n => (
            <button key={n.key} onClick={() => { setTab(n.key); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              style={{
                padding: '8px 20px',
                border: 'none',
                borderBottom: tab === n.key ? '2px solid var(--ws-accent)' : '2px solid transparent',
                background: 'transparent',
                color: tab === n.key ? 'var(--ws-text)' : 'var(--ws-text-3)',
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: tab === n.key ? 700 : 500,
                fontSize: '11px',
                letterSpacing: '1.5px',
                cursor: 'pointer',
                transition: 'all 0.15s',
                marginBottom: '-1px',
                flexShrink: 0,
                whiteSpace: 'nowrap',
              }}>
              {n.label}{n.key === 'compare' && compareSelection.length > 1 ? ` (${compareSelection.length})` : ''}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* ACTIONS */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={toggleWatchlist}
                style={inWatchlist
                  ? { fontSize: '12px', padding: '8px 14px', background: 'var(--ws-text)', color: 'var(--ws-bg)', border: 'none', fontWeight: 600, cursor: 'pointer' }
                  : { fontSize: '12px', padding: '8px 14px', background: 'var(--ws-bg-2)', border: '1px solid var(--ws-border)', color: 'var(--ws-text)', fontWeight: 600, cursor: 'pointer' }}>
                {inWatchlist ? 'Remove from Watchlist' : '+ Add to Watchlist'}
              </button>
              <button onClick={goToBuy}
                style={{ fontSize: '12px', padding: '8px 14px', background: 'var(--ws-accent)', color: 'var(--ws-bg-1)', border: 'none', fontWeight: 700, cursor: 'pointer' }}>
                + Add to Portfolio
              </button>
            </div>

            {/* PERFORMANCE CHART */}
            <div style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', overflow: 'hidden' }}>
              <div style={{ background: 'var(--ws-bg-2)', borderBottom: '1px solid var(--ws-border)', padding: '10px 16px' }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', color: 'var(--ws-text-3)', letterSpacing: '1px', fontWeight: 700 }}>PERFORMANCE & CHART HISTORICALS</span>
              </div>
              <StockChart ticker={ticker} currency={currency} />
            </div>

            {/* METRICS GRID */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              {[
                { label: 'EXPENSE RATIO', value: etf.expenseRatio, desc: 'Annualized cost ratio' },
                { label: 'AUM', value: etf.aum, desc: 'Assets Under Management' },
                { label: 'DIVIDEND YIELD', value: etf.yield, desc: '12-month trailing yield' },
                { label: 'AVG DAILY VOLUME', value: etf.volume, desc: 'Liquidity metric' },
                { label: 'PE RATIO', value: etf.pe, desc: 'Average portfolio price/earnings' },
                { label: 'BETA (1Y)', value: etf.beta, desc: 'Volatility vs Benchmark' },
                { label: 'ISSUER', value: etf.issuer, desc: 'Fund manager' },
                { label: 'INCEPTION DATE', value: etf.inception, desc: 'Fund creation date' },
              ].map((m, i) => (
                <div key={i} style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', padding: '14px 16px' }}>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '9px', color: 'var(--ws-text-3)', letterSpacing: '1px', fontWeight: 700, marginBottom: '6px' }}>
                    {m.label}
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: m.label === 'EXPENSE RATIO' ? 'var(--ws-accent)' : 'var(--ws-text)', marginBottom: '4px' }}>
                    {m.value}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--ws-text-3)' }}>
                    {m.desc}
                  </div>
                </div>
              ))}
            </div>

            {/* EXPOSURES ROW */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', flexWrap: 'wrap' }}>

              {/* TOP HOLDINGS */}
              <div style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)' }}>
                <div style={{ background: 'var(--ws-bg-2)', borderBottom: '1px solid var(--ws-border)', padding: '10px 16px' }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', color: 'var(--ws-text-3)', letterSpacing: '1px', fontWeight: 700 }}>PORTFOLIO TOP HOLDINGS</span>
                </div>
                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {etf.holdings.length === 0 ? (
                    <span style={{ fontSize: '11px', color: 'var(--ws-text-3)' }}>No holdings data reported by the fund.</span>
                  ) : etf.holdings.map((h, i) => {
                    const weightPct = parseFloat(h.weight);
                    return (
                      <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 600 }}>
                          <span style={{ color: 'var(--ws-text-2)' }}>{h.name} <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '9px', color: 'var(--ws-accent)', marginLeft: '4px' }}>{h.ticker}</span></span>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--ws-text)' }}>{h.weight}</span>
                        </div>
                        <div style={{ height: '5px', background: 'var(--ws-bg-2)', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${weightPct}%`, background: 'var(--ws-accent)', borderRadius: '2px' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SECTOR EXPOSURE */}
              <div style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)' }}>
                <div style={{ background: 'var(--ws-bg-2)', borderBottom: '1px solid var(--ws-border)', padding: '10px 16px' }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', color: 'var(--ws-text-3)', letterSpacing: '1px', fontWeight: 700 }}>SECTOR ALLOCATION EXPOSURE</span>
                </div>
                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {etf.sectors.length === 0 ? (
                    <span style={{ fontSize: '11px', color: 'var(--ws-text-3)' }}>No sector data reported by the fund.</span>
                  ) : etf.sectors.map((s, i) => {
                    const weightPct = parseFloat(s.weight);
                    return (
                      <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 600 }}>
                          <span style={{ color: 'var(--ws-text-2)' }}>{s.name}</span>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--ws-text)' }}>{s.weight}</span>
                        </div>
                        <div style={{ height: '5px', background: 'var(--ws-bg-2)', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${weightPct}%`, background: 'var(--ws-text-2)', borderRadius: '2px' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>

          </div>
        )}

        {tab === 'quality' && <ETFQualityTab etf={etf} />}

        {tab === 'compare' && (
          <ETFCompareTab
            tickers={compareSelection}
            etfsList={etfsList}
            onAddTicker={addCompareTicker}
            onRemoveTicker={removeCompareTicker}
          />
        )}

      </div>
    </div>
  );
}
