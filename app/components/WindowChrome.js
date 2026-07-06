const MONO = "'JetBrains Mono', monospace";

export function WindowChrome({ title, children, maxWidth = '980px' }) {
  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid var(--border)',
      borderRadius: '12px',
      boxShadow: '0 20px 50px rgba(0,0,0,0.06)',
      maxWidth,
      margin: '0 auto',
      textAlign: 'left',
      overflow: 'hidden',
    }}>
      <div style={{
        background: '#f1f3f5',
        padding: '10px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
      }}>
        <div style={{ display: 'flex', gap: '5px', flexShrink: 0 }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
        </div>
        <div style={{ fontFamily: MONO, fontSize: '10px', color: 'var(--text-3)', letterSpacing: '0.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {title}
        </div>
      </div>
      {children}
    </div>
  );
}

export function Shot({ src, alt }) {
  return <img src={src} alt={alt} style={{ display: 'block', width: '100%', height: 'auto' }} />;
}
