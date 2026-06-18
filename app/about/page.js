'use client';
import Topbar from '../components/Topbar';
import { useRouter } from 'next/navigation';

const SCORE_CRITERIA = [
  { label: 'Return on Capital', desc: 'Does the business generate strong returns on what it invests?', weight: 'High' },
  { label: 'Revenue Growth',    desc: 'Is the company growing its top line consistently?',           weight: 'High' },
  { label: 'Profit Margins',    desc: 'How much of each dollar of revenue becomes profit?',          weight: 'Medium' },
  { label: 'Debt Level',        desc: 'Is the balance sheet healthy? Can they handle a downturn?',   weight: 'Medium' },
  { label: 'Free Cash Flow',    desc: 'Does the business actually convert earnings to cash?',        weight: 'High' },
  { label: 'Earnings Quality',  desc: 'Are the reported numbers reliable and consistent?',           weight: 'Medium' },
];

const SOURCES = [
  { name: 'SEC EDGAR',      desc: 'Official US regulator. Every public company must file here. Income statements, balance sheets, cash flows — straight from the source.', icon: '🏛️' },
  { name: 'Alpha Vantage',  desc: 'Company descriptions, sector data, and supplementary fundamental metrics.',                                                              icon: '📡' },
  { name: 'Finnhub',        desc: 'Live stock prices and real-time market data.',                                                                                          icon: '⚡' },
];

const STEPS = [
  { n: '01', title: 'Search any company', desc: 'Type a name or ticker. We cover 8,000+ US-listed stocks — from S&P 500 giants to small caps.' },
  { n: '02', title: 'Read the score',     desc: 'A 0–100 quality score tells you at a glance whether the business is strong, average, or weak.' },
  { n: '03', title: 'Dig deeper',         desc: 'Fair value estimate, financial statements, margins, growth history — all in one page. No spreadsheet needed.' },
];

export default function About() {
  const router = useRouter();

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', fontFamily: 'Nunito, sans-serif' }}>
      <Topbar />
      <div style={{ maxWidth: '820px', margin: '0 auto', padding: '60px 24px 100px' }}>

        {/* Hero */}
        <div style={{ marginBottom: '72px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'var(--accent-dim)', border: '1px solid var(--accent)', padding: '4px 14px', borderRadius: '20px', marginBottom: '20px' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
            <span style={{ color: 'var(--accent)', fontSize: '11px', letterSpacing: '2px', fontWeight: 700 }}>ABOUT TRAQCKER</span>
          </div>
          <h1 style={{ fontSize: '42px', fontWeight: 900, letterSpacing: '-1.5px', lineHeight: 1.1, marginBottom: '20px' }}>
            Built for people who<br />
            <span className="gradient-text">just want facts.</span>
          </h1>
          <p style={{ color: 'var(--text-2)', fontSize: '16px', lineHeight: 1.9, maxWidth: '620px', marginBottom: '14px' }}>
            Most stock tools are either expensive, overwhelming with jargon, or quietly designed to push you into trades that benefit them — not you.
          </p>
          <p style={{ color: 'var(--text-2)', fontSize: '16px', lineHeight: 1.9, maxWidth: '620px' }}>
            Traqcker pulls real data straight from official company filings and turns it into a simple score. No complicated formulas. No noise. Just what matters.
          </p>
        </div>

        {/* How it works */}
        <div style={{ marginBottom: '72px' }}>
          <div style={{ color: 'var(--text-3)', fontSize: '11px', letterSpacing: '2px', fontWeight: 700, marginBottom: '28px' }}>HOW IT WORKS</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }} className="grid-3">
            {STEPS.map(s => (
              <div key={s.n} className="glass" style={{ padding: '28px 24px' }}>
                <div style={{ fontSize: '32px', fontWeight: 900, color: 'var(--border-2)', letterSpacing: '-2px', marginBottom: '12px', fontFamily: 'Nunito, sans-serif' }}>{s.n}</div>
                <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '8px' }}>{s.title}</div>
                <div style={{ color: 'var(--text-3)', fontSize: '13px', lineHeight: 1.7 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Quality Score explained */}
        <div style={{ marginBottom: '72px' }}>
          <div style={{ color: 'var(--text-3)', fontSize: '11px', letterSpacing: '2px', fontWeight: 700, marginBottom: '12px' }}>THE QUALITY SCORE</div>
          <h2 style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.5px', marginBottom: '12px' }}>A 0–100 score built on fundamentals</h2>
          <p style={{ color: 'var(--text-2)', fontSize: '14px', lineHeight: 1.8, maxWidth: '600px', marginBottom: '28px' }}>
            We analyse six dimensions of a business and combine them into one number. Higher is better — but we show you the breakdown so you can see exactly why.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }} className="quality-score-grid">
            {SCORE_CRITERIA.map(c => (
              <div key={c.label} className="card" style={{ padding: '18px 20px', display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.weight === 'High' ? 'var(--accent)' : 'var(--text-3)', flexShrink: 0, marginTop: '5px' }} />
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '4px' }}>{c.label}</div>
                  <div style={{ color: 'var(--text-3)', fontSize: '12px', lineHeight: 1.6 }}>{c.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
              <span style={{ color: 'var(--text-3)', fontSize: '12px' }}>High weight</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--text-3)', display: 'inline-block' }} />
              <span style={{ color: 'var(--text-3)', fontSize: '12px' }}>Medium weight</span>
            </div>
          </div>
        </div>

        {/* Data sources */}
        <div style={{ marginBottom: '72px' }}>
          <div style={{ color: 'var(--text-3)', fontSize: '11px', letterSpacing: '2px', fontWeight: 700, marginBottom: '12px' }}>DATA SOURCES</div>
          <h2 style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.5px', marginBottom: '12px' }}>No analysts. No estimates. Just filings.</h2>
          <p style={{ color: 'var(--text-2)', fontSize: '14px', lineHeight: 1.8, maxWidth: '600px', marginBottom: '28px' }}>
            We go straight to the source. Every number comes from documents companies are legally required to file with regulators — not third-party estimates or analyst forecasts.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {SOURCES.map(s => (
              <div key={s.name} className="glass" style={{ padding: '24px', display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                <div style={{ fontSize: '28px', flexShrink: 0 }}>{s.icon}</div>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '6px' }}>{s.name}</div>
                  <div style={{ color: 'var(--text-3)', fontSize: '13px', lineHeight: 1.7 }}>{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Team */}
        <div style={{ marginBottom: '72px' }}>
          <div style={{ color: 'var(--text-3)', fontSize: '11px', letterSpacing: '2px', fontWeight: 700, marginBottom: '28px' }}>THE TEAM</div>
          <div className="glass" style={{ padding: '32px', display: 'flex', alignItems: 'center', gap: '28px' }}>
            <img src="/pablo.jpg" alt="Pablo Rodriguez" style={{ width: '88px', height: '88px', objectFit: 'cover', borderRadius: '50%', flexShrink: 0, border: '2px solid var(--border-2)' }} />
            <div>
              <div style={{ fontSize: '20px', fontWeight: 800, marginBottom: '4px' }}>Pablo Rodriguez</div>
              <div className="gradient-text" style={{ fontSize: '13px', fontWeight: 700, marginBottom: '10px' }}>Founder</div>
              <p style={{ color: 'var(--text-3)', fontSize: '13px', lineHeight: 1.7, marginBottom: '12px', maxWidth: '420px' }}>
                Built Traqcker out of frustration with tools that were either too expensive or too complex. Wanted something honest, simple, and actually useful for normal investors.
              </p>
              <a href="https://twitter.com/InvestingPablo" target="_blank" rel="noopener noreferrer"
                style={{ color: 'var(--accent)', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}>
                @InvestingPablo ↗
              </a>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="glass-strong" style={{ padding: '48px 40px', textAlign: 'center', borderRadius: '24px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '-0.5px', marginBottom: '12px' }}>
            Try it on any stock. It's free.
          </h2>
          <p style={{ color: 'var(--text-3)', fontSize: '14px', marginBottom: '28px' }}>
            No credit card. No sign-up required to get started.
          </p>
          <button className="btn-primary" onClick={() => router.push('/')} style={{ padding: '14px 36px', fontSize: '15px' }}>
            Analyse a stock →
          </button>
        </div>

        {/* Footer note */}
        <div style={{ marginTop: '48px', paddingTop: '24px', borderTop: '1px solid var(--border)', color: 'var(--text-3)', fontSize: '12px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <span>Not investment advice · Data from public sources</span>
          <span>© 2026 Traqcker</span>
        </div>

      </div>
    </div>
  );
}
