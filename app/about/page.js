'use client';
import Topbar from '../components/Topbar';

export default function About() {
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', fontFamily: 'JetBrains Mono, monospace' }}>
      <Topbar />
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '60px 24px' }}>

        {/* Header */}
        <div style={{ marginBottom: '48px' }}>
          <div style={{ color: 'var(--accent)', fontSize: '10px', letterSpacing: '3px', marginBottom: '12px' }}>ABOUT</div>
          <h1 style={{ fontSize: '36px', fontWeight: 600, letterSpacing: '-1px', marginBottom: '24px' }}>
            Built by an investor.<br />
            <span style={{ color: 'var(--accent)' }}>For investors.</span>
          </h1>
          <div style={{ color: 'var(--text-2)', fontSize: '13px', lineHeight: 1.9, maxWidth: '600px' }}>
            <p style={{ marginBottom: '16px' }}>
              Traqcker was born out of frustration. Most stock analysis tools are either too expensive, too noisy, or push buy/sell recommendations that serve the platform more than the investor.
            </p>
            <p style={{ marginBottom: '16px' }}>
              The idea was simple: build a tool that goes straight to the source. SEC EDGAR filings. No opinions. No noise. Just the raw data that actually matters for fundamental analysis.
            </p>
            <p>
              Built by an individual investor for individual investors who want to do their own due diligence.
            </p>
          </div>
        </div>

        {/* Divider */}
        <div style={{ borderTop: '1px solid var(--border)', marginBottom: '48px' }} />

        {/* Team */}
        <div style={{ marginBottom: '48px' }}>
          <div style={{ color: 'var(--accent)', fontSize: '10px', letterSpacing: '3px', marginBottom: '24px' }}>THE TEAM</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <img
              src="/pablo.jpg"
              alt="Pablo Rodriguez"
              style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '50%', filter: 'grayscale(100%)', flexShrink: 0 }}
            />
            <div>
              <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>Pablo Rodriguez</div>
              <div style={{ color: 'var(--accent)', fontSize: '11px', letterSpacing: '1px', marginBottom: '8px' }}>FOUNDER</div>
              <a href="https://twitter.com/InvestingPablo" target="_blank" rel="noopener noreferrer"
                style={{ color: 'var(--text-3)', fontSize: '11px', textDecoration: 'none', letterSpacing: '1px' }}>
                @InvestingPablo ↗
              </a>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ borderTop: '1px solid var(--border)', marginBottom: '48px' }} />

        {/* Data sources */}
        <div style={{ marginBottom: '48px' }}>
          <div style={{ color: 'var(--accent)', fontSize: '10px', letterSpacing: '3px', marginBottom: '16px' }}>DATA SOURCES</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: 'var(--border)' }}>
            {[
              { name: 'SEC EDGAR', desc: 'Primary financial data from official US filings (XBRL)' },
              { name: 'FINNHUB', desc: 'Real-time prices, market data and company profiles' },
              { name: 'YAHOO FINANCE', desc: 'Historical price data and sparklines' },
            ].map(s => (
              <div key={s.name} style={{ background: 'var(--bg-1)', padding: '16px' }}>
                <div style={{ color: 'var(--accent)', fontSize: '11px', fontWeight: 600, marginBottom: '6px', letterSpacing: '1px' }}>{s.name}</div>
                <div style={{ color: 'var(--text-3)', fontSize: '11px', lineHeight: 1.6 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', color: 'var(--text-3)', fontSize: '10px', letterSpacing: '1px' }}>
          NOT INVESTMENT ADVICE · DATA FROM PUBLIC SOURCES · © 2026 TRAQCKER
        </div>
      </div>
    </div>
  );
}