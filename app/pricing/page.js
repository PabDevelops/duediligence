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

  const MONTHLY_ID = process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY || 'price_1TfcvtPqu5l8d1hxrUZUlT1E';
  const ANNUAL_ID = process.env.NEXT_PUBLIC_STRIPE_PRICE_ANNUAL || 'price_1TfcvtPqu5l8d1hxz5cmBDqO';

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', fontFamily: 'JetBrains Mono, monospace' }}>
      <Topbar />
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '60px 24px' }}>

        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <div style={{ color: 'var(--accent)', fontSize: '10px', letterSpacing: '3px', marginBottom: '12px' }}>PLANS & PRICING</div>
          <h1 style={{ fontSize: '36px', fontWeight: 600, letterSpacing: '-1px', marginBottom: '12px' }}>
            Serious analysis.<br /><span style={{ color: 'var(--accent)' }}>Serious tools.</span>
          </h1>
          <p style={{ color: 'var(--text-2)', fontSize: '13px', lineHeight: 1.7 }}>
            No ads. No opinions. Just data from SEC filings.
          </p>
        </div>

        {/* Toggle */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1px', background: 'var(--border)', marginBottom: '40px', maxWidth: '300px', margin: '0 auto 40px' }}>
          <button onClick={() => setAnnual(false)}
            style={{ flex: 1, padding: '8px 16px', background: !annual ? 'var(--accent)' : 'var(--bg-1)', color: !annual ? '#000' : 'var(--text-3)', border: 'none', fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', fontWeight: 700, cursor: 'pointer', letterSpacing: '1px' }}>
            MONTHLY
          </button>
          <button onClick={() => setAnnual(true)}
            style={{ flex: 1, padding: '8px 16px', background: annual ? 'var(--accent)' : 'var(--bg-1)', color: annual ? '#000' : 'var(--text-3)', border: 'none', fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', fontWeight: 700, cursor: 'pointer', letterSpacing: '1px' }}>
            ANNUAL · SAVE 17%
          </button>
        </div>

        {/* Plans */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'var(--border)' }}>

          {/* Free */}
          <div style={{ background: 'var(--bg-1)', padding: '32px' }}>
            <div style={{ color: 'var(--text-3)', fontSize: '10px', letterSpacing: '3px', marginBottom: '16px' }}>FREE</div>
            <div style={{ fontSize: '36px', fontWeight: 600, marginBottom: '4px' }}>$0</div>
            <div style={{ color: 'var(--text-3)', fontSize: '11px', marginBottom: '24px' }}>forever</div>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px', marginBottom: '24px' }}>
              {[
                '✓ Stock overview',
                '✓ Market data & sparklines',
          
              ].map(f => (
                <div key={f} style={{ color: f.startsWith('✓') ? 'var(--text-2)' : 'var(--text-3)', fontSize: '11px', marginBottom: '8px', letterSpacing: '0.5px' }}>{f}</div>
              ))}
            </div>
            <button disabled style={{ width: '100%', padding: '10px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-3)', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', letterSpacing: '1px', cursor: 'default' }}>
              FREE PLAN
            </button>
          </div>

          {/* Pro */}
          <div style={{ background: 'var(--bg-2)', padding: '32px', border: '1px solid var(--accent)' }}>
            <div style={{ color: 'var(--accent)', fontSize: '10px', letterSpacing: '3px', marginBottom: '16px' }}>PRO</div>
            <div style={{ fontSize: '36px', fontWeight: 600, marginBottom: '4px' }}>
              {annual ? '$9.99' : '$11.99'}
            </div>
            <div style={{ color: 'var(--text-3)', fontSize: '11px', marginBottom: '24px' }}>
              {annual ? '/month · billed $119.88/year' : '/month'}
            </div>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px', marginBottom: '24px' }}>
              {[
                '✓ Everything in Free',
                '✓ Financial statements',
                '✓ DCF valuation',
                '✓ Stock screener',
                '✓ Compare up to 3 stocks',
                '✓ PDF dossier (coming soon)',
                '✓ Priority support',
              ].map(f => (
                <div key={f} style={{ color: 'var(--text-2)', fontSize: '11px', marginBottom: '8px', letterSpacing: '0.5px' }}>{f}</div>
              ))}
            </div>
            <button
              onClick={() => checkout(annual ? ANNUAL_ID : MONTHLY_ID)}
              disabled={loading !== null}
              style={{ width: '100%', padding: '10px', background: 'var(--accent)', border: 'none', color: '#000', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', fontWeight: 700, letterSpacing: '1px', cursor: 'pointer' }}>
              {loading ? 'LOADING...' : `GET PRO ${annual ? '· SAVE 17%' : ''} →`}
            </button>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '24px', color: 'var(--text-3)', fontSize: '10px', letterSpacing: '1px' }}>
          SECURE PAYMENT VIA STRIPE · CANCEL ANYTIME · NO HIDDEN FEES
        </div>
      </div>
    </div>
  );
}