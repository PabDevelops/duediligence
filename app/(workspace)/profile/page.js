'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '../../components/AuthProvider';

export default function WorkspaceProfile() {
  const router = useRouter();
  const { user, isLoaded, isSignedIn } = useUser();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('thesis');
  const [priceCache, setPriceCache] = useState({});

  // 1. Thesis Journal State
  const [thesisNotes, setThesisNotes] = useState([]);
  const [newThesis, setNewThesis] = useState({ ticker: '', direction: 'BUY', entryPrice: '', targetPrice: '', summary: '' });

  // 2. Strategy Backtester State
  const [btForm, setBtForm] = useState({ ticker: '', condition: 'drop_1d', threshold: '3', holdDays: '20', direction: 'BUY' });
  const [btResult, setBtResult] = useState(null);
  const [btLoading, setBtLoading] = useState(false);
  const [btError, setBtError] = useState('');

  // 3. Valuation Tracker State
  const [valuations, setValuations] = useState([]);
  const [newValuation, setNewValuation] = useState({ ticker: '', method: 'DCF Model', fairValue: '' });



  // Load prices cache
  useEffect(() => {
    fetch('/api/movers')
      .then(r => r.json())
      .then(data => {
        const map = {};
        const allStocks = [
          ...(data.gainers || []),
          ...(data.losers || []),
          ...(data.bigCapMovers || []),
          ...(data.topRoic || []),
        ];
        allStocks.forEach(s => {
          if (s.ticker && s.currentPrice) {
            map[s.ticker.toUpperCase()] = s.currentPrice;
          }
        });
        const defaults = {
          AAPL: 189.84,
          MSFT: 421.90,
          NVDA: 126.57,
          TSLA: 184.40,
          GOOGL: 174.56,
          AMZN: 182.15,
          META: 498.42,
          NFLX: 620.10,
        };
        setPriceCache({ ...defaults, ...map });
      })
      .catch(() => {
        setPriceCache({
          AAPL: 189.84,
          MSFT: 421.90,
          NVDA: 126.57,
          TSLA: 184.40,
          GOOGL: 174.56,
          AMZN: 182.15,
          META: 498.42,
          NFLX: 620.10,
        });
      });
  }, []);


  // Load state from localStorage on mount
  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { router.push('/sign-in'); return; }
    
    const savedThesis = localStorage.getItem('traqcker_ledger_thesis');
    const savedValuations = localStorage.getItem('traqcker_ledger_valuations');

    if (savedThesis) setThesisNotes(JSON.parse(savedThesis));
    else {
      const initialThesis = [
        { id: '1', ticker: 'NVDA', direction: 'BUY', entryPrice: 120.5, targetPrice: 160.0, summary: 'Undisputed leader in AI chips, Blackwell architecture is expected to drive the next wave of revenue.', status: 'ACTIVE', date: new Date().toLocaleDateString() },
        { id: '2', ticker: 'TSLA', direction: 'SELL', entryPrice: 195.0, targetPrice: 140.0, summary: 'Margin pressure from price cuts, cooling global EV demand.', status: 'ACTIVE', date: new Date().toLocaleDateString() }
      ];
      setThesisNotes(initialThesis);
      localStorage.setItem('traqcker_ledger_thesis', JSON.stringify(initialThesis));
    }

    if (savedValuations) setValuations(JSON.parse(savedValuations));
    else {
      const initialValuations = [
        { id: '1', ticker: 'GOOGL', method: 'DCF Model', fairValue: 195.0, date: new Date().toLocaleDateString() },
        { id: '2', ticker: 'AMZN', method: 'PE Multiples', fairValue: 210.0, date: new Date().toLocaleDateString() }
      ];
      setValuations(initialValuations);
      localStorage.setItem('traqcker_ledger_valuations', JSON.stringify(initialValuations));
    }

    setLoading(false);
  }, [isSignedIn, isLoaded]);

  // Form Submit Handlers
  const handleAddThesis = (e) => {
    e.preventDefault();
    if (!newThesis.ticker) return;
    const item = {
      id: Date.now().toString(),
      ticker: newThesis.ticker.toUpperCase(),
      direction: newThesis.direction,
      entryPrice: parseFloat(newThesis.entryPrice) || 0,
      targetPrice: parseFloat(newThesis.targetPrice) || 0,
      summary: newThesis.summary,
      status: 'ACTIVE',
      date: new Date().toLocaleDateString()
    };
    const updated = [item, ...thesisNotes];
    setThesisNotes(updated);
    localStorage.setItem('traqcker_ledger_thesis', JSON.stringify(updated));
    setNewThesis({ ticker: '', direction: 'BUY', entryPrice: '', targetPrice: '', summary: '' });
  };

  const handleDeleteThesis = (id) => {
    const updated = thesisNotes.filter(t => t.id !== id);
    setThesisNotes(updated);
    localStorage.setItem('traqcker_ledger_thesis', JSON.stringify(updated));
  };

  const runBacktest = async (e) => {
    e.preventDefault();
    if (!btForm.ticker) return;
    setBtLoading(true);
    setBtError('');
    setBtResult(null);
    try {
      const res = await fetch(`/api/chart?ticker=${btForm.ticker.toUpperCase()}&range=1y`);
      const { candles } = await res.json();
      if (!candles || candles.length < 10) { setBtError('Not enough historical data for this ticker.'); setBtLoading(false); return; }

      const threshold = parseFloat(btForm.threshold) / 100;
      const hold = parseInt(btForm.holdDays);
      const signals = [];

      for (let i = 1; i < candles.length - hold; i++) {
        const prev = candles[i - 1].c;
        const curr = candles[i].c;
        const change = (curr - prev) / prev;
        let triggered = false;

        if (btForm.condition === 'drop_1d' && btForm.direction === 'BUY') triggered = change <= -threshold;
        if (btForm.condition === 'drop_1d' && btForm.direction === 'SELL') triggered = change >= threshold;
        if (btForm.condition === 'above_ma20') {
          const slice = candles.slice(Math.max(0, i - 20), i);
          const ma = slice.reduce((s, c) => s + c.c, 0) / slice.length;
          triggered = btForm.direction === 'BUY' ? curr > ma * (1 + threshold) : curr < ma * (1 - threshold);
        }
        if (btForm.condition === 'below_ma20') {
          const slice = candles.slice(Math.max(0, i - 20), i);
          const ma = slice.reduce((s, c) => s + c.c, 0) / slice.length;
          triggered = btForm.direction === 'BUY' ? curr < ma * (1 - threshold) : curr > ma * (1 + threshold);
        }

        if (triggered) {
          const exit = candles[i + hold]?.c || curr;
          const ret = btForm.direction === 'BUY' ? (exit - curr) / curr : (curr - exit) / curr;
          signals.push({ date: new Date(candles[i].t).toLocaleDateString(), entryPrice: curr, exitPrice: exit, returnPct: (ret * 100).toFixed(2), win: ret > 0 });
        }
      }

      if (signals.length === 0) { setBtError('No signals triggered with these parameters in the last year.'); setBtLoading(false); return; }

      const wins = signals.filter(s => s.win).length;
      const avgRet = signals.reduce((s, x) => s + parseFloat(x.returnPct), 0) / signals.length;
      const best = Math.max(...signals.map(s => parseFloat(s.returnPct)));
      const worst = Math.min(...signals.map(s => parseFloat(s.returnPct)));
      setBtResult({ ticker: btForm.ticker.toUpperCase(), signals, wins, winRate: ((wins / signals.length) * 100).toFixed(1), avgRet: avgRet.toFixed(2), best: best.toFixed(2), worst: worst.toFixed(2) });
    } catch { setBtError('Error fetching data. Try again.'); }
    setBtLoading(false);
  };

  const handleAddValuation = (e) => {
    e.preventDefault();
    if (!newValuation.ticker || !newValuation.fairValue) return;
    const item = {
      id: Date.now().toString(),
      ticker: newValuation.ticker.toUpperCase(),
      method: newValuation.method,
      fairValue: parseFloat(newValuation.fairValue) || 0,
      date: new Date().toLocaleDateString()
    };
    const updated = [item, ...valuations];
    setValuations(updated);
    localStorage.setItem('traqcker_ledger_valuations', JSON.stringify(updated));
    setNewValuation({ ticker: '', method: 'DCF Model', fairValue: '' });
  };

  const handleDeleteValuation = (id) => {
    const updated = valuations.filter(v => v.id !== id);
    setValuations(updated);
    localStorage.setItem('traqcker_ledger_valuations', JSON.stringify(updated));
  };



  if (!isLoaded || loading) return (
    <div style={{ padding: '24px', fontFamily: "'JetBrains Mono', monospace" }}>
      <div style={{ border: '1px solid var(--ws-border)', background: 'var(--ws-bg-1)', overflow: 'hidden' }}>
        <div style={{ background: 'var(--ws-bg-2)', borderBottom: '1px solid var(--ws-border)', padding: '7px 16px' }}>
          <span style={{ fontSize: '11px', color: 'var(--ws-accent)', fontWeight: 700, letterSpacing: '1px' }}>$ traq profile</span>
        </div>
        <div style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: 'var(--ws-accent)', fontSize: '11px' }}>▶</span>
            <span style={{ color: 'var(--ws-text-3)', fontSize: '11px', letterSpacing: '1px' }}>LOADING LEDGER...</span>
          </div>
        </div>
      </div>
    </div>
  );

  const card = { border: '1px solid var(--ws-border)', background: 'var(--ws-bg-1)' };

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', height: '100%', boxSizing: 'border-box' }}>

      {/* Terminal title bar */}
      <div style={{ border: '1px solid var(--ws-border)', background: 'var(--ws-bg-1)', overflow: 'hidden' }}>
        <div style={{ background: 'var(--ws-bg-2)', borderBottom: '1px solid var(--ws-border)', padding: '7px 16px' }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: 'var(--ws-accent)', fontWeight: 700, letterSpacing: '1px' }}>
            $ traq profile
          </span>
        </div>
      </div>

      {/* Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--ws-border)', paddingBottom: '14px' }}>
        <div>
          <div style={{ fontSize: '10px', fontFamily: "'JetBrains Mono', monospace", color: 'var(--ws-accent)', letterSpacing: '1.5px', marginBottom: '6px', fontWeight: 700 }}>WORKSPACE CONSOLE</div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--ws-text)', marginBottom: '4px', letterSpacing: '-0.5px' }}>TRADING LEDGER</h1>
          <p style={{ color: 'var(--ws-text-3)', fontSize: '11px' }}>Institutional-grade multi-ledger dashboard</p>
        </div>
      </div>

      {/* Tabs Menu */}
      <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--ws-border)', paddingBottom: '2px' }}>
        {[
          { id: 'thesis', label: 'THESIS JOURNAL' },
          { id: 'paper', label: 'PAPER TRADING' },
          { id: 'valuation', label: 'VALUATION TRACKER' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '8px 16px',
              fontSize: '11px',
              fontWeight: 800,
              color: activeTab === tab.id ? 'var(--ws-accent)' : 'var(--ws-text-3)',
              background: activeTab === tab.id ? 'var(--ws-bg-2)' : 'transparent',
              border: activeTab === tab.id ? '1px solid var(--ws-border)' : '1px solid transparent',
              borderBottom: 'none',
              borderRadius: 'var(--ws-radius) var(--ws-radius) 0 0',
              cursor: 'pointer',
              outline: 'none',
              transition: 'all 0.15s ease'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ flex: 1, minHeight: 0 }}>
        
        {/* TAB 1: THESIS JOURNAL */}
        {activeTab === 'thesis' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '16px', height: '100%' }}>
            {/* Form */}
            <form onSubmit={handleAddThesis} style={{ ...card, padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: 'var(--ws-accent)', letterSpacing: '1.5px', borderBottom: '1px solid var(--ws-border)', paddingBottom: '6px' }}>RECORD THESIS NOTE</div>
              
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '9px', color: 'var(--ws-text-3)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>TICKER</label>
                  <input type="text" placeholder="AAPL" value={newThesis.ticker} onChange={e => setNewThesis({ ...newThesis, ticker: e.target.value })} required
                    style={{ width: '100%', padding: '6px 10px', background: 'var(--ws-bg-2)', border: '1px solid var(--ws-border)', borderRadius: '4px', color: 'var(--ws-text)', outline: 'none', boxSizing: 'border-box', fontSize: '11px' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '9px', color: 'var(--ws-text-3)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>DIRECTION</label>
                  <select value={newThesis.direction} onChange={e => setNewThesis({ ...newThesis, direction: e.target.value })}
                    style={{ width: '100%', padding: '6px 10px', background: 'var(--ws-bg-2)', border: '1px solid var(--ws-border)', borderRadius: '4px', color: 'var(--ws-text)', outline: 'none', boxSizing: 'border-box', fontSize: '11px' }}>
                    <option value="BUY">BUY / LONG</option>
                    <option value="SELL">SELL / SHORT</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '9px', color: 'var(--ws-text-3)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>ENTRY PRICE ($)</label>
                  <input type="number" step="any" placeholder="185.50" value={newThesis.entryPrice} onChange={e => setNewThesis({ ...newThesis, entryPrice: e.target.value })}
                    style={{ width: '100%', padding: '6px 10px', background: 'var(--ws-bg-2)', border: '1px solid var(--ws-border)', borderRadius: '4px', color: 'var(--ws-text)', outline: 'none', boxSizing: 'border-box', fontSize: '11px' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '9px', color: 'var(--ws-text-3)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>TARGET PRICE ($)</label>
                  <input type="number" step="any" placeholder="220.00" value={newThesis.targetPrice} onChange={e => setNewThesis({ ...newThesis, targetPrice: e.target.value })}
                    style={{ width: '100%', padding: '6px 10px', background: 'var(--ws-bg-2)', border: '1px solid var(--ws-border)', borderRadius: '4px', color: 'var(--ws-text)', outline: 'none', boxSizing: 'border-box', fontSize: '11px' }} />
                </div>
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontSize: '9px', color: 'var(--ws-text-3)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>THESIS SUMMARY</label>
                <textarea placeholder="Write investment thesis rationale here..." value={newThesis.summary} onChange={e => setNewThesis({ ...newThesis, summary: e.target.value })} required
                  style={{ width: '100%', flex: 1, padding: '8px 10px', background: 'var(--ws-bg-2)', border: '1px solid var(--ws-border)', borderRadius: '4px', color: 'var(--ws-text)', outline: 'none', boxSizing: 'border-box', fontSize: '11px', resize: 'none', minHeight: '80px' }} />
              </div>

              <button type="submit"
                style={{ width: '100%', padding: '8px', fontSize: '11px', fontWeight: 800, background: 'var(--ws-accent)', border: 'none', borderRadius: '4px', color: 'var(--ws-bg-1)', cursor: 'pointer' }}>
                SAVE THESIS NOTE
              </button>
            </form>

            {/* List */}
            <div style={{ ...card, padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto' }}>
              <div style={{ fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: 'var(--ws-text-2)', letterSpacing: '1.5px', borderBottom: '1px solid var(--ws-border)', paddingBottom: '6px' }}>RECORDED THESIS NOTES</div>
              {thesisNotes.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--ws-text-3)', fontSize: '12px' }}>No recorded thesis notes.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {thesisNotes.map(thesis => {
                    const currentPrice = priceCache[thesis.ticker] || thesis.entryPrice;
                    const priceDiff = currentPrice - thesis.entryPrice;
                    const returnPct = thesis.entryPrice ? ((priceDiff / thesis.entryPrice) * 100).toFixed(1) : '0';
                    const targetReturnPct = thesis.entryPrice ? (((thesis.targetPrice - thesis.entryPrice) / thesis.entryPrice) * 100).toFixed(1) : '0';
                    return (
                      <div key={thesis.id} style={{ border: '1px solid var(--ws-border)', borderRadius: '4px', padding: '12px', background: 'var(--ws-bg-2)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--ws-text)' }}>{thesis.ticker}</span>
                            {thesis.direction === 'BUY' ? (
                              <span style={{ background: 'var(--ws-accent-dim)', color: 'var(--ws-accent)', fontSize: '9px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px' }}>▲ LONG</span>
                            ) : (
                              <span style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--ws-red)', fontSize: '9px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px' }}>▼ SHORT</span>
                            )}
                          </div>
                          <button onClick={() => handleDeleteThesis(thesis.id)}
                            style={{ background: 'none', border: 'none', color: 'var(--ws-red)', cursor: 'pointer', fontSize: '10px', fontWeight: 600 }}>
                            [ DELETE ]
                          </button>
                        </div>
                        <p style={{ fontSize: '11px', color: 'var(--ws-text-2)', lineHeight: 1.4, margin: '0 0 10px 0' }}>{thesis.summary}</p>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', borderTop: '1px solid var(--ws-border)', paddingTop: '8px', fontSize: '9px', color: 'var(--ws-text-3)' }}>
                          <div>
                            <div>ENTRY PRICE</div>
                            <div style={{ color: 'var(--ws-text)', fontWeight: 700, fontSize: '11px', marginTop: '2px' }}>${thesis.entryPrice.toFixed(2)}</div>
                          </div>
                          <div>
                            <div>TARGET PRICE</div>
                            <div style={{ color: 'var(--ws-text)', fontWeight: 700, fontSize: '11px', marginTop: '2px' }}>${thesis.targetPrice.toFixed(2)} ({targetReturnPct >= 0 ? '+' : ''}{targetReturnPct}%)</div>
                          </div>
                          <div>
                            <div>CURRENT PRICE</div>
                            <div style={{ color: 'var(--ws-text)', fontWeight: 700, fontSize: '11px', marginTop: '2px' }}>${currentPrice.toFixed(2)}</div>
                          </div>
                          <div>
                            <div>CURRENT RETURN</div>
                            <div style={{ color: parseFloat(returnPct) >= 0 ? 'var(--ws-accent)' : 'var(--ws-red)', fontWeight: 700, fontSize: '11px', marginTop: '2px' }}>
                              {parseFloat(returnPct) >= 0 ? '+' : ''}{returnPct}%
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: STRATEGY BACKTESTER */}
        {activeTab === 'paper' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '16px', height: '100%' }}>
            {/* Config Form */}
            <form onSubmit={runBacktest} style={{ ...card, padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: 'var(--ws-accent)', letterSpacing: '1.5px', borderBottom: '1px solid var(--ws-border)', paddingBottom: '6px' }}>DEFINE STRATEGY RULE</div>

              <div>
                <label style={{ fontSize: '9px', color: 'var(--ws-text-3)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>TICKER</label>
                <input type="text" placeholder="AAPL" value={btForm.ticker} onChange={e => setBtForm({ ...btForm, ticker: e.target.value })} required
                  style={{ width: '100%', padding: '6px 10px', background: 'var(--ws-bg-2)', border: '1px solid var(--ws-border)', borderRadius: '4px', color: 'var(--ws-text)', outline: 'none', boxSizing: 'border-box', fontSize: '11px' }} />
              </div>

              <div>
                <label style={{ fontSize: '9px', color: 'var(--ws-text-3)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>ENTRY CONDITION</label>
                <select value={btForm.condition} onChange={e => setBtForm({ ...btForm, condition: e.target.value })}
                  style={{ width: '100%', padding: '6px 10px', background: 'var(--ws-bg-2)', border: '1px solid var(--ws-border)', borderRadius: '4px', color: 'var(--ws-text)', outline: 'none', boxSizing: 'border-box', fontSize: '11px' }}>
                  <option value="drop_1d">Single-day price move ≥ threshold %</option>
                  <option value="above_ma20">Price deviates above 20-day MA ≥ threshold %</option>
                  <option value="below_ma20">Price deviates below 20-day MA ≥ threshold %</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '9px', color: 'var(--ws-text-3)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>THRESHOLD (%)</label>
                  <input type="number" step="0.5" min="0.1" placeholder="3" value={btForm.threshold} onChange={e => setBtForm({ ...btForm, threshold: e.target.value })} required
                    style={{ width: '100%', padding: '6px 10px', background: 'var(--ws-bg-2)', border: '1px solid var(--ws-border)', borderRadius: '4px', color: 'var(--ws-text)', outline: 'none', boxSizing: 'border-box', fontSize: '11px' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '9px', color: 'var(--ws-text-3)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>HOLD PERIOD (DAYS)</label>
                  <select value={btForm.holdDays} onChange={e => setBtForm({ ...btForm, holdDays: e.target.value })}
                    style={{ width: '100%', padding: '6px 10px', background: 'var(--ws-bg-2)', border: '1px solid var(--ws-border)', borderRadius: '4px', color: 'var(--ws-text)', outline: 'none', boxSizing: 'border-box', fontSize: '11px' }}>
                    <option value="5">5 days</option>
                    <option value="10">10 days</option>
                    <option value="20">20 days</option>
                    <option value="30">30 days</option>
                    <option value="60">60 days</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '9px', color: 'var(--ws-text-3)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>TRADE DIRECTION</label>
                <select value={btForm.direction} onChange={e => setBtForm({ ...btForm, direction: e.target.value })}
                  style={{ width: '100%', padding: '6px 10px', background: 'var(--ws-bg-2)', border: '1px solid var(--ws-border)', borderRadius: '4px', color: 'var(--ws-text)', outline: 'none', boxSizing: 'border-box', fontSize: '11px' }}>
                  <option value="BUY">BUY / LONG</option>
                  <option value="SELL">SELL / SHORT</option>
                </select>
              </div>

              <div style={{ flex: 1 }} />
              <button type="submit" disabled={btLoading}
                style={{ width: '100%', padding: '8px', fontSize: '11px', fontWeight: 800, background: btLoading ? 'var(--ws-border)' : 'var(--ws-accent)', border: 'none', borderRadius: '4px', color: 'var(--ws-bg-1)', cursor: btLoading ? 'default' : 'pointer' }}>
                {btLoading ? 'RUNNING BACKTEST…' : 'RUN BACKTEST ON 1Y DATA'}
              </button>
            </form>

            {/* Results */}
            <div style={{ ...card, padding: '16px', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
              <div style={{ fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: 'var(--ws-text-2)', letterSpacing: '1.5px', borderBottom: '1px solid var(--ws-border)', paddingBottom: '6px', marginBottom: '12px' }}>BACKTEST RESULTS</div>

              {btError && <div style={{ padding: '16px', background: 'rgba(239,68,68,0.08)', border: '1px solid var(--ws-red)', borderRadius: '4px', color: 'var(--ws-red)', fontSize: '11px' }}>{btError}</div>}

              {!btResult && !btError && !btLoading && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--ws-text-3)', gap: '8px' }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                  <span style={{ fontSize: '12px' }}>Configure a rule and run backtest to see signals</span>
                </div>
              )}

              {btResult && (
                <>
                  {/* Summary Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '14px' }}>
                    {[
                      { label: 'SIGNALS', value: btResult.signals.length },
                      { label: 'WIN RATE', value: `${btResult.winRate}%`, color: parseFloat(btResult.winRate) >= 50 ? 'var(--ws-accent)' : 'var(--ws-red)' },
                      { label: 'AVG RETURN', value: `${btResult.avgRet >= 0 ? '+' : ''}${btResult.avgRet}%`, color: parseFloat(btResult.avgRet) >= 0 ? 'var(--ws-accent)' : 'var(--ws-red)' },
                      { label: 'BEST / WORST', value: `+${btResult.best}% / ${btResult.worst}%` },
                    ].map((m, i) => (
                      <div key={i} style={{ background: 'var(--ws-bg-2)', border: '1px solid var(--ws-border)', borderRadius: '4px', padding: '8px' }}>
                        <div style={{ fontSize: '8px', color: 'var(--ws-text-3)', fontWeight: 600, marginBottom: '3px' }}>{m.label}</div>
                        <div style={{ fontSize: '12px', fontWeight: 800, color: m.color || 'var(--ws-text)' }}>{m.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Signals Table */}
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--ws-border)', background: 'var(--ws-bg-2)' }}>
                        <th style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--ws-text-3)' }}>SIGNAL DATE</th>
                        <th style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--ws-text-3)' }}>ENTRY</th>
                        <th style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--ws-text-3)' }}>EXIT</th>
                        <th style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--ws-text-3)' }}>RETURN</th>
                        <th style={{ padding: '6px 10px', textAlign: 'center', color: 'var(--ws-text-3)' }}>OUTCOME</th>
                      </tr>
                    </thead>
                    <tbody>
                      {btResult.signals.map((s, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--ws-border)' }}>
                          <td style={{ padding: '6px 10px', color: 'var(--ws-text-2)' }}>{s.date}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--ws-text-2)' }}>${s.entryPrice.toFixed(2)}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--ws-text-2)' }}>${s.exitPrice.toFixed(2)}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: parseFloat(s.returnPct) >= 0 ? 'var(--ws-accent)' : 'var(--ws-red)' }}>
                            {parseFloat(s.returnPct) >= 0 ? '+' : ''}{s.returnPct}%
                          </td>
                          <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                            <span style={{ fontSize: '9px', fontWeight: 800, color: s.win ? 'var(--ws-accent)' : 'var(--ws-red)' }}>{s.win ? '✓ WIN' : '✗ LOSS'}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          </div>
        )}


        {/* TAB 3: VALUATION TRACKER */}
        {activeTab === 'valuation' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '16px', height: '100%' }}>
            {/* Form */}
            <form onSubmit={handleAddValuation} style={{ ...card, padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: 'var(--ws-accent)', letterSpacing: '1.5px', borderBottom: '1px solid var(--ws-border)', paddingBottom: '6px' }}>RECORD FAIR VALUE MODEL</div>
              
              <div>
                <label style={{ fontSize: '9px', color: 'var(--ws-text-3)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>TICKER</label>
                <input type="text" placeholder="AAPL" value={newValuation.ticker} onChange={e => setNewValuation({ ...newValuation, ticker: e.target.value })} required
                  style={{ width: '100%', padding: '6px 10px', background: 'var(--ws-bg-2)', border: '1px solid var(--ws-border)', borderRadius: '4px', color: 'var(--ws-text)', outline: 'none', boxSizing: 'border-box', fontSize: '11px' }} />
              </div>

              <div>
                <label style={{ fontSize: '9px', color: 'var(--ws-text-3)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>VALUATION METHODOLOGY</label>
                <select value={newValuation.method} onChange={e => setNewValuation({ ...newValuation, method: e.target.value })}
                  style={{ width: '100%', padding: '6px 10px', background: 'var(--ws-bg-2)', border: '1px solid var(--ws-border)', borderRadius: '4px', color: 'var(--ws-text)', outline: 'none', boxSizing: 'border-box', fontSize: '11px' }}>
                  <option value="DCF Model">Discounted Cash Flow (DCF)</option>
                  <option value="PE Multiples">P/E Multiples / Graham Formula</option>
                  <option value="Dividend Discount">Dividend Discount Model (DDM)</option>
                  <option value="FCF Yield Analysis">FCF Yield Valuation</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '9px', color: 'var(--ws-text-3)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>FAIR VALUE ESTIMATE ($)</label>
                <input type="number" step="any" placeholder="195.50" value={newValuation.fairValue} onChange={e => setNewValuation({ ...newValuation, fairValue: e.target.value })} required
                  style={{ width: '100%', padding: '6px 10px', background: 'var(--ws-bg-2)', border: '1px solid var(--ws-border)', borderRadius: '4px', color: 'var(--ws-text)', outline: 'none', boxSizing: 'border-box', fontSize: '11px' }} />
              </div>

              <div style={{ flex: 1 }}></div>

              <button type="submit"
                style={{ width: '100%', padding: '8px', fontSize: '11px', fontWeight: 800, background: 'var(--ws-accent)', border: 'none', borderRadius: '4px', color: 'var(--ws-bg-1)', cursor: 'pointer' }}>
                SAVE VALUATION MODEL
              </button>
            </form>

            {/* List */}
            <div style={{ ...card, padding: '16px', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
              <div style={{ fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: 'var(--ws-text-2)', letterSpacing: '1.5px', borderBottom: '1px solid var(--ws-border)', paddingBottom: '6px', marginBottom: '8px' }}>SAVED VALUATIONS</div>
              {valuations.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--ws-text-3)', fontSize: '12px' }}>No valuations saved yet.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--ws-border)', background: 'var(--ws-bg-2)' }}>
                      <th style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--ws-text-3)' }}>ASSET</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--ws-text-3)' }}>METHODOLOGY</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--ws-text-3)' }}>FAIR VALUE</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--ws-text-3)' }}>MARKET</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--ws-text-3)' }}>MARGIN OF SAFETY</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center', color: 'var(--ws-text-3)' }}>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {valuations.map(val => {
                      const marketPrice = priceCache[val.ticker] || 100;
                      // Margin of Safety = ((Fair Value - Current Price) / Fair Value) * 100
                      const safetyMargin = val.fairValue ? ((val.fairValue - marketPrice) / val.fairValue * 100).toFixed(1) : '0.0';
                      return (
                        <tr key={val.id} style={{ borderBottom: '1px solid var(--ws-border)' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--ws-text)' }}>{val.ticker}</td>
                          <td style={{ padding: '8px 10px', color: 'var(--ws-text-2)' }}>{val.method}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--ws-text)', fontWeight: 600 }}>${val.fairValue.toFixed(2)}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--ws-text-3)' }}>${marketPrice.toFixed(2)}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: parseFloat(safetyMargin) >= 0 ? 'var(--ws-accent)' : 'var(--ws-red)' }}>
                            {parseFloat(safetyMargin) >= 0 ? '+' : ''}{safetyMargin}%
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                            <button onClick={() => handleDeleteValuation(val.id)}
                              style={{ background: 'none', border: 'none', color: 'var(--ws-red)', cursor: 'pointer', fontSize: '9px', fontWeight: 700 }}>
                              DELETE
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}


      </div>

    </div>
  );
}
