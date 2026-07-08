'use client';
import { useState } from 'react';
import { useUser } from '../components/AuthProvider';
import Topbar from '../components/Topbar';

export default function Pricing() {
  const { isSignedIn } = useUser();
  const [loading, setLoading] = useState(null);
  const [annual, setAnnual] = useState(false);

  const checkout = async (priceId) => {
    if (!isSignedIn) { window.location.href = '/sign-in'; return; }
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
      <div style={{ position: 'absolute', top: '80px', left: '20%', width: '600px', height: '400px', background: 'radial-gradient(ellipse, rgba(15,118,110,0.1) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
      <Topbar />

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '56px 20px', position: 'relative', zIndex: 1 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ color: 'var(--accent)', fontSize: '11px', letterSpacing: '2px', marginBottom: '12px', fontWeight: 700 }}>PLANS & PRICING</div>
          <h1 style={{ fontSize: '40px', fontWeight: 800, letterSpacing: '-1px', marginBottom: '12px', lineHeight: 1.1 }}>
            Try Pro free for 14 days.<br /><span style={{ color: 'var(--accent)' }}>Cancel anytime.</span>
          </h1>
          <p style={{ color: 'var(--text-2)', fontSize: '15px', lineHeight: 1.7 }}>
            Full financials, screener, and compare tools — 14 days free, no card required to start.
          </p>
        </div>

        {/* Toggle */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '36px' }}>
          <div className="glass" style={{ display: 'flex', gap: '4px', padding: '4px', borderRadius: '14px' }}>
            <button onClick={() => setAnnual(false)}
              style={{ padding: '10px 24px', borderRadius: '10px', background: !annual ? 'linear-gradient(135deg, #0f766e, #2563eb)' : 'transparent', color: !annual ? '#fff' : 'var(--text-2)', border: 'none', fontFamily: 'Inter, sans-serif', fontSize: '14px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}>
              Monthly
            </button>
            <button onClick={() => setAnnual(true)}
              style={{ padding: '10px 24px', borderRadius: '10px', background: annual ? 'linear-gradient(135deg, #0f766e, #2563eb)' : 'transparent', color: annual ? '#fff' : 'var(--text-2)', border: 'none', fontFamily: 'Inter, sans-serif', fontSize: '14px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}>
              Annual · Save 33%
            </button>
          </div>
        </div>

        {/* Plan — single Pro subscription, no free tier */}
        <div style={{ maxWidth: '420px', margin: '0 auto' }}>
          <div style={{ background: 'rgba(15,118,110,0.06)', border: '1.5px solid rgba(15,118,110,0.4)', borderRadius: '20px', padding: '28px', position: 'relative', backdropFilter: 'blur(24px)' }}>
            <div style={{ position: 'absolute', top: '-12px', right: '20px', background: 'linear-gradient(135deg, #0f766e, #2563eb)', color: '#fff', fontSize: '11px', fontWeight: 800, padding: '4px 14px', borderRadius: '20px', fontFamily: 'Inter, sans-serif' }}>
              14-DAY FREE TRIAL
            </div>
            <div style={{ color: 'var(--accent)', fontSize: '11px', letterSpacing: '2px', marginBottom: '12px', fontWeight: 700 }}>TRAQCKER PRO</div>
            <div style={{ fontSize: '40px', fontWeight: 900, marginBottom: '4px', letterSpacing: '-1px' }}>
              {annual ? '$9.99' : '$14.99'}
            </div>
            <div style={{ color: 'var(--text-3)', fontSize: '13px', marginBottom: '24px' }}>
              {annual ? '/month · billed $119.88/year after trial' : '/month after trial'}
            </div>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                'Full terminal access — screener, radar, portfolio, calendar',
                'Full financial statements & detailed valuation ratios',
                'Stock screener (thousands of global equities)',
                'Compare up to 3 stocks',
                'Traq AI research assistant',
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
              {loading ? 'Loading...' : `Start free trial ${annual ? '— Save 33%' : ''} →`}
            </button>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '28px', color: 'var(--text-3)', fontSize: '13px' }}>
          Secure payment via Stripe · Cancel anytime · No hidden fees
        </div>
      </div>
    </div>
  );
}
