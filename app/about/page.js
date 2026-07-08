'use client';
import Topbar from '../components/Topbar';
import { useRouter } from 'next/navigation';
import { WindowChrome, Shot } from '../components/WindowChrome';

const MONO = "'JetBrains Mono', monospace";

const bentoTiles = [
  {
    span: 2,
    badge: 'TERMINAL & SCREENER',
    title: 'Direct SEC Financials',
    desc: 'Every margin, cash conversion figure, and Graham fair value is computed straight from the filing, not a third-party summary.',
    src: '/screenshots/stock.png',
    alt: 'Stock analysis page sourced directly from SEC filings'
  },
  {
    span: 1,
    badge: 'PORTFOLIO',
    title: 'Multi-Currency Tracker',
    desc: 'Positions, gain/loss, and allocation in your own reporting currency, across any exchange.',
    src: '/screenshots/portfolio.png',
    alt: 'Multi-currency portfolio tracker'
  },
  {
    span: 1,
    badge: 'TRAQ AI',
    title: 'Research Assistant',
    desc: 'Ask complex questions about any filing and get instant, cited answers.',
    src: '/screenshots/chat.png',
    alt: 'Traq AI research assistant'
  },
  {
    span: 1,
    badge: 'SCREENER',
    title: 'Quantitative Universe Filter',
    desc: 'Rank thousands of global equities by margin, FCF yield, debt profile, and dilution in seconds.',
    src: '/screenshots/screener.png',
    alt: 'Quantitative stock screener'
  },
  {
    span: 2,
    badge: 'LIVE COVERAGE',
    title: 'Global Filing & Price Feed',
    desc: 'Real-time alerts the moment filings hit SEC EDGAR, with watchlists that sync prices and currency rates continuously.',
    src: '/screenshots/watchlist.png',
    alt: 'Live ticker headlines and real-time prices feed'
  }
];

export default function About() {
  const router = useRouter();

  return (
    <div style={{ background: '#ffffff', minHeight: '100vh', color: 'var(--text)', fontFamily: 'Inter, sans-serif' }}>
      <Topbar />

      {/* HERO — dark, Quartr-inspired */}
      <section style={{
        background: 'linear-gradient(180deg, #0b0d13 0%, #0d1017 100%)',
        borderBottom: '1px solid var(--border)',
        padding: '90px 24px 100px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute',
          top: '-10%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '70%',
          height: '60%',
          background: 'radial-gradient(circle, var(--accent) 0%, transparent 70%)',
          opacity: 0.18,
          filter: 'blur(60px)',
          pointerEvents: 'none'
        }} />

        <div style={{ maxWidth: '820px', margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(20,184,166,0.12)', border: '1px solid rgba(20,184,166,0.35)', padding: '4px 14px', borderRadius: '20px', marginBottom: '24px' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#14b8a6', display: 'inline-block' }} />
            <span style={{ color: '#5eead4', fontSize: '11px', letterSpacing: '2px', fontWeight: 700 }}>OUR STORY</span>
          </div>
          <h1 style={{ fontSize: '48px', fontWeight: 900, letterSpacing: '-1.5px', lineHeight: 1.1, marginBottom: '20px', color: '#ffffff' }}>
            Investment research infrastructure, built on primary sources.
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '16px', lineHeight: 1.8, maxWidth: '640px', margin: '0 auto 36px' }}>
            Traqcker gives independent analysts and retail investors direct, unfiltered access to clean public company filings, financial scores, and portfolio analysis.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn-primary" onClick={() => router.push('/pricing')} style={{ padding: '14px 28px', fontSize: '14px' }}>
              Start Free Trial →
            </button>
            <a href="/#product-tour" style={{
              padding: '14px 28px',
              fontSize: '14px',
              fontWeight: 600,
              background: 'transparent',
              color: '#ffffff',
              border: '1px solid rgba(255,255,255,0.25)',
              borderRadius: '12px',
              textDecoration: 'none',
              transition: 'background 0.15s'
            }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              See product tour
            </a>
          </div>
        </div>

        <div style={{ maxWidth: '900px', margin: '56px auto 0', position: 'relative', zIndex: 1 }}>
          <WindowChrome title="terminal.traqcker.com/home — Market Overview Dashboard" maxWidth="900px">
            <Shot src="/screenshots/home.png" alt="Traqcker home dashboard" />
          </WindowChrome>
        </div>
      </section>

      {/* BENTO PRODUCT GRID */}
      <section style={{ maxWidth: '1200px', margin: '0 auto', padding: '100px 24px 40px' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <span style={{ fontFamily: MONO, fontSize: '11px', color: 'var(--accent)', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>What we've built</span>
          <h2 style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-0.8px', color: 'var(--text)', marginTop: '8px' }}>One workspace, straight from the source</h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }} className="about-bento-grid">
          {bentoTiles.map((tile) => (
            <div key={tile.title} style={{
              gridColumn: `span ${tile.span}`,
              border: '1px solid var(--border)',
              borderRadius: '16px',
              padding: '28px',
              background: '#fafafa',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              transition: 'border-color 0.2s'
            }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <div>
                <div style={{ display: 'inline-flex', background: 'var(--accent-dim)', color: 'var(--accent)', fontSize: '10px', fontWeight: 700, padding: '4px 10px', borderRadius: '20px', marginBottom: '14px', letterSpacing: '0.5px' }}>
                  {tile.badge}
                </div>
                <h3 style={{ fontSize: '19px', fontWeight: 800, color: 'var(--text)', marginBottom: '8px' }}>{tile.title}</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.6 }}>{tile.desc}</p>
              </div>
              <WindowChrome title={tile.alt}>
                <Shot src={tile.src} alt={tile.alt} />
              </WindowChrome>
            </div>
          ))}
        </div>
      </section>

      {/* FOUNDER'S LETTER / MISSION */}
      <section style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: '#fafafa', padding: '80px 24px' }}>
        <div style={{ maxWidth: '820px', margin: '0 auto' }}>
          <div style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-1px', color: 'var(--text)', marginBottom: '32px', borderLeft: '3px solid var(--accent)', paddingLeft: '24px', lineHeight: 1.3 }}>
            "In investment research, verified facts are the only currency that matters."
          </div>

          <div style={{ color: 'var(--text-2)', fontSize: '15px', lineHeight: 1.8, display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <p>
              Most investment tools are designed to overwhelm you with complex jargon or push you into trades that generate commissions. They give you numbers, but they don't help you understand the quality of the business.
            </p>
            <p>
              We believe independent researchers shouldn't have to spend thousands of dollars a year to access clean, direct financial data. At Traqcker, we go straight to the primary source. We fetch files directly from regulatory bodies, compute margins transparently, and map them to historical visual models.
            </p>
            <p>
              When you evaluate a stock on Traqcker, you don't just see a quality score. You can click on any metric to inspect the exact line in the company's financial reports. We believe in total transparency, facts over predictions, and absolute clarity.
            </p>
          </div>
        </div>
      </section>

      {/* WHY TRAQCKER EXISTS */}
      <section style={{ maxWidth: '820px', margin: '0 auto', padding: '80px 24px' }}>
        <div style={{ color: 'var(--text-3)', fontSize: '11px', letterSpacing: '2px', fontWeight: 700, marginBottom: '36px' }}>WHY TRAQCKER EXISTS</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }} className="quality-score-grid">
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)', marginBottom: '10px' }}>No Analyst Bias</h3>
            <p style={{ color: 'var(--text-2)', fontSize: '13px', lineHeight: 1.7 }}>
              We don't publish speculative target prices or buy/sell recommendations. We provide the historical data, quality score, and intrinsic calculations so you can make your own decisions.
            </p>
          </div>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)', marginBottom: '10px' }}>Source Transparency</h3>
            <p style={{ color: 'var(--text-2)', fontSize: '13px', lineHeight: 1.7 }}>
              Every calculation on our platform is open and verifiable. Clicking any number opens a direct reference to the SEC EDGAR filing row so you can audit the source yourself.
            </p>
          </div>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)', marginBottom: '10px' }}>Multi-Currency Standard</h3>
            <p style={{ color: 'var(--text-2)', fontSize: '13px', lineHeight: 1.7 }}>
              We normalize global assets under one unified interface, converting local currencies and tickers automatically so you can evaluate domestic and foreign positions side-by-side.
            </p>
          </div>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)', marginBottom: '10px' }}>Clean Speed</h3>
            <p style={{ color: 'var(--text-2)', fontSize: '13px', lineHeight: 1.7 }}>
              A high-performance workspace caching system allows you to load watchlists and portfolios instantly, refreshing prices in the background without locking up the UI.
            </p>
          </div>
        </div>
      </section>

      {/* TEAM SECTION */}
      <section style={{ borderTop: '1px solid var(--border)', background: '#fafafa', padding: '80px 24px' }}>
        <div style={{ maxWidth: '820px', margin: '0 auto' }}>
          <div style={{ color: 'var(--text-3)', fontSize: '11px', letterSpacing: '2px', fontWeight: 700, marginBottom: '28px' }}>THE TEAM</div>
          <div style={{ border: '1px solid var(--border)', borderRadius: '16px', padding: '32px', display: 'flex', alignItems: 'center', gap: '28px', background: '#ffffff' }}>
            <img src="/pablo2.jpg" alt="Pablo Rodriguez" style={{ width: '88px', height: '88px', objectFit: 'cover', borderRadius: '50%', flexShrink: 0, border: '2px solid var(--border)' }} />
            <div>
              <div style={{ fontSize: '20px', fontWeight: 800, marginBottom: '4px', color: 'var(--text)' }}>Pablo Rodriguez</div>
              <div className="gradient-text" style={{ fontSize: '13px', fontWeight: 700, marginBottom: '10px' }}>Founder</div>
              <p style={{ color: 'var(--text-2)', fontSize: '13px', lineHeight: 1.7, marginBottom: '12px', maxWidth: '440px' }}>
                Built Traqcker out of frustration with tools that were either too expensive or too complex. Wanted something honest, simple, and actually useful for normal investors.
              </p>
              <a href="https://twitter.com/PabloDevelops" target="_blank" rel="noopener noreferrer"
                style={{ color: 'var(--accent)', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}>
                @PabloDevelops ↗
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section style={{ maxWidth: '820px', margin: '0 auto', padding: '80px 24px 100px' }}>
        <div style={{ border: '1px solid var(--border)', borderRadius: '24px', padding: '48px 40px', textAlign: 'center', background: '#ffffff' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '-0.5px', marginBottom: '12px', color: 'var(--text)' }}>
            Start your research today.
          </h2>
          <p style={{ color: 'var(--text-2)', fontSize: '14px', marginBottom: '28px' }}>
            Try Traqcker Pro free for 14 days. No credit card required.
          </p>
          <button className="btn-primary" onClick={() => router.push('/pricing')} style={{ padding: '14px 36px', fontSize: '15px' }}>
            Start Free Trial →
          </button>
        </div>

        {/* Footer note */}
        <div style={{ marginTop: '48px', paddingTop: '24px', borderTop: '1px solid var(--border)', color: 'var(--text-3)', fontSize: '12px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <span>Not investment advice · Data from public sources</span>
          <span>© 2026 Traqcker</span>
        </div>
      </section>

    </div>
  );
}
