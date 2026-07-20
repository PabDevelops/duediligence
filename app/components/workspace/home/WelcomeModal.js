'use client';
import { useState, useEffect } from 'react';

const TIPS = [
  { title: 'Search a stock',  desc: 'Look up any company to see its Quality Score and DCF valuation, computed from SEC filings.' },
  { title: 'Track it',        desc: 'Add tickers to your Watchlist, or log real trades in Portfolio to follow them over time.' },
  { title: 'No idea yet?',    desc: 'Radar ranks stocks by quality, valuation, and momentum — a place to start browsing.' },
];

// Replaces the old OnboardingBanner (a dismissible bar pinned above the widget grid) now
// that visitors who've already been here before skip straight past the marketing landing
// into the terminal (see middleware.js's tq_gid-based redirect) — this popup is what gives
// them (and any first-time visitor) their one-time orientation instead.
export default function WelcomeModal() {
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
    <div
      onClick={dismiss}
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
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '480px',
          background: 'var(--ws-bg-1)',
          border: '1px solid var(--ws-border)',
          borderRadius: '12px',
          padding: '28px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
      >
        <button onClick={dismiss} style={{
          position: 'absolute', top: '14px', right: '14px',
          background: 'none', border: 'none', color: 'var(--ws-text-3)',
          cursor: 'pointer', fontSize: '16px', padding: '4px', lineHeight: 1,
        }}>
          ✕
        </button>

        <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--ws-text)', margin: '0 0 6px' }}>
          Welcome to the Terminal
        </h2>
        <p style={{ fontSize: '12px', color: 'var(--ws-text-3)', margin: '0 0 20px' }}>
          First time here? Here's how to get started.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
          {TIPS.map(t => (
            <div key={t.title}>
              <span style={{ fontSize: '13px', color: 'var(--ws-text-2)' }}>
                <span style={{ color: 'var(--ws-text)', fontWeight: 700 }}>{t.title}:</span> {t.desc}
              </span>
            </div>
          ))}
        </div>

        <button onClick={dismiss} style={{
          width: '100%',
          background: 'var(--ws-accent)',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          padding: '10px',
          fontSize: '13px',
          fontWeight: 700,
          cursor: 'pointer',
        }}>
          Get started
        </button>
      </div>
    </div>
  );
}
