'use client';
import Topbar from '../components/Topbar';

export default function About() {
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', fontFamily: 'Nunito, sans-serif' }}>
      <Topbar />
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '60px 24px 80px' }}>

        {/* Header */}
        <div style={{ marginBottom: '48px' }}>
          <div style={{ color: 'var(--accent)', fontSize: '11px', letterSpacing: '2px', marginBottom: '12px', fontWeight: 700 }}>ABOUT</div>
          <h1 style={{ fontSize: '40px', fontWeight: 800, letterSpacing: '-1px', marginBottom: '24px', lineHeight: 1.1 }}>
            Built for people<br />
            <span style={{ color: 'var(--accent)' }}>who just want facts.</span>
          </h1>
          <div style={{ color: 'var(--text-2)', fontSize: '15px', lineHeight: 1.9, maxWidth: '600px' }}>
            <p style={{ marginBottom: '16px' }}>
              Most stock tools are either super expensive, overwhelming with jargon, or designed to push you into trades that benefit them, not you.
            </p>
            <p style={{ marginBottom: '16px' }}>
              Traqcker is different. We pull real data from official company filings and turn it into a simple score. No complicated formulas. No noise. Just what matters.
            </p>
            <p>
              Built by someone who got frustrated with existing tools. For anyone who wants to understand stocks without a finance degree.
            </p>
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', marginBottom: '48px' }} />

        {/* Team */}
        <div style={{ marginBottom: '48px' }}>
          <div style={{ color: 'var(--accent)', fontSize: '11px', letterSpacing: '2px', marginBottom: '24px', fontWeight: 700 }}>THE TEAM</div>
          <div className="glass" style={{ padding: '28px', display: 'flex', alignItems: 'center', gap: '24px' }}>
            <img
              src="/pablo.jpg"
              alt="Pablo Rodriguez"
              style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '50%', flexShrink: 0 }}
            />
            <div>
              <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px' }}>Pablo Rodriguez</div>
              <div style={{ color: 'var(--accent)', fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>Founder</div>
              <a href="https://twitter.com/InvestingPablo" target="_blank" rel="noopener noreferrer"
                style={{ color: 'var(--text-3)', fontSize: '13px', textDecoration: 'none' }}>
                @InvestingPablo ↗
              </a>
            </div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', marginBottom: '48px' }} />

        {/* Data sources */}
        <div style={{ marginBottom: '48px' }}>
          <div style={{ color: 'var(--accent)', fontSize: '11px', letterSpacing: '2px', marginBottom: '16px', fontWeight: 700 }}>DATA SOURCES</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            {[
              { name: 'Official Data', desc: 'Real financial information from company filings' },
              { name: 'Finnhub', desc: 'Live stock prices and market data' },
              { name: 'Yahoo Finance', desc: 'Historical price data' },
            ].map(s => (
              <div key={s.name} className="glass" style={{ padding: '20px' }}>
                <div style={{ color: 'var(--accent)', fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>{s.name}</div>
                <div style={{ color: 'var(--text-3)', fontSize: '13px', lineHeight: 1.6 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', color: 'var(--text-3)', fontSize: '12px' }}>
          Not investment advice · Data from public sources · © 2026 Traqcker
        </div>
      </div>
    </div>
  );
}
