'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import NewMarketingNav from '../../components/new/NewMarketingNav';
import { NEW_COLORS as C } from '../../components/new/theme';

const FEATURES = [
  'Todo lo del plan Gratis',
  'Seguimiento de cartera multi-divisa',
  'Cobertura completa de ETFs',
  'Descubrimiento diario sin límite',
];

export default function StartTrialView() {
  const router = useRouter();
  const [loading, setLoading] = useState(null);
  const [annual, setAnnual] = useState(true);
  const [isPro, setIsPro] = useState(false);

  useEffect(() => {
    fetch('/api/subscription').then(r => r.json()).then(d => setIsPro(d.isPro)).catch(() => {});
  }, []);

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
    <div style={{ width: '100%', minHeight: '100vh', boxSizing: 'border-box', background: C.bg, color: C.ink, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 'min(1200px, 92vw)', margin: '0 auto', padding: '32px 24px 0', boxSizing: 'border-box' }}>
        <NewMarketingNav active="precios" />
      </div>

      <div style={{ maxWidth: '460px', margin: '0 auto', padding: '40px 24px 96px', boxSizing: 'border-box' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: C.text3, letterSpacing: '0.06em', marginBottom: '10px' }}>EMPIEZA TU PRUEBA</div>
          <h1 style={{ margin: '0 0 10px', fontSize: '28px', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.15 }}>
            14 días de Pro, <span style={{ color: C.green }}>gratis</span>.
          </h1>
          <p style={{ margin: 0, fontSize: '13px', color: C.text2, lineHeight: 1.6 }}>
            Acceso completo a cartera, ETFs y descubrimiento ilimitado. Sin tarjeta para empezar.
          </p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '22px' }}>
          <div style={{ display: 'flex', gap: '4px', padding: '4px', borderRadius: '14px', background: C.surface, border: `1px solid ${C.border}` }}>
            <button type="button" onClick={() => setAnnual(false)} style={{
              padding: '9px 20px', borderRadius: '10px', fontFamily: 'inherit', fontSize: '13px', fontWeight: 700, cursor: 'pointer', border: 'none',
              background: !annual ? C.lime : 'transparent', color: C.ink,
            }}>
              Mensual
            </button>
            <button type="button" onClick={() => setAnnual(true)} style={{
              padding: '9px 20px', borderRadius: '10px', fontFamily: 'inherit', fontSize: '13px', fontWeight: 700, cursor: 'pointer', border: 'none',
              background: annual ? C.lime : 'transparent', color: C.ink,
            }}>
              Anual · ahorra 33%
            </button>
          </div>
        </div>

        <div style={{ background: '#F6FFDE', border: `1.5px solid ${C.lime}`, borderRadius: '20px', padding: '26px', boxSizing: 'border-box' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: C.text3, letterSpacing: '0.06em', marginBottom: '10px' }}>PLAN PRO</div>
          <div style={{ fontSize: '36px', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '4px' }}>
            {annual ? '9,99 €' : '14,99 €'}
          </div>
          <div style={{ color: C.text3, fontSize: '13px', marginBottom: '20px' }}>
            {annual ? '/mes · facturado 119,99 €/año tras la prueba' : '/mes'}
          </div>
          <div style={{ borderTop: `1px solid ${C.borderSoft}`, paddingTop: '18px', marginBottom: '22px', display: 'flex', flexDirection: 'column', gap: '11px' }}>
            {FEATURES.map(f => (
              <div key={f} style={{ display: 'flex', gap: '9px', alignItems: 'flex-start', color: C.text2, fontSize: '13px', lineHeight: 1.5 }}>
                <span style={{ color: C.ink, flexShrink: 0, fontWeight: 700 }}>✓</span>{f}
              </div>
            ))}
          </div>
          <button
            onClick={() => isPro ? router.push('/home') : checkout(annual ? ANNUAL_ID : MONTHLY_ID)}
            disabled={loading !== null}
            style={{
              width: '100%', padding: '13px', borderRadius: '12px', fontSize: '14px', fontWeight: 700, fontFamily: 'inherit',
              background: C.lime, color: C.ink, border: 'none', cursor: loading !== null ? 'default' : 'pointer', opacity: loading !== null ? 0.6 : 1,
            }}>
            {loading ? 'Cargando…' : isPro ? 'Ir a la app →' : 'Empezar mi prueba gratis →'}
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: '18px', color: C.text3, fontSize: '12px' }}>
          Pago seguro con Stripe · Cancela cuando quieras
        </div>
      </div>
    </div>
  );
}
