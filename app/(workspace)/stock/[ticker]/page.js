'use client';
import { useState, useEffect, useMemo, useRef, use, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import StockChart from '../../../components/StockChart';
import ProjectionChart from '../../../components/workspace/stock/ProjectionChart';
import Sparkline from '../../../components/Sparkline';
import SparklineHeader from '../../../components/SparklineHeader';
import ShareCardComponent from '../../../components/ShareCard';
import AchievementToast from '../../../components/AchievementToast';
import AddHoldingModal from '../../../components/workspace/portfolio/AddHoldingModal';
import MarketStatusDot from '../../../components/workspace/MarketStatusDot';
import { LockedPanel } from '../../../components/SoftWall';
import { useUser } from '../../../components/AuthProvider';
import AdSlot from '../../../components/AdSlot';
import PaywallModal from '../../../components/workspace/PaywallModal';
import { isInGuestWatchlist, addToGuestWatchlist, removeFromGuestWatchlist } from '../../../../lib/guestWatchlist';
import { openInNewTab } from '../../../../lib/openInNewTab';
import { fmt as sharedFmt, fmtP as sharedFmtP, fmtN as sharedFmtN, formatCurrency } from '../../../../lib/formatters';
import { useStockData } from '../../../../lib/hooks/useStockData';
import { useTickerSearch } from '../../../../lib/hooks/useTickerSearch';
import {
  getDimScore as sharedGetDimScore,
  totalScore as sharedTotalScore,
  computeEasyMode,
  computeRelativeValue,
  computeFundamentalGrowth,
  computeFairValue,
} from '../../../../lib/stockScoring';
import { getCapTier, isTierAdjusted } from '../../../../lib/marketCap';

// This page shows 'N/A' for missing values instead of the shared '—' fallback.
const fmt = (val) => sharedFmt(val, 'N/A');
const fmtP = (v) => sharedFmtP(v, { fallback: 'N/A' });
const fmtN = (v, d = 2) => sharedFmtN(v, d, 'N/A');

// QoQ deltas for the Quality/Financials tabs: "now" vs. data.prevQuarter (the same figure as it
// stood immediately before the most recent 10-Q — see fetchEarningsReaction/prevQuarter in
// app/api/stock/route.js). Percentage-point deltas for metrics already expressed as a %
// (margins, ROE/ROIC, yields) — a "+1.8%" next to a margin reads as a relative move, when it's
// actually an absolute point move. Everything else (dollar amounts, ratios, day counts) uses
// relative % change instead.
const ppDelta = (now, before) => (now == null || before == null) ? null : +(now - before).toFixed(1);
const pctDelta = (now, before) => (now == null || before == null || !before) ? null : +(((now - before) / Math.abs(before)) * 100).toFixed(1);

// Green/red only tracks direction (up/down since last earnings), not whether that direction is
// good or bad for this particular metric (e.g. rising debt is a red flag, but would render
// green here same as rising revenue) — keeping the same up-is-green/down-is-red convention as
// the price header badge rather than hand-coding per-metric "good direction" semantics.
function DeltaTag({ value, unit = '%' }) {
  if (value == null || value === 0) return null;
  const up = value > 0;
  return (
    <span style={{ fontSize: '9px', fontWeight: 700, marginLeft: '6px', whiteSpace: 'nowrap', color: up ? 'var(--ws-accent)' : 'var(--ws-red)' }}>
      {up ? '▲' : '▼'}{Math.abs(value)}{unit}
    </span>
  );
}

// Animated fill bar for the main Quality Score. Was an ASCII '█'/'░' character string —
// besides not being animatable, mixing two block-drawing glyphs at a font weight (400) that
// isn't one of the loaded JetBrains Mono weights (500/700) meant the two characters could
// render via different font-matching paths and end up visually mismatched in size. A real
// div-based bar sidesteps both problems. Defined at module scope (not inside StockPage's
// render body, where the equivalent ScoreBar below lives) so its identity — and animation
// state — survives StockPage re-renders; it only replays the fill when the score itself
// changes (e.g. switching tickers), via the `score100` dependency.
function QualityScoreBar({ score100, color }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    setWidth(0);
    // setTimeout, not requestAnimationFrame — rAF never fires in a backgrounded/hidden tab
    // (verified: a bare rAF call sat un-fired for 2s+ under document.hidden), so a rAF-driven
    // trigger would silently never animate for anyone opening this in a background tab.
    // setTimeout still runs there (may be throttled, but it runs). The delay itself is
    // deliberately longer than "just force one paint" needs — this is the hero score, the
    // first thing on the page, so it mounts the instant data arrives; a near-zero delay meant
    // the fill was already mostly done by the time a human actually registers the page has
    // loaded (reported: "the bar's already filled by the time I see it"). Holding at 0% for
    // ~400ms first gives the eye an empty state to register before it fills.
    const t = setTimeout(() => setWidth(score100), 400);
    return () => clearTimeout(t);
  }, [score100]);
  return (
    <div style={{
      position: 'relative', width: '150px', height: '18px', overflow: 'hidden', flexShrink: 0,
      // The '░' look, recreated as a CSS dot grid instead of a font glyph — this is the base
      // layer the whole bar starts as, same color as the fill (not a muted gray) so it reads
      // as "the same bar, less dense" rather than a different track color, matching how '█'
      // and '░' shared one color in the original ASCII version.
      backgroundImage: `radial-gradient(circle, ${color} 1.1px, transparent 1.1px)`,
      backgroundSize: '6px 6px', backgroundColor: 'var(--ws-bg-1)',
    }}>
      <div style={{ position: 'absolute', inset: 0, width: `${width}%`, background: color, transition: 'width 1.1s cubic-bezier(0.16, 1, 0.3, 1)' }} />
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(90deg, var(--ws-bg-1) 0px, var(--ws-bg-1) 2px, transparent 2px, transparent 15px)' }} />
    </div>
  );
}

// Faceted diamond, recolored from a public-domain gemstone SVG (10 real cut facets, not a
// flat polygon) with a blue light-source gradient (light upper-left, dark lower-right) and a
// diagonal shine sweeping across it — see GemRevealBar below for why this exists.
function GemDiamondIcon({ size = 46 }) {
  return (
    <svg viewBox="0 0 231.884 231.884" width={size} height={size} style={{ overflow: 'visible' }}>
      <defs>
        <clipPath id="gemOutlineClip">
          <polygon points="110.327,15.329 65.057,80.069 40.085,15.657" />
          <polygon points="35.24,19.685 59.8,83.029 0,82.665" />
          <polygon points="1.301,88.638 62.067,89.014 107.171,216.556" />
          <polygon points="112.643,214.127 68.41,89.05 112.917,89.324" />
          <polygon points="112.935,83.357 70.218,83.095 112.845,22.137 113.072,21.821 112.959,71.823" />
          <polygon points="231.884,82.665 172.085,83.029 196.638,19.685" />
          <polygon points="191.799,15.657 166.828,80.069 121.557,15.329" />
          <polygon points="118.926,71.823 118.812,21.821 119.033,22.137 161.666,83.095 118.95,83.357" />
          <polygon points="118.961,89.324 163.474,89.05 119.242,214.127" />
          <polygon points="124.714,216.556 169.817,89.014 230.584,88.638" />
        </clipPath>
      </defs>
      <polygon fill="#85B7EB" points="110.327,15.329 65.057,80.069 40.085,15.657" />
      <polygon fill="#B5D4F4" points="35.24,19.685 59.8,83.029 0,82.665" />
      <polygon fill="#378ADD" points="1.301,88.638 62.067,89.014 107.171,216.556" />
      <polygon fill="#185FA5" points="112.643,214.127 68.41,89.05 112.917,89.324" />
      <polygon fill="#E6F1FB" points="112.935,83.357 70.218,83.095 112.845,22.137 113.072,21.821 112.959,71.823" />
      <polygon fill="#378ADD" points="231.884,82.665 172.085,83.029 196.638,19.685" />
      <polygon fill="#185FA5" points="191.799,15.657 166.828,80.069 121.557,15.329" />
      <polygon fill="#0C447C" points="118.926,71.823 118.812,21.821 119.033,22.137 161.666,83.095 118.95,83.357" />
      <polygon fill="#042C53" points="118.961,89.324 163.474,89.05 119.242,214.127" />
      <polygon fill="#0C447C" points="124.714,216.556 169.817,89.014 230.584,88.638" />
      <polygon fill="none" stroke="#E6F1FB" strokeWidth="1.5" opacity="0.4"
        points="110.327,15.329 191.799,15.657 231.884,82.665 230.584,88.638 169.817,89.014 124.714,216.556 107.171,216.556 62.067,89.014 1.301,88.638 0,82.665 40.085,15.657" />
      <g clipPath="url(#gemOutlineClip)">
        <rect x="-60" y="-20" width="50" height="280" fill="#ffffff" opacity="0.6" style={{ animation: 'gem-shine 1.8s ease-in-out 0.3s infinite' }} />
      </g>
    </svg>
  );
}

// The "blue gem" reveal — replaces the ordinary QualityScoreBar when easyMode.isBlueGem is
// true (computeEasyMode: a WIDE-moat business with CBS/OPPO/GQS all near their own individual
// max, rare enough that four textbook "wonderful businesses" — Visa, Mastercard, ASML, Eli
// Lilly — all fell short on OPPO alone; see the comment above isBlueGem in stockScoring.js).
// Sequence: fill to 100% same as the normal bar, hold, shake with escalating amplitude for
// ~1s (built tension, not idle vibration — the bar is straining against its own ceiling),
// flash + shatter into fragments, then the whole readout swaps to a blue "HIDDEN GEM" label
// next to the faceted diamond. Module-scope like QualityScoreBar, same reasoning: stable
// identity across StockPage re-renders so the sequence doesn't replay on unrelated updates.
function GemRevealBar({ score100 }) {
  const [stage, setStage] = useState('filling'); // filling -> shaking -> exploding -> revealed
  const [fillWidth, setFillWidth] = useState(0);
  const [chunks, setChunks] = useState([]);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    setStage('filling');
    setFillWidth(0);
    setChunks([]);
    setFlash(false);

    const tFill = setTimeout(() => setFillWidth(100), 400);
    const tShake = setTimeout(() => setStage('shaking'), 1500);
    const tExplode = setTimeout(() => {
      const n = 5;
      const colors = ['#5DCAA5', '#1D9E75', '#5DCAA5', '#1D9E75', '#9FE1CB'];
      setChunks(Array.from({ length: n }, (_, i) => ({
        left: (i * 130) / n, width: 130 / n, color: colors[i],
        ex: (i - (n - 1) / 2) * 22 + (Math.random() * 10 - 5),
        ey: -18 - Math.random() * 16,
        rot: Math.random() * 140 - 70,
        flying: false,
      })));
      setFlash(true);
      setStage('exploding');
      setTimeout(() => setFlash(false), 70);
      // Same reason as QualityScoreBar's fill delay: force the chunks to paint at rest before
      // flipping to their flying transform, or the transition has nothing to animate from.
      setTimeout(() => {
        setChunks(cs => cs.map(c => ({ ...c, flying: true })));
      }, 30);
    }, 2500);
    const tReveal = setTimeout(() => setStage('revealed'), 2700);

    return () => { clearTimeout(tFill); clearTimeout(tShake); clearTimeout(tExplode); clearTimeout(tReveal); };
  }, [score100]);

  const barHidden = stage === 'exploding' || stage === 'revealed';

  return (
    <div style={{ position: 'relative', height: '46px', display: 'flex', alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', opacity: stage === 'revealed' ? 0 : 1, transition: 'opacity 0.2s' }}>
        <div style={{
          position: 'relative', width: '130px', height: '18px', flexShrink: 0, overflow: 'visible',
          backgroundImage: 'radial-gradient(circle, #1D9E75 1.1px, transparent 1.1px)',
          backgroundSize: '6px 6px', backgroundColor: 'var(--ws-bg-1)',
          animation: stage === 'shaking' ? 'gem-escalate-shake 1s ease-in-out 1' : 'none',
        }}>
          <div style={{
            position: 'absolute', inset: 0, background: '#1D9E75', width: `${fillWidth}%`,
            opacity: barHidden ? 0 : 1,
            transition: 'width 1.1s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.15s',
          }} />
          <div style={{ position: 'absolute', inset: '-6px', background: '#fff', opacity: flash ? 1 : 0, transition: flash ? 'opacity 0.06s' : 'opacity 0.3s' }} />
          {chunks.map((c, i) => (
            <div key={i} style={{
              position: 'absolute', top: 0, height: '18px', left: `${c.left}px`, width: `${c.width}px`, background: c.color,
              transform: c.flying ? `translate(${c.ex}px, ${c.ey}px) rotate(${c.rot}deg)` : 'translate(0, 0) rotate(0)',
              opacity: c.flying ? 0 : 1,
              transition: 'transform 0.5s cubic-bezier(0.3, 0, 0.7, 1), opacity 0.5s',
            }} />
          ))}
        </div>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '28px', fontWeight: 700, color: '#1D9E75', lineHeight: 1 }}>{score100}</span>
      </div>

      <div style={{
        position: 'absolute', left: 0, top: '50%', marginTop: '-23px', display: 'flex', alignItems: 'center', gap: '12px',
        opacity: stage === 'revealed' ? 1 : 0, transition: 'opacity 0.3s', pointerEvents: stage === 'revealed' ? 'auto' : 'none',
      }}>
        <div style={{
          position: 'absolute', left: '4px', top: '50%', width: '64px', height: '64px', marginTop: '-32px', marginLeft: '-9px',
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(133,183,235,0.9) 0%, rgba(55,138,221,0.4) 45%, transparent 75%)',
          animation: stage === 'revealed' ? 'gem-glow-pulse 0.9s ease-out 1' : 'none', pointerEvents: 'none',
        }} />
        <div style={{ width: '46px', height: '46px', flexShrink: 0, transform: stage === 'revealed' ? 'scale(1)' : 'scale(0)', transition: 'transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
          <GemDiamondIcon size={46} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '17px', fontWeight: 700, color: '#85B7EB', letterSpacing: '0.5px', lineHeight: 1.1 }}>HIDDEN GEM</span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '9px', color: '#5a7ba0', letterSpacing: '1px' }}>QUALITY OFF THE CHARTS</span>
        </div>
      </div>
    </div>
  );
}

const CURRENCY_SYMBOLS = { USD: '$', EUR: '€', GBP: '£', JPY: '¥', CNY: '¥', CHF: 'CHF ', CAD: 'C$', AUD: 'A$', HKD: 'HK$', INR: '₹', KRW: '₩', SEK: 'kr', NOK: 'kr', DKK: 'kr' };
const curSym = (code) => !code || code === 'USD' ? '$' : (CURRENCY_SYMBOLS[code] || `${code} `);

// Market-cap tier classification (Mega/Large/Mid/Small/Micro) lives in lib/marketCap.js — the
// same module the size-calibrated Quality Score and the Small & Micro Cap screener use — so
// this page and those never classify the same company differently.
const marketCapTier = getCapTier;

// SEC Form 4 transaction codes — P/S are genuine open-market trades, everything else
// (grants, exercises, tax withholding, gifts...) moves shares for administrative reasons.
const TXN_CODE_LABELS = {
  P: 'BUY', S: 'SELL', A: 'GRANT', M: 'EXERCISE', F: 'TAX WITHHOLD', G: 'GIFT', C: 'CONVERSION',
};


const NAV = [
    { key: 'overview', label: 'OVERVIEW' },
    { key: 'quality', label: 'QUALITY' },
    { key: 'financials', label: 'FINANCIALS' },
    { key: 'dcf', label: 'VALUATION' },
    { key: 'projection', label: 'PROJECTION' },
    { key: 'insiders', label: 'INSIDERS' },
  ];

const QUESTIONS = [
  { dim: 'Management', text: 'Has management consistently met quarterly guidance?' },
  { dim: 'Management', text: 'Is exec compensation aligned with long-term metrics?' },
  { dim: 'Management', text: 'Were there significant C-suite changes in 12 months?' },
  { dim: 'Concentration', text: 'Does top-3 customers represent <30% of revenue?' },
  { dim: 'Concentration', text: 'Does the company operate in multiple geographies?' },
  { dim: 'Concentration', text: 'Does main product represent <50% of revenue?' },
  { dim: 'Op. Trend', text: 'Did operating margin improve over last 3 years?' },
  { dim: 'Op. Trend', text: 'Did FCF/share grow >8% CAGR over last 5 years?' },
  { dim: 'Op. Trend', text: 'Does ROIC exceed estimated WACC?' },
  { dim: 'Earn. Quality', text: 'Does FCF/Net Income exceed 0.8x on 3yr average?' },
  { dim: 'Earn. Quality', text: 'Are accruals as % of assets below 5%?' },
  { dim: 'Earn. Quality', text: 'Does receivables growth not exceed 2x revenue growth?' },
  { dim: 'Transparency', text: 'Does the company provide quantitative quarterly guidance?' },
  { dim: 'Transparency', text: 'Does the 10-K include specific material risk factors?' },
  { dim: 'Transparency', text: 'Do segments allow margin calculation by business unit?' },
];
const DIMS = ['Management', 'Concentration', 'Op. Trend', 'Earn. Quality', 'Transparency'];

const MiniBar = ({ data, color = 'var(--ws-text-2)' }) => {
  const max = Math.max(...data.map(d => Math.abs(d.value)));
  return (
    <ResponsiveContainer width="100%" height={80}>
      <BarChart data={data} barSize={18} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <XAxis dataKey="year" tick={{ fill: 'var(--ws-text-3)', fontSize: 9 }} axisLine={false} tickLine={false} />
        <YAxis hide domain={[0, max * 1.15]} />
        <Tooltip
          formatter={v => [`$${Math.abs(v).toFixed(1)}B`]}
          contentStyle={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', fontSize: 10 }}
        />
        <Bar dataKey="value" radius={[2, 2, 0, 0]}>
          {data.map((_, i) => <Cell key={i} fill={i === data.length - 1 ? color : color + '55'} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

// domain={['auto','auto']} on the (hidden) Y axis is what actually makes this readable —
// without it, Recharts defaults toward including 0, so a metric that only moves within a
// narrow band relative to its absolute size (e.g. revenue climbing 25% over 5 years) renders
// as a nearly flat line. Same fix already applied in Sparkline/SparklineHeader.
const MiniLine = ({ data, color = 'var(--ws-accent)' }) => (
  <ResponsiveContainer width="100%" height={60}>
    <LineChart data={data}>
      <XAxis dataKey="year" tick={{ fill: 'var(--ws-text-3)', fontSize: 9 }} axisLine={false} tickLine={false} />
      <YAxis domain={['auto', 'auto']} hide />
      <Tooltip contentStyle={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', fontSize: 10 }} />
      <Line type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} dot={{ fill: color, r: 2 }} />
    </LineChart>
  </ResponsiveContainer>
);

const ScoreBox = ({ score, size = 48 }) => {
  const c = score === null ? 'var(--ws-text-3)' : score >= 70 ? 'var(--ws-accent)' : score >= 40 ? 'var(--ws-text)' : 'var(--ws-red)';
  return (
    <div style={{ width: size, height: size, border: `1px solid ${c}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size > 40 ? '16px' : '12px', fontWeight: 600, color: c }}>
      {score ?? '—'}
    </div>
  );
};

// Half-circle speedometer for the analyst consensus, with a second needle for Traqcker's
// own Quality Score overlaid on the same dial. `score` is the 1 (strong sell) to 5 (strong
// buy) weighted average from /api/analyst-rating; `qualityScore100` is easyMode.score100
// (0-100), linearly rescaled to the same 1-5 axis so both needles share one angle formula.
// Needle angles are derived from the continuous scores directly, not the discrete labels,
// so the dial reads as continuous rather than a 5-position switch. Rotation math: the
// needle SVG is authored pointing straight up (12 o'clock); rotating it by 45°*(score-1) -
// 90 lands it at -90° (left, score=1) through 0° (up, score=3) to +90° (right, score=5).
const ANALYST_GAUGE_SEGMENTS = [
  { key: 'strongSell', color: '#ef4444' },
  { key: 'sell', color: '#f97316' },
  { key: 'hold', color: '#eab308' },
  { key: 'buy', color: '#84cc16' },
  { key: 'strongBuy', color: '#0d9488' },
];
const QUALITY_NEEDLE_COLOR = '#6366f1';
function AnalystGauge({ score, qualityScore100 }) {
  const cx = 120, cy = 108, r = 90, strokeWidth = 18;
  const toPoint = (angleDeg) => {
    const rad = (angleDeg * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy - r * Math.sin(rad)];
  };
  const arcs = ANALYST_GAUGE_SEGMENTS.map((seg, i) => {
    const startAngle = 180 - i * 36;
    const endAngle = 180 - (i + 1) * 36;
    const [x1, y1] = toPoint(startAngle);
    const [x2, y2] = toPoint(endAngle);
    return { ...seg, d: `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}` };
  });
  const rotationFor = (s) => s == null ? null : 45 * (Math.max(1, Math.min(5, s)) - 1) - 90;
  const analystRotation = rotationFor(score) ?? 0;
  const qualityScore5 = qualityScore100 == null ? null : 1 + (qualityScore100 / 100) * 4;
  const qualityRotation = rotationFor(qualityScore5);
  return (
    <svg viewBox="0 0 240 122" width="100%" height="122" style={{ display: 'block', overflow: 'visible' }}>
      {arcs.map(a => (
        <path key={a.key} d={a.d} fill="none" stroke={a.color} strokeWidth={strokeWidth} strokeLinecap="butt" />
      ))}
      
      {/* Traqcker Quality Score — a shorter, thinner tapered blade in brand teal */}
      {qualityRotation != null && (
        <g transform={`rotate(${qualityRotation} ${cx} ${cy})`} style={{ transition: 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)' }}>
          <polygon points={`${cx - 2.5},${cy} ${cx + 2.5},${cy} ${cx},${cy - 62}`} fill="var(--ws-accent)" />
          <circle cx={cx} cy={cy - 62} r="3" fill="var(--ws-accent)" stroke="var(--ws-bg-1)" strokeWidth="1" />
        </g>
      )}

      {/* Analyst consensus — the primary pointer, a long tapered blade (only if coverage exists) */}
      {score != null && (
        <g transform={`rotate(${analystRotation} ${cx} ${cy})`} style={{ transition: 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)' }}>
          <polygon points={`${cx - 4},${cy} ${cx + 4},${cy} ${cx},${cy - 76}`} fill="var(--ws-text)" />
        </g>
      )}

      {/* Center cap pivot pin — layered on top to seal the base of both needles */}
      <circle cx={cx} cy={cy} r="7" fill="var(--ws-text)" stroke="var(--ws-bg-1)" strokeWidth="1.5" />
    </svg>
  );
}

// useSearchParams() opts the whole subtree out of static prerendering unless it's inside a
// Suspense boundary — without this wrapper, `next build` fails prerendering this page instead
// of just falling back to client-side rendering for it (same pattern as app/(workspace)/search).
export default function StockPage({ params }) {
  return (
    <Suspense fallback={null}>
      <StockPageContent params={params} />
    </Suspense>
  );
}

function StockPageContent({ params }) {
  const { ticker: rawTicker } = use(params);
  const ticker = rawTicker.toUpperCase();
  const router = useRouter();
  // The "↻ Refresh data" button below navigates to ?refresh=true, but nothing ever read that
  // param — useStockData always ran with its default (cached) fetch, so the button silently did
  // nothing but reload the page. Wiring it here is what makes it force a fresh /api/stock fetch.
  const searchParams = useSearchParams();
  const forceRefresh = searchParams.get('refresh') === 'true';
  const { data, error, loading } = useStockData(ticker, { refresh: forceRefresh });
  const [tab, setTab] = useState('overview');
  const [jumpQuery, setJumpQuery] = useState('');
  const [showJumpSuggestions, setShowJumpSuggestions] = useState(false);
  const jumpInputRef = useRef(null);
  const { suggestions: jumpSuggestions } = useTickerSearch(jumpQuery, { limit: 6 });
  const goToTicker = (t, isEtf = false) => {
    const next = t.trim().toUpperCase();
    if (!next) return;
    openInNewTab(isEtf ? `/etfs/${next}` : `/stock/${next}`);
    setJumpQuery('');
    setShowJumpSuggestions(false);
    jumpInputRef.current?.blur();
  };
  const [insiderTrades, setInsiderTrades] = useState(null);
  const [insiderLoading, setInsiderLoading] = useState(false);
  const [insiderChart, setInsiderChart] = useState(null);
  const [insiderDateFilter, setInsiderDateFilter] = useState('ALL');
  const [insiderTypeFilter, setInsiderTypeFilter] = useState('ALL');
  const [insiderRoleFilter, setInsiderRoleFilter] = useState('ALL');
  const [selectedInsiderName, setSelectedInsiderName] = useState(null);
  const [answers, setAnswers] = useState({});
  const [finTab, setFinTab] = useState('snapshot');
  const [evidence, setEvidence] = useState({});
  const [sparklineData, setSparklineData] = useState(null);
  const [isPro, setIsPro] = useState(false);
  const [checkingPro, setCheckingPro] = useState(true);
  // Daily free-view limit (see /api/usage) — null until we know we're over it, so this
  // never blocks the initial render while the check is in flight (same lax pattern as
  // checkingPro above, which also doesn't hold up the page).
  const [viewGate, setViewGate] = useState(null);
  const [inWatchlist, setInWatchlist] = useState(false);
  // Existing watchlist "pies" (groups) this user already has, so Add-to-Watchlist here can
  // offer a picker instead of always dropping the ticker into General — same grouping concept
  // as app/(workspace)/watchlist/page.js's existingPies.
  const [watchlistPies, setWatchlistPies] = useState([]);
  const [showPiePicker, setShowPiePicker] = useState(false);
  const [customPieInput, setCustomPieInput] = useState('');
  const [analystRating, setAnalystRating] = useState({ ratings: null, total: 0, consensus: null, score: null, source: 'none' });
  const [expanded, setExpanded] = useState(false);
  const [sotw, setSotw] = useState(null);
  const [achievementToast, setAchievementToast] = useState(null);
  const [relatedPosts, setRelatedPosts] = useState([]);
  const [news, setNews] = useState([]);
  const [upcomingEvent, setUpcomingEvent] = useState(null);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const { isSignedIn, user, isLoaded } = useUser();
  const [showAddHolding, setShowAddHolding] = useState(false);

  useEffect(() => {
    fetch(`/api/earnings?ticker=${ticker}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        if (d.earnings && d.earnings.length > 0) {
          const sorted = d.earnings.sort((a, b) => new Date(a.date) - new Date(b.date));
          const todayStr = new Date().toISOString().slice(0, 10);
          const nextEvent = sorted.find(e => e.date >= todayStr) || sorted[sorted.length - 1];
          setUpcomingEvent(nextEvent || null);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingEvent(false));
  }, [ticker]);

  useEffect(() => {
    fetch(`/api/blog?ticker=${ticker}`).then(r => r.json()).then(d => setRelatedPosts(d.posts || [])).catch(() => {});
  }, [ticker]);

  useEffect(() => {
    fetch(`/api/filings?tickers=${ticker}`).then(r => r.json()).then(d => setNews(d.holdingsNews || [])).catch(() => {});
  }, [ticker]);

  useEffect(() => {
    if (tab !== 'insiders' || insiderTrades !== null) return;
    setInsiderLoading(true);
    fetch(`/api/insider-trades?ticker=${ticker}&limit=25`)
      .then(r => r.json())
      .then(d => setInsiderTrades(d.transactions || []))
      .catch(() => setInsiderTrades([]))
      .finally(() => setInsiderLoading(false));

    fetch(`/api/sparkline?ticker=${ticker}&range=1y`)
      .then(r => r.json())
      .then(d => setInsiderChart(d.candles || []))
      .catch(() => setInsiderChart([]));
  }, [tab, ticker, insiderTrades]);

  // Filters apply to both the table and the summary metrics so they stay consistent.
  const filteredInsiderTrades = useMemo(() => {
    if (!insiderTrades) return [];
    let rows = insiderTrades;
    if (insiderDateFilter === '30D') {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      const cutoffStr = cutoff.toISOString().slice(0, 10);
      rows = rows.filter(t => t.date >= cutoffStr);
    }
    if (insiderTypeFilter !== 'ALL') rows = rows.filter(t => t.type === insiderTypeFilter);
    if (insiderRoleFilter === 'EXEC') rows = rows.filter(t => t.isOfficer);
    if (insiderRoleFilter === 'OWNER10') rows = rows.filter(t => t.isTenPercentOwner);
    if (selectedInsiderName) rows = rows.filter(t => t.insider === selectedInsiderName);
    return rows;
  }, [insiderTrades, insiderDateFilter, insiderTypeFilter, insiderRoleFilter, selectedInsiderName]);

  // Sentiment metrics only count genuine open-market buys/sells (code P/S) — option
  // exercises, tax withholding, and gifts move shares but don't reflect a bet on the stock.
  const insiderSummary = useMemo(() => {
    const openMarket = filteredInsiderTrades.filter(t => t.isOpenMarket && t.value != null);
    if (openMarket.length === 0) return null;

    const netShares = openMarket.reduce((s, t) => s + (t.type === 'BUY' ? t.shares : -t.shares), 0);
    const netValue = openMarket.reduce((s, t) => s + (t.type === 'BUY' ? t.value : -t.value), 0);
    const totalValue = openMarket.reduce((s, t) => s + t.value, 0);

    const bySellerValue = {};
    const byBuyerValue = {};
    openMarket.forEach(t => {
      const bucket = t.type === 'SELL' ? bySellerValue : byBuyerValue;
      bucket[t.insider] = (bucket[t.insider] || 0) + t.value;
    });
    const topOf = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1])[0] || null;
    const largestSeller = topOf(bySellerValue);
    const largestBuyer = topOf(byBuyerValue);

    const ratio = totalValue > 0 ? netValue / totalValue : 0;
    const signal = ratio > 0.2
      ? { label: 'BULLISH', color: 'var(--ws-accent)' }
      : ratio < -0.2
        ? { label: 'BEARISH', color: 'var(--ws-red)' }
        : { label: 'MIXED', color: 'var(--ws-text-2)' };

    return { netShares, netValue, largestSeller, largestBuyer, signal };
  }, [filteredInsiderTrades]);

  const insiderChartData = useMemo(() => {
    if (!insiderChart?.length) return [];
    const rows = insiderChart.filter(c => c.date).map(c => ({ date: c.date, price: c.c }));
    const dateIndex = new Map(rows.map((r, i) => [r.date, i]));
    filteredInsiderTrades.forEach(t => {
      let idx = dateIndex.get(t.date);
      if (idx === undefined) idx = rows.findIndex(r => r.date >= t.date);
      if (idx === undefined || idx === -1) return;
      if (t.type === 'BUY') rows[idx].buy = rows[idx].price;
      else rows[idx].sell = rows[idx].price;
    });
    return rows;
  }, [insiderChart, filteredInsiderTrades]);

  useEffect(() => {
    if (isSignedIn && user?.id) {
      const key = `viewed_stocks_${user.id}`;
      const viewed = new Set(JSON.parse(localStorage.getItem(key) || '[]'));
      viewed.add(ticker);
      localStorage.setItem(key, JSON.stringify([...viewed]));
      if (viewed.size >= 20) unlockAchievement('stock_explorer');
    }
  }, [isSignedIn, user?.id, ticker]);

  useEffect(() => {
    fetch(`/api/sparkline?ticker=${ticker}`)
      .then(r => r.json())
      .then(d => setSparklineData(d.candles || null))
      .catch(() => {});
  }, [ticker]);

  useEffect(() => {
    // isSignedIn starts false optimistically before AuthProvider confirms the session (isLoaded
    // flips true once it has) — treating that as "really a guest" here used to set checkingPro
    // to false immediately, before the real signed-in state (and then isPro) caught up. That
    // window was enough for the viewGate effect below to run its real /api/usage check and
    // briefly show the "you've hit today's limit" paywall for signed-in Pro users, an instant
    // before isPro landed and cleared it — the flash the paywall modal shouldn't show at all.
    if (!isLoaded) return;

    if (isSignedIn) {
      fetch('/api/watchlist')
        .then(r => r.json())
        .then(d => {
          const list = d.tickers || [];
          setInWatchlist(list.some(t => t.ticker === ticker));
          setWatchlistPies([...new Set(list.map(t => t.pie).filter(Boolean))].sort());
        })
        .catch(() => {});
    } else {
      setInWatchlist(isInGuestWatchlist(ticker));
    }

    if (isSignedIn) {
      fetch('/api/subscription')
        .then(r => r.json())
        .then(d => {
          setIsPro(d.isPro);
          setCheckingPro(false);
        })
        .catch(() => setCheckingPro(false));
    } else {
      setCheckingPro(false);
    }
  }, [ticker, isSignedIn, isLoaded]);

  // Daily free-view limit — Pro (incl. the 14-day trial, see /api/subscription) is unlimited,
  // so this never even calls /api/usage for them. Every other view counts against today's
  // free quota, anonymous and signed-in-free alike (same isPro-not-isSignedIn convention the
  // screener's column gating already uses).
  useEffect(() => {
    if (checkingPro || isPro) { setViewGate(null); return; }
    let cancelled = false;
    fetch('/api/usage')
      .then(r => r.json())
      .then(d => {
        if (cancelled) return;
        if (!d.allowed) { setViewGate('blocked'); return; }
        setViewGate(null);
        fetch('/api/usage', { method: 'POST' }).catch(() => {});
      })
      .catch(() => { if (!cancelled) setViewGate(null); });
    return () => { cancelled = true; };
  }, [ticker, isPro, checkingPro]);

  useEffect(() => {
    fetch(`/api/analyst-rating?ticker=${ticker}`)
      .then(r => r.json())
      .then(d => setAnalystRating({ ratings: d.ratings, total: d.total, consensus: d.consensus, score: d.score, source: d.source || 'none' }))
      .catch(() => {});
  }, [ticker]);

  useEffect(() => {
    fetch('/api/stock-of-week')
      .then(r => r.json())
      .then(d => setSotw(d.ticker))
      .catch(() => {});
  }, []);

  const getDimScore = (dim) => sharedGetDimScore(dim, QUESTIONS, answers);
  const totalScore = () => sharedTotalScore(DIMS, QUESTIONS, answers);

  const unlockAchievement = (key) => {
    if (!user?.id) return;
    fetch('/api/achievements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, achievementKey: key }),
    })
    .then(r => r.json())
    .then(data => { if (data.unlocked) setAchievementToast(data.achievement); })
    .catch(() => {});
  };

  // `pie` only applies when adding (ignored on remove) — omitted entirely means General,
  // same convention as the /watchlist page's moveToPie and the POST route itself.
  const toggleWatchlist = async (pie) => {
    setShowPiePicker(false);
    setCustomPieInput('');
    if (!isSignedIn) {
      if (inWatchlist) {
        removeFromGuestWatchlist(ticker);
        setInWatchlist(false);
        return;
      }
      const { added, atLimit } = addToGuestWatchlist(ticker);
      if (atLimit) { window.location.href = '/sign-up'; return; }
      setInWatchlist(added);
      return;
    }
    const method = inWatchlist ? 'DELETE' : 'POST';
    const body = inWatchlist ? { ticker } : { ticker, ...(pie ? { pie } : {}) };
    const res = await fetch('/api/watchlist', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (method === 'POST') {
      const data = await res.json();
      if (data.watchlistCount >= 5) unlockAchievement('watchlist_builder');
      if (pie) setWatchlistPies(prev => prev.includes(pie) ? prev : [...prev, pie].sort());
    }
    setInWatchlist(!inWatchlist);
  };

  // Clicking "Add to Watchlist" opens a pie picker so the user can select or create a list/group;
  // removing when already in watchlist stays a single click.
  const handleWatchlistClick = () => {
    if (inWatchlist) { toggleWatchlist(); return; }
    setShowPiePicker(v => !v);
  };

  if (loading) return (
    <div style={{ padding: '24px', fontFamily: "'JetBrains Mono', monospace" }}>
      <div style={{ border: '1px solid var(--ws-border)', background: 'var(--ws-bg-1)', overflow: 'hidden', marginBottom: '16px' }}>
        <div style={{ background: 'var(--ws-bg-2)', borderBottom: '1px solid var(--ws-border)', padding: '7px 16px' }}>
          <span style={{ fontSize: '10px', color: 'var(--ws-accent)', letterSpacing: '1px' }}>$ traq {ticker}</span>
        </div>
        <div className="p-6">
          <div className="flex flex-col gap-2">
            {['CONNECTING TO SEC EDGAR...', 'FETCHING FINANCIALS...', 'COMPUTING QUALITY SCORE...'].map((line, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: 'var(--ws-accent)', fontSize: '11px' }}>▶</span>
                <span style={{ color: 'var(--ws-text-3)', fontSize: '11px', letterSpacing: '1px' }}>{line}</span>
              </div>
            ))}
            <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: 'var(--ws-text-3)', fontSize: '11px' }}>█░░░░░░░░░</span>
              <span className="text-ws-text-3 text-[10px] tracking-[1px]">LOADING {ticker}...</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ padding: '24px', fontFamily: "'JetBrains Mono', monospace" }}>
      <div style={{ border: '1px solid var(--ws-border)', background: 'var(--ws-bg-1)', overflow: 'hidden', maxWidth: '560px' }}>
        <div style={{ background: 'var(--ws-bg-2)', borderBottom: '1px solid var(--ws-border)', padding: '7px 16px' }}>
          <span style={{ fontSize: '10px', color: 'var(--ws-red)', letterSpacing: '1px' }}>$ traq {ticker} — ERROR</span>
        </div>
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <span style={{ color: 'var(--ws-red)', fontSize: '11px', marginTop: '1px' }}>✗</span>
            <span style={{ color: 'var(--ws-text-3)', fontSize: '11px', letterSpacing: '0.5px', lineHeight: 1.7 }}>
              TICKER <strong className="text-ws-text">{ticker}</strong> NOT FOUND IN SEC EDGAR OR FINNHUB.{'\n'}
              CHECK THE SYMBOL AND TRY AGAIN.
            </span>
          </div>
          <div style={{ borderTop: '1px solid var(--ws-border)', paddingTop: '16px', display: 'flex', gap: '8px' }}>
            <a href="/search" style={{ textDecoration: 'none', fontSize: '11px', letterSpacing: '1px', background: 'var(--ws-text)', color: 'var(--ws-bg)', border: 'none', fontWeight: 700, padding: '8px 16px' }}>
              NEW SEARCH
            </a>
            <a href="/screener" style={{ textDecoration: 'none', fontSize: '11px', letterSpacing: '1px', background: 'transparent', border: '1px solid var(--ws-border)', color: 'var(--ws-text-2)', padding: '8px 16px' }}>
              SCREENER
            </a>
          </div>
        </div>
      </div>
    </div>
  );

  const score = totalScore();
  const revChart = data.revHistory.map(r => ({ year: r.year, value: +(r.val / 1e9).toFixed(1) }));
  const fcfChart = data.fcfHistory.map(r => ({ year: r.year, value: +(r.val / 1e9).toFixed(1) }));

  const price = data.currentPrice;
  const change = data.priceChange;
  const changePct = data.priceChangePct;

  // Recent IPOs (and thinly-covered tickers) have no SEC/Finnhub fundamentals at all —
  // computing a Quality Score or "Numbers, Simplified" bars in that case just produces a
  // plausible-looking but entirely made-up result, since every input defaults to a neutral
  // midpoint. Show price-only instead of a wall of fabricated/N/A metrics.
  const hasFundamentals = data.revVal != null || data.niVal != null || data.marketCap != null
    || data.roic != null || data.grossMargin != null || (data.revHistory?.length ?? 0) > 0;

  const easyMode = computeEasyMode(data, hasFundamentals);
  // Same scoring/ratio pipeline, re-run on the pre-last-earnings scalars (data.prevQuarter —
  // see app/api/stock/route.js) instead of duplicating computeEasyMode's formulas here. Field
  // names in prevQuarter deliberately mirror the top-level data fields it's derived from
  // (revVal, marketCap, grossMargin, etc.), so spreading it over `data` produces a structurally
  // identical "as of before the last earnings report" snapshot. null when this ticker has no
  // prevQuarter data (non-SEC-covered tickers, or a filer's first 10-Q).
  const easyModeBefore = data.prevQuarter ? computeEasyMode({ ...data, ...data.prevQuarter }, hasFundamentals) : null;
  // Gates every tier-specific UI element below (badge, footnote narrative, Capital Discipline
  // section) — true only for small/micro, where the calibration actually differs from the
  // mid/large/mega baseline. Mid-and-up renders exactly as it did before market-cap tiering
  // existed: no badge, no extra section, same numbers.
  const tierAdjusted = isTierAdjusted(easyMode?.capTier?.id);
  // Quality-adjusted relative valuation — replaces the old 10-year forward DCF, which stacked
  // 4-5 independently uncertain assumptions (WACC via beta, a decade of reinvestment×ROIC
  // growth, a margin-recovery ramp, a terminal exit multiple) that compounded multiplicatively.
  // See computeRelativeValue in lib/stockScoring.js for the full reasoning: it blends this
  // company's own current P/FCF multiple with its sector's typical one, weighted by its own
  // Quality Score (CBS/GQS) instead of assuming full reversion to a sector average regardless
  // of who the company actually is.
  const relativeValue = computeRelativeValue(data, easyMode);
  const fairValue = computeFairValue(relativeValue?.fairValue, price);
  // Kept separate from the valuation above — the Projection tab's drift blend only needs this
  // one fundamentals-based growth number, not the old DCF's full parameter stack.
  const fundamentalGrowth = computeFundamentalGrowth(data);

  // International stocks (sourced via the Yahoo fallback, not SEC EDGAR) are the
  // freemium wedge: header, sparkline and the hero Quality Score stay free, but every
  // tab requires a free account to view.
  const isInternational = data.internationalSource === 'yahoo';
  const tabsLocked = isInternational && !isSignedIn;

  if (viewGate === 'blocked') {
    return (
      <PaywallModal
        eyebrow="TRAQCKER TERMINAL"
        title="You've hit today's free limit"
        description={isSignedIn
          ? "You've viewed 5 stocks today. Upgrade to Pro for unlimited access."
          : "You've viewed 5 stocks today. Sign up free — your first 14 days include full Pro access, no card required."}
        ctaLabel={isSignedIn ? 'Upgrade to Pro' : 'Start 14-day free trial'}
        ctaHref="/pricing"
        onClose={() => router.push('/home')}
      />
    );
  }

  return (
    <div className="p-6">

      {/* TERMINAL HERO */}
      <div style={{ border: '1px solid var(--ws-border)', background: 'var(--ws-bg-1)', marginBottom: '20px', overflow: 'hidden' }}>
        {/* Terminal title bar */}
        <div style={{ background: 'var(--ws-bg-2)', borderBottom: '1px solid var(--ws-border)', padding: '7px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: 'var(--ws-accent)', fontWeight: 700, letterSpacing: '1px' }}>
            $ traq {ticker}
          </span>
          {data.finnhubFallback && (
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '9px', color: 'var(--ws-text-3)', letterSpacing: '1px' }}>
              [LIMITED DATA]
            </span>
          )}

          {/* Jump-to-ticker search, so you can move between stocks without leaving the page */}
          <div style={{ marginLeft: 'auto', position: 'relative', width: '200px' }}>
            <input
              ref={jumpInputRef}
              value={jumpQuery}
              onChange={e => { setJumpQuery(e.target.value); setShowJumpSuggestions(true); }}
              onKeyDown={e => {
                if (e.key === 'Enter' && jumpQuery.trim()) goToTicker(jumpQuery);
                if (e.key === 'Escape') { setShowJumpSuggestions(false); jumpInputRef.current?.blur(); }
              }}
              onFocus={() => { if (jumpQuery) setShowJumpSuggestions(true); }}
              onBlur={() => setTimeout(() => setShowJumpSuggestions(false), 150)}
              placeholder="jump to ticker..."
              style={{
                width: '100%',
                height: '24px',
                padding: '0 8px',
                fontSize: '10px',
                fontFamily: "'JetBrains Mono', monospace",
                letterSpacing: '0.5px',
                border: '1px solid var(--ws-border)',
                borderRadius: 'var(--ws-radius)',
                background: 'var(--ws-bg-1)',
                color: 'var(--ws-text)',
                outline: 'none',
              }}
            />
            {showJumpSuggestions && jumpSuggestions.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '28px',
                right: 0,
                width: '260px',
                background: 'var(--ws-bg-1)',
                border: '1px solid var(--ws-border)',
                borderRadius: 'var(--ws-radius)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                maxHeight: '280px',
                overflowY: 'auto',
                zIndex: 30,
              }}>
                {jumpSuggestions.map(s => (
                  <div key={s.ticker}
                    onMouseDown={() => goToTicker(s.ticker, s.isEtf)}
                    style={{ padding: '7px 10px', cursor: 'pointer', display: 'flex', gap: '8px', alignItems: 'baseline', fontSize: '11px' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--ws-bg-2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <span style={{ color: 'var(--ws-accent)', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", minWidth: '44px' }}>{s.ticker}</span>
                    <span style={{ color: 'var(--ws-text-2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                    {s.isEtf && (
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: '9px', letterSpacing: '0.5px', color: 'var(--ws-text-3)', border: '1px solid var(--ws-border)', borderRadius: '4px', padding: '1px 4px', flexShrink: 0 }}>
                        ETF
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Terminal output body */}
        <div style={{ padding: '20px 24px' }}>
          <div className="stock-hero" style={{ padding: 0 }}>
            {/* Left: identity + price */}
            <div className="stock-hero-left" style={{ gap: '16px' }}>
              <div style={{ width: '72px', height: '72px', background: 'white', border: '1px solid var(--ws-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                <img
                  src={`https://img.logo.dev/ticker/${ticker}?token=pk_B4aaLZF6S4G1YbCgqZq2Ug`}
                  alt={data.name}
                  style={{ width: '54px', height: '54px', objectFit: 'contain' }}
                  onError={e => { e.target.style.display = 'none'; e.target.parentElement.innerHTML = `<span style="color:var(--ws-accent);font-weight:700;font-size:22px;font-family:'JetBrains Mono',monospace">${ticker.slice(0,2)}</span>`; e.target.parentElement.style.background = 'var(--ws-bg-2)'; }}
                />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', color: 'var(--ws-text-3)', letterSpacing: '1.5px' }}>
                    {ticker} · {data.exchange || 'NASDAQ'}{data.sector ? ` · ${data.sector.toUpperCase()}` : ''}
                  </span>
                  {marketCapTier(data.marketCap) && (
                    <span style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '9px',
                      fontWeight: 700,
                      letterSpacing: '1px',
                      color: marketCapTier(data.marketCap).color,
                      border: `1px solid ${marketCapTier(data.marketCap).color}`,
                      borderRadius: '4px',
                      padding: '2px 6px',
                    }}
                      title={`Market cap: ${fmt(data.marketCap)}`}
                    >
                      {marketCapTier(data.marketCap).label}
                    </span>
                  )}
                </div>
                <h1 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.5px', marginBottom: '10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.2, color: 'var(--ws-text)' }}>{data.name}</h1>
                {price && (
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '28px', fontWeight: 700, letterSpacing: '-1px', color: 'var(--ws-text)' }}>{curSym(data.currency)}{price.toFixed(2)}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', fontWeight: 700, color: change >= 0 ? 'var(--ws-accent)' : 'var(--ws-red)' }}>
                      {change >= 0 ? '+' : ''}{changePct?.toFixed(2)}%
                    </span>
                    <MarketStatusDot ticker={ticker} showLabel />
                  </div>
                )}
              </div>
            </div>

            {/* Middle: price chart */}
            <div className="stock-hero-chart">
              <SparklineHeader ticker={ticker} currency={data?.currency} />
            </div>

            {/* Right: terminal score block */}
            <div className="stock-hero-score" style={{ alignItems: 'flex-start', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '9px', letterSpacing: '2px', color: 'var(--ws-text-3)', fontWeight: 700 }}>QUALITY SCORE</div>
                {tierAdjusted && (
                  <span title={`Margin/ROIC bars and the CBS/OPPO/GQS blend are calibrated for ${easyMode.capTier.label} — see the Quality tab for the exact weighting.`}
                    style={{
                      fontFamily: "'JetBrains Mono', monospace", fontSize: '8px', fontWeight: 700, letterSpacing: '0.5px',
                      color: easyMode.capTier.color, border: `1px solid ${easyMode.capTier.color}`, borderRadius: '3px', padding: '1px 5px',
                    }}>
                    {easyMode.capTier.label} CALIBRATED
                  </span>
                )}
              </div>
              {!easyMode ? (
                <div style={{ fontSize: '11px', color: 'var(--ws-text-3)', maxWidth: '200px', lineHeight: 1.6, borderLeft: '2px solid var(--ws-border)', paddingLeft: '10px', marginTop: '2px' }}>
                  No fundamentals reported yet — likely a recent IPO or thin data coverage. Price and chart are still live.
                </div>
              ) : (
              <>
              {easyMode.isBlueGem ? (
                <GemRevealBar score100={easyMode.score100} />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <QualityScoreBar score100={easyMode.score100} color={easyMode.verdictColor} />
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '28px', fontWeight: 700, color: easyMode.verdictColor, lineHeight: 1 }}>
                    {easyMode.score100}
                  </span>
                </div>
              )}
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 700, color: easyMode.verdictColor, letterSpacing: '1px' }}>
                {easyMode.verdict.toUpperCase()}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--ws-text-3)', maxWidth: '200px', lineHeight: 1.6, borderLeft: '2px solid var(--ws-border)', paddingLeft: '10px', marginTop: '2px' }}>
                {easyMode.summary}
              </div>
              </>
              )}
            </div>
          </div>
        </div>
      </div>{/* end terminal hero */}

      <div style={{ padding: '0 0 40px' }}>

        {/* TERMINAL TAB NAV */}
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
              {n.label}{n.pro && !isPro && !checkingPro ? ' [PRO]' : ''}
            </button>
          ))}
        </div>

        {/* OVERVIEW TAB — 2-column layout */}
        {tab === 'overview' && (tabsLocked ? (
          <LockedPanel
            title="Overview"
            description="Full data for this international market unlocks with a free account."
          />
        ) : (
          <div className="stock-overview-grid">

            {/* Left column: vote + numbers + chart */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Analyst rating */}
              <div style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', padding: '20px' }}>
                <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '4px', color: 'var(--ws-text)' }}>
                  Analyst Consensus
                </div>
                {analystRating.source === 'none' || !analystRating.ratings ? (
                  easyMode ? (
                    <>
                      <div style={{ fontSize: '11px', color: 'var(--ws-text-3)', marginBottom: '10px' }}>
                        No analyst coverage available. Showing Traqcker model consensus.
                      </div>
                      <AnalystGauge score={easyMode.finalNote} qualityScore100={null} />
                      <div style={{ textAlign: 'center', fontSize: '20px', fontWeight: 800, color: easyMode.verdictColor, margin: '4px 0 16px' }}>
                        {easyMode.verdict}
                      </div>
                      <div style={{ borderTop: '1px solid var(--ws-border)', paddingTop: '14px', fontSize: '11px', color: 'var(--ws-text-2)', lineHeight: 1.6 }}>
                        This automated consensus is calculated using Traqcker's quantitative quality score metrics (CBS, OPPO, GQS) and balance sheet health.
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: '11px', color: 'var(--ws-text-3)', padding: '8px 0' }}>
                      No analyst coverage or fundamental scoring available for this ticker.
                    </div>
                  )
                ) : (() => {
                  const r = analystRating.ratings;
                  const total = analystRating.total;
                  const pct = (n) => Math.round((n / total) * 100);
                  const CONSENSUS_LABELS = {
                    strong_buy: { label: 'Strong Buy', color: '#0d9488' },
                    buy: { label: 'Buy', color: '#84cc16' },
                    hold: { label: 'Hold', color: '#eab308' },
                    sell: { label: 'Sell', color: '#f97316' },
                    strong_sell: { label: 'Strong Sell', color: '#ef4444' },
                  };
                  const c = CONSENSUS_LABELS[analystRating.consensus];
                  const rows = [
                    { key: 'strongBuy', label: 'Strong Buy', color: '#0d9488' },
                    { key: 'buy', label: 'Buy', color: '#84cc16' },
                    { key: 'hold', label: 'Hold', color: '#eab308' },
                    { key: 'sell', label: 'Sell', color: '#f97316' },
                    { key: 'strongSell', label: 'Strong Sell', color: '#ef4444' },
                  ];
                  return (
                    <>
                      <div style={{ fontSize: '11px', color: 'var(--ws-text-3)', marginBottom: '10px' }}>
                        Based on {total} analyst{total === 1 ? '' : 's'} offering ratings for {data.name}.
                      </div>
                      <AnalystGauge score={analystRating.score} qualityScore100={easyMode?.score100} />
                      {c && (
                        <div style={{ textAlign: 'center', fontSize: '20px', fontWeight: 800, color: c.color, margin: '4px 0 4px' }}>
                          {c.label}
                        </div>
                      )}
                      {easyMode && (
                        <div style={{ textAlign: 'center', fontSize: '10px', color: 'var(--ws-text-3)', marginBottom: '16px' }}>
                          <span style={{ color: QUALITY_NEEDLE_COLOR }}>●</span> Traqcker Quality Score ({easyMode.score100}/100)
                        </div>
                      )}
                      <div style={{ borderTop: '1px solid var(--ws-border)', paddingTop: '14px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', rowGap: '14px' }}>
                        {rows.map(row => (
                          <div key={row.key}>
                            <div style={{ fontSize: '11px', color: 'var(--ws-text-2)', marginBottom: '3px' }}>
                              <span style={{ color: row.color }}>●</span> {row.label}
                            </div>
                            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ws-text)' }}>
                              {r[row.key]} <span style={{ fontWeight: 400, color: 'var(--ws-text-3)' }}>analyst{r[row.key] === 1 ? '' : 's'}</span>{' '}
                              <span style={{ color: row.color }}>{pct(r[row.key])}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div style={{ marginTop: '10px', fontSize: '10px', color: 'var(--ws-text-3)', textAlign: 'center' }}>
                        Source: {analystRating.source === 'finnhub' ? 'Finnhub' : 'Yahoo Finance'}
                      </div>
                      {easyMode && c && (() => {
                        // Collapse both scales to Buy/Hold/Sell to compare directional
                        // agreement — Quality Score measures business quality/valuation,
                        // analyst consensus measures Street sentiment; they're different
                        // instruments and won't line up to the same 5-way granularity.
                        const qualityCall = easyMode.score100 >= 70 ? 'Buy' : easyMode.score100 >= 40 ? 'Hold' : 'Sell';
                        const analystCall = analystRating.consensus === 'strong_buy' || analystRating.consensus === 'buy' ? 'Buy'
                          : analystRating.consensus === 'hold' ? 'Hold' : 'Sell';
                        const agrees = qualityCall === analystCall;
                        return (
                          <div style={{ marginTop: '14px', background: 'var(--ws-bg-2)', border: '1px solid var(--ws-border)', padding: '12px 14px', fontSize: '11px', color: 'var(--ws-text-2)', lineHeight: 1.5, display: 'flex', gap: '8px' }}>
                            <span style={{ color: 'var(--ws-text-3)', flexShrink: 0 }}>ⓘ</span>
                            <span>
                              Our Quality Score model (<strong style={{ color: easyMode.verdictColor }}>{easyMode.verdict}</strong>, {easyMode.score100}/100)
                              {' '}{agrees ? 'agrees' : 'disagrees'} with the analyst consensus{' '}
                              (<strong style={{ color: c.color }}>{c.label}</strong>) rating.
                            </span>
                          </div>
                        );
                      })()}
                    </>
                  );
                })()}
              </div>

              {/* Numbers, Simplified */}
              {hasFundamentals && (
              <div>
                <div style={{ color: 'var(--ws-text-3)', fontSize: '10px', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1.5px', marginBottom: '10px', fontWeight: 700 }}>THE NUMBERS, SIMPLIFIED</div>
                <div style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {(() => {
                    // Same 3-tier (accent/neutral/red) + "unavailable" shape for every row, with the
                    // label always breaking at the same value as the color — no row should say
                    // something the color next to it contradicts.
                    const fcfMargin = data.fcfVal != null && data.revVal ? (data.fcfVal / data.revVal) * 100 : null;
                    return [
                      {
                        label: data.revGrowth == null ? 'Revenue data unavailable' : data.revGrowth > 10 ? 'Revenue is growing fast' : data.revGrowth > 0 ? 'Revenue is growing' : 'Revenue is shrinking',
                        value: data.revGrowth != null ? `${data.revGrowth > 0 ? '+' : ''}${data.revGrowth}% / yr` : 'N/A',
                        pct: data.revGrowth != null ? Math.max(4, Math.min(100, 50 + data.revGrowth * 2)) : 0,
                        color: data.revGrowth == null ? 'var(--ws-text-3)' : data.revGrowth > 10 ? 'var(--ws-accent)' : data.revGrowth > 0 ? 'var(--ws-text-2)' : 'var(--ws-red)',
                      },
                      {
                        label: data.opMargin == null ? 'Margin data unavailable' : data.opMargin > 15 ? 'Keeps a healthy slice of profit' : data.opMargin > 0 ? 'Keeps a modest slice of profit' : 'Operating at a loss',
                        value: data.opMargin != null ? `${data.opMargin}% margin` : 'N/A',
                        pct: data.opMargin != null ? Math.max(4, Math.min(100, data.opMargin * 2.5)) : 0,
                        color: data.opMargin == null ? 'var(--ws-text-3)' : data.opMargin > 15 ? 'var(--ws-accent)' : data.opMargin > 0 ? 'var(--ws-text-2)' : 'var(--ws-red)',
                      },
                      {
                        label: data.fcfVal == null ? 'Cash flow data unavailable' : fcfMargin != null && fcfMargin > 15 ? 'Strong cash generation' : data.fcfVal > 0 ? 'Generates real cash, not just paper profit' : 'Burning cash, not generating profit',
                        value: data.fcfVal == null ? 'N/A' : fcfMargin != null && fcfMargin > 15 ? 'Strong' : data.fcfVal > 0 ? 'Positive' : 'Negative',
                        pct: data.fcfVal == null ? 0 : fcfMargin != null && fcfMargin > 15 ? 90 : data.fcfVal > 0 ? 60 : 15,
                        color: data.fcfVal == null ? 'var(--ws-text-3)' : fcfMargin != null && fcfMargin > 15 ? 'var(--ws-accent)' : data.fcfVal > 0 ? 'var(--ws-text-2)' : 'var(--ws-red)',
                      },
                      (() => {
                        const de = data.debtToEquity ?? (data.equityVal != null ? 0 : null);
                        return {
                          label: de == null
                            ? 'Debt levels unavailable'
                            : de < 0
                            ? 'Negative equity — high risk'
                            : de === 0
                            ? 'Debt free — clean balance sheet'
                            : de < 1
                            ? 'Debt levels look manageable'
                            : de < 2
                            ? 'Carries some debt — worth watching'
                            : 'Highly leveraged — significant risk',
                          value: de != null ? `${de.toFixed(2)}x equity` : 'N/A',
                          pct: de != null ? (de === 0 ? 100 : Math.max(4, Math.min(100, 100 - de * 30))) : 0,
                          color: de == null
                            ? 'var(--ws-text-3)'
                            : de < 0
                            ? 'var(--ws-red)'
                            : de <= 1
                            ? 'var(--ws-accent)'
                            : de < 2
                            ? 'var(--ws-text-2)'
                            : 'var(--ws-red)',
                        };
                      })(),
                    ];
                  })().map((m, i) => (
                    <div key={i} className="flex flex-col gap-2">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
                        <span style={{ fontSize: '13px', color: 'var(--ws-text-2)', lineHeight: 1.3 }}>{m.label}</span>
                        <span style={{ fontSize: '12px', fontWeight: 700, flexShrink: 0, color: m.color }}>{m.value}</span>
                      </div>
                      <div style={{ height: '6px', background: 'var(--ws-bg-2)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${m.pct}%`, background: m.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              )}

              {/* NEWS */}
              {news.length > 0 && (
                <div>
                  <div style={{ color: 'var(--ws-text-3)', fontSize: '10px', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1.5px', marginBottom: '10px', fontWeight: 700 }}>NEWS</div>
                  <div style={{ display: 'flex', gap: '14px', overflowX: 'auto', paddingBottom: '6px' }}>
                    {news.slice(0, 5).map((n, i) => (
                      <a key={n.id || i} href={n.url} target="_blank" rel="noopener noreferrer"
                        style={{
                          flex: '0 0 220px', width: '220px', display: 'flex', flexDirection: 'column',
                          textDecoration: 'none', border: '1px solid var(--ws-border)', background: 'var(--ws-bg-1)', overflow: 'hidden',
                        }}>
                        {n.image && (
                          <img src={n.image} alt="" style={{ width: '100%', height: '120px', objectFit: 'cover', flexShrink: 0 }} />
                        )}
                        <div style={{ padding: '10px 12px' }}>
                          <div style={{
                            fontSize: '12px', fontWeight: 600, color: 'var(--ws-text)', lineHeight: 1.4, marginBottom: '8px',
                            display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                          }}>{n.title}</div>
                          <div style={{ fontSize: '10px', color: 'var(--ws-text-3)' }}>{n.source} · {n.time}</div>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Related reading */}
              {relatedPosts.length > 0 && (
                <div>
                  <div style={{ color: 'var(--ws-text-3)', fontSize: '10px', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1.5px', marginBottom: '10px', fontWeight: 700 }}>RELATED READING</div>
                  <div style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {relatedPosts.map(post => {
                      const dotColor = post.sentiment === 'positive' ? 'var(--ws-accent)' : post.sentiment === 'negative' ? 'var(--ws-red)' : 'var(--ws-text-2)';
                      return (
                        <a key={post.slug} href={`/blog/${post.slug}`}
                          style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', color: 'var(--ws-text-2)', fontSize: '12px', fontWeight: 600, lineHeight: 1.5, textDecoration: 'none' }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor, flexShrink: 0, marginTop: '4px' }} />
                          {post.title}
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>

            {/* Right column: about + fair value + share + actions + continue */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

              {/* About */}
              {data.description && (() => {
                const LIMIT = 240;
                const short = data.description.slice(0, LIMIT);
                return (
                  <div className="bg-ws-bg-1 border border-ws-border px-[18px] py-4">
                    <div style={{ fontSize: '10px', color: 'var(--ws-text-3)', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1.5px', fontWeight: 700, marginBottom: '8px' }}>ABOUT</div>
                    <div style={{ color: 'var(--ws-text-2)', fontSize: '12px', lineHeight: 1.75 }}>
                      {expanded ? data.description : `${short}${data.description.length > LIMIT ? '…' : ''}`}
                      {data.description.length > LIMIT && (
                        <span onClick={() => setExpanded(!expanded)}
                          style={{ color: 'var(--ws-accent)', cursor: 'pointer', marginLeft: '6px', fontWeight: 700, fontSize: '11px' }}>
                          {expanded ? 'Show less' : 'Read more'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Fair value — Traqcker's DCF estimate. Hidden entirely when the DCF can't
                  run (negative/missing FCF); the Valuation tab explains why. Signed-out
                  visitors get a locked card instead of the real cheap/fair/expensive call —
                  that call is the product, not something to leak for free. */}
              {fairValue && (isSignedIn ? (
                <div className="bg-ws-bg-1 border border-ws-border px-[18px] py-4">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
                    <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--ws-text)' }}>Fair value</div>
                    <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '1px', color: fairValue.tagColor, padding: '3px 8px', backgroundColor: 'var(--ws-bg-2)' }}>{fairValue.tag}</div>
                  </div>
                  <div style={{ position: 'relative', height: '10px', background: 'var(--ws-bg-2)' }}>
                    <div style={{ position: 'absolute', top: '-5px', width: '4px', height: '20px', borderRadius: '2px', background: 'var(--ws-text)', left: `${fairValue.pct}%` }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '10px', color: 'var(--ws-text-3)' }}>
                    <span>Cheap</span><span>Fair</span><span>Expensive</span>
                  </div>
                  <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--ws-text-2)', lineHeight: 1.6 }}>
                    Price: <b className="text-ws-text">{curSym(data.currency)}{price?.toFixed(2)}</b> · Estimate: <b className="text-ws-text">{curSym(data.currency)}{fairValue.estimate.toFixed(2)}</b>
                  </div>
                </div>
              ) : (
                <LockedPanel compact title="Fair value" description="Sign up free to see whether this stock trades cheap, fair or expensive according to our model." />
              ))}

              {/* Upcoming Event */}
              {(!loadingEvent || upcomingEvent) && (
                <div className="bg-ws-bg-1 border border-ws-border px-[18px] py-4">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ fontSize: '10px', color: 'var(--ws-text-3)', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1.5px', fontWeight: 700 }}>UPCOMING EVENT</div>
                    {upcomingEvent && (() => {
                      const daysDiff = Math.ceil((new Date(upcomingEvent.date + 'T00:00:00') - new Date().setHours(0,0,0,0)) / (1000 * 60 * 60 * 24));
                      let badgeText = '';
                      let badgeBg = 'var(--ws-bg-2)';
                      let badgeColor = 'var(--ws-text-2)';
                      if (daysDiff === 0) {
                        badgeText = 'TODAY';
                        badgeBg = 'var(--ws-accent-dim)';
                        badgeColor = 'var(--ws-accent)';
                      } else if (daysDiff === 1) {
                        badgeText = 'TOMORROW';
                        badgeBg = 'var(--ws-accent-dim)';
                        badgeColor = 'var(--ws-accent)';
                      } else if (daysDiff > 1) {
                        badgeText = `IN ${daysDiff} DAYS`;
                        badgeBg = 'var(--ws-accent-dim)';
                        badgeColor = 'var(--ws-accent)';
                      } else if (daysDiff === -1) {
                        badgeText = 'YESTERDAY';
                        badgeBg = 'rgba(239, 68, 68, 0.1)';
                        badgeColor = 'var(--ws-red)';
                      } else if (daysDiff < -1) {
                        badgeText = `${Math.abs(daysDiff)} DAYS AGO`;
                        badgeBg = 'var(--ws-bg-2)';
                        badgeColor = 'var(--ws-text-3)';
                      }
                      return (
                        <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.5px', background: badgeBg, color: badgeColor, padding: '2px 6px', borderRadius: '3px' }}>
                          {badgeText}
                        </div>
                      );
                    })()}
                  </div>
                  {upcomingEvent ? (
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ws-text)' }}>
                        Earnings Report
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--ws-text-2)', marginTop: '4px', lineHeight: 1.4 }}>
                        <span>
                          {new Date(upcomingEvent.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                        <span className="text-ws-text-3"> · </span>
                        <span>
                          {upcomingEvent.hour === 'bmo' ? 'Before Open' : upcomingEvent.hour === 'amc' ? 'After Close' : 'Time TBD'}
                        </span>
                        {upcomingEvent.epsActual != null && (
                          <>
                            <span className="text-ws-text-3"> · </span>
                            <span>
                              EPS: ${upcomingEvent.epsActual.toFixed(2)}
                              {upcomingEvent.epsEstimate != null && ` (est. $${upcomingEvent.epsEstimate.toFixed(2)})`}
                              <DeltaTag value={upcomingEvent.surprisePercent} />
                            </span>
                          </>
                        )}
                        {upcomingEvent.epsActual == null && upcomingEvent.epsEstimate != null && (
                          <>
                            <span className="text-ws-text-3"> · </span>
                            <span>Est. EPS: ${upcomingEvent.epsEstimate.toFixed(2)}</span>
                          </>
                        )}
                        {upcomingEvent.source === 'nasdaq' && (
                          <>
                            <span className="text-ws-text-3"> · </span>
                            <span title="Not yet confirmed by our primary data source — estimated date">Est. date</span>
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: '12px', color: 'var(--ws-text-3)' }}>
                      No earnings events scheduled in the next 90 days.
                    </div>
                  )}
                </div>
              )}

              {/* Stock of the week */}
              {sotw === ticker && (
                <div style={{ background: 'var(--ws-accent-dim)', border: '1px solid var(--ws-accent)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div>
                    <div style={{ color: 'var(--ws-accent)', fontWeight: 700, fontSize: '11px', letterSpacing: '0.5px' }}>STOCK OF THE WEEK</div>
                    <div style={{ color: 'var(--ws-text-2)', fontSize: '12px', marginTop: '2px' }}>{ticker} is this week's community pick.</div>
                  </div>
                </div>
              )}

              {/* Share */}
              <div className="bg-ws-bg-1 border border-ws-border px-[18px] py-4">
                <div style={{ fontSize: '10px', color: 'var(--ws-text-3)', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1.5px', fontWeight: 700, marginBottom: '12px' }}>SHARE</div>
                 <ShareCardComponent
                  ticker={ticker}
                  name={data?.name || 'N/A'}
                  score={easyMode?.score100 ?? 50}
                />
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2">
                <a href={data.cik ? `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${data.cik}&type=10-K` : `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=${encodeURIComponent(data.name)}&type=10-K&dateb=&owner=include&count=10&search_text=&action=getcompany`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ textAlign: 'center', fontSize: '12px', padding: '10px 8px', background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', color: 'var(--ws-text)', textDecoration: 'none' }}>
                  SEC Filings ↗
                </a>
                <div style={{ position: 'relative' }}>
                  <button onClick={handleWatchlistClick}
                    style={inWatchlist
                      ? { fontSize: '12px', padding: '10px 8px', width: '100%', background: 'var(--ws-text)', color: 'var(--ws-bg)', border: 'none', fontWeight: 600, cursor: 'pointer' }
                      : { fontSize: '12px', padding: '10px 8px', width: '100%', background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', color: 'var(--ws-text)', cursor: 'pointer' }}>
                    {inWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist'}
                  </button>
                  {showPiePicker && (
                    <>
                      <div onClick={() => setShowPiePicker(false)} style={{ position: 'fixed', inset: 0, zIndex: 998 }} />
                      <div style={{
                        position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 999,
                        background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.15)', maxHeight: '240px', overflowY: 'auto',
                      }}>
                        <div style={{ fontSize: '9px', color: 'var(--ws-text-3)', letterSpacing: '1px', padding: '8px 12px 4px' }}>
                          ADD TO WATCHLIST
                        </div>
                        <button onClick={() => toggleWatchlist()}
                          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '11px', background: 'none', border: 'none', borderTop: '1px solid var(--ws-border)', color: 'var(--ws-text)', cursor: 'pointer' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--ws-bg-2)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                          General
                        </button>
                        {watchlistPies.map(p => (
                          <button key={p} onClick={() => toggleWatchlist(p)}
                            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '11px', background: 'none', border: 'none', borderTop: '1px solid var(--ws-border)', color: 'var(--ws-text)', cursor: 'pointer' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--ws-bg-2)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                            {p}
                          </button>
                        ))}
                        <div style={{ borderTop: '1px solid var(--ws-border)', padding: '6px 8px' }}>
                          <form onSubmit={(e) => { e.preventDefault(); if (customPieInput.trim()) toggleWatchlist(customPieInput.trim()); }}>
                            <input
                              type="text"
                              placeholder="+ Create new list..."
                              value={customPieInput}
                              onChange={e => setCustomPieInput(e.target.value)}
                              style={{
                                width: '100%', fontSize: '10px', padding: '5px 6px',
                                background: 'var(--ws-bg-2)', border: '1px solid var(--ws-border)',
                                color: 'var(--ws-text)', outline: 'none', fontFamily: "'JetBrains Mono', monospace"
                              }}
                            />
                          </form>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <button onClick={() => { if (!isSignedIn) { window.location.href = '/sign-in'; return; } setShowAddHolding(true); }}
                  style={{ fontSize: '12px', padding: '10px 8px', width: '100%', background: 'var(--ws-accent)', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }}>
                  + Add to Portfolio
                </button>
                <button onClick={() => { window.location.href = `/stock/${ticker}?refresh=true`; }}
                  style={{ fontSize: '12px', padding: '10px 8px', width: '100%', background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', color: 'var(--ws-text)', cursor: 'pointer' }}>
                  ↻ Refresh data
                </button>
              </div>

              <div style={{ color: 'var(--ws-text-3)', fontSize: '10px', letterSpacing: '1px', paddingTop: '4px' }}>
                SOURCE: SEC EDGAR (XBRL) · ALPHA VANTAGE · FINNHUB · NOT INVESTMENT ADVICE
              </div>

            </div>
          </div>
        ))}

        {/* QUALITY TAB */}
        {tab === 'quality' && easyMode && (!isSignedIn ? (
          <LockedPanel
            title="Quality Score"
            description="The full Quality Score breakdown unlocks with a free account."
          />
        ) : (
  <div>
    {(() => {
      const isFinancial = (data.sector || '').toLowerCase().includes('bank')
        || (data.sector || '').toLowerCase().includes('insurance')
        || (data.sector || '').toLowerCase().includes('financial');

      const scoreColor = (s) => s >= 4 ? 'var(--ws-accent)' : s >= 3 ? 'var(--ws-text)' : 'var(--ws-red)';
      const ScoreBar = ({ score }) => (
        <div style={{ height: '3px', background: 'var(--ws-border)', marginTop: '8px', borderRadius: '2px' }}>
          <div style={{ width: `${(score / 5) * 100}%`, height: '100%', background: scoreColor(score), borderRadius: '2px' }} />
        </div>
      );

      return (
        <>
          <div style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', padding: '24px', overflow: 'hidden', marginBottom: '24px' }}>
            <div className="quality-score-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: '1px', background: 'var(--ws-border)' }}>
              {[
                { label: 'CORE BUSINESS', score: easyMode.cbs, desc: 'ROIC · Margins · Liquidity' },
                { label: 'OPPO SCORE', score: easyMode.oppo, desc: 'P/FCF · FCF Yield' },
                { label: 'GROWTH QUALITY', score: easyMode.gqs, desc: 'Revenue · R&D · SBC' },
                { label: 'MOAT', text: easyMode.moat, color: easyMode.moatColor, desc: 'ROIC · Op. margin' },
                { label: 'FINAL NOTE', score: easyMode.finalNote, desc: 'Weighted composite', highlight: true },
              ].map(s => (
                <div key={s.label} style={{ background: s.highlight ? 'var(--ws-bg-2)' : 'var(--ws-bg-1)', padding: '12px 8px', textAlign: 'center' }}>
                  <div style={{ color: 'var(--ws-text-3)', fontSize: '8px', letterSpacing: '1px', marginBottom: '8px', lineHeight: 1.3 }}>{s.label}</div>
                  <div style={{ fontSize: s.text ? '18px' : s.highlight ? '36px' : '30px', fontWeight: 700, color: s.text ? s.color : scoreColor(s.score), letterSpacing: '-1px', lineHeight: 1, marginTop: s.text ? '9px' : 0 }}>
                    {s.text || Math.round(s.score * 20)}
                  </div>
                  <div style={{ color: 'var(--ws-text-3)', fontSize: '8px', marginTop: '4px', lineHeight: 1.3 }}>{s.desc}</div>
                  {!s.text && <ScoreBar score={s.score} />}
                </div>
              ))}
            </div>
            <div style={{ color: 'var(--ws-text-3)', fontSize: '10px', letterSpacing: '1px', marginTop: '12px', textAlign: 'center' }}>
              AUTOMATED SCORE · BASED ON SEC EDGAR & FINNHUB · NOT A BUY/SELL SIGNAL · CBS {Math.round(easyMode.capTier.weights.cbs * 100)}% · OPPO {Math.round(easyMode.capTier.weights.oppo * 100)}% · GQS {Math.round(easyMode.capTier.weights.gqs * 100)}% · MOAT ±20%
            </div>
            {tierAdjusted && (
              <div style={{ color: 'var(--ws-text-3)', fontSize: '10px', lineHeight: 1.6, marginTop: '8px', textAlign: 'center', maxWidth: '520px', marginLeft: 'auto', marginRight: 'auto' }}>
                Weighted toward Growth Quality (GQS) over Core Business (CBS) — at {easyMode.capTier.label.toLowerCase()} scale, growth trajectory is the thesis, and demanding mega-cap-level stability would unfairly punish an earlier-stage business. Mid cap and up are unaffected — this recalibration only applies here.
              </div>
            )}
          </div>

          <div className="text-ws-text-3 text-[10px] tracking-[2px] border-b border-ws-border pb-1.5 mb-3">CORE BUSINESS BREAKDOWN</div>
          <div className="grid-5" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1px', background: 'var(--ws-border)', marginBottom: '24px' }}>
            {[
              {
                label: 'ROIC', val: fmtP(easyMode.roicForScore), score: easyMode.roicScore,
                desc: easyMode.roicForScore == null && data.currentLiabilitiesVal == null
                  ? 'N/A for banks/brokerages — unclassified balance sheet, no Current Liabilities to compute invested capital'
                  : `Threshold: ${(easyMode.roicThreshold * 100).toFixed(0)}% for ${data.sector || 'this sector'}${tierAdjusted ? ` (${easyMode.capTier.short} Cap)` : ''}`,
                delta: ppDelta(easyMode.roicForScore, easyModeBefore?.roicForScore), deltaUnit: 'pp',
              },
              { label: isFinancial ? 'NET MARGIN' : 'GROSS MARGIN', val: isFinancial ? fmtP(data.netMargin) : fmtP(data.grossMargin), score: easyMode.gmScore, desc: `Threshold: ${(easyMode.gmThreshold * 100).toFixed(0)}% for ${data.sector || 'this sector'}${tierAdjusted ? ` (${easyMode.capTier.short} Cap)` : ''}`, delta: isFinancial ? ppDelta(data.netMargin, data.prevQuarter?.netMargin) : ppDelta(data.grossMargin, data.prevQuarter?.grossMargin), deltaUnit: 'pp' },
              { label: 'OP. MARGIN', val: fmtP(data.opMargin), score: easyMode.omScore, desc: `Threshold: ${(easyMode.omThreshold * 100).toFixed(0)}% for ${data.sector || 'this sector'}${tierAdjusted ? ` (${easyMode.capTier.short} Cap)` : ''}`, delta: ppDelta(data.opMargin, data.prevQuarter?.opMargin), deltaUnit: 'pp' },
              { label: 'DEBT/EQUITY', val: fmtN(easyMode.netDebtToEquity), score: easyMode.deScore, desc: 'Net of cash · lower is better', delta: pctDelta(easyMode.netDebtToEquity, easyModeBefore?.netDebtToEquity) },
              { label: 'CURRENT RATIO', val: easyMode.currentRatio != null ? `${easyMode.currentRatio.toFixed(2)}x` : 'N/A', score: easyMode.crScore, desc: 'Current assets / liabilities', delta: pctDelta(easyMode.currentRatio, easyModeBefore?.currentRatio) },
            ].map(m => (
              <div key={m.label} className="bg-ws-bg-1 p-4">
                <div className="flex justify-between mb-2">
                  <span className="text-ws-text-3 text-[10px] tracking-[1px]">{m.label}</span>
                  <span style={{ color: scoreColor(m.score), fontSize: '10px' }}>{Math.round(m.score * 20)}/100</span>
                </div>
                <div style={{ fontSize: '28px', fontWeight: 600, color: scoreColor(m.score), marginBottom: '4px', display: 'flex', alignItems: 'baseline' }}>
                  {m.val}<DeltaTag value={m.delta} unit={m.deltaUnit ?? '%'} />
                </div>
                <div className="text-ws-text-3 text-[10px]">{m.desc}</div>
              </div>
            ))}
          </div>

          {/* Small/micro only — dilution, cash runway and insider ownership carry zero weight
              in CBS at mid cap and up (capTier.capitalDisciplineWeight === 0 there), so the
              section is hidden entirely rather than shown with a score that can't move. */}
          {tierAdjusted && (
            <>
              <div className="text-ws-text-3 text-[10px] tracking-[2px] border-b border-ws-border pb-1.5 mb-3">
                CAPITAL DISCIPLINE — {Math.round(easyMode.capTier.capitalDisciplineWeight * 100)}% OF CBS FOR {easyMode.capTier.label}
              </div>
              <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: 'var(--ws-border)', marginBottom: '24px' }}>
                {[
                  {
                    label: 'DILUTION (HISTORICAL)', val: easyMode.shareDilution != null ? `${easyMode.shareDilution > 0 ? '+' : ''}${easyMode.shareDilution}%` : 'N/A',
                    score: easyMode.dilutionScore, desc: 'Diluted share count, oldest to latest reported year',
                  },
                  {
                    label: 'CASH RUNWAY', val: data.fcfVal != null && data.fcfVal >= 0 ? 'FCF+' : easyMode.cashRunwayYears != null ? `${easyMode.cashRunwayYears.toFixed(1)}y` : 'N/A',
                    score: easyMode.runwayScore, desc: data.fcfVal != null && data.fcfVal >= 0 ? 'Not burning cash' : 'Cash on hand ÷ annual FCF burn',
                  },
                  {
                    label: 'INSIDER OWNERSHIP', val: easyMode.insiderOwnershipPct != null ? `${easyMode.insiderOwnershipPct}%` : 'N/A',
                    score: easyMode.ownershipScore, desc: 'Skin in the game · from recent SEC Form 4 filings',
                  },
                ].map(m => (
                  <div key={m.label} className="bg-ws-bg-1 p-4">
                    <div className="flex justify-between mb-2">
                      <span className="text-ws-text-3 text-[10px] tracking-[1px]">{m.label}</span>
                      <span style={{ color: scoreColor(m.score), fontSize: '10px' }}>{Math.round(m.score * 20)}/100</span>
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: 600, color: scoreColor(m.score), marginBottom: '4px' }}>{m.val}</div>
                    <div className="text-ws-text-3 text-[10px]">{m.desc}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="text-ws-text-3 text-[10px] tracking-[2px] border-b border-ws-border pb-1.5 mb-3">OPPORTUNITY BREAKDOWN</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1px', background: 'var(--ws-border)', marginBottom: '24px' }}>
            {[
              { label: 'P/FCF', val: fmtN(easyMode.truePfcf), score: easyMode.pfcfScore, desc: easyMode.truePfcf < 20 ? 'Attractive entry' : easyMode.truePfcf < 35 ? 'Fair valuation' : 'Expensive', delta: pctDelta(easyMode.truePfcf, easyModeBefore?.truePfcf) },
              { label: 'FCF YIELD', val: easyMode.trueFcfYield != null ? `${easyMode.trueFcfYield.toFixed(2)}%` : 'N/A', score: easyMode.fcfYieldScore, desc: easyMode.trueFcfYield > 5 ? 'Strong yield' : easyMode.trueFcfYield > 2 ? 'Moderate yield' : 'Low yield', delta: ppDelta(easyMode.trueFcfYield, easyModeBefore?.trueFcfYield), deltaUnit: 'pp' },
            ].map(m => (
              <div key={m.label} className="bg-ws-bg-1 p-4">
                <div className="flex justify-between mb-2">
                  <span className="text-ws-text-3 text-[10px] tracking-[1px]">{m.label}</span>
                  <span style={{ color: scoreColor(m.score), fontSize: '10px' }}>{Math.round(m.score * 20)}/100</span>
                </div>
                <div style={{ fontSize: '28px', fontWeight: 600, color: scoreColor(m.score), marginBottom: '4px', display: 'flex', alignItems: 'baseline' }}>
                  {m.val}<DeltaTag value={m.delta} unit={m.deltaUnit ?? '%'} />
                </div>
                <div className="text-ws-text-3 text-[10px]">{m.desc}</div>
              </div>
            ))}
            <div className="bg-ws-bg-1 p-4">
              <div style={{ color: 'var(--ws-text-3)', fontSize: '10px', letterSpacing: '1px', marginBottom: '8px' }}>52W RANGE</div>
              {data.high52 && data.low52 && data.currentPrice ? (() => {
                const pct = Math.round(((data.currentPrice - data.low52) / (data.high52 - data.low52)) * 100);
                const color = pct < 30 ? 'var(--ws-accent)' : pct > 75 ? 'var(--ws-red)' : 'var(--ws-text)';
                return (
                  <>
                    <div style={{ fontSize: '28px', fontWeight: 600, color, marginBottom: '4px' }}>{pct}%</div>
                    <div style={{ color: 'var(--ws-text-3)', fontSize: '10px', marginBottom: '10px' }}>
                      {pct < 30 ? 'Near 52W low' : pct > 75 ? 'Near 52W high' : 'Mid range'}
                    </div>
                    <div style={{ position: 'relative', height: '3px', background: 'var(--ws-border)', borderRadius: '2px', marginBottom: '6px' }}>
                      <div style={{ position: 'absolute', left: `${pct}%`, top: '-3px', width: '2px', height: '9px', background: color, borderRadius: '1px' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--ws-text-3)' }}>
                      <span>${data.low52}</span>
                      <span>${data.high52}</span>
                    </div>
                  </>
                );
              })() : <div className="text-ws-text-3 text-[10px]">N/A</div>}
            </div>
          </div>

          <div className="text-ws-text-3 text-[10px] tracking-[2px] border-b border-ws-border pb-1.5 mb-3">GROWTH QUALITY BREAKDOWN</div>
          <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: 'var(--ws-border)', marginBottom: '24px' }}>
            <div className="bg-ws-bg-1 p-4">
              <div className="flex justify-between mb-2">
                <span className="text-ws-text-3 text-[10px] tracking-[1px]">REVENUE GROWTH</span>
                <span style={{ color: scoreColor(easyMode.revGrowthScore), fontSize: '10px' }}>{Math.round(easyMode.revGrowthScore * 20)}/100</span>
              </div>
              <div style={{ fontSize: '22px', fontWeight: 600, color: scoreColor(easyMode.revGrowthScore), marginBottom: '8px', display: 'flex', alignItems: 'baseline' }}>
                {data.revGrowth !== null ? `${data.revGrowth > 0 ? '+' : ''}${data.revGrowth}%` : 'N/A'}
                <DeltaTag value={ppDelta(data.revGrowth, data.prevQuarter?.revGrowth)} unit="pp" />
              </div>
              <MiniLine data={revChart} color={scoreColor(easyMode.revGrowthScore)} />
            </div>
            <div className="bg-ws-bg-1 p-4">
              <div className="flex justify-between mb-2">
                <span className="text-ws-text-3 text-[10px] tracking-[1px]">R&D / REVENUE</span>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 600, color: 'var(--ws-text)', marginBottom: '4px', display: 'flex', alignItems: 'baseline' }}>
                {easyMode.rdToRevenue != null ? `${(easyMode.rdToRevenue * 100).toFixed(1)}%` : 'N/A'}
                <DeltaTag value={ppDelta(easyMode.rdToRevenue != null ? easyMode.rdToRevenue * 100 : null, easyModeBefore?.rdToRevenue != null ? easyModeBefore.rdToRevenue * 100 : null)} unit="pp" />
              </div>
              <div className="text-ws-text-3 text-[10px]">
                {easyMode.rdToRevenue == null ? 'Not reported' : easyMode.rdToRevenue > 0.15 ? 'Heavy reinvestment (+)' : easyMode.rdToRevenue < 0.05 ? 'Light reinvestment (−)' : 'Moderate reinvestment'}
              </div>
            </div>
            <div className="bg-ws-bg-1 p-4">
              <div className="flex justify-between mb-2">
                <span className="text-ws-text-3 text-[10px] tracking-[1px]">SBC / REVENUE</span>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 600, color: 'var(--ws-text)', marginBottom: '4px', display: 'flex', alignItems: 'baseline' }}>
                {easyMode.sbcToRevenue != null ? `${(easyMode.sbcToRevenue * 100).toFixed(1)}%` : 'N/A'}
                <DeltaTag value={ppDelta(easyMode.sbcToRevenue != null ? easyMode.sbcToRevenue * 100 : null, easyModeBefore?.sbcToRevenue != null ? easyModeBefore.sbcToRevenue * 100 : null)} unit="pp" />
              </div>
              <div className="text-ws-text-3 text-[10px]">
                {easyMode.sbcToRevenue == null ? 'Not reported' : easyMode.sbcToRevenue > 0.10 ? 'High dilution risk (−)' : easyMode.sbcToRevenue < 0.04 ? 'Low dilution (+)' : 'Moderate dilution'}
              </div>
            </div>
          </div>

          <div className="text-ws-text-3 text-[10px] tracking-[1px]">
            SECTOR-ADJUSTED THRESHOLDS · CBS = MARGINS + DEBT/EQUITY + CURRENT RATIO + ROIC (20% each) + SURPLUS CASH BONUS · OPPO = P/FCF×55% + FCF YIELD×45% · GQS = ROIC×50% + REV GROWTH×50% ± R&D/SBC INTENSITY
          </div>
        </>
      );
    })()}
  </div>
))}

        {/* FINANCIALS TAB */}
        {tab === 'financials' && (tabsLocked ? (
          <LockedPanel
            title="Financials"
            description="Full financial statements unlock with a free account."
          />
        ) : (
  <div>
    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
      {[['snapshot', 'SNAPSHOT'], ['income', 'INCOME'], ['balance', 'BALANCE'], ['cashflow', 'CASH FLOW']].map(([key, label]) => (
        <button key={key} onClick={() => setFinTab(key)}
          style={{ flex: 1, padding: '10px 8px', fontSize: '13px', letterSpacing: '0.3px', background: finTab === key ? 'var(--ws-text)' : 'var(--ws-bg-1)', color: finTab === key ? 'var(--ws-bg)' : 'var(--ws-text-2)', border: finTab === key ? 'none' : '1px solid var(--ws-border)', cursor: 'pointer', fontWeight: 600 }}>
          {label}
        </button>
      ))}
    </div>

    {finTab === 'snapshot' && <div>
              <div style={{ marginBottom: '16px' }}>
  <div className="grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>

    <div className="bg-ws-bg-1 border border-ws-border p-4">
      <div className="text-ws-text-3 text-[10px] tracking-[2px] mb-3">VALUATION</div>
      <table className="w-full border-collapse text-[11px]">
        <tbody>
          {[
            { label: 'Market Cap', val: fmt(data.marketCap), delta: pctDelta(data.marketCap, data.prevQuarter?.marketCap) },
            { label: 'P/E', val: fmtN(data.pe), color: data.pe > 0 && data.pe < 20 ? 'var(--ws-accent)' : data.pe > 40 ? 'var(--ws-red)' : 'var(--ws-text)', delta: pctDelta(data.pe, data.prevQuarter?.pe) },
            { label: 'P/FCF', val: fmtN(easyMode?.truePfcf ?? data.pfcf), color: (easyMode?.truePfcf ?? data.pfcf) > 0 && (easyMode?.truePfcf ?? data.pfcf) < 20 ? 'var(--ws-accent)' : (easyMode?.truePfcf ?? data.pfcf) > 40 ? 'var(--ws-red)' : 'var(--ws-text)', delta: pctDelta(easyMode?.truePfcf ?? data.pfcf, easyModeBefore?.truePfcf ?? data.prevQuarter?.pfcf) },
            { label: 'EV/EBITDA', val: fmtN(data.evEbitda), delta: pctDelta(data.evEbitda, data.prevQuarter?.evEbitda) },
            { label: 'P/B', val: fmtN(data.priceToBook), delta: pctDelta(data.priceToBook, data.prevQuarter?.priceToBook) },
            { label: 'FCF Yield', val: (easyMode?.trueFcfYield ?? data.fcfYield) ? `${(easyMode?.trueFcfYield ?? data.fcfYield).toFixed(2)}%` : 'N/A', color: (easyMode?.trueFcfYield ?? data.fcfYield) > 5 ? 'var(--ws-accent)' : (easyMode?.trueFcfYield ?? data.fcfYield) > 0 ? 'var(--ws-text-2)' : 'var(--ws-red)', delta: ppDelta(easyMode?.trueFcfYield ?? data.fcfYield, easyModeBefore?.trueFcfYield ?? data.prevQuarter?.fcfYield), deltaUnit: 'pp' },
            { label: 'Div. Yield', val: data.dividendYield ? `${(+data.dividendYield).toFixed(2)}%` : '—' },
          ].map(r => (
            <tr key={r.label} className="border-b border-ws-border">
              <td className="py-1 text-ws-text-3 text-[10px]">{r.label}</td>
              <td style={{ padding: '4px 0', textAlign: 'right', color: r.color || 'var(--ws-text)', fontSize: '11px', fontWeight: 500 }}>{r.val}<DeltaTag value={r.delta} unit={r.deltaUnit ?? '%'} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    <div className="bg-ws-bg-1 border border-ws-border p-4">
      <div className="text-ws-text-3 text-[10px] tracking-[2px] mb-3">PROFITABILITY</div>
      <table className="w-full border-collapse text-[11px]">
        <tbody>
          {[
            { label: 'Gross Margin', val: fmtP(data.grossMargin), color: data.grossMargin > 50 ? 'var(--ws-accent)' : data.grossMargin > 30 ? 'var(--ws-text-2)' : 'var(--ws-red)', delta: ppDelta(data.grossMargin, data.prevQuarter?.grossMargin), deltaUnit: 'pp' },
            { label: 'Op. Margin', val: fmtP(data.opMargin), color: data.opMargin > 20 ? 'var(--ws-accent)' : data.opMargin > 10 ? 'var(--ws-text-2)' : 'var(--ws-red)', delta: ppDelta(data.opMargin, data.prevQuarter?.opMargin), deltaUnit: 'pp' },
            { label: 'Net Margin', val: fmtP(data.netMargin), color: data.netMargin > 15 ? 'var(--ws-accent)' : data.netMargin > 5 ? 'var(--ws-text-2)' : 'var(--ws-red)', delta: ppDelta(data.netMargin, data.prevQuarter?.netMargin), deltaUnit: 'pp' },
            { label: 'ROE', val: fmtP(data.roe), color: data.roe > 20 ? 'var(--ws-accent)' : data.roe > 10 ? 'var(--ws-text-2)' : 'var(--ws-red)', delta: ppDelta(data.roe, data.prevQuarter?.roe), deltaUnit: 'pp' },
            { label: 'ROA', val: fmtP(data.roa), color: data.roa > 10 ? 'var(--ws-accent)' : data.roa > 5 ? 'var(--ws-text-2)' : 'var(--ws-red)', delta: ppDelta(data.roa, data.prevQuarter?.roa), deltaUnit: 'pp' },
            {
              label: 'ROIC', val: fmtP(data.roic), color: data.roic > 15 ? 'var(--ws-accent)' : data.roic > 8 ? 'var(--ws-text-2)' : 'var(--ws-red)', delta: ppDelta(data.roic, data.prevQuarter?.roic), deltaUnit: 'pp',
              title: data.roic == null && data.currentLiabilitiesVal == null
                ? 'ROIC needs Current Liabilities to compute invested capital. Banks and brokerages report an unclassified balance sheet (no current/non-current split — that distinction doesn’t apply to deposits and financial instruments), so this figure isn’t available for financial institutions. See ROE/ROA instead.'
                : undefined,
            },
            { label: 'SBC', val: fmt(data.sbcVal), delta: pctDelta(data.sbcVal, data.prevQuarter?.sbcVal) },
            { label: 'Dividends Paid', val: fmt(data.dividendsPaidVal), delta: pctDelta(data.dividendsPaidVal, data.prevQuarter?.dividendsPaidVal) },
          ].map(r => (
            <tr key={r.label} className="border-b border-ws-border">
              <td className="py-1 text-ws-text-3 text-[10px]">{r.label}</td>
              <td title={r.title} style={{ padding: '4px 0', textAlign: 'right', color: r.color || 'var(--ws-text)', fontSize: '11px', fontWeight: 500, cursor: r.title ? 'help' : 'default' }}>{r.val}<DeltaTag value={r.delta} unit={r.deltaUnit ?? '%'} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    <div className="bg-ws-bg-1 border border-ws-border p-4">
      <div className="text-ws-text-3 text-[10px] tracking-[2px] mb-3">BALANCE SHEET</div>
      <table className="w-full border-collapse text-[11px]">
        <tbody>
          {[
            { label: 'Total Assets', val: fmt(data.assetsVal), delta: pctDelta(data.assetsVal, data.prevQuarter?.assetsVal) },
            { label: 'Total Liabilities', val: fmt(data.totalLiabilitiesVal), delta: pctDelta(data.totalLiabilitiesVal, data.prevQuarter?.totalLiabilitiesVal) },
            { label: 'Equity', val: fmt(data.equityVal), delta: pctDelta(data.equityVal, data.prevQuarter?.equityVal) },
            { label: 'Net Debt', val: fmt(data.netDebt), color: data.netDebt < 0 ? 'var(--ws-accent)' : 'var(--ws-text)', delta: pctDelta(data.netDebt, data.prevQuarter?.netDebt) },
            { label: 'Cash', val: fmt(data.cashVal), color: 'var(--ws-accent)', delta: pctDelta(data.cashVal, data.prevQuarter?.cashVal) },
            { label: 'LT Debt', val: fmt(data.debtVal), delta: pctDelta(data.debtVal, data.prevQuarter?.debtVal) },
            { label: 'D/E Ratio', val: fmtN(data.debtToEquity), color: data.debtToEquity < 1 ? 'var(--ws-accent)' : data.debtToEquity < 2 ? 'var(--ws-text-2)' : 'var(--ws-red)', delta: pctDelta(data.debtToEquity, data.prevQuarter?.debtToEquity) },
            { label: 'Current Ratio', val: data.currentAssetsVal && data.currentLiabilitiesVal ? fmtN(data.currentAssetsVal / data.currentLiabilitiesVal) : 'N/A', color: data.currentAssetsVal / data.currentLiabilitiesVal > 2 ? 'var(--ws-accent)' : data.currentAssetsVal / data.currentLiabilitiesVal > 1 ? 'var(--ws-text-2)' : 'var(--ws-red)', delta: pctDelta(data.currentAssetsVal && data.currentLiabilitiesVal ? data.currentAssetsVal / data.currentLiabilitiesVal : null, data.prevQuarter?.currentRatio) },
          ].map(r => (
            <tr key={r.label} className="border-b border-ws-border">
              <td className="py-1 text-ws-text-3 text-[10px]">{r.label}</td>
              <td style={{ padding: '4px 0', textAlign: 'right', color: r.color || 'var(--ws-text)', fontSize: '11px', fontWeight: 500 }}>{r.val}<DeltaTag value={r.delta} unit={r.deltaUnit ?? '%'} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    <div className="bg-ws-bg-1 border border-ws-border p-4">
      <div className="text-ws-text-3 text-[10px] tracking-[2px] mb-3">EFFICIENCY</div>
      <table className="w-full border-collapse text-[11px]">
        <tbody>
          {[
            { label: 'Cash Conv. Cycle', val: data.ccc != null ? `${data.ccc}d` : 'N/A', color: data.ccc != null && data.ccc < 30 ? 'var(--ws-accent)' : data.ccc != null && data.ccc < 60 ? 'var(--ws-text-2)' : data.ccc != null ? 'var(--ws-red)' : 'var(--ws-text-3)', delta: pctDelta(data.ccc, data.prevQuarter?.ccc) },
            { label: 'Inventory Turnover', val: data.inventoryTurnover != null ? fmtN(data.inventoryTurnover) : 'N/A', color: data.inventoryTurnover > 8 ? 'var(--ws-accent)' : data.inventoryTurnover > 4 ? 'var(--ws-text-2)' : 'var(--ws-text)', delta: pctDelta(data.inventoryTurnover, data.prevQuarter?.inventoryTurnover) },
            { label: 'DSO', val: data.dso != null ? `${data.dso}d` : 'N/A', delta: pctDelta(data.dso, data.prevQuarter?.dso) },
            { label: 'DIO', val: data.dio != null ? `${data.dio}d` : 'N/A', delta: pctDelta(data.dio, data.prevQuarter?.dio) },
            { label: 'DPO', val: data.dpo != null ? `${data.dpo}d` : 'N/A', delta: pctDelta(data.dpo, data.prevQuarter?.dpo) },
          ].map(r => (
            <tr key={r.label} className="border-b border-ws-border">
              <td className="py-1 text-ws-text-3 text-[10px]">{r.label}</td>
              <td style={{ padding: '4px 0', textAlign: 'right', color: r.color || 'var(--ws-text)', fontSize: '11px', fontWeight: 500 }}>{r.val}<DeltaTag value={r.delta} unit={r.deltaUnit ?? '%'} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

  </div>
</div>

<div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px', marginBottom: '16px' }}>
  <div className="bg-ws-bg-1 border border-ws-border p-4">
    <div className="text-ws-text-3 text-[10px] tracking-[2px] mb-3">PER SHARE & MARKET DATA</div>
    <div className="per-share-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
      {[
        { label: 'EPS (TTM)', val: data.eps ? `${curSym(data.currency)}${data.eps}` : 'N/A', delta: pctDelta(data.eps, data.prevQuarter?.eps) },
        { label: 'Shs Outstanding', val: data.sharesOutstanding ? `${(data.sharesOutstanding / 1e6).toFixed(0)}M` : 'N/A', delta: pctDelta(data.sharesOutstanding, data.prevQuarter?.sharesOutstanding) },
        { label: 'Beta', val: fmtN(data.beta) },
        { label: '52W High', val: data.high52 ? `${curSym(data.currency)}${data.high52}` : 'N/A' },
        { label: '52W Low', val: data.low52 ? `${curSym(data.currency)}${data.low52}` : 'N/A' },
      ].map(r => (
        <div key={r.label} style={{ background: 'var(--ws-bg-2)', padding: '12px' }}>
          <div className="text-ws-text-3 text-[10px] tracking-[1px] mb-1.5">{r.label}</div>
          <div style={{ color: 'var(--ws-text)', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'baseline' }}>{r.val}<DeltaTag value={r.delta} unit={r.deltaUnit ?? '%'} /></div>
        </div>
      ))}
    </div>
  </div>
</div>

              <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                <div style={{ flex: 1, background: 'var(--ws-bg-1)' }}>
                  <StockChart ticker={ticker} currency={data?.currency} />
                </div>
              </div>

              <div className="text-ws-text-3 text-[10px] tracking-[2px] border-b border-ws-border pb-1.5 mb-3">PROFITABILITY & RETURNS</div>
              <div className="grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '16px' }}>
                {[
                  { label: 'REVENUE (TTM)', val: fmt(data.revVal), sub: data.revGrowth !== null ? `${data.revGrowth > 0 ? '+' : ''}${data.revGrowth}% YOY` : null, good: data.revGrowth > 0 },
                  { label: 'NET INCOME (TTM)', val: fmt(data.niVal), sub: data.netMargin !== null ? `${data.netMargin}% NET MARGIN` : null, good: data.netMargin > 10 },
                  { label: 'OP. MARGIN', val: fmtP(data.opMargin), sub: data.opMargin > 15 ? 'ABOVE THRESHOLD' : 'BELOW THRESHOLD', good: data.opMargin > 15 },
                  { label: 'ROE', val: fmtP(data.roe), sub: data.roe > 15 ? 'STRONG RETURN' : 'MODERATE RETURN', good: data.roe > 15 },
                ].map(m => (
                  <div key={m.label} style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', padding: '14px' }}>
                    <div className="text-ws-text-3 text-[10px] tracking-[1px] mb-1.5">{m.label}</div>
                    <div style={{ fontSize: '20px', fontWeight: 600, marginBottom: '4px', color: 'var(--ws-text)' }}>{m.val}</div>
                    {m.sub && <div style={{ color: m.good ? 'var(--ws-accent)' : 'var(--ws-red)', fontSize: '10px', letterSpacing: '0.5px' }}>{m.sub}</div>}
                  </div>
                ))}
              </div>

              <div className="text-ws-text-3 text-[10px] tracking-[2px] border-b border-ws-border pb-1.5 mb-3">CASH FLOW & BALANCE SHEET</div>
              <div className="grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '16px' }}>
                {[
                  { label: 'FREE CASH FLOW', val: fmt(data.fcfVal), sub: data.fcfVal > 0 ? 'POSITIVE FCF' : 'NEGATIVE FCF', good: data.fcfVal > 0 },
                  { label: 'OP. CASH FLOW', val: fmt(data.fcfVal), sub: data.fcfVal && data.revVal ? `${((data.fcfVal / data.revVal) * 100).toFixed(1)}% CONVERSION` : null, good: data.fcfVal > 0 },
                  { label: 'NET DEBT', val: fmt(data.netDebt), sub: data.netDebt < 0 ? 'NET CASH POSITION' : 'NET DEBT POSITION', good: data.netDebt < 0 },
                  { label: 'CASH & EQUIV.', val: fmt(data.cashVal), sub: null },
                ].map(m => (
                  <div key={m.label} style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', padding: '14px' }}>
                    <div className="text-ws-text-3 text-[10px] tracking-[1px] mb-1.5">{m.label}</div>
                    <div style={{ fontSize: '20px', fontWeight: 600, marginBottom: '4px', color: 'var(--ws-text)' }}>{m.val}</div>
                    {m.sub && <div style={{ color: m.good ? 'var(--ws-accent)' : 'var(--ws-red)', fontSize: '10px', letterSpacing: '0.5px' }}>{m.sub}</div>}
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                {[
                  { title: 'REVENUE', chart: revChart, color: 'var(--ws-text-2)', type: 'line' },
                  { title: 'FREE CASH FLOW', chart: fcfChart, color: 'var(--ws-accent)', type: 'line' },
                ].map(({ title, chart, color, type }) => (
                  <div key={title} className="bg-ws-bg-1 border border-ws-border p-4">
                    <div className="text-ws-text-3 text-[10px] tracking-[2px] mb-3">{title}</div>
                    <MiniLine data={chart} color={color} />
                  </div>
                ))}
              </div>
    </div>}

    {finTab === 'income' && (() => {
      const years = data.revHistory?.map(r => r.year) || [];
      const rows = [
        { label: 'Revenue', history: data.revHistory, ttm: data.revVal, bold: true },
        { label: 'Cost of Revenue', history: data.cogsHistory, ttm: data.cogsVal, indent: true, neg: true },
        { label: 'Gross Profit', history: data.revHistory?.map((r, i) => ({ year: r.year, val: data.cogsHistory?.[i] ? r.val - data.cogsHistory[i].val : null })), ttm: data.revVal && data.cogsVal ? data.revVal - data.cogsVal : null, bold: true, green: true },
        { label: 'SG&A', history: data.sgaHistory, ttm: data.sgaVal, indent: true, neg: true },
        { label: 'R&D', history: data.rdHistory, ttm: data.rdVal, indent: true, neg: true },
        { label: 'Operating Income', history: data.oiHistory, ttm: data.oiVal, bold: true, green: true },
        { label: 'Interest Expense', history: [], ttm: data.interestVal, indent: true, neg: true },
        { label: 'EBT', history: data.ebtHistory, ttm: data.ebtVal, bold: true },
        { label: 'Income Tax', history: data.taxHistory, ttm: data.taxVal, indent: true, neg: true },
        { label: 'Net Income', history: data.niHistory, ttm: data.niVal, bold: true, green: true },
        { label: '---', divider: true },
        { label: 'EPS (Diluted)', history: data.sharesDilutedHistory?.map((s, i) => ({ year: s.year, val: data.niHistory?.[i] && s.val ? +(data.niHistory[i].val / s.val).toFixed(2) : null })), ttm: data.eps, prefix: '$' },
        { label: 'Shares Diluted', history: data.sharesDilutedHistory, ttm: data.sharesDilutedVal, shares: true },
        { label: 'SBC', history: [], ttm: data.sbcVal, indent: true },
      ];
      const fmtV = (v, row) => {
        if (v === null || v === undefined) return '—';
        if (row?.prefix) return `$${v}`;
        if (row?.shares) return Math.abs(v) >= 1e9 ? `${(v/1e9).toFixed(2)}B` : `${(v/1e6).toFixed(0)}M`;
        return Math.abs(v) >= 1e9 ? `$${(v/1e9).toFixed(1)}B` : Math.abs(v) >= 1e6 ? `$${(v/1e6).toFixed(0)}M` : `$${v.toLocaleString()}`;
      };
      return (
        <div className="overflow-x-auto">
          <div style={{ color: 'var(--ws-text-3)', fontSize: '10px', letterSpacing: '1px', marginBottom: '8px' }}>All values in USD · Source: SEC EDGAR</div>
          <table className="w-full border-collapse text-[11px] min-w-[700px]">
            <thead>
              <tr className="border-b border-ws-border">
                <th style={{ padding: '8px 0', textAlign: 'left', fontWeight: 400, fontSize: '10px', letterSpacing: '1px', color: 'var(--ws-text-3)', width: '180px' }}>METRIC</th>
                {years.map(y => <th key={y} style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 400, fontSize: '10px', color: 'var(--ws-text-3)' }}>{y}</th>)}
                <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, fontSize: '10px', color: 'var(--ws-accent)' }}>TTM</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                if (row.divider) return <tr key={i}><td colSpan={years.length + 2} className="py-1 border-b border-ws-border" /></tr>;
                return (
                  <tr key={i} style={{ borderBottom: '1px solid var(--ws-border)', background: i % 2 === 0 ? 'transparent' : 'var(--ws-bg-1)' }}>
                    <td style={{ padding: '6px 0', paddingLeft: row.indent ? '16px' : '0', color: row.bold ? 'var(--ws-text)' : 'var(--ws-text-3)', fontWeight: row.bold ? 600 : 400, fontSize: '11px' }}>{row.label}</td>
                    {years.map((y, j) => {
                      const h = row.history?.[j];
                      const color = row.green ? 'var(--ws-accent)' : row.neg ? 'var(--ws-red)' : 'var(--ws-text)';
                      return <td key={y} style={{ padding: '6px 12px', textAlign: 'right', color: h?.val != null ? color : 'var(--ws-text-3)' }}>{fmtV(h?.val, row)}</td>;
                    })}
                    <td style={{ padding: '6px 12px', textAlign: 'right', color: row.green ? 'var(--ws-accent)' : row.neg ? 'var(--ws-red)' : 'var(--ws-text)', fontWeight: 600 }}>{fmtV(row.ttm, row)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
    })()}

    {finTab === 'balance' && (() => {
      const rows = [
        { label: 'ASSETS', section: true },
        { label: 'Current Assets', val: data.currentAssetsVal, green: true },
        { label: 'Total Assets', val: data.assetsVal, bold: true },
        { label: 'LIABILITIES', section: true },
        { label: 'Current Liabilities', val: data.currentLiabilitiesVal, neg: true },
        { label: 'Long-term Debt', val: data.debtVal, neg: true },
        { label: 'Total Liabilities', val: data.totalLiabilitiesVal, neg: true, bold: true },
        { label: 'EQUITY', section: true },
        { label: "Stockholders' Equity", val: data.equityVal, bold: true, green: true },
        { label: 'Retained Earnings', val: data.retainedEarningsVal },
        { label: 'RATIOS', section: true },
        { label: 'D/E Ratio', val: data.debtToEquity, raw: true, suffix: 'x', color: data.debtToEquity < 1 ? 'var(--ws-accent)' : data.debtToEquity < 2 ? 'var(--ws-text-2)' : 'var(--ws-red)' },
        { label: 'Current Ratio', val: data.currentAssetsVal && data.currentLiabilitiesVal ? +(data.currentAssetsVal/data.currentLiabilitiesVal).toFixed(2) : null, raw: true, suffix: 'x', color: data.currentAssetsVal/data.currentLiabilitiesVal > 1.5 ? 'var(--ws-accent)' : 'var(--ws-text-2)' },
        { label: 'Net Debt', val: data.netDebt, color: data.netDebt < 0 ? 'var(--ws-accent)' : 'var(--ws-text)' },
        { label: 'Cash & Equivalents', val: data.cashVal, green: true },
      ];
      const fmtV = (v, row) => {
        if (v === null || v === undefined) return '—';
        if (row?.raw) return `${v.toFixed(2)}${row.suffix || ''}`;
        return Math.abs(v) >= 1e9 ? `$${(v/1e9).toFixed(1)}B` : Math.abs(v) >= 1e6 ? `$${(v/1e6).toFixed(0)}M` : `$${v.toLocaleString()}`;
      };
      return (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', maxWidth: '500px' }}>
          <thead>
            <tr className="border-b border-ws-border">
              <th style={{ padding: '8px 0', textAlign: 'left', fontWeight: 400, fontSize: '10px', color: 'var(--ws-text-3)' }}>METRIC</th>
              <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, fontSize: '10px', color: 'var(--ws-accent)' }}>TTM</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              if (row.section) return <tr key={i}><td colSpan={2} style={{ padding: '10px 0 4px', color: 'var(--ws-accent)', fontSize: '10px', letterSpacing: '2px', borderBottom: '1px solid var(--ws-border)' }}>{row.label}</td></tr>;
              return (
                <tr key={i} className="border-b border-ws-border">
                  <td style={{ padding: '6px 0', color: row.bold ? 'var(--ws-text)' : 'var(--ws-text-3)', fontWeight: row.bold ? 600 : 400 }}>{row.label}</td>
                  <td style={{ padding: '6px 12px', textAlign: 'right', color: row.color || (row.green ? 'var(--ws-accent)' : row.neg ? 'var(--ws-red)' : 'var(--ws-text)'), fontWeight: row.bold ? 600 : 400 }}>{fmtV(row.val, row)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      );
    })()}

    {finTab === 'cashflow' && (() => {
      const years = data.operatingCFHistory?.map(r => r.year) || [];
      const rows = [
        { label: 'Operating Cash Flow', history: data.operatingCFHistory, ttm: data.operatingCFVal, bold: true, green: true },
        { label: 'Capital Expenditures', history: data.capexHistory, ttm: data.capexVal, indent: true, neg: true },
        { label: 'Free Cash Flow', history: data.fcfHistory, ttm: data.fcfVal, bold: true, green: true },
        { label: '---', divider: true },
        { label: 'Investing Cash Flow', history: data.investingCFHistory, ttm: data.investingCFVal, neg: data.investingCFVal < 0 },
        { label: 'Financing Cash Flow', history: data.financingCFHistory, ttm: data.financingCFVal, neg: data.financingCFVal < 0 },
        { label: 'Dividends Paid', history: [], ttm: data.dividendsPaidVal, indent: true, neg: true },
        { label: 'SBC', history: [], ttm: data.sbcVal, indent: true },
      ];
      const fmtV = (v) => {
        if (v === null || v === undefined) return '—';
        return Math.abs(v) >= 1e9 ? `$${(v/1e9).toFixed(1)}B` : Math.abs(v) >= 1e6 ? `$${(v/1e6).toFixed(0)}M` : `$${v.toLocaleString()}`;
      };
      return (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[11px] min-w-[700px]">
            <thead>
              <tr className="border-b border-ws-border">
                <th style={{ padding: '8px 0', textAlign: 'left', fontWeight: 400, fontSize: '10px', color: 'var(--ws-text-3)', width: '200px' }}>METRIC</th>
                {years.map(y => <th key={y} style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 400, fontSize: '10px', color: 'var(--ws-text-3)' }}>{y}</th>)}
                <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, fontSize: '10px', color: 'var(--ws-accent)' }}>TTM</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                if (row.divider) return <tr key={i}><td colSpan={years.length + 2} className="py-1 border-b border-ws-border" /></tr>;
                return (
                  <tr key={i} style={{ borderBottom: '1px solid var(--ws-border)', background: i % 2 === 0 ? 'transparent' : 'var(--ws-bg-1)' }}>
                    <td style={{ padding: '6px 0', paddingLeft: row.indent ? '16px' : '0', color: row.bold ? 'var(--ws-text)' : 'var(--ws-text-3)', fontWeight: row.bold ? 600 : 400 }}>{row.label}</td>
                    {years.map((y, j) => {
                      const h = row.history?.[j];
                      const color = row.green ? 'var(--ws-accent)' : row.neg ? 'var(--ws-red)' : 'var(--ws-text)';
                      return <td key={y} style={{ padding: '6px 12px', textAlign: 'right', color: h?.val != null ? color : 'var(--ws-text-3)' }}>{fmtV(h?.val)}</td>;
                    })}
                    <td style={{ padding: '6px 12px', textAlign: 'right', color: row.green ? 'var(--ws-accent)' : row.neg ? 'var(--ws-red)' : 'var(--ws-text)', fontWeight: 600 }}>{fmtV(row.ttm)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
    })()}

    <div style={{ color: 'var(--ws-text-3)', fontSize: '10px', letterSpacing: '1px', marginTop: '16px' }}>
      SOURCE: SEC EDGAR (XBRL) · FINNHUB · NOT INVESTMENT ADVICE
    </div>
  </div>
))}

        {/* VALUATION TAB — locked entirely for guests, not just blurred: the valuation
            call itself is the product. */}
        {tab === 'dcf' && (!isSignedIn ? (
          <LockedPanel
            title="Relative Valuation"
            description="The full valuation range, bull/bear scenarios and quality-weighted target multiple unlock with a free account."
          />
        ) : (
          <div>
            {/* RELATIVE VALUATION — quality-adjusted target P/FCF multiple, primary estimate
                when available. Replaces the old 10-year forward DCF (see computeRelativeValue
                in lib/stockScoring.js for why: that model stacked 4-5 independently uncertain
                assumptions that compounded multiplicatively over a decade). */}
            <div className="text-ws-text-3 text-[10px] tracking-[2px] border-b border-ws-border pb-1.5 mb-3 mt-6">RELATIVE VALUATION</div>

            {relativeValue ? (() => {
              const scenarios = [
                { key: 'bear', label: 'BEAR CASE', value: relativeValue.bearValue, primary: false },
                { key: 'base', label: 'BASE CASE', value: relativeValue.fairValue, primary: true },
                { key: 'bull', label: 'BULL CASE', value: relativeValue.bullValue, primary: false },
              ].map(s => {
                const diff = price ? +(((s.value - price) / price) * 100).toFixed(1) : null;
                const underval = price ? s.value > price : null;
                return { ...s, diff, underval };
              });

              const values = scenarios.map(s => s.value);
              const lo = Math.min(...values, price ?? values[0]);
              const hi = Math.max(...values, price ?? values[values.length - 1]);
              const span = (hi - lo) || 1;
              const pctOf = (v) => Math.max(0, Math.min(100, ((v - lo) / span) * 100));

              return (
                <>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 24px', background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', padding: '14px 16px', marginBottom: '16px', fontSize: '11px' }}>
                    <div title="Current true P/FCF (net of stock-based compensation) — the market's own read on this business today.">
                      <span className="text-ws-text-3">Own multiple</span> &nbsp;<b className="text-ws-text">{relativeValue.ownMultiple != null ? `${relativeValue.ownMultiple.toFixed(1)}x` : 'N/A'}</b>
                    </div>
                    <div title="Rough long-run benchmark for this sector — not fitted to this company.">
                      <span className="text-ws-text-3">Sector multiple</span> &nbsp;<b className="text-ws-text">{relativeValue.sectorMultiple.toFixed(1)}x</b>
                    </div>
                    <div title="How much this company's own Quality Score (CBS/GQS) supports trusting its current multiple over the sector benchmark, whichever direction it's priced.">
                      <span className="text-ws-text-3">Quality weight</span> &nbsp;<b className="text-ws-text">{(relativeValue.qualityWeight * 100).toFixed(0)}%</b>
                    </div>
                    <div>
                      <span className="text-ws-text-3">Target multiple</span> &nbsp;<b className="text-ws-text">{relativeValue.targetMultiple.toFixed(1)}x FCF</b>
                    </div>
                    {relativeValue.impliedGrowthPct != null && (
                      <div title="Reverse-DCF: the single growth rate today's price already implies, at a plain CAPM discount rate — context only, not used to drive the valuation above.">
                        <span className="text-ws-text-3">Market is pricing in</span> &nbsp;<b className="text-ws-text">{relativeValue.impliedGrowthPct.toFixed(1)}%</b>
                      </div>
                    )}
                    {relativeValue.realGrowthPct != null && (
                      <div title="This company's own recent, trailing revenue growth (3yr, stub/shock years excluded) — compare against 'Market is pricing in' above.">
                        <span className="text-ws-text-3">Actually growing at</span> &nbsp;<b className="text-ws-text">{relativeValue.realGrowthPct.toFixed(1)}%</b>
                      </div>
                    )}
                  </div>

                  {price != null && (
                    <div style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', padding: '18px 20px', marginBottom: '16px' }}>
                      <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--ws-text-3)', letterSpacing: '1.5px', marginBottom: '10px' }}>VALUATION RANGE</div>
                      <div style={{ position: 'relative', paddingTop: '32px', paddingBottom: '38px' }}>
                        <div style={{ position: 'relative', height: '6px', borderRadius: '3px', background: 'linear-gradient(to right, var(--ws-red), var(--ws-text-3), var(--ws-accent))', opacity: 0.35, margin: '0 4px' }}>
                          {scenarios.map(s => (
                            <div key={s.key} style={{ position: 'absolute', left: `${pctOf(s.value)}%`, bottom: '6px', transform: 'translateX(-50%)', textAlign: 'center', whiteSpace: 'nowrap' }}>
                              <div style={{ fontSize: '11px', fontWeight: 700, color: s.primary ? 'var(--ws-text)' : 'var(--ws-text-3)', marginBottom: '4px' }}>
                                {curSym(data.currency)}{s.value.toFixed(2)}
                              </div>
                              <div style={{ width: s.primary ? '3px' : '2px', height: '14px', margin: '0 auto', borderRadius: '2px', background: s.primary ? 'var(--ws-text)' : 'var(--ws-text-3)' }} />
                            </div>
                          ))}
                          <div style={{ position: 'absolute', left: `${pctOf(price)}%`, top: '6px', transform: 'translateX(-50%)', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <div style={{ width: 0, height: 0, margin: '0 auto', borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderBottom: '7px solid var(--ws-text)' }} />
                            <div style={{ fontSize: '10px', color: 'var(--ws-text-2)', marginTop: '4px' }}>Price {curSym(data.currency)}{price.toFixed(2)}</div>
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--ws-text-3)', letterSpacing: '1px' }}>
                        <span>BEAR</span><span>BASE</span><span>BULL</span>
                      </div>
                    </div>
                  )}

                  <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
                    {scenarios.map(s => (
                      <div key={s.key} style={{
                        background: 'var(--ws-bg-1)',
                        border: s.primary ? '1px solid var(--ws-text)' : '1px solid var(--ws-border)',
                        padding: '18px',
                        position: 'relative',
                      }}>
                        {s.primary && (
                          <div style={{ position: 'absolute', top: '-9px', left: '16px', background: 'var(--ws-text)', color: 'var(--ws-bg)', fontSize: '9px', fontWeight: 800, letterSpacing: '1px', padding: '2px 8px' }}>
                            MAIN ESTIMATE
                          </div>
                        )}
                        <div className="text-ws-text-3 text-[10px] tracking-[2px] mb-3">{s.label}</div>
                        <div style={{ fontSize: '30px', fontWeight: 700, letterSpacing: '-1px', marginBottom: '10px', color: 'var(--ws-text)' }}>
                          {curSym(data.currency)}{s.value.toFixed(2)}
                        </div>
                        {s.diff !== null && (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 800, padding: '3px 8px', background: 'var(--ws-bg-2)', color: s.underval ? 'var(--ws-accent)' : 'var(--ws-red)', marginBottom: '12px' }}>
                            {s.underval ? '▲' : '▼'} {Math.abs(s.diff)}% {s.underval ? 'UPSIDE' : 'DOWNSIDE'}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="text-ws-text-3 text-[10px] tracking-[1px]">
                    TARGET MULTIPLE = OWN CURRENT TRUE P/FCF BLENDED WITH SECTOR-TYPICAL, WEIGHTED BY THIS COMPANY'S OWN QUALITY SCORE (CBS/GQS) · FAIR VALUE = TARGET MULTIPLE × TRUE FCF PER SHARE · NOT INVESTMENT ADVICE
                  </div>
                </>
              );
            })() : (
              <div style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', padding: '40px', textAlign: 'center', marginBottom: '32px' }}>
                <div style={{ color: 'var(--ws-accent)', fontSize: '24px', fontWeight: 600, letterSpacing: '4px', marginBottom: '8px' }}>N/A</div>
                <div style={{ color: 'var(--ws-text-2)', fontSize: '12px', marginBottom: '4px' }}>
                  {!data.marketCap || !data.currentPrice ? 'MISSING MARKET CAP OR PRICE' : 'NEGATIVE OR MISSING FREE CASH FLOW'}
                </div>
                <div style={{ color: 'var(--ws-text-3)', fontSize: '11px' }}>
                  A relative valuation isn&apos;t meaningful without a current market price and positive free cash flow to anchor to.
                </div>
              </div>
            )}
          </div>
        ))}

        {/* PROJECTION TAB — GBM random-walk price path + analytic confidence band.
            Locked entirely for guests, same reasoning as the DCF tab above. */}
        {tab === 'projection' && (!isSignedIn ? (
          <LockedPanel
            title="Projections"
            description="Future price projections (Monte Carlo + confidence band) unlock with a free account."
          />
        ) : (
          <ProjectionChart ticker={ticker} data={data} fundamentalGrowth={fundamentalGrowth} price={price} currency={data.currency} />
        ))}

        {/* INSIDERS TAB — Form 3/4/5 buy/sell activity, SEC EDGAR primary / Finnhub fallback */}
        {tab === 'insiders' && (!isSignedIn ? (
          <LockedPanel
            title="Insiders"
            description="Insider activity (Form 3/4/5) unlocks with a free account."
          />
        ) : (
          <div>
            <div className="text-ws-text-3 text-[10px] tracking-[2px] border-b border-ws-border pb-1.5 mb-3 mt-6">
              INSIDER TRANSACTIONS — LAST REPORTED FORM 4 FILINGS
            </div>

            {insiderLoading ? (
              <div style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', padding: '40px', textAlign: 'center', color: 'var(--ws-text-3)', fontSize: '11px' }}>
                LOADING INSIDER ACTIVITY…
              </div>
            ) : !insiderTrades || insiderTrades.length === 0 ? (
              <div style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', padding: '40px', textAlign: 'center' }}>
                <div style={{ color: 'var(--ws-accent)', fontSize: '24px', fontWeight: 600, letterSpacing: '4px', marginBottom: '8px' }}>N/A</div>
                <div style={{ color: 'var(--ws-text-2)', fontSize: '12px', marginBottom: '4px' }}>NO INSIDER DATA AVAILABLE</div>
                <div style={{ color: 'var(--ws-text-3)', fontSize: '11px' }}>No reported Form 3/4/5 filings for this ticker.</div>
              </div>
            ) : (
              <>
                {/* Summary metrics — computed from genuine open-market buys/sells only */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', padding: '14px' }}>
                    <div style={{ fontSize: '9px', fontWeight: 800, color: 'var(--ws-text-3)', letterSpacing: '1px', marginBottom: '8px' }}>NET OPEN-MARKET BUYING</div>
                    {insiderSummary ? (
                      <>
                        <div style={{ fontSize: '18px', fontWeight: 800, color: insiderSummary.netValue >= 0 ? 'var(--ws-accent)' : 'var(--ws-red)' }}>
                          {insiderSummary.netValue >= 0 ? '+' : '-'}{fmt(Math.abs(insiderSummary.netValue))}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--ws-text-3)', marginTop: '2px' }}>
                          {insiderSummary.netShares >= 0 ? '+' : ''}{insiderSummary.netShares.toLocaleString()} shares
                        </div>
                      </>
                    ) : <div style={{ fontSize: '11px', color: 'var(--ws-text-3)' }}>No open-market trades</div>}
                  </div>

                  <div style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', padding: '14px' }}>
                    <div style={{ fontSize: '9px', fontWeight: 800, color: 'var(--ws-text-3)', letterSpacing: '1px', marginBottom: '8px' }}>SIGNAL</div>
                    {insiderSummary ? (
                      <div style={{ fontSize: '18px', fontWeight: 800, color: insiderSummary.signal.color, letterSpacing: '1px' }}>
                        {insiderSummary.signal.label}
                      </div>
                    ) : <div style={{ fontSize: '11px', color: 'var(--ws-text-3)' }}>—</div>}
                  </div>

                  <div style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', padding: '14px' }}>
                    <div style={{ fontSize: '9px', fontWeight: 800, color: 'var(--ws-text-3)', letterSpacing: '1px', marginBottom: '8px' }}>LARGEST SELLER</div>
                    {insiderSummary?.largestSeller ? (
                      <>
                        <div style={{ fontSize: '13px', fontWeight: 700 }}>{insiderSummary.largestSeller[0]}</div>
                        <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--ws-red)', marginTop: '2px' }}>-{fmt(insiderSummary.largestSeller[1])}</div>
                      </>
                    ) : <div style={{ fontSize: '11px', color: 'var(--ws-text-3)' }}>—</div>}
                  </div>

                  <div style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', padding: '14px' }}>
                    <div style={{ fontSize: '9px', fontWeight: 800, color: 'var(--ws-text-3)', letterSpacing: '1px', marginBottom: '8px' }}>LARGEST BUYER</div>
                    {insiderSummary?.largestBuyer ? (
                      <>
                        <div style={{ fontSize: '13px', fontWeight: 700 }}>{insiderSummary.largestBuyer[0]}</div>
                        <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--ws-accent)', marginTop: '2px' }}>+{fmt(insiderSummary.largestBuyer[1])}</div>
                      </>
                    ) : <div style={{ fontSize: '11px', color: 'var(--ws-text-3)' }}>—</div>}
                  </div>
                </div>

                {/* Price vs insider activity */}
                {insiderChartData.length > 1 && (
                  <div style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', padding: '14px', marginBottom: '16px' }}>
                    <div style={{ fontSize: '9px', fontWeight: 800, color: 'var(--ws-text-3)', letterSpacing: '1px', marginBottom: '4px' }}>PRICE VS INSIDER ACTIVITY (1Y)</div>
                    <ResponsiveContainer width="100%" height={160}>
                      <LineChart data={insiderChartData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                        <XAxis dataKey="date" tick={{ fill: 'var(--ws-text-3)', fontSize: 9 }} axisLine={false} tickLine={false} minTickGap={40} />
                        <YAxis hide domain={['dataMin', 'dataMax']} />
                        <Tooltip contentStyle={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', fontSize: 10 }} />
                        <Line type="monotone" dataKey="price" stroke="var(--ws-text-3)" strokeWidth={1.25} dot={false} />
                        <Line dataKey="buy" stroke="none" dot={{ r: 4, fill: 'var(--ws-accent)' }} isAnimationActive={false} />
                        <Line dataKey="sell" stroke="none" dot={{ r: 4, fill: 'var(--ws-red)' }} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Filters */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px', alignItems: 'center' }}>
                  {[
                    { key: 'ALL', label: 'All time', state: insiderDateFilter, set: setInsiderDateFilter, val: 'ALL' },
                    { key: '30D', label: 'Last 30 days', state: insiderDateFilter, set: setInsiderDateFilter, val: '30D' },
                  ].map(f => (
                    <button key={f.label} onClick={() => f.set(f.val)}
                      style={{ padding: '6px 12px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.5px', border: '1px solid var(--ws-border)', background: f.state === f.val ? 'var(--ws-text)' : 'var(--ws-bg-1)', color: f.state === f.val ? 'var(--ws-bg)' : 'var(--ws-text-2)', cursor: 'pointer' }}>
                      {f.label}
                    </button>
                  ))}
                  <span style={{ width: '1px', height: '16px', background: 'var(--ws-border)' }} />
                  {[
                    { label: 'All types', val: 'ALL' },
                    { label: 'Buys', val: 'BUY' },
                    { label: 'Sells', val: 'SELL' },
                  ].map(f => (
                    <button key={f.label} onClick={() => setInsiderTypeFilter(f.val)}
                      style={{ padding: '6px 12px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.5px', border: '1px solid var(--ws-border)', background: insiderTypeFilter === f.val ? 'var(--ws-text)' : 'var(--ws-bg-1)', color: insiderTypeFilter === f.val ? 'var(--ws-bg)' : 'var(--ws-text-2)', cursor: 'pointer' }}>
                      {f.label}
                    </button>
                  ))}
                  <span style={{ width: '1px', height: '16px', background: 'var(--ws-border)' }} />
                  {[
                    { label: 'All roles', val: 'ALL' },
                    { label: 'Only executives', val: 'EXEC' },
                    { label: 'Owners >10%', val: 'OWNER10' },
                  ].map(f => (
                    <button key={f.label} onClick={() => setInsiderRoleFilter(f.val)}
                      style={{ padding: '6px 12px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.5px', border: '1px solid var(--ws-border)', background: insiderRoleFilter === f.val ? 'var(--ws-text)' : 'var(--ws-bg-1)', color: insiderRoleFilter === f.val ? 'var(--ws-bg)' : 'var(--ws-text-2)', cursor: 'pointer' }}>
                      {f.label}
                    </button>
                  ))}
                  {selectedInsiderName && (
                    <button onClick={() => setSelectedInsiderName(null)}
                      style={{ padding: '6px 12px', fontSize: '10px', fontWeight: 700, border: '1px solid var(--ws-accent)', background: 'var(--ws-bg-1)', color: 'var(--ws-accent)', cursor: 'pointer' }}>
                      {selectedInsiderName} ✕
                    </button>
                  )}
                </div>

                {filteredInsiderTrades.length === 0 ? (
                  <div style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', padding: '30px', textAlign: 'center', color: 'var(--ws-text-3)', fontSize: '11px' }}>
                    No transactions match this filter.
                  </div>
                ) : (
                  <div style={{ background: 'var(--ws-bg-1)', border: '1px solid var(--ws-border)', overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--ws-border)' }}>
                          {['DATE', 'INSIDER', 'TYPE', 'SHARES', 'PRICE', 'VALUE', 'OWNERSHIP'].map(h => (
                            <th key={h} style={{ textAlign: h === 'DATE' || h === 'INSIDER' ? 'left' : 'right', padding: '10px 14px', color: 'var(--ws-text-3)', fontSize: '10px', letterSpacing: '1px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredInsiderTrades.slice(0, 40).map((t, i) => {
                          const isBuy = t.type === 'BUY';
                          // Only P (open-market buy) and S (open-market sell) reflect a real discretionary
                          // bet — grants, option exercises, tax withholding and gifts move shares for
                          // administrative reasons and shouldn't read as the same signal as a BUY/SELL.
                          const label = TXN_CODE_LABELS[t.code] || (isBuy ? 'ACQUIRED' : 'DISPOSED');
                          const isCeoCfo = t.role && /chief executive|chief financial|\bceo\b|\bcfo\b/i.test(t.role);
                          const isLargeSell = t.isOpenMarket && !isBuy && t.value != null && t.value > 1_000_000;
                          const highlightValue = (t.isOpenMarket && isBuy && isCeoCfo) || isLargeSell;
                          const ownershipPct = t.sharesOwnedAfter && data.sharesOutstanding
                            ? (t.sharesOwnedAfter / data.sharesOutstanding) * 100 : null;

                          return (
                            <tr key={i} style={{ borderBottom: '1px solid var(--ws-border)' }}>
                              <td style={{ padding: '9px 14px', color: 'var(--ws-text-2)', whiteSpace: 'nowrap' }}>{t.date}</td>
                              <td style={{ padding: '9px 14px', textAlign: 'left' }}>
                                <span
                                  onClick={() => setSelectedInsiderName(t.insider)}
                                  style={{ fontWeight: 700, cursor: 'pointer' }}
                                  onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                                  onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                                >
                                  {t.insider}
                                </span>
                                {t.role && <div style={{ fontSize: '10px', color: 'var(--ws-text-3)', marginTop: '1px' }}>{t.role}{isCeoCfo ? ' ★' : ''}</div>}
                              </td>
                              <td style={{ padding: '9px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                <span
                                  title={t.code ? `SEC transaction code: ${t.code}${t.isOpenMarket ? ' (open market)' : ' (not an open-market trade)'}` : undefined}
                                  style={{ fontWeight: 800, color: t.isOpenMarket ? (isBuy ? '#059669' : '#dc2626') : 'var(--ws-text-3)' }}
                                >
                                  {isBuy ? '▲' : '▼'} {label}
                                </span>
                              </td>
                              <td style={{ padding: '9px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>{t.shares.toLocaleString()}</td>
                              <td style={{ padding: '9px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>{t.price ? `${curSym(data.currency)}${t.price.toFixed(2)}` : '—'}</td>
                              <td style={{ padding: '9px 14px', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: highlightValue ? 800 : 600, color: highlightValue ? (isBuy ? '#059669' : '#dc2626') : 'var(--ws-text)' }}>
                                {t.value ? fmt(t.value) : '—'}
                              </td>
                              <td style={{ padding: '9px 14px', textAlign: 'right', whiteSpace: 'nowrap', color: 'var(--ws-text-3)' }}>
                                {ownershipPct != null ? `${ownershipPct.toFixed(2)}%` : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            <div className="text-ws-text-3 text-[10px] tracking-[1px]" style={{ marginTop: '16px' }}>
              SOURCE: SEC EDGAR FORM 4 (PRIMARY) · FINNHUB (FALLBACK FOR NON-SEC TICKERS) · ★ = OFFICER TITLE MATCHES CEO/CFO · GRAY LABELS (GRANT/EXERCISE/TAX WITHHOLD/GIFT) ARE NOT OPEN-MARKET TRADES · NOT INVESTMENT ADVICE
            </div>
          </div>
        ))}

      </div>

      {/* Signed-out visitors only — subscribers never see ads. */}
      <AdSlot slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_STOCK} style={{ minHeight: '90px', marginTop: '20px' }} />

      {achievementToast && (
        <AchievementToast
          achievement={achievementToast}
          onClose={() => setAchievementToast(null)}
        />
      )}

      {showAddHolding && (
        <AddHoldingModal
          presetTicker={ticker}
          existingPies={[]}
          onClose={() => setShowAddHolding(false)}
          onAdded={() => setShowAddHolding(false)}
        />
      )}
    </div>
  );
}
