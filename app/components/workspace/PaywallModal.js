'use client';

// Popup over the (still-visible, dimmed) terminal shell — used both for the Pro-subscription
// gate ((workspace)/layout.js's PaywallGate) and for the daily free-view limit (stock/[ticker]
// page). Same visual language as WelcomeModal.js: dark blurred backdrop, centered card, click
// outside or the X to close.
export default function PaywallModal({ eyebrow, title, description, ctaLabel, ctaHref, onClose }) {
  const card = { padding: '12px 0', borderRadius: '10px', fontWeight: 700, fontSize: '14px', textDecoration: 'none', textAlign: 'center' };
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ position: 'relative', maxWidth: '420px', width: '100%', textAlign: 'center', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '16px', padding: '40px 32px', boxSizing: 'border-box', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
      >
        <button onClick={onClose} aria-label="Close" style={{
          position: 'absolute', top: '14px', right: '14px',
          background: 'none', border: 'none', color: '#9ca3af',
          cursor: 'pointer', fontSize: '18px', padding: '4px', lineHeight: 1,
        }}>
          ✕
        </button>

        <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1.5px', color: '#0f766e', marginBottom: '10px' }}>{eyebrow}</div>
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#1f2937', marginBottom: '10px' }}>{title}</h1>
        <p style={{ fontSize: '14px', color: '#4b5563', lineHeight: 1.6, marginBottom: '24px' }}>
          {description}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <a href={ctaHref} style={{ ...card, background: '#0f766e', color: '#fff' }}>{ctaLabel}</a>
          <button onClick={onClose} style={{ ...card, background: 'none', border: '1px solid #e5e7eb', color: '#4b5563', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>Maybe later</button>
        </div>
      </div>
    </div>
  );
}
