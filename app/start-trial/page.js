'use client';
import { useState } from 'react';
import Topbar from '../components/Topbar';

export default function StartTrial() {
  const [loading, setLoading] = useState(null);
  const [annual, setAnnual] = useState(true);

  const checkout = async (priceId) => {
    setLoading(priceId);
    try {
      const res = await fetch('/api/stripe/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ priceId }) });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (e) { console.error(e); }
    setLoading(null);
  };

  const MONTHLY_ID = process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY;
  const ANNUAL_ID = process.env.NEXT_PUBLIC_STRIPE_PRICE_ANNUAL;

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', fontFamily: 'Inter, sans-serif', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '80px', left: '20%', width: '600px', height: '400px', background: 'radial-gradient(ellipse, rgba(167,139,250,0.1) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
      <Topbar />

      <div style={{ maxWidth: '520px', margin: '0 auto', padding: '56px 20px', position: 'relative', zIndex: 1 }}>

        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ color: 'var(--accent)', fontSize: '11px', letterSpacing: '2px', marginBottom: '12px', fontWeight: 700 }}>START YOUR TRIAL</div>
          <h1 style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-1px', marginBottom: '12px', lineHeight: 1.1 }}>
            14 days of Pro, <span style={{ color: 'var(--accent)' }}>free.</span>
          </h1>
          <p style={{ color: 'var(--text-2)', fontSize: '15px', lineHeight: 1.7 }}>
            Full access to financials, screener, compare, and valuation tools. Card required — cancel anytime before the trial ends and you won't be charged.
          </p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '28px' }}>
          <div className="glass" style={{ display: 'flex', gap: '4px', padding: '4px', borderRadius: '14px' }}>
            <button onClick={() => setAnnual(false)}
              style={{ padding: '10px 24px', borderRadius: '10px', background: !annual ? 'linear-gradient(135deg, #a78bfa, #60a5fa)' : 'transparent', color: !annual ? '#000' : 'var(--text-2)', border: 'none', fontFamily: 'Inter, sans-serif', fontSize: '14px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}>
              Monthly
            </button>
            <button onClick={() => setAnnual(true)}
              style={{ padding: '10px 24px', borderRadius: '10px', background: annual ? 'linear-gradient(135deg, #a78bfa, #60a5fa)' : 'transparent', color: annual ? '#000' : 'var(--text-2)', border: 'none', fontFamily: 'Inter, sans-serif', fontSize: '14px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}>
              Annual · Save 33%
            </button>
          </div>
        </div>

        <div style={{ background: 'rgba(167,139,250,0.06)', border: '1.5px solid rgba(167,139,250,0.4)', borderRadius: '20px', padding: '28px', backdropFilter: 'blur(24px)' }}>
          <div style={{ color: 'var(--accent)', fontSize: '11px', letterSpacing: '2px', marginBottom: '12px', fontWeight: 700 }}>PRO</div>
          <div style={{ fontSize: '40px', fontWeight: 900, marginBottom: '4px', letterSpacing: '-1px' }}>
            {annual ? '$9.99' : '$14.99'}
          </div>
          <div style={{ color: 'var(--text-3)', fontSize: '13px', marginBottom: '20px' }}>
            {annual ? '/month · billed $119.88/year after your trial' : '/month after your trial'}
          </div>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              'Full financial statements',
              'Detailed valuation ratios',
              'Stock screener (8,000+ stocks)',
              'Compare up to 3 stocks',
              'Vote history & accuracy tracking',
            ].map(f => (
              <div key={f} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', color: 'var(--text-2)', fontSize: '14px', lineHeight: 1.5 }}>
                <span style={{ color: 'var(--accent)', flexShrink: 0, fontWeight: 700 }}>✓</span>{f}
              </div>
            ))}
          </div>
          <button
            onClick={() => checkout(annual ? ANNUAL_ID : MONTHLY_ID)}
            disabled={loading !== null}
            className="btn-primary"
            style={{ width: '100%', padding: '13px', borderRadius: '12px', fontSize: '15px' }}>
            {loading ? 'Loading...' : 'Start my free trial →'}
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: '20px', color: 'var(--text-3)', fontSize: '13px' }}>
          Secure payment via Stripe · Cancel anytime
        </div>
      </div>
    </div>
  );
}
