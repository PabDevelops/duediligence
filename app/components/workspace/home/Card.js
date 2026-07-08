'use client';

// Reusable card wrapper with drag handles and modern shadows
export default function Card({ title, subtitle, rightElement, dragProps, children }) {
  return (
    <div
      {...dragProps}
      className="widget-card"
      style={{
        border: '1px solid var(--ws-border)',
        background: 'var(--ws-bg-1)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02), 0 1px 2px rgba(0,0,0,0.01)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        transition: 'box-shadow 0.15s ease, transform 0.2s ease, opacity 0.15s ease',
        ...dragProps?.style
      }}
    >
      <div className="widget-card-header" style={{
        padding: '14px 18px',
        borderBottom: '1px solid var(--ws-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(0, 0, 0, 0.01)',
        cursor: dragProps ? 'grab' : 'default'
      }}>
        <div className="flex items-center gap-2">
          {dragProps && (
            <span style={{ color: 'var(--ws-text-3)', fontSize: '13px', marginRight: '4px', userSelect: 'none' }}>
              ⋮⋮
            </span>
          )}
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ws-text)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              {title}
            </div>
            {subtitle && (
              <div className="text-[10px] text-ws-text-3 mt-0.5">
                {subtitle}
              </div>
            )}
          </div>
        </div>
        {rightElement}
      </div>
      <div className="widget-card-body" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  );
}
