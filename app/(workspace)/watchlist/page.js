'use client';
import { useState, useEffect, useMemo } from 'react';
import { useUser } from '../../components/AuthProvider';
import { useRouter } from 'next/navigation';
import Sparkline from '../../components/Sparkline';

const fmt = (val) => {
  if (val === null || val === undefined) return '—';
  if (Math.abs(val) >= 1e12) return `$${(val / 1e12).toFixed(1)}T`;
  if (Math.abs(val) >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
  if (Math.abs(val) >= 1e6) return `$${(val / 1e6).toFixed(0)}M`;
  return `$${val.toLocaleString()}`;
};

const CURRENCIES = { USD: '$', EUR: '€', GBP: '£' };

const formatCurrency = (val, symbol = '$') => {
  if (val === null || val === undefined) return '—';
  return `${symbol}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

function NewsRow({ item, onTicker, isLast }) {
  const [expanded, setExpanded] = useState(false);
  const sourceLetter = item.source ? item.source.charAt(0).toUpperCase() : 'N';
  return (
    <div onClick={() => setExpanded(e => !e)}
      style={{ display: 'flex', gap: '14px', padding: '14px 4px', borderBottom: isLast ? 'none' : '1px solid var(--ws-border)', cursor: 'pointer' }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--ws-bg-2)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
      {item.image ? (
        <div style={{ width: '110px', height: '82px', flexShrink: 0, borderRadius: '8px', background: `var(--ws-bg-2) url(${item.image}) center/cover no-repeat` }} />
      ) : (
        <div style={{ width: '110px', height: '82px', flexShrink: 0, borderRadius: '8px', background: 'var(--ws-bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: 800, color: 'var(--ws-text-3)' }}>{sourceLetter}</div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ws-text)', lineHeight: 1.35 }}>{item.title}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
          <span style={{ fontSize: '11px', color: 'var(--ws-text-3)' }}>{item.source} · {item.time}</span>
          {item.ticker && (
            <span onClick={(e) => { e.stopPropagation(); onTicker(item.ticker); }}
              style={{ fontSize: '10px', fontWeight: 800, color: 'var(--ws-accent)', background: 'var(--ws-accent-dim)', padding: '2px 6px', borderRadius: '4px' }}>
              {item.ticker}
            </span>
          )}
        </div>
        {expanded && (
          <div style={{ marginTop: '10px' }}>
            <div style={{ fontSize: '12px', color: 'var(--ws-text-2)', lineHeight: 1.5 }}>
              {item.summary || 'No summary available for this story.'}
            </div>
            <a href={item.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
              style={{ display: 'inline-block', marginTop: '8px', fontSize: '11px', fontWeight: 700, color: 'var(--ws-accent)', textDecoration: 'none' }}>
              Read full article ↗
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export default function WorkspaceNews() {
  const { isSignedIn } = useUser();
  const router = useRouter();
  const [tab, setTab] = useState('all');

  const [allNews, setAllNews] = useState([]);
  const [allLoading, setAllLoading] = useState(true);
  const [myNews, setMyNews] = useState([]);
  const [myLoading, setMyLoading] = useState(true);

  const [tickers, setTickers] = useState([]);
  const [stocks, setStocks] = useState({});
  const [sparklines, setSparklines] = useState({});
  const [portfolioTickers, setPortfolioTickers] = useState([]);
  const [savedPosts, setSavedPosts] = useState([]);

  useEffect(() => {
    fetch('/api/filings').then(r => r.json()).then(d => { setAllNews(d.filings || []); setAllLoading(false); }).catch(() => setAllLoading(false));
  }, []);

  useEffect(() => {
    if (!isSignedIn) return;
    fetch('/api/watchlist').then(r => r.json()).then(d => {
      setTickers(d.tickers || []);
      d.tickers?.forEach(({ ticker }) => {
        fetch(`/api/stock?ticker=${ticker}`).then(r => r.json()).then(data => setStocks(prev => ({ ...prev, [ticker]: data })));
        fetch(`/api/sparkline?ticker=${ticker}`).then(r => r.json()).then(data => setSparklines(prev => ({ ...prev, [ticker]: data.candles })));
      });
    });
    fetch('/api/portfolio').then(r => r.json()).then(d => setPortfolioTickers((d.holdings || []).map(h => h.ticker)));
    fetch('/api/saved').then(r => r.json()).then(d => setSavedPosts(d.posts || []));
  }, [isSignedIn]);

  const myTickers = useMemo(() => {
    return [...new Set([...portfolioTickers, ...tickers.map(t => t.ticker)])];
  }, [portfolioTickers, tickers]);

  useEffect(() => {
    if (myTickers.length === 0) return;
    fetch(`/api/filings?tickers=${myTickers.join(',')}`)
      .then(r => r.json())
      .then(d => setMyNews(d.holdingsNews || []))
      .catch(() => setMyNews([]))
      .finally(() => setMyLoading(false));
  }, [myTickers]);

  const remove = async (ticker) => {
    await fetch('/api/watchlist', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ticker }) });
    setTickers(prev => prev.filter(t => t.ticker !== ticker));
  };

  const goTicker = (ticker) => router.push(`/stock/${ticker}`);

  const activeNews = tab === 'all' ? allNews : myNews;
  const activeLoading = tab === 'all' ? allLoading : (myTickers.length > 0 && myLoading);

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ border: '1px solid var(--ws-border)', background: 'var(--ws-bg-1)', marginBottom: '20px', overflow: 'hidden' }}>
        <div style={{ background: 'var(--ws-bg-2)', borderBottom: '1px solid var(--ws-border)', padding: '7px 16px' }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: 'var(--ws-accent)', fontWeight: 700, letterSpacing: '1px' }}>
            $ traq watchlist
          </span>
        </div>
        <div style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ws-text)' }}>News</div>
          <div style={{ fontSize: '13px', color: 'var(--ws-text-2)' }}>Real-time market headlines, filtered to your positions.</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '6px', marginBottom: '18px' }}>
        {['all', 'mine'].map(k => (
          <button key={k} onClick={() => setTab(k)}
            style={{ padding: '6px 14px', fontSize: '12px', fontWeight: 700, border: '1px solid var(--ws-border)', background: tab === k ? 'var(--ws-bg-2)' : 'transparent', color: tab === k ? 'var(--ws-text)' : 'var(--ws-text-3)', cursor: 'pointer' }}>
            {k === 'all' ? 'All' : `My Positions (${myTickers.length})`}
          </button>
        ))}
      </div>

      {activeLoading ? (
        <div style={{ color: 'var(--ws-text-3)', fontSize: '13px', padding: '30px 0' }}>Loading news…</div>
      ) : activeNews.length === 0 ? (
        <div style={{ border: '1px solid var(--ws-border)', padding: '40px', textAlign: 'center', color: 'var(--ws-text-3)', fontSize: '13px' }}>
          {tab === 'mine' && myTickers.length === 0 ? 'Add holdings or watchlist tickers to see personalized news here.' : 'No news available right now.'}
        </div>
      ) : (
        <div style={{ border: '1px solid var(--ws-border)', padding: '4px 14px', marginBottom: '32px' }}>
          {activeNews.map((item, i) => <NewsRow key={item.id || i} item={item} onTicker={goTicker} isLast={i === activeNews.length - 1} />)}
        </div>
      )}

      {isSignedIn && (
        <>
          <div style={{ color: 'var(--ws-text-3)', fontSize: '10px', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1.5px', marginBottom: '10px', fontWeight: 700 }}>YOUR WATCHLIST</div>
          {tickers.length === 0 ? (
            <div style={{ border: '1px solid var(--ws-border)', padding: '24px', textAlign: 'center', color: 'var(--ws-text-3)', fontSize: '12px', marginBottom: '28px' }}>
              Your watchlist is empty — add stocks from any stock page.
            </div>
          ) : (
            <div className="responsive-table-container" style={{ border: '1px solid var(--ws-border)', marginBottom: '28px', background: 'var(--ws-bg-1)' }}>
              <table className="responsive-table" style={{ fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--ws-border)', background: 'var(--ws-bg-1)' }}>
                    {['Stock', 'Price', 'Change', 'Market cap', 'P/E', 'FCF yield', '1M', ''].map(h => (
                      <th key={h} className={h === 'Stock' ? 'sticky-col' : ''} style={{ padding: '9px 12px', textAlign: h === 'Stock' ? 'left' : 'right', fontWeight: 600, fontSize: '10px', color: 'var(--ws-text-3)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tickers.map(({ ticker }) => {
                    const s = stocks[ticker];
                    const up = s?.priceChangePct >= 0;
                    return (
                      <tr key={ticker} onClick={() => goTicker(ticker)}
                        style={{ borderBottom: '1px solid var(--ws-border)', cursor: 'pointer', background: 'var(--ws-bg-1)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--ws-bg-2)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'var(--ws-bg-1)'}>
                        <td className="sticky-col" style={{ padding: '10px 12px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--ws-text)' }}>{ticker}</div>
                          <div style={{ color: 'var(--ws-text-3)', fontSize: '11px' }}>{s?.name || '…'}</div>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>{s?.currentPrice ? formatCurrency(s.currentPrice, CURRENCIES[s.currency] || s.currency) : '—'}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: up ? 'var(--ws-accent)' : 'var(--ws-red)', fontWeight: 600 }}>
                          {s?.priceChangePct ? `${up ? '+' : ''}${s.priceChangePct.toFixed(2)}%` : '—'}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--ws-text-2)' }}>{s ? fmt(s.marketCap) : '—'}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>{s?.pe ? s.pe.toFixed(1) : '—'}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>{s?.fcfYield ? `${s.fcfYield}%` : '—'}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          {sparklines[ticker] && <Sparkline data={sparklines[ticker]} width={70} height={22} />}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                          <button onClick={e => { e.stopPropagation(); remove(ticker); }}
                            style={{ background: 'none', border: 'none', color: 'var(--ws-text-3)', cursor: 'pointer', fontSize: '13px' }}>
                            ✕
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ color: 'var(--ws-text-3)', fontSize: '10px', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1.5px', marginBottom: '10px', fontWeight: 700 }}>SAVED ARTICLES</div>
          {savedPosts.length === 0 ? (
            <div style={{ border: '1px solid var(--ws-border)', padding: '20px', textAlign: 'center', color: 'var(--ws-text-3)', fontSize: '12px' }}>
              No saved articles yet.
            </div>
          ) : (
            <div style={{ border: '1px solid var(--ws-border)', overflow: 'hidden' }}>
              {savedPosts.map((p, i) => (
                <a key={p.slug} href={`/blog/${p.slug}`}
                  style={{ display: 'block', padding: '12px 14px', borderBottom: i < savedPosts.length - 1 ? '1px solid var(--ws-border)' : 'none', textDecoration: 'none' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ws-text)' }}>{p.title}</div>
                  <div style={{ fontSize: '11px', color: 'var(--ws-text-3)', marginTop: '2px' }}>{p.read_time} · {new Date(p.date).toLocaleDateString()}</div>
                </a>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
