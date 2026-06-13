'use client';
import { useState, useEffect } from 'react';

export default function AchievementToast({ achievement, onClose }) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div style={{
      position: 'fixed',
      bottom: isMobile ? '16px' : '20px',
      right: isMobile ? '16px' : '20px',
      left: isMobile ? '16px' : 'auto',
      background: 'linear-gradient(135deg, var(--accent-dim), rgba(167, 139, 250, 0.05))',
      border: '2px solid var(--accent)',
      borderRadius: '16px',
      padding: isMobile ? '16px 16px' : '20px 24px',
      boxShadow: '0 10px 40px rgba(167, 139, 250, 0.3)',
      zIndex: 10000,
      maxWidth: isMobile ? 'calc(100% - 32px)' : '320px',
      animation: isMobile ? 'slideInMobile 0.4s ease-out' : 'slideInDesktop 0.4s ease-out',
      fontFamily: 'JetBrains Mono, monospace'
    }}>
      <style>{`
        @keyframes slideInDesktop {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes slideInMobile {
          from {
            transform: translateY(100px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ fontSize: isMobile ? '32px' : '40px', flexShrink: 0, animation: 'pulse 0.6s ease-in-out' }}>
          {achievement.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ 
            fontSize: isMobile ? '12px' : '14px', 
            fontWeight: 700, 
            color: 'var(--accent)', 
            marginBottom: '4px',
            letterSpacing: '0.5px'
          }}>
            🎉 UNLOCKED
          </div>
          <div style={{ 
            fontSize: isMobile ? '12px' : '13px', 
            fontWeight: 600, 
            color: 'var(--text)',
            marginBottom: '2px',
            wordBreak: 'break-word'
          }}>
            {achievement.title}
          </div>
          <div style={{ 
            fontSize: isMobile ? '10px' : '11px', 
            color: 'var(--text-3)',
            lineHeight: 1.4,
            wordBreak: 'break-word'
          }}>
            {achievement.description}
          </div>
        </div>
      </div>
    </div>
  );
}
