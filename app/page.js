'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from './components/AuthProvider';
import Topbar from './components/Topbar';
import NewsletterForm from './components/NewsletterForm';

// Dark "terminal" tokens matching the actual app UI (app/globals.css --ws-* dark theme),
// hardcoded here (matching app/globals.css --ws-* light theme) so the mockups
// always mirror the actual product UI, which defaults to light regardless of
// the marketing page's own theme.
const W = {
  bg: '#f8f9fa', bg1: '#ffffff', bg2: '#f1f3f5',
  text: '#1f2937', text2: '#4b5563', text3: '#9ca3af',
  border: '#e5e7eb', accent: '#0f766e', accentDim: 'rgba(15, 118, 110, 0.08)', red: '#ef4444',
};
const MONO = "'JetBrains Mono', monospace";

function WindowChrome({ title, children, maxWidth = '980px' }) {
  return (
    <div style={{
      background: W.bg1, border: `1px solid ${W.border}`, borderRadius: '14px',
      boxShadow: '0 24px 60px rgba(15,23,42,0.12)', maxWidth, margin: '0 auto',
      textAlign: 'left', overflow: 'hidden',
    }}>
      <div style={{ background: W.bg2, padding: '11px 16px', borderBottom: `1px solid ${W.border}`, display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
          <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
          <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
          <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
        </div>
        <div style={{ fontFamily: MONO, fontSize: '10px', color: W.text3, letterSpacing: '0.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {title}
        </div>
      </div>
      {children}
    </div>
  );
}

function SectionTag({ children }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: '8px', fontFamily: MONO,
      fontSize: '10px', fontWeight: 700, color: 'var(--accent)', letterSpacing: '2px',
      textTransform: 'uppercase', marginBottom: '14px',
    }}>
      <span style={{ width: '16px', height: '1px', background: 'var(--accent)', display: 'inline-block' }} />
      {children}
    </div>
  );
}

function FeatureRow({ tag, title, description, bullets, mockup, reverse, href }) {
  return (
    <div className="reveal landing-feature-row" style={{
      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '56px', alignItems: 'center',
      padding: '56px 0', borderTop: `1px solid var(--border)`,
    }}>
      <div className="landing-feature-text" style={{ order: reverse ? 2 : 1, minWidth: 0 }}>
        <SectionTag>{tag}</SectionTag>
        <h3 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--text)', marginBottom: '14px', lineHeight: 1.2 }}>
          {title}
        </h3>
        <p style={{ fontSize: '15px', color: 'var(--text-2)', lineHeight: 1.7, marginBottom: '20px', maxWidth: '440px' }}>
          {description}
        </p>
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {bullets.map((b, i) => (
            <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13px', color: 'var(--text-2)' }}>
              <span style={{ color: 'var(--accent)', fontWeight: 700, marginTop: '1px' }}>✓</span>
              {b}
            </li>
          ))}
        </ul>
        {href && (
          <a href={href} style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent)', textDecoration: 'none' }}>
            Get access with Pro →
          </a>
        )}
      </div>
      <div className="landing-feature-mockup" style={{ order: reverse ? 1 : 2, minWidth: 0 }}>
        {mockup}
      </div>
    </div>
  );
}

// --- Real product screenshots (public/screenshots/*.png), wrapped in the
// same fake-browser chrome for a consistent frame. Captured from an
// authenticated Pro session — see scripts used during the redesign session.

function Shot({ src, alt }) {
  return <img src={src} alt={alt} style={{ display: 'block', width: '100%', height: 'auto' }} />;
}

function MockScreener() {
  return (
    <WindowChrome title="traqcker.com/screener — Quantitative Universe Filter">
      <Shot src="/screenshots/screener.png" alt="Traqcker screener showing filterable US equity universe" />
    </WindowChrome>
  );
}

function MockCompare() {
  return (
    <WindowChrome title="traqcker.com/compare — Sentiment & Sector Momentum">
      <Shot src="/screenshots/compare.png" alt="Traqcker radar showing sector momentum and sentiment" />
    </WindowChrome>
  );
}

function MockPortfolio() {
  return (
    <WindowChrome title="traqcker.com/portfolio — Holdings & Allocation">
      <Shot src="/screenshots/portfolio.png" alt="Traqcker portfolio tracker with allocation charts" />
    </WindowChrome>
  );
}

function MockChat() {
  return (
    <WindowChrome title="traqcker.com/chat — Traq, the research assistant">
      <Shot src="/screenshots/chat.png" alt="Traq AI assistant answering a question about NVDA risks" />
    </WindowChrome>
  );
}

function MockCalendar() {
  return (
    <WindowChrome title="traqcker.com/calendar — Earnings & IPO Tracker">
      <Shot src="/screenshots/calendar.png" alt="Traqcker earnings and IPO calendar" />
    </WindowChrome>
  );
}

function MockWatchlist() {
  return (
    <WindowChrome title="traqcker.com/watchlist — News, filtered to your positions">
      <Shot src="/screenshots/watchlist.png" alt="Traqcker watchlist news feed filtered to holdings" />
    </WindowChrome>
  );
}

export default function Home() {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useUser();
  const [userCount, setUserCount] = useState(null);

  useEffect(() => {
    if (isLoaded && isSignedIn) router.replace('/home');
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    fetch('/api/user-count').then(r => r.json()).then(d => setUserCount(d.count)).catch(() => {});
  }, []);

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', fontFamily: 'Inter, sans-serif', paddingBottom: '80px', overflow: 'hidden' }}>
      <Topbar />

      {/* HERO */}
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '80px 24px 0', textAlign: 'center', position: 'relative' }}>

        <div style={{ position: 'absolute', top: '-120px', left: '50%', transform: 'translateX(-50%)', width: '600px', height: '400px', background: 'radial-gradient(ellipse at center, var(--accent) 0%, transparent 70%)', opacity: 0.12, pointerEvents: 'none' }} />

        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'var(--accent-dim)',
          border: '1px solid rgba(15, 118, 110, 0.3)', borderRadius: '20px', padding: '4px 12px',
          fontSize: '11px', fontWeight: 700, color: 'var(--accent)', letterSpacing: '1px',
          textTransform: 'uppercase', marginBottom: '24px',
        }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)', display: 'inline-block', boxShadow: '0 0 8px var(--accent)' }} />
          The Bloomberg terminal for independent investors
        </div>

        <h1 style={{
          fontSize: '54px', fontWeight: 900, letterSpacing: '-1.5px', lineHeight: 1.08,
          maxWidth: '860px', margin: '0 auto 20px',
          background: 'linear-gradient(135deg, #1f2937 40%, #0f766e 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          Every public company. Every filing. One terminal — for a fraction of the price.
        </h1>

        <p style={{ fontSize: '17px', color: 'var(--text-2)', lineHeight: 1.7, maxWidth: '640px', margin: '0 auto 40px', fontWeight: 400 }}>
          Traqcker pulls straight from SEC EDGAR to score quality, model fair value, track your portfolio,
          and brief you every morning — all in one workspace built for people who do their own research.
        </p>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '56px', flexWrap: 'wrap' }}>
          <a href="/pricing" style={{ padding: '13px 26px', fontSize: '14px', fontWeight: 700, background: 'var(--accent)', color: '#fff', borderRadius: '8px', textDecoration: 'none', boxShadow: '0 4px 14px rgba(15, 118, 110, 0.25)' }}>
            Start free 14-day Pro trial
          </a>
          <a href="/about" style={{ padding: '13px 26px', fontSize: '14px', fontWeight: 700, background: 'transparent', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '8px', textDecoration: 'none' }}>
            Learn more →
          </a>
        </div>

        {/* HERO PRODUCT SHOT — real screenshot of /stock/AAPL, signed in as Pro */}
        <WindowChrome title="terminal.traqcker.com — AAPL (Apple Inc.) Analysis" maxWidth="920px">
          <Shot src="/screenshots/stock.png" alt="Traqcker stock analysis page for Apple Inc." />
        </WindowChrome>

        {/* TRUST / STATS STRIP */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '48px', flexWrap: 'wrap', margin: '48px 0 0', padding: '0 0 56px' }}>
          {[
            ['8,412', 'US Equities Covered'],
            ['SEC EDGAR', 'Primary Source Data'],
            [userCount ? userCount.toLocaleString() : '2,874', 'Independent Analysts'],
            ['14 Days', 'Free Trial, Then Subscribe'],
          ].map(([v, l]) => (
            <div key={l} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '22px', fontWeight: 900, color: 'var(--text)' }}>{v}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px', letterSpacing: '0.3px' }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* FEATURE SHOWCASE */}
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 24px' }}>
        <div style={{ textAlign: 'center', maxWidth: '640px', margin: '0 auto 8px' }}>
          <h2 style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-0.5px', marginBottom: '12px' }}>
            One workspace. Every step of your process.
          </h2>
          <p style={{ fontSize: '15px', color: 'var(--text-2)', lineHeight: 1.6 }}>
            From first screen to final thesis — Traqcker replaces the spreadsheet-and-tab-hopping workflow with a single terminal.
          </p>
        </div>

        <FeatureRow
          tag="Screener"
          title="Filter 8,000+ stocks by the metrics that actually matter."
          description="Skip the noisy stock-pickers. Run quantitative screens on margins, growth, FCF yield and ROE across the full US equity universe, sourced straight from filings."
          bullets={['Presets for Tech Growth, Value Gems, Cash Cows and more', 'Live sparklines and sector breakdowns', 'Custom thresholds on 10+ fundamental metrics']}
          mockup={<MockScreener />}
          href="/pricing"
        />

        <FeatureRow
          tag="Radar"
          title="See sentiment and momentum before it's consensus."
          description="Track sector-wide momentum and aggregate Buy/Hold/Sell positioning from the Traqcker community and analyst coverage, side by side."
          bullets={['Sector momentum index updated daily', 'Crowd-sourced Buy/Hold/Sell consensus', 'Compare up to 5 tickers head-to-head']}
          mockup={<MockCompare />}
          reverse
          href="/pricing"
        />

        <FeatureRow
          tag="Portfolio"
          title="Track real holdings, not just watchlists."
          description="Import your positions by CSV or add them by hand. See live gain/loss, allocation by stock, sector and custom pies, in your own currency."
          bullets={['CSV import with automatic column detection', 'Multi-currency support (USD, EUR, GBP)', 'Allocation and growth charts, always current']}
          mockup={<MockPortfolio />}
        />

        <FeatureRow
          tag="Traq AI"
          title="Ask your terminal a question, get an answer grounded in filings."
          description="Traq is a research assistant scoped to your ticker or your whole portfolio — no hallucinated numbers, every answer traces back to real fundamentals."
          bullets={['Ask about risks, valuation, or fundamentals in plain English', 'Portfolio mode reasons across your entire book', 'Grounded in the same SEC data as the rest of the terminal']}
          mockup={<MockChat />}
          reverse
        />

        <FeatureRow
          tag="Calendar"
          title="Never get blindsided by an earnings date again."
          description="A calendar of every earnings release and IPO for covered stocks, filterable down to just the names on your watchlist."
          bullets={['Earnings timing: before open, after close, or TBD', 'Upcoming IPO pricing and expected ranges', 'One-click filter to your watchlist only']}
          mockup={<MockCalendar />}
        />

        <FeatureRow
          tag="Watchlist"
          title="News that's actually about the stocks you own."
          description="Real-time headlines, pre-filtered to your holdings and watchlist — instead of a firehose of unrelated market noise."
          bullets={['Filings and headlines matched to your tickers', 'Save articles to revisit later', 'One list for watchlist + portfolio positions']}
          mockup={<MockWatchlist />}
          reverse
        />
      </div>

      {/* CORE METHOD CARDS */}
      <div style={{ maxWidth: '1100px', margin: '80px auto 0', padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.5px' }}>
            Built on primary data, not someone else's summary.
          </h2>
          <p style={{ fontSize: '15px', color: 'var(--text-2)', marginTop: '8px' }}>
            A complete suite of financial tools with zero marketing noise.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
          {[
            ['📥', 'Direct SEC EDGAR Feed', 'Data is loaded and computed directly from primary SEC filings. Zero dependency on third-party aggregators means zero delay.'],
            ['📊', 'Algorithmic Quality Score', 'Evaluate profitability, operational trends, customer concentration risk, and revenue quality in a fraction of a second.'],
            ['⚖️', 'Graham Intrinsic Value', "Intelligent valuation calculations based on Benjamin Graham's classical formula, adjusted for current bond yields and growth CAGR."],
            ['👥', 'Consensus Intelligence', 'Compare your underwriting calls with the collective votes of other institutional and independent financial analysts.'],
          ].map(([icon, title, body]) => (
            <div key={title} style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px' }}>
              <div style={{ fontSize: '22px', marginBottom: '14px' }}>{icon}</div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)', marginBottom: '8px' }}>{title}</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.5 }}>{body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* PRICING TEASER */}
      <div style={{ maxWidth: '560px', margin: '80px auto 0', padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.5px' }}>One plan. Full terminal.</h2>
          <p style={{ fontSize: '15px', color: 'var(--text-2)', marginTop: '8px' }}>No institutional sales call required — just a 14-day trial, then a subscription.</p>
        </div>
        <div style={{ background: 'var(--bg-1)', border: '1px solid var(--accent)', borderRadius: '14px', padding: '32px', boxShadow: '0 0 0 1px var(--accent) inset' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent)', letterSpacing: '1px', marginBottom: '8px' }}>TRAQCKER PRO</div>
          <div style={{ fontSize: '30px', fontWeight: 900, marginBottom: '4px' }}>14 days free</div>
          <div style={{ fontSize: '13px', color: 'var(--text-3)', marginBottom: '20px' }}>then a subscription — cancel anytime during the trial</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', color: 'var(--text-2)' }}>
            <li>✓ Full access to the terminal — screener, radar, portfolio, calendar</li>
            <li>✓ Quality Score, Graham fair value & SEC-sourced financials</li>
            <li>✓ Traq AI research assistant, unlimited discovers</li>
          </ul>
          <a href="/pricing" style={{ display: 'block', textAlign: 'center', padding: '13px', background: 'var(--accent)', borderRadius: '8px', color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: '13px' }}>Start your 14-day trial →</a>
        </div>
      </div>

      {/* CTA + NEWSLETTER */}
      <div style={{ maxWidth: '680px', margin: '96px auto 0', padding: '0 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '32px' }}>
        <div>
          <h2 style={{ fontSize: '26px', fontWeight: 800, marginBottom: '14px', letterSpacing: '-0.5px' }}>
            Ready to underwrite your first stock?
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--text-2)', marginBottom: '24px', maxWidth: '480px', margin: '0 auto 24px' }}>
            Sign up today to get 14 days of full Pro access. Unlimited discovers, advanced SEC financials, and intrinsic valuation tools.
          </p>
          <a href="/sign-up" style={{
            display: 'inline-block', padding: '14px 32px', fontSize: '14px', fontWeight: 700,
            background: 'var(--accent)', color: '#ffffff', borderRadius: '8px', textDecoration: 'none',
            boxShadow: '0 4px 14px rgba(79, 122, 104, 0.25)', transition: 'opacity 0.15s',
          }}
            onMouseEnter={e => e.currentTarget.style.opacity = 0.9}
            onMouseLeave={e => e.currentTarget.style.opacity = 1}
          >
            Start your 14-day trial →
          </a>
        </div>
        <NewsletterForm />
      </div>

    </div>
  );
}
