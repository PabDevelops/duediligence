const MONO = "'Inter', sans-serif";

export function WindowChrome({ title, children, maxWidth = '980px' }) {
  return (
    <div style={{
      background: 'var(--bg-1)',
      border: '1px solid var(--border)',
      borderRadius: '12px',
      boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
      maxWidth,
      margin: '0 auto',
      textAlign: 'left',
      overflow: 'hidden',
    }}>
      <div style={{
        background: 'var(--bg-2)',
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
