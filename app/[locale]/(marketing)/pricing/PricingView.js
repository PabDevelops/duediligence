'use client';
import { useState } from 'react';
import { useUser } from '../../../components/AuthProvider';
import Topbar from '../../../components/Topbar';
import Footer from '../../../components/marketing/Footer';
import { localizeHref } from '../../../../lib/i18n/locale';

export default function PricingView({ dict, locale }) {
  const { isSignedIn } = useUser();
  const [loading, setLoading] = useState(null);
  const t = dict.pricing;
  const withLocale = (path) => localizeHref(path, locale);

  const checkout = async (priceId) => {
    if (!isSignedIn) { window.location.href = withLocale('/sign-in'); return; }
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

  const freePlan = {
    id: 'free',
    label: t.free.label,
    price: t.free.price,
    suffix: t.free.suffix,
    features: t.free.features,
    cta: t.free.cta,
    isFree: true,
  };

  const proPlans = [
    { id: MONTHLY_ID, label: t.monthly, price: '$14.99', suffix: t.priceSuffixMonthly, cta: t.ctaStart, features: t.proFeatures, highlight: false },
    { id: ANNUAL_ID, label: t.annual, price: '$9.99', suffix: t.priceSuffixAnnual, cta: `${t.ctaStart} ${t.ctaStartAnnual}`, features: t.proFeatures, highlight: true },
  ];

  const plans = [freePlan, ...proPlans];

  return (
    <div style={{ background: '#ffffff', minHeight: '100vh', color: 'var(--text)', fontFamily: 'Inter, sans-serif', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '80px', left: '20%', width: '600px', height: '400px', background: 'radial-gradient(ellipse, rgba(15,118,110,0.08) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
      <Topbar />

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '56px 20px 80px', position: 'relative', zIndex: 1 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <div style={{ color: 'var(--accent)', fontSize: '11px', letterSpacing: '2px', marginBottom: '12px', fontWeight: 700 }}>{t.eyebrow}</div>
          <h1 style={{ fontSize: '40px', fontWeight: 800, letterSpacing: '-1px', marginBottom: '12px', lineHeight: 1.1 }}>
            {t.titleLine1}<br /><span style={{ color: 'var(--accent)' }}>{t.titleLine2}</span>
          </h1>
          <p style={{ color: 'var(--text-2)', fontSize: '15px', lineHeight: 1.7, maxWidth: '520px', margin: '0 auto' }}>
            {t.subtitle}
          </p>
        </div>

        {/* Plans — free, monthly, and annual side by side */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', maxWidth: '980px', margin: '0 auto' }}>
          {plans.map(plan => (
            <div key={plan.id} style={{
              background: plan.highlight ? 'rgba(15,118,110,0.06)' : '#ffffff',
              border: plan.highlight ? '1.5px solid var(--accent)' : '1px solid var(--border)',
              padding: '28px',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
            }}>
              {plan.highlight && (
                <div style={{
                  position: 'absolute', top: '-13px', right: '20px',
                  background: 'var(--accent)', color: '#fff', fontSize: '11px', fontWeight: 800,
                  padding: '4px 14px', fontFamily: 'Inter, sans-serif',
                }}>
                  {t.badge}
                </div>
              )}
              <div style={{ color: 'var(--accent)', fontSize: '11px', letterSpacing: '2px', marginBottom: '8px', fontWeight: 700 }}>{plan.label.toUpperCase()}</div>
              <div style={{ fontSize: '40px', fontWeight: 900, marginBottom: '4px', letterSpacing: '-1px' }}>{plan.price}</div>
              <div style={{ color: 'var(--text-3)', fontSize: '13px', marginBottom: '24px' }}>{plan.suffix}</div>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                {plan.features.map(f => (
                  <div key={f} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', color: 'var(--text-2)', fontSize: '14px', lineHeight: 1.5 }}>
                    <span style={{ color: 'var(--accent)', flexShrink: 0, fontWeight: 700 }}>✓</span>{f}
                  </div>
                ))}
              </div>
              <button
                onClick={() => plan.isFree ? (window.location.href = withLocale('/sign-up')) : checkout(plan.id)}
                disabled={loading !== null}
                style={{
                  width: '100%',
                  padding: '13px',
                  fontSize: '15px',
                  fontWeight: 700,
                  fontFamily: 'Inter, sans-serif',
                  background: plan.highlight ? 'var(--accent)' : 'transparent',
                  color: plan.highlight ? '#fff' : 'var(--text)',
                  border: plan.highlight ? 'none' : '1px solid var(--text)',
                  borderRadius: 0,
                  cursor: 'pointer',
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = 0.9}
                onMouseLeave={e => e.currentTarget.style.opacity = 1}
              >
                {loading === plan.id ? t.ctaLoading : plan.cta}
              </button>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: '32px', color: 'var(--text-3)', fontSize: '13px' }}>
          {t.footNote}
        </div>
      </div>

      <Footer dict={dict.home.footer} locale={locale} />
    </div>
  );
}
