'use client';
import Link from 'next/link';
import { NEW_COLORS as C } from './theme';

// Cream/lime footer for the marketing pages — same link targets as the old dark Footer
// (app/components/marketing/Footer.js), restyled, Spanish labels. The destinations (/about,
// /faq, /privacy, /terms) stay on the old theme for now; only this component changed.
export default function NewMarketingFooter() {
  return (
    <footer style={{ borderTop: `1px solid ${C.border}`, background: C.surface, padding: '48px 24px 64px' }}>
      <div style={{ maxWidth: 'min(1200px, 92vw)', margin: '0 auto', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '40px' }}>
        <div style={{ maxWidth: '280px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <div aria-hidden="true" style={{ width: '26px', height: '26px', borderRadius: '8px', background: C.lime, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px', boxSizing: 'border-box' }}>
              <img src="/bulltrace-logos/bull-icon-black.png" alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            <span style={{ fontSize: '15px', fontWeight: 800, color: C.ink }}>Bulltrace</span>
          </div>
          <p style={{ fontSize: '12px', color: C.text3, lineHeight: 1.6, margin: 0 }}>
            Datos de empresas cotizadas directos de la fuente, y análisis pensado para inversores particulares.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 'clamp(32px, 8vw, 64px)', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '14px' }}>Producto</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '9px', fontSize: '13px' }}>
              <li><Link href="/pricing" style={{ textDecoration: 'none', color: C.text2 }}>Precios</Link></li>
              <li><Link href="/about" style={{ textDecoration: 'none', color: C.text2 }}>Qué incluye Pro</Link></li>
            </ul>
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '14px' }}>Empresa</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '9px', fontSize: '13px' }}>
              <li><Link href="/about" style={{ textDecoration: 'none', color: C.text2 }}>Sobre nosotros</Link></li>
              <li><Link href="/faq" style={{ textDecoration: 'none', color: C.text2 }}>Preguntas frecuentes</Link></li>
              <li><Link href="/privacy" style={{ textDecoration: 'none', color: C.text2 }}>Privacidad</Link></li>
              <li><Link href="/terms" style={{ textDecoration: 'none', color: C.text2 }}>Términos de uso</Link></li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
