'use client';
import { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import Topbar from '../components/Topbar';

export default function Pricing() {
  const { isSignedIn } = useUser();
  const [loading, setLoading] = useState(null);
  const [annual, setAnnual] = useState(false);

  const checkout = async (priceId) => {
    if (!isSignedIn) {
      window.location.href = '/sign-in';
      return;
    }
    setLoading(priceId);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (e) {
      console.error(e);
    }
    setLoading(null);
  };

  const MONTHLY_ID = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ? process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY : 'price_1TfSfrLMHeyYvnlV7VzKo3Hc';
  const ANNUAL_ID = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ? process.env.NEXT_PUBLIC_STRIPE_PRICE_ANNUAL : 'price_1TfSh7LMHeyYvnlVdmrYKhJj';

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', fontFamily: 'Inter, sans-serif' }}>
      <Topbar />
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '48px 20px' }}>

        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <div style={{ color: 'var(--accent)', fontSize: '11px', letterSpacing: '2px', marginBottom: '12px', fontFamily: 'JetBrains Mono, monospace' }}>PLANS & PRICING</div>
          <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '32px', fontWeight: 700, letterSpacing: '-0.5px', marginBottom: '12px' }}>
            Easy Mode is free.<br /><span style={{ color: 'var(--accent)' }}>Go Pro for more.</span>
          </h1>
          <p style={{ color: 'var(--text-2)', fontSize: '13px', lineHeight: 1.7 }}>
            Scores, fair value, and community votes are free for everyone — forever.
          </p>
        </div>

        {/* Toggle */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '32px', maxWidth: '320px', margin: '0 auto 32px' }}>
          <button onClick={() => setAnnual(false)}
            style={{ flex: 1, padding: '10px 16px', borderRadius: '12px', background: !annual ? 'var(--accent)' : 'var(--bg-1)', color: !annual ? '#0B0E14' : 'var(--text-2)', border: !annual ? 'none' : '1px solid var(--border)', fontFamily: 'Space Grotesk, sans-serif', fontSize: '12px', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.3px' }}>
            Monthly
          </button>
          <button onClick={() => setAnnual(true)}
            style={{ flex: 1, padding: '10px 16px', borderRadius: '12px', background: annual ? 'var(--accent)' : 'var(--bg-1)', color: annual ? '#0B0E14' : 'var(--text-2)', border: annual ? 'none' : '1px solid var(--border)', fontFamily: 'Space Grotesk, sans-serif', fontSize: '12px', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.3px' }}>
            Annual · Save 27%
          </button>
        </div>

        {/* Plans */}
        <div className="pricing-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>

          {/* Free */}
          <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: '20px', padding: '24px' }}>
            <div style={{ color: 'var(--text-3)', fontSize: '11px', letterSpacing: '2px', marginBottom: '12px', fontFamily: 'JetBrains Mono, monospace' }}>FREE</div>
            <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '32px', fontWeight: 700, marginBottom: '4px' }}>$0</div>
            <div style={{ color: 'var(--text-3)', fontSize: '12px', marginBottom: '20px' }}>forever</div>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '18px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                'Easy Mode score for any stock',
                'Fair value check',
                'Community Buy/Hold/Sell votes',
                'Stock of the Week',
                'Market data & charts',
              ].map(f => (
                <div key={f} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', color: 'var(--text-2)', fontSize: '12px', lineHeight: 1.5 }}>
                  <span style={{ color: 'var(--green)', flexShrink: 0 }}>✓</span>{f}
                </div>
              ))}
            </div>
            <button disabled style={{ width: '100%', padding: '12px', borderRadius: '12px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-3)', fontFamily: 'Space Grotesk, sans-serif', fontSize: '12px', fontWeight: 600, letterSpacing: '0.3px', cursor: 'default' }}>
              Your current plan
            </button>
          </div>

          {/* Pro */}
          <div style={{ background: 'var(--bg-2)', border: '1.5px solid var(--accent)', borderRadius: '20px', padding: '24px', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '-10px', right: '20px', background: 'var(--accent)', color: '#0B0E14', fontSize: '10px', fontWeight: 700, letterSpacing: '1px', padding: '4px 10px', borderRadius: '8px', fontFamily: 'Space Grotesk, sans-serif' }}>
              MOST POPULAR
            </div>
            <div style={{ color: 'var(--accent)', fontSize: '11px', letterSpacing: '2px', marginBottom: '12px', fontFamily: 'JetBrains Mono, monospace' }}>PRO</div>
            <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '32px', fontWeight: 700, marginBottom: '4px' }}>
              {annual ? '$2.92' : '$3.99'}
            </div>
            <div style={{ color: 'var(--text-3)', fontSize: '12px', marginBottom: '20px' }}>
              {annual ? '/month · billed $34.99/year' : '/month'}
            </div>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '18px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                'Everything in Free',
                'Full financial statements',
                'Detailed valuation ratios',
                'Stock screener (8,000+ stocks)',
                'Compare up to 3 stocks',
                'Vote history & accuracy tracking',
                'Advanced profile & stats',
              ].map(f => (
                <div key={f} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', color: 'var(--text-2)', fontSize: '12px', lineHeight: 1.5 }}>
                  <span style={{ color: 'var(--accent)', flexShrink: 0 }}>✓</span>{f}
                </div>
              ))}
            </div>
            <button
              onClick={() => checkout(annual ? ANNUAL_ID : MONTHLY_ID)}
              disabled={loading !== null}
              style={{ width: '100%', padding: '12px', borderRadius: '12px', background: 'var(--accent)', border: 'none', color: '#0B0E14', fontFamily: 'Space Grotesk, sans-serif', fontSize: '13px', fontWeight: 700, letterSpacing: '0.3px', cursor: 'pointer' }}>
              {loading ? 'Loading...' : `Go Pro ${annual ? '— Save 17%' : ''} →`}
            </button>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '24px', color: 'var(--text-3)', fontSize: '11px', letterSpacing: '0.5px' }}>
          Secure payment via Stripe · Cancel anytime · No hidden fees
        </div>
      </div>
    </div>
  );
}
