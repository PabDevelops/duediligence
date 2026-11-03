'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { NEW_COLORS as C } from '../../components/new/theme';

export default function SuccessView() {
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => router.push('/home'), 5000);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <div style={{ width: '100%', minHeight: '100vh', boxSizing: 'border-box', background: C.bg, color: C.ink, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '440px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '40px 32px', textAlign: 'center', boxSizing: 'border-box' }}>
        <div style={{ fontSize: '48px', marginBottom: '18px' }}>🎉</div>
        <div style={{ fontSize: '11px', fontWeight: 700, color: C.text3, letterSpacing: '0.06em', marginBottom: '10px' }}>PAGO COMPLETADO</div>
        <h1 style={{ margin: '0 0 10px', fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em' }}>Bienvenido a Bulltrace Pro</h1>
        <p style={{ margin: '0 0 26px', fontSize: '13px', color: C.text2, lineHeight: 1.6 }}>
          Tu suscripción ya está activa. Tienes acceso completo a todas las funciones Pro.
        </p>
        <Link href="/home" style={{ display: 'inline-block', padding: '12px 24px', borderRadius: '12px', background: C.lime, color: C.ink, fontWeight: 700, fontSize: '14px', textDecoration: 'none' }}>
          Empezar a explorar →
        </Link>
        <div style={{ marginTop: '16px', fontSize: '12px', color: C.text3 }}>
          Te llevamos a inicio en 5 segundos…
        </div>
      </div>
    </div>
  );
}
