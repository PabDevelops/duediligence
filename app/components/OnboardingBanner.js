'use client';
import { useState, useEffect } from 'react';

const TIPS = [
  { title: 'Search a stock',  desc: 'Look up any company to see its Quality Score and DCF valuation, computed from SEC filings.' },
  { title: 'Track it',        desc: 'Add tickers to your Watchlist, or log real trades in Portfolio to follow them over time.' },
  { title: 'No idea yet?',    desc: 'Radar ranks stocks by quality, valuation, and momentum — a place to start browsing.' },
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
