'use client';

export function PrimaryButton({ href: to, children, style, ...rest }) {
  return (
    <a href={to} style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '46px',
      padding: '0 24px',
      fontSize: '14px',
      fontWeight: 700,
      background: 'var(--accent)',
      color: '#ffffff',
      borderRadius: '10px',
      textDecoration: 'none',
      boxShadow: '0 4px 14px rgba(15, 118, 110, 0.25)',
      transition: 'opacity 0.15s',
      whiteSpace: 'nowrap',
      ...style,
    }}
      onMouseEnter={e => e.currentTarget.style.opacity = 0.92}
      onMouseLeave={e => e.currentTarget.style.opacity = 1}
      {...rest}
    >
      {children}
    </a>
  );
}

export function SecondaryButton({ href: to, children, style, ...rest }) {
  return (
    <a href={to} style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '46px',
      padding: '0 24px',
      fontSize: '14px',
      fontWeight: 600,
      background: 'transparent',
      color: 'var(--text)',
      border: '1px solid var(--border)',
      borderRadius: '10px',
      textDecoration: 'none',
      transition: 'background 0.15s, border-color 0.15s',
      whiteSpace: 'nowrap',
      ...style,
    }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-dim)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--border)'; }}
      {...rest}
    >
      {children}
    </a>
  );
}
