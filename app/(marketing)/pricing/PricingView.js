'use client';
import { useState } from 'react';
import { useUser } from '../../components/AuthProvider';
import NewMarketingNav from '../../components/new/NewMarketingNav';
import NewMarketingFooter from '../../components/new/NewMarketingFooter';
import { NEW_COLORS as C } from '../../components/new/theme';

export default function PricingView() {
  const { isSignedIn } = useUser();
  const [loading, setLoading] = useState(null);

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

  const plans = [
    {
      id: 'free', label: 'Gratis', price: '0€', suffix: 'sin tarjeta', isFree: true, cta: 'Crear cuenta gratis',
      features: [
        'Veredictos y proyección a 5 años en cada acción',
        'Nota de calidad en cada acción y ETF',
        'Lista de seguimiento (hasta 20 acciones)',
        'Explorador de acciones y ETFs sin límite',
      ],
    },
    {
      id: MONTHLY_ID, label: 'Mensual', price: '14,99 €', suffix: '/mes', cta: 'Hazte Pro',
      features: ['Todo lo de Gratis', 'Seguimiento de cartera multi-divisa', 'Lista de seguimiento sin límite', 'Descubrimiento diario sin límite'],
    },
    {
      id: ANNUAL_ID, label: 'Anual', price: '9,99 €', suffix: '/mes · 119,99 €/año', cta: 'Hazte Pro — ahorra 33%', highlight: true,
      features: ['Todo lo de Gratis', 'Seguimiento de cartera multi-divisa', 'Lista de seguimiento sin límite', 'Descubrimiento diario sin límite'],
    },
  ];

  return (
    <div style={{ width: '100%', minHeight: '100vh', boxSizing: 'border-box', background: C.bg, color: C.ink, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 'min(1200px, 92vw)', margin: '0 auto', padding: '32px 24px 0', display: 'flex', flexDirection: 'column', gap: '24px', boxSizing: 'border-box' }}>
        <NewMarketingNav active="precios" />
      </div>

      <div style={{ maxWidth: '980px', margin: '0 auto', padding: '40px 24px 96px', boxSizing: 'border-box' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <h1 style={{ margin: '0 0 12px', fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            Gratis para empezar.<br />Hazte Pro cuando lo necesites.
          </h1>
          <p style={{ margin: '0 auto', maxWidth: '520px', fontSize: '14px', color: C.text2, lineHeight: 1.6 }}>
            Crea una cuenta gratis para ver veredictos completos y explorar sin límite — sin tarjeta. Pasa a Pro para cartera, seguimiento sin límite y descubrimiento ilimitado.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '18px' }}>
          {plans.map(plan => (
            <div key={plan.id} style={{
              background: plan.highlight ? '#F6FFDE' : C.surface,
              border: plan.highlight ? `1.5px solid ${C.lime}` : `1px solid ${C.border}`,
              borderRadius: '20px', padding: '28px', position: 'relative', display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
            }}>
              {plan.highlight && (
                <div style={{ position: 'absolute', top: '-12px', right: '20px', background: C.lime, color: C.ink, fontSize: '10px', fontWeight: 800, letterSpacing: '0.04em', padding: '4px 12px', borderRadius: '20px' }}>
                  MÁS POPULAR
                </div>
              )}
              <div style={{ fontSize: '11px', fontWeight: 700, color: C.text3, letterSpacing: '0.06em', marginBottom: '8px', textTransform: 'uppercase' }}>{plan.label}</div>
              <div style={{ fontSize: '36px', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '4px' }}>{plan.price}</div>
              <div style={{ color: C.text3, fontSize: '13px', marginBottom: '22px' }}>{plan.suffix}</div>
              <div style={{ borderTop: `1px solid ${C.borderSoft}`, paddingTop: '18px', marginBottom: '22px', display: 'flex', flexDirection: 'column', gap: '11px', flex: 1 }}>
                {plan.features.map(f => (
                  <div key={f} style={{ display: 'flex', gap: '9px', alignItems: 'flex-start', color: C.text2, fontSize: '13px', lineHeight: 1.5 }}>
                    <span style={{ color: C.ink, flexShrink: 0, fontWeight: 700 }}>✓</span>{f}
                  </div>
                ))}
              </div>
              <button
                onClick={() => plan.isFree ? (window.location.href = '/home') : checkout(plan.id)}
                disabled={loading !== null}
                style={{
                  width: '100%', padding: '13px', borderRadius: '12px', fontSize: '14px', fontWeight: 700, fontFamily: 'inherit',
                  background: plan.highlight ? C.lime : plan.isFree ? 'transparent' : C.ink,
                  color: plan.highlight ? C.ink : plan.isFree ? C.ink : '#FFFFFF',
                  border: plan.isFree ? `1px solid ${C.ink}` : 'none',
                  cursor: loading !== null ? 'default' : 'pointer', opacity: loading !== null ? 0.6 : 1,
                }}>
                {loading === plan.id ? 'Cargando…' : plan.cta}
              </button>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: '28px', color: C.text3, fontSize: '12px' }}>
          Pago seguro con Stripe · Cancela cuando quieras · Sin cargos ocultos
        </div>
      </div>

      <NewMarketingFooter />
    </div>
  );
}
