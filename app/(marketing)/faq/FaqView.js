'use client';
import NewMarketingNav from '../../components/new/NewMarketingNav';
import NewMarketingFooter from '../../components/new/NewMarketingFooter';
import { NEW_COLORS as C } from '../../components/new/theme';
import { FAQ_ITEMS as ITEMS } from './faqItems';

export default function FaqView() {
  return (
    <div style={{ width: '100%', minHeight: '100vh', boxSizing: 'border-box', background: C.bg, color: C.ink, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 'min(1200px, 92vw)', margin: '0 auto', padding: '32px 24px 0', boxSizing: 'border-box' }}>
        <NewMarketingNav active="faq" />
      </div>

      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '40px 24px 96px', boxSizing: 'border-box' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: C.text3, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>PREGUNTAS FRECUENTES</div>
        <h1 style={{ margin: '0 0 12px', fontSize: '30px', fontWeight: 800, letterSpacing: '-0.02em' }}>Respuestas directas</h1>
        <p style={{ margin: '0 0 40px', fontSize: '14px', color: C.text2, lineHeight: 1.6 }}>
          Respuestas cortas y directas sobre qué es Bulltrace, cómo funciona la nota de calidad y cuánto cuesta.
        </p>

        {ITEMS.map(item => (
          <div key={item.q} style={{ marginBottom: '24px', paddingBottom: '24px', borderBottom: `1px solid ${C.borderSoft}` }}>
            <h2 style={{ margin: '0 0 8px', fontSize: '15px', fontWeight: 800 }}>{item.q}</h2>
            <p style={{ margin: 0, color: C.text2, fontSize: '13.5px', lineHeight: 1.7 }}>{item.a}</p>
          </div>
        ))}
      </div>

      <NewMarketingFooter />
    </div>
  );
}
