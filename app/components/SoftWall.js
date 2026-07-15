'use client';

// Reusable "blur + reveal CTA" wrapper for a section of gated content.
// Generalizes the pattern that used to be hand-rolled around the Quality
// Score block in stock/[ticker]/page.js: blur the content, disable
// interaction with it, and show a call-to-action label on hover (or always,
// via `alwaysVisible`) that links out to sign-up/sign-in.
//
// When `active` is false, renders children unchanged with no wrapper cost.
export default function SoftWall({
  active,
  label,
  ctaHref = '/sign-up',
  onCtaClick,
  alwaysVisible = false,
  style,
  children,
}) {
  if (!active) return children;

  const overlayStyle = {
    position: 'absolute',
    inset: 0,
    zIndex: 2,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textDecoration: 'none',
    cursor: 'pointer',
    opacity: alwaysVisible ? 1 : 0,
    transition: 'opacity 0.2s',
  };

  const badge = (
    <div style={{
      background: 'var(--ws-bg-1)',
      border: '1px solid var(--ws-accent)',
      padding: '10px 20px',
      color: 'var(--ws-accent)',
      fontSize: '11px',
      fontWeight: 700,
      letterSpacing: '2px',
      textAlign: 'center',
    }}>
      {label}
    </div>
  );

  const overlayProps = {
    style: overlayStyle,
    onMouseEnter: e => { e.currentTarget.style.opacity = '1'; },
    onMouseLeave: e => { if (!alwaysVisible) e.currentTarget.style.opacity = '0'; },
  };

  return (
    <div style={{ position: 'relative', ...style }}>
      {onCtaClick
        ? <div onClick={onCtaClick} {...overlayProps}>{badge}</div>
        : <a href={ctaHref} {...overlayProps}>{badge}</a>}
      <div style={{ filter: 'blur(12px)', pointerEvents: 'none', userSelect: 'none', overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
}
