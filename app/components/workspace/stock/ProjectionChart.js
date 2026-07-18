'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import {
  computeProjectionDrift,
  computeAnnualizedVolatility,
  computeBlendedVolatility,
  computeHistoricalCagr,
  computeProjection,
  createSeededRng,
} from '../../../../lib/stockScoring';

// Matches computeHistoricalCagr's own 0.25-year cutoff — below this, the CAGR signal
// already silently drops out of the drift blend, and the volatility estimate (which only
// needs 10 days to compute at all) is statistically thin enough to warn about explicitly.
const MIN_RELIABLE_DAYS = 63;

const HORIZONS = [
  { key: '6m', label: '6M', years: 0.5, stepsPerYear: 252 },
  { key: '1y', label: '1Y', years: 1, stepsPerYear: 252 },
  { key: '3y', label: '3Y', years: 3, stepsPerYear: 52 },
  { key: '5y', label: '5Y', years: 5, stepsPerYear: 52 },
  { key: '10y', label: '10Y', years: 10, stepsPerYear: 52 },
];

const CURRENCY_SYMBOLS = { USD: '$', EUR: '€', GBP: '£', JPY: '¥', CNY: '¥', CHF: 'CHF ', CAD: 'C$', AUD: 'A$', HKD: 'HK$', INR: '₹', KRW: '₩', SEK: 'kr', NOK: 'kr', DKK: 'kr' };
const curSym = (code) => !code || code === 'USD' ? '$' : (CURRENCY_SYMBOLS[code] || `${code} `);

// Relative offset from today ("+3mo", "+2y6mo") instead of an absolute calendar date —
// keeps the chart's x-axis pure/deterministic from the same inputs on every render.
const fmtOffset = (years) => {
  if (years === 0) return 'TODAY';
  const totalMonths = Math.round(years * 12);
  const y = Math.floor(totalMonths / 12);
  const m = totalMonths % 12;
  if (y === 0) return `+${m}mo`;
  if (m === 0) return `+${y}y`;
  return `+${y}y${m}mo`;
};

export default function ProjectionChart({ ticker, data, fundamentalGrowth, price, currency }) {
  const [horizonKey, setHorizonKey] = useState('1y');
  const [closes, setCloses] = useState(null);
  const [marketVolAnnual, setMarketVolAnnual] = useState(null);
  const [loading, setLoading] = useState(true);

  const horizon = HORIZONS.find(h => h.key === horizonKey);

  // 1y of daily closes doubles as the historical-vol estimate and the historical-CAGR
  // signal. VIX/100 doubles as the market's current annualized vol for the beta signal —
  // fetched once, not per-ticker, since it's the same number for every stock.
  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      fetch(`/api/chart?ticker=${ticker}&range=1y`).then(r => r.json()).catch(() => ({ candles: [] })),
      fetch(`/api/market`).then(r => r.json()).catch(() => ({ markets: [] })),
    ]).then(([chartData, marketData]) => {
      if (!active) return;
      setCloses((chartData.candles || []).map(c => c.c).filter(v => v > 0));
      const vix = marketData.markets?.find(m => m.symbol === '^VIX')?.price;
      setMarketVolAnnual(vix ? vix / 100 : null);
      setLoading(false);
    });
    return () => { active = false; };
  }, [ticker]);

  const historicalVol = useMemo(() => computeAnnualizedVolatility(closes), [closes]);
  const historicalCagr = useMemo(() => computeHistoricalCagr(closes), [closes]);

  const volAnnual = useMemo(
    () => computeBlendedVolatility({ historicalVol, beta: data.beta, marketVolAnnual }),
    [historicalVol, data.beta, marketVolAnnual]
  );

  const analystDrift = data.analystTarget && price ? (data.analystTarget / price) - 1 : null;
  // The fundamentals-based (not market-implied) growth assumption — one of three independent
  // drift signals blended below.
  const dcfGrowth = fundamentalGrowth ?? null;

  const driftAnnual = useMemo(
    () => computeProjectionDrift({ impliedGrowth: dcfGrowth, historicalCagr, analystDrift }),
    [dcfGrowth, historicalCagr, analystDrift]
  );

  // The drift input is preloaded with our blended estimate but the user can overwrite it
  // with their own growth assumption. Re-preload (and drop any manual edit) whenever the
  // ticker changes or our estimate first arrives, but never overwrite a value the user
  // already typed for the ticker they're looking at.
  const [driftInput, setDriftInput] = useState('');
  const [driftTouched, setDriftTouched] = useState(false);
  const prevTickerRef = useRef(ticker);

  useEffect(() => {
    if (prevTickerRef.current !== ticker) {
      prevTickerRef.current = ticker;
      setDriftTouched(false);
    }
  }, [ticker]);

  useEffect(() => {
    if (!driftTouched && driftAnnual != null) setDriftInput((driftAnnual * 100).toFixed(1));
  }, [driftAnnual, driftTouched]);

  const parsedDriftInput = parseFloat(driftInput);
  const effectiveDrift = driftInput !== '' && !isNaN(parsedDriftInput) ? parsedDriftInput / 100 : driftAnnual;

  const projection = useMemo(() => {
    if (!price || effectiveDrift == null || volAnnual == null || !horizon) return null;
    // Seeded from the actual inputs (not wall-clock time) so the fan is a pure function of
    // ticker/horizon/drift/vol — reloading the page reproduces the exact same paths, and
    // the fan only reshuffles when one of these genuinely changes (e.g. the user edits drift).
    const seed = `${ticker}-${horizon.key}-${effectiveDrift.toFixed(4)}-${volAnnual.toFixed(4)}`;
    return computeProjection({
      price, driftAnnual: effectiveDrift, volAnnual,
      horizonYears: horizon.years, stepsPerYear: horizon.stepsPerYear,
      rng: createSeededRng(seed), riskFreeRate: data.riskFreeRate,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker, price, effectiveDrift, volAnnual, horizon.key]);

  const sym = curSym(currency || data.currency);

  const chartData = useMemo(() => {
    if (!projection) return [];
    return projection.points.map(p => {
      const fanKeys = Object.fromEntries(p.paths.map((v, i) => [`path${i}`, v]));
      return {
        ...p,
        base: p.p10,
        band: +(p.p90 - p.p10).toFixed(2),
        best: p.paths[projection.bestPathIndex],
        dateLabel: fmtOffset(p.t),
        ...fanKeys,
      };
    });
  }, [projection]);

  const endPoint = chartData[chartData.length - 1];

  // Scale the axis to the p10-p90 band, not to the 18 faint background paths — those are
  // pure random-walk noise for visual texture (see the footnote below), and over a 10-year
  // horizon at high volatility one of them can wander to an extreme multiple of the band by
  // chance alone. Without this, that single line would blow out the axis and squash the
  // band everyone actually cares about down to a flat line near the bottom.
  const yDomain = useMemo(() => {
    if (!chartData.length) return ['auto', 'auto'];
    const maxP90 = Math.max(...chartData.map(p => p.p90));
    return [0, +(maxP90 * 1.15).toFixed(2)];
  }, [chartData]);

  if (loading) {
    return (
      <div style={{ height: 380, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ws-text-3)', fontSize: '11px', letterSpacing: '2px' }}>
        LOADING PROJECTION...
      </div>
    );
  }

  if (!projection) {
    return (
      <div style={{ padding: '24px', color: 'var(--ws-text-3)', fontSize: '11px', textAlign: 'center' }}>
        Not enough data to build a projection for {ticker}.
      </div>
    );
  }

  return (
    <div>
      <div className="text-ws-text-3 text-[10px] tracking-[2px] border-b border-ws-border pb-1.5 mb-3 mt-6">
        PRICE PROJECTION
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 24px', background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', padding: '14px 16px', marginBottom: '16px', fontSize: '11px' }}>
        <div>
          <span className="text-ws-text-3">Annual drift</span> &nbsp;
          <input
            type="number"
            step="0.1"
            value={driftInput}
            onChange={e => { setDriftInput(e.target.value); setDriftTouched(true); }}
            style={{ width: '58px', background: 'var(--ws-bg-2)', border: '1px solid var(--ws-border)', color: 'var(--ws-text)', fontSize: '11px', fontWeight: 700, padding: '3px 5px', fontFamily: "'JetBrains Mono', monospace" }}
          />
          <span className="text-ws-text-3">%</span>
          {driftTouched && driftAnnual != null && (
            <button
              onClick={() => { setDriftInput((driftAnnual * 100).toFixed(1)); setDriftTouched(false); }}
              title="Reset to our estimate"
              style={{ marginLeft: '6px', fontSize: '9px', color: 'var(--ws-text-3)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
              reset
            </button>
          )}
        </div>
        <div><span className="text-ws-text-3">Annual volatility</span> &nbsp;<b className="text-ws-text">{(volAnnual * 100).toFixed(1)}%</b></div>
        <div><span className="text-ws-text-3">Drift sources</span> &nbsp;<b className="text-ws-text">
          {[dcfGrowth != null && 'Fundamentals', historicalCagr != null && '1Y CAGR', analystDrift != null && 'Analyst target'].filter(Boolean).join(' + ') || '—'}
        </b></div>
        <div><span className="text-ws-text-3">Vol sources</span> &nbsp;<b className="text-ws-text">
          {[historicalVol != null && '1Y realized', (data.beta != null && marketVolAnnual != null) && 'Beta × VIX'].filter(Boolean).join(' + ') || '—'}
        </b></div>
      </div>

      {closes && closes.length < MIN_RELIABLE_DAYS && (
        <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid var(--ws-red)', padding: '10px 14px', marginBottom: '16px', fontSize: '11px', color: 'var(--ws-red)', lineHeight: 1.5 }}>
          ⚠ {ticker} only has {closes.length} trading day{closes.length === 1 ? '' : 's'} of price history — recent IPOs like this one don&apos;t
          have enough data yet for a reliable volatility or growth-trend estimate. Treat this projection as a rough placeholder, not a
          real read on {ticker}&apos;s risk.
        </div>
      )}

      <div style={{ display: 'flex', gap: '1px', background: 'var(--ws-border)', marginBottom: '12px' }}>
        {HORIZONS.map(h => (
          <button key={h.key} onClick={() => setHorizonKey(h.key)}
            style={{ padding: '5px 12px', fontSize: '10px', letterSpacing: '1px', background: horizonKey === h.key ? 'var(--ws-accent)' : 'var(--ws-bg-2)', color: horizonKey === h.key ? '#000' : 'var(--ws-text-3)', border: 'none', cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace", fontWeight: horizonKey === h.key ? 700 : 500 }}>
            {h.label}
          </button>
        ))}
      </div>

      <div style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', padding: '16px' }}>
        <ResponsiveContainer width="100%" height={340}>
          <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <XAxis dataKey="dateLabel" tick={{ fill: 'var(--ws-text-3)', fontSize: 9 }} axisLine={false} tickLine={false} minTickGap={40} />
            <YAxis domain={yDomain} allowDataOverflow tick={{ fill: 'var(--ws-text-3)', fontSize: 9 }} axisLine={false} tickLine={false} width={56} tickFormatter={v => `${sym}${v.toFixed(0)}`} />
            <Tooltip
              formatter={(v, name) => {
                if (name === 'p50') return [`${sym}${v}`, 'Median (p50)'];
                if (name === 'best') return [`${sym}${v}`, 'Most probable path'];
                return null;
              }}
              labelFormatter={l => l}
              contentStyle={{ background: 'var(--ws-bg-2)', border: '1px solid var(--ws-border)', fontSize: 10 }}
            />
            <Area dataKey="base" stackId="band" fill="transparent" stroke="none" isAnimationActive={false} />
            <Area dataKey="band" stackId="band" fill="var(--ws-accent)" fillOpacity={0.12} stroke="none" isAnimationActive={false} />
            {Array.from({ length: projection.numPaths }, (_, i) => (
              <Line key={i} dataKey={`path${i}`} stroke="var(--ws-text-3)" strokeWidth={1} strokeOpacity={0.16} dot={false} isAnimationActive={false} />
            ))}
            <Line dataKey="p50" stroke="var(--ws-text-3)" strokeDasharray="4 4" strokeWidth={1.25} dot={false} isAnimationActive={false} />
            <Line dataKey="best" stroke="var(--ws-accent)" strokeWidth={2} dot={false} isAnimationActive={false} />
            {price != null && <ReferenceLine y={price} stroke="var(--ws-text-2)" strokeDasharray="2 2" />}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {endPoint && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginTop: '16px' }}>
          {[
            { label: 'BEAR (P10)', value: endPoint.p10, color: 'var(--ws-red)' },
            { label: 'BASE (P50)', value: endPoint.p50, color: 'var(--ws-text)' },
            { label: 'BULL (P90)', value: endPoint.p90, color: 'var(--ws-accent)' },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', padding: '14px 16px' }}>
              <div style={{ fontSize: '9px', fontWeight: 800, color: 'var(--ws-text-3)', letterSpacing: '1.5px', marginBottom: '6px' }}>{s.label}</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: s.color }}>{sym}{s.value}</div>
              {price != null && (
                <div style={{ fontSize: '10px', color: 'var(--ws-text-3)', marginTop: '4px' }}>
                  {s.value >= price ? '+' : ''}{(((s.value - price) / price) * 100).toFixed(1)}% vs today
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: '14px', fontSize: '10px', color: 'var(--ws-text-3)', lineHeight: 1.6 }}>
        This is a simulated scenario, not a prediction. The faint lines are {projection.numPaths} independent random walks built from {ticker}&apos;s
        historical volatility; the highlighted line is whichever one tracked the median most closely over the whole horizon — not a
        more likely outcome than the others, just the least extreme sample of the bunch. The shaded band (10th–90th percentile) is
        what actually matters here, not any single line.
      </div>
    </div>
  );
}
