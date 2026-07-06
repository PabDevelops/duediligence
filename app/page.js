'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from './components/AuthProvider';
import NewsletterForm from './components/NewsletterForm';
import { WindowChrome, Shot } from './components/WindowChrome';

const MONO = "'JetBrains Mono', monospace";

export default function Home() {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useUser();
  const [userCount, setUserCount] = useState(null);
  const [activePropTab, setActivePropTab] = useState(0);

  useEffect(() => {
    if (isLoaded && isSignedIn) router.replace('/home');
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    fetch('/api/user-count').then(r => r.json()).then(d => setUserCount(d.count)).catch(() => { });
  }, []);

  const valueProps = [
    {
      title: "Cut research time",
      tagline: "AI queries on any company, filing, or metric",
      desc: "Ask complex questions like 'what are the main risks outlined in their last 10-K?' or 'how has capital allocation changed?' and get instant, cited answers from Traq AI.",
      mockup: (
        <WindowChrome title="terminal.traqcker.com/chat — Traq Research Assistant">
          <Shot src="/screenshots/chat.png" alt="Traq AI research assistant analyzing company risks" />
        </WindowChrome>
      )
    },
    {
      title: "Be first",
      tagline: "Global live coverage of filings and prices",
      desc: "Get real-time alerts as soon as filings hit the SEC EDGAR system. Watchlists and portfolios synchronize prices and currency rates continuously to show movements instantly.",
      mockup: (
        <WindowChrome title="terminal.traqcker.com/watchlist — Live Ticker Headlines">
          <Shot src="/screenshots/watchlist.png" alt="Live ticker headlines and real-time prices feed" />
        </WindowChrome>
      )
    },
    {
      title: "Trust every finding",
      tagline: "First-party source verification",
      desc: "No black boxes. Every computed margin, quality score component, and Graham fair value is directly linked to the exact filing row. Click any metric to inspect the original SEC source.",
      mockup: (
        <WindowChrome title="terminal.traqcker.com/stock/AAPL — SEC Source Reference">
          <Shot src="/screenshots/stock.png" alt="Stock fundamental analysis verified with SEC files" />
        </WindowChrome>
      )
    },
    {
      title: "Spot inflection points",
      tagline: "Evaluate growth, margins, and allocation trends",
      desc: "Filter and rank over 8,000+ equities in seconds. Compare margins, free cash flow yields, debt-to-equity ratios, and dilution profiles side-by-side using classical models.",
      mockup: (
        <WindowChrome title="terminal.traqcker.com/screener — Quantitative Universe Filter">
          <Shot src="/screenshots/screener.png" alt="Quantitative stock screener grid" />
        </WindowChrome>
      )
    }
  ];

  return (
    <div style={{ background: '#ffffff', minHeight: '100vh', color: 'var(--text)', fontFamily: 'Inter, sans-serif', overflow: 'hidden' }}>

      {/* HEADER */}
      <header style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--border)'
      }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
          <img src="/logo-traqcker-new.png" alt="Traqcker" style={{ height: '18px', width: 'auto' }} />
        </a>

        <nav className="desktop-only" style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
          <a href="/about" style={{ textDecoration: 'none', color: 'var(--text-2)', fontSize: '13px', fontWeight: 600 }}>Product</a>
          <a href="/pricing" style={{ textDecoration: 'none', color: 'var(--text-2)', fontSize: '13px', fontWeight: 600 }}>Pricing</a>
          <a href="#product-tour" style={{ textDecoration: 'none', color: 'var(--text-2)', fontSize: '13px', fontWeight: 600 }}>Use cases</a>
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <a href="/sign-in" style={{ textDecoration: 'none', color: 'var(--text-2)', fontSize: '13px', fontWeight: 600 }}>Open app</a>
          <a href="/pricing" style={{
            height: '38px',
            padding: '0 16px',
            background: 'var(--text)',
            color: '#ffffff',
            fontSize: '13px',
            fontWeight: 700,
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textDecoration: 'none',
            transition: 'opacity 0.15s'
          }}
            onMouseEnter={e => e.currentTarget.style.opacity = 0.9}
            onMouseLeave={e => e.currentTarget.style.opacity = 1}
          >
            Start free trial
          </a>
        </div>
      </header>

      {/* HERO SECTION */}
      <section style={{ maxWidth: '1200px', margin: '0 auto', padding: '80px 24px 60px', textAlign: 'center', position: 'relative' }}>
        <h1 style={{
          fontSize: '56px',
          fontWeight: 900,
          letterSpacing: '-1.5px',
          lineHeight: 1.08,
          maxWidth: '820px',
          margin: '0 auto 24px',
          color: 'var(--text)',
        }}>
          Professional investment analysis, powered by direct company filings.
        </h1>
        <p style={{
          fontSize: '18px',
          color: 'var(--text-2)',
          lineHeight: 1.6,
          maxWidth: '680px',
          margin: '0 auto 40px',
        }}>
          Direct SEC filings, normalized multi-currency portfolios, intrinsic valuation modeling, and community intelligence. Trusted by independent analysts worldwide.
        </p>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '64px', flexWrap: 'wrap' }}>
          <a href="/pricing" style={{
            padding: '14px 28px',
            fontSize: '14px',
            fontWeight: 700,
            background: 'var(--accent)',
            color: '#ffffff',
            borderRadius: '8px',
            textDecoration: 'none',
            boxShadow: '0 4px 14px rgba(15, 118, 110, 0.25)',
            transition: 'opacity 0.15s'
          }}
            onMouseEnter={e => e.currentTarget.style.opacity = 0.95}
            onMouseLeave={e => e.currentTarget.style.opacity = 1}
          >
            Start free 14-day Pro trial
          </a>
          <a href="#product-tour" style={{
            padding: '14px 28px',
            fontSize: '14px',
            fontWeight: 600,
            background: 'transparent',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            textDecoration: 'none',
            transition: 'background 0.15s'
          }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.02)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            See product tour ↓
          </a>
        </div>

        {/* HERO MOCKUP */}
        <div style={{ position: 'relative', maxWidth: '960px', margin: '0 auto' }}>
          <div style={{
            position: 'absolute',
            top: '10%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '80%',
            height: '80%',
            background: 'radial-gradient(circle, var(--accent) 0%, transparent 70%)',
            opacity: 0.08,
            filter: 'blur(40px)',
            pointerEvents: 'none',
            zIndex: 0
          }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <WindowChrome title="terminal.traqcker.com/home — Market Overview Dashboard" maxWidth="920px">
              <Shot src="/screenshots/stock.png" alt="Traqcker Terminal Stock Analysis Screen" />
            </WindowChrome>
          </div>
        </div>
      </section>

      {/* TRUSTED BY STRIP */}
      <section style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: '#fafafa', padding: '36px 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '24px' }}>
            Trusted by independent analysts & retail investors
          </p>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '48px',
            flexWrap: 'wrap',
            fontFamily: MONO,
            fontSize: '14px',
            fontWeight: 700,
            color: 'var(--text-3)',
          }}>
            <span>STIFEL</span>
            <span>YAHOO FINANCE</span>
            <span>JANUS HENDERSON</span>
            <span>MONTANARO</span>
            <span>WOOD MACKENZIE</span>
          </div>
        </div>
      </section>

      {/* CORE CAPABILITIES */}
      <section style={{ maxWidth: '1200px', margin: '0 auto', padding: '100px 24px 60px' }}>
        <div style={{ textAlign: 'center', marginBottom: '56px' }}>
          <span style={{ fontFamily: MONO, fontSize: '11px', color: 'var(--accent)', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>Built for research</span>
          <h2 style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-0.8px', color: 'var(--text)', marginTop: '8px' }}>Tools designed to verify, clarify, and speed up your process</h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>

          {/* CAPABILITY 1: PRO TERMINAL */}
          <div style={{
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '36px',
            background: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            transition: 'border-color 0.2s',
          }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            <div>
              <div style={{ display: 'inline-flex', background: 'var(--accent-dim)', color: 'var(--accent)', fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '20px', marginBottom: '20px' }}>
                TERMINAL & SCREENER
              </div>
              <h3 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text)', marginBottom: '8px' }}>Direct SEC Financials</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-3)', fontFamily: MONO, marginBottom: '20px' }}>Quantitative stock screening & modeling</p>
              <p style={{ fontSize: '14px', color: 'var(--text-2)', lineHeight: 1.6, marginBottom: '24px' }}>
                Filter over 8,000+ equities instantly. Compute margins, cash conversions, debt profiles, and Benjamin Graham intrinsic values directly from filings.
              </p>
            </div>
            <a href="/pricing" style={{
              height: '44px',
              border: '1px solid var(--text)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '13px',
              fontWeight: 700,
              color: 'var(--text)',
              textDecoration: 'none',
              transition: 'background 0.15s'
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--text)'; e.currentTarget.style.color = '#ffffff'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text)'; }}
            >
              Start Free 14-day Trial →
            </a>
          </div>

          {/* CAPABILITY 2: PORTFOLIO & WATCHLIST */}
          <div style={{
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '36px',
            background: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            transition: 'border-color 0.2s',
          }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            <div>
              <div style={{ display: 'inline-flex', background: 'rgba(37, 99, 235, 0.08)', color: 'var(--blue)', fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '20px', marginBottom: '20px' }}>
                PORTFOLIO & WATCHLIST
              </div>
              <h3 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text)', marginBottom: '8px' }}>Multi-Currency Tracker</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-3)', fontFamily: MONO, marginBottom: '20px' }}>Real-time valuation across global assets</p>
              <p style={{ fontSize: '14px', color: 'var(--text-2)', lineHeight: 1.6, marginBottom: '24px' }}>
                Track positions, gain/loss, and sector allocation in your own reporting currency. Handles international tickers (like LLOY.L) with automatic pence/pound conversion.
              </p>
            </div>
            <a href="/pricing" style={{
              height: '44px',
              border: '1px solid var(--text)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '13px',
              fontWeight: 700,
              color: 'var(--text)',
              textDecoration: 'none',
              transition: 'background 0.15s'
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--text)'; e.currentTarget.style.color = '#ffffff'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text)'; }}
            >
              Track Your Portfolio →
            </a>
          </div>

        </div>
      </section>

      {/* VALUE PROPOSITION TABS ("Numbers are easy. Understanding is hard.") */}
      <section style={{ background: '#fafafa', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: '100px 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

          <div style={{ textAlign: 'center', marginBottom: '56px' }}>
            <span style={{ fontFamily: MONO, fontSize: '11px', color: 'var(--accent)', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>Why Traqcker</span>
            <h2 style={{ fontSize: '36px', fontWeight: 900, letterSpacing: '-1px', color: 'var(--text)', marginTop: '8px', marginBottom: '14px' }}>
              Raw filings. Unbiased metrics. Clear insights.
            </h2>
            <p style={{ fontSize: '15px', color: 'var(--text-2)', maxWidth: '580px', margin: '0 auto' }}>
              We build tools that focus on verification, clarity, and speed. Cut through the noise with primary source financial intelligence.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '56px', alignItems: 'center' }}>

            {/* TABS MENU */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {valueProps.map((prop, idx) => {
                const isActive = activePropTab === idx;
                return (
                  <button key={prop.title} onClick={() => setActivePropTab(idx)} style={{
                    textAlign: 'left',
                    background: isActive ? '#ffffff' : 'transparent',
                    border: isActive ? '1px solid var(--border)' : '1px solid transparent',
                    borderRadius: '10px',
                    padding: '16px 20px',
                    cursor: 'pointer',
                    outline: 'none',
                    transition: 'all 0.15s'
                  }}>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: isActive ? 'var(--text)' : 'var(--text-2)' }}>{prop.title}</div>
                    <div style={{ fontSize: '11px', color: isActive ? 'var(--accent)' : 'var(--text-3)', fontFamily: MONO, marginTop: '4px' }}>{prop.tagline}</div>
                  </button>
                );
              })}
            </div>

            {/* TAB CONTENT (MOCKUP + TEXT) */}
            <div style={{ background: '#ffffff', border: '1px solid var(--border)', borderRadius: '16px', padding: '36px', minHeight: '440px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text)', marginBottom: '8px' }}>{valueProps[activePropTab].tagline}</h3>
                <p style={{ fontSize: '14px', color: 'var(--text-2)', lineHeight: 1.6 }}>{valueProps[activePropTab].desc}</p>
              </div>
              <div style={{ zIndex: 1 }}>
                {valueProps[activePropTab].mockup}
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* PRODUCT TOUR / FULL EXAMPLE OF WHAT THE APP OFFERS */}
      <section id="product-tour" style={{ background: '#ffffff', padding: '100px 24px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '56px' }}>
            <span style={{ fontFamily: MONO, fontSize: '11px', color: 'var(--accent)', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>Product tour</span>
            <h2 style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text)', marginTop: '8px' }}>Everything Traqcker offers, in one walkthrough</h2>
            <p style={{ fontSize: '15px', color: 'var(--text-2)', maxWidth: '620px', margin: '14px auto 0' }}>
              From your morning dashboard to a full valuation model, here's what a real session inside Traqcker looks like.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '80px' }}>
            {[
              {
                step: '01',
                title: 'Start with a live market snapshot',
                desc: "Your home dashboard opens with real-time indices, currency rates, and the day's biggest filings and price movers across your watchlist and portfolio.",
                src: '/screenshots/home.png',
                alt: 'Traqcker home dashboard with market snapshot',
                windowTitle: 'terminal.traqcker.com/home — Market Overview Dashboard'
              },
              {
                step: '02',
                title: 'Track your holdings across currencies',
                desc: 'Your portfolio view rolls up gain/loss, sector allocation, and dividend income in one reporting currency, no matter what exchange each position trades on.',
                src: '/screenshots/portfolio.png',
                alt: 'Traqcker multi-currency portfolio tracker',
                windowTitle: 'terminal.traqcker.com/portfolio — Multi-Currency Portfolio'
              },
              {
                step: '03',
                title: 'Drill into a single company',
                desc: 'Every quality score, margin, and Graham fair value on a stock page links straight back to the exact row in the original SEC filing.',
                src: '/screenshots/stock.png',
                alt: 'Traqcker stock analysis page verified against SEC filings',
                windowTitle: 'terminal.traqcker.com/stock/AAPL — SEC Source Reference'
              },
              {
                step: '04',
                title: 'Screen the entire market',
                desc: 'Filter and rank 8,000+ equities by margin, free cash flow yield, debt profile, or dilution to find setups worth a closer look.',
                src: '/screenshots/screener.png',
                alt: 'Traqcker quantitative stock screener',
                windowTitle: 'terminal.traqcker.com/screener — Quantitative Universe Filter'
              },
              {
                step: '05',
                title: 'Compare candidates side-by-side',
                desc: 'Line up two or more companies across the same fundamentals to see who actually has the stronger balance sheet and growth trajectory.',
                src: '/screenshots/compare.png',
                alt: 'Traqcker side-by-side company comparison',
                windowTitle: 'terminal.traqcker.com/compare — Side-by-Side Comparison'
              },
              {
                step: '06',
                title: 'Ask Traq AI the hard questions',
                desc: "Get instant, cited answers to questions like \"what changed in their debt covenants?\" pulled directly from the filings, not a generic summary.",
                src: '/screenshots/chat.png',
                alt: 'Traq AI research assistant answering questions about filings',
                windowTitle: 'terminal.traqcker.com/chat — Traq Research Assistant'
              },
              {
                step: '07',
                title: 'Never miss a catalyst',
                desc: 'The earnings calendar and live filing feed keep you ahead of reports, dividends, and SEC EDGAR alerts for everything on your radar.',
                src: '/screenshots/calendar.png',
                alt: 'Traqcker earnings and filings calendar',
                windowTitle: 'terminal.traqcker.com/calendar — Earnings & Filings Calendar'
              }
            ].map((s, idx) => (
              <div key={s.step} style={{
                display: 'flex',
                flexDirection: idx % 2 === 1 ? 'row-reverse' : 'row',
                gap: '48px',
                alignItems: 'center',
                flexWrap: 'wrap'
              }} className="product-tour-row">
                <div style={{ flex: '1 1 320px' }}>
                  <div style={{ fontFamily: MONO, fontSize: '12px', color: 'var(--accent)', fontWeight: 700, marginBottom: '12px' }}>{s.step}</div>
                  <h3 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text)', marginBottom: '12px' }}>{s.title}</h3>
                  <p style={{ fontSize: '14px', color: 'var(--text-2)', lineHeight: 1.7 }}>{s.desc}</p>
                </div>
                <div style={{ flex: '1.4 1 420px' }}>
                  <WindowChrome title={s.windowTitle}>
                    <Shot src={s.src} alt={s.alt} />
                  </WindowChrome>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CALL TO ACTION (CTA) */}
      <section style={{ maxWidth: '1200px', margin: '0 auto', padding: '100px 24px 120px', textAlign: 'center' }}>
        <div style={{
          background: 'linear-gradient(135deg, #0b0d13 0%, #0f766e 100%)',
          borderRadius: '24px',
          padding: '80px 40px',
          color: '#ffffff',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ position: 'relative', zIndex: 1, maxWidth: '640px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '42px', fontWeight: 900, letterSpacing: '-1.5px', marginBottom: '18px' }}>
              Research faster. Value smarter.
            </h2>
            <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.8)', lineHeight: 1.6, marginBottom: '36px' }}>
              Join thousands of analysts. Try Traqcker Pro free for 14 days. No credit card required.
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '48px', flexWrap: 'wrap' }}>
              <a href="/pricing" style={{
                padding: '14px 32px',
                fontSize: '14px',
                fontWeight: 700,
                background: '#ffffff',
                color: '#0b0d13',
                borderRadius: '8px',
                textDecoration: 'none',
                boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
                transition: 'opacity 0.15s'
              }}
                onMouseEnter={e => e.currentTarget.style.opacity = 0.9}
                onMouseLeave={e => e.currentTarget.style.opacity = 1}
              >
                Start free trial
              </a>
              <a href="/pricing" style={{
                padding: '14px 32px',
                fontSize: '14px',
                fontWeight: 600,
                background: 'transparent',
                color: '#ffffff',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '8px',
                textDecoration: 'none',
                transition: 'background 0.15s'
              }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                View pricing plans
              </a>
            </div>

            <div style={{ maxWidth: '440px', margin: '0 auto' }}>
              <NewsletterForm />
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid var(--border)', background: '#fafafa', padding: '60px 24px 80px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '40px' }}>
          <div>
            <img src="/logo-traqcker-new.png" alt="Traqcker" style={{ height: '16px', width: 'auto', marginBottom: '16px' }} />
            <p style={{ fontSize: '12px', color: 'var(--text-3)', maxWidth: '240px', lineHeight: 1.5 }}>
              Structured first-party data and AI utilities for public market investors.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '64px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Product</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                <li><a href="/pricing" style={{ textDecoration: 'none', color: 'var(--text-2)' }}>Pricing</a></li>
                <li><a href="/about" style={{ textDecoration: 'none', color: 'var(--text-2)' }}>Pro Features</a></li>
              </ul>
            </div>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Company</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                <li><a href="/about" style={{ textDecoration: 'none', color: 'var(--text-2)' }}>About Us</a></li>
                <li><a href="/privacy" style={{ textDecoration: 'none', color: 'var(--text-2)' }}>Privacy Policy</a></li>
                <li><a href="/terms" style={{ textDecoration: 'none', color: 'var(--text-2)' }}>Terms of Service</a></li>
              </ul>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
