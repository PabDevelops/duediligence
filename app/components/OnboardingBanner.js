'use client';
import { useState, useEffect } from 'react';

const TIPS = [
  { icon: '🎯', title: 'Quality Score', desc: '0–100. Above 70 means a fundamentally strong business.' },
  { icon: '💰', title: 'Fair Value',    desc: 'Graham formula estimate. Green = potentially undervalued.' },
  { icon: '📊', title: 'Explore tabs', desc: 'Financials, Valuation, Quality scorecard — all from real filings.' },
];

export default function OnboardingBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('traqcker_onboarded')) setVisible(true);
  }, []);

  const dismiss = () => {
    localStorage.setItem('traqcker_onboarded', '1');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div style={{
      background: 'rgba(167,139,250,0.06)',
      borderBottom: '1px solid rgba(167,139,250,0.2)',
      padding: '12px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      flexWrap: 'wrap',
    }}>
      <span style={{ color: 'var(--accent)', fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
        👋 First time?
      </span>

      <div style={{ display: 'flex', gap: '20px', flex: 1, flexWrap: 'wrap' }}>
        {TIPS.map(t => (
          <div key={t.title} style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '180px' }}>
            <span style={{ fontSize: '14px' }}>{t.icon}</span>
            <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>
              <span style={{ color: 'var(--text-2)', fontWeight: 700 }}>{t.title}:</span> {t.desc}
            </span>
          </div>
        ))}
      </div>

      <button onClick={dismiss} style={{
        background: 'none', border: 'none', color: 'var(--text-3)',
        cursor: 'pointer', fontSize: '16px', padding: '0 4px', flexShrink: 0,
        lineHeight: 1,
      }}>
        ✕
      </button>
    </div>
  );
}
