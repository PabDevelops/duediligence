'use client';
import { useState } from 'react';
import { useLocale } from '../../lib/i18n/useLocale';
import { getDictionary } from '../../lib/i18n/getDictionary';

export default function NewsletterForm({ source = 'landing', dict }) {
  const locale = useLocale();
  const t = dict || getDictionary(locale).newsletter;
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | done | error
  const [errorMsg, setErrorMsg] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (status === 'loading') return;
    setStatus('loading');
    setErrorMsg('');
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source }),
      });
      const d = await res.json();
      if (d.error) { setStatus('error'); setErrorMsg(d.error); return; }
      setStatus('done');
    } catch {
      setStatus('error');
      setErrorMsg(t.genericError);
    }
  };

  if (status === 'done') {
    return (
      <div className="glass" style={{ padding: '24px', textAlign: 'center' }}>
        <div style={{ fontSize: '20px', marginBottom: '6px' }}>✓</div>
        <div style={{ fontWeight: 800, fontSize: '15px' }}>{t.doneTitle}</div>
        <div style={{ color: 'var(--text-3)', fontSize: '13px', marginTop: '4px' }}>{t.doneSubtitle}</div>
      </div>
    );
  }

  return (
    <div className="glass" style={{ padding: '24px', textAlign: 'center' }}>
      <div style={{ fontWeight: 800, fontSize: '16px', marginBottom: '4px' }}>{t.title}</div>
      <div style={{ color: 'var(--text-3)', fontSize: '13px', marginBottom: '16px' }}>{t.subtitle}</div>
      <form onSubmit={submit} style={{ display: 'flex', gap: '8px', maxWidth: '380px', margin: '0 auto', flexWrap: 'wrap', justifyContent: 'center' }}>
        <input
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder={t.placeholder}
          style={{ flex: '1 1 200px', padding: '11px 14px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-1)', color: 'var(--text)', fontSize: '14px', fontFamily: 'Inter, sans-serif' }}
        />
        <button type="submit" disabled={status === 'loading'} className="btn-primary" style={{ opacity: status === 'loading' ? 0.6 : 1, flexShrink: 0 }}>
          {status === 'loading' ? t.joining : t.subscribe}
        </button>
      </form>
      {status === 'error' && <div style={{ color: 'var(--red)', fontSize: '12px', marginTop: '10px' }}>{errorMsg}</div>}
    </div>
  );
}
