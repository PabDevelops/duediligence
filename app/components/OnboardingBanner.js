'use client';
import { useState, useEffect } from 'react';

const TIPS = [
  { title: 'Quality Score', desc: '0–100. Above 70 means a fundamentally strong business.' },
  { title: 'Fair Value',    desc: 'Graham formula estimate. Below price means potentially undervalued.' },
  { title: 'Explore tabs',  desc: 'Financials, Valuation, Quality scorecard — all from real filings.' },
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
      background: 'var(--ws-bg-1)',
      borderBottom: '1px solid var(--ws-border)',
      padding: '12px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      flexWrap: 'wrap',
    }}>
      <span style={{ color: 'var(--ws-text)', fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>
        First time here?
      </span>

      <div style={{ display: 'flex', gap: '20px', flex: 1, flexWrap: 'wrap' }}>
        {TIPS.map(t => (
          <div key={t.title} style={{ minWidth: '180px' }}>
            <span style={{ fontSize: '12px', color: 'var(--ws-text-3)' }}>
              <span style={{ color: 'var(--ws-text-2)', fontWeight: 600 }}>{t.title}:</span> {t.desc}
            </span>
          </div>
        ))}
      </div>

      <button onClick={dismiss} style={{
        background: 'none', border: 'none', color: 'var(--ws-text-3)',
        cursor: 'pointer', fontSize: '14px', padding: '0 4px', flexShrink: 0,
        lineHeight: 1,
      }}>
        ✕
      </button>
    </div>
  );
}
