'use client';
import { useState, useEffect } from 'react';
import { useUser } from '../../components/AuthProvider';
import Topbar from '../../components/Topbar';

function fmt(n) {
  if (n == null) return '—';
  return Math.abs(n) >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n.toLocaleString();
}

export default function DataAnomaliesPage() {
  const { isLoaded, isSignedIn } = useUser();
  const [isAdmin, setIsAdmin] = useState(null);
  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoaded) return;
    fetch('/api/admin/check').then(r => r.json()).then(d => setIsAdmin(d.isAdmin)).catch(() => setIsAdmin(false));
  }, [isLoaded]);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  const load = async () => {
    setLoading(true);
    const res = await fetch('/api/admin/data-anomalies');
    const d = await res.json();
    setAnomalies(d.anomalies || []);
    setLoading(false);
  };

  const markReviewed = async (id) => {
    setAnomalies(prev => prev.filter(a => a.id !== id));
    await fetch('/api/admin/data-anomalies', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
  };

  if (!isLoaded || isAdmin === null) {
    return <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text-3)', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>;
  }

  if (!isSignedIn || !isAdmin) {
    return (
      <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', fontFamily: 'Inter, sans-serif' }}>
        <Topbar />
        <div style={{ maxWidth: '480px', margin: '0 auto', padding: '100px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: '20px', fontWeight: 800, marginBottom: '8px' }}>Not authorized</div>
          <div style={{ color: 'var(--text-3)', fontSize: '14px' }}>This page is restricted.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', fontFamily: 'Inter, sans-serif' }}>
      <Topbar />
      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '40px 24px 100px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h1 style={{ fontSize: '26px', fontWeight: 800 }}>Data anomalies</h1>
          <button onClick={load} className="btn-secondary" style={{ padding: '6px 14px', fontSize: '12px' }}>Refresh</button>
        </div>
        <div style={{ color: 'var(--text-3)', fontSize: '13px', marginBottom: '28px' }}>
          Tickers whose independently-sourced stats (Finnhub / Yahoo / SEC XBRL) disagree by more than 15% — a candidate for the same kind of per-ticker reconciliation fix as MNTN's marketCap. Not auto-fixed; review and patch app/api/stock/route.js as needed.
        </div>

        {loading ? (
          <div style={{ color: 'var(--text-3)', fontSize: '14px', textAlign: 'center', padding: '40px' }}>Loading...</div>
        ) : anomalies.length === 0 ? (
          <div style={{ color: 'var(--text-3)', fontSize: '14px', textAlign: 'center', padding: '40px' }}>No open anomalies. 🎉</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {anomalies.map(a => (
              <div key={a.id} className="glass" style={{ padding: '16px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>
                      <a href={`/stock/${a.ticker}`} target="_blank" rel="noreferrer" style={{ color: 'var(--text)' }}>{a.ticker}</a>
                      {' · '}{a.field}
                      {' · '}<span style={{ color: 'var(--red)' }}>{a.pct_diff}% diff</span>
                    </div>
                    <div style={{ color: 'var(--text-3)', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {(a.detail?.sources || []).map((s, i) => (
                        <div key={i}>{s.source}: {fmt(s.value)}</div>
                      ))}
                    </div>
                    <div style={{ color: 'var(--text-3)', fontSize: '11px', marginTop: '4px' }}>
                      first seen {new Date(a.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <button onClick={() => markReviewed(a.id)} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', flexShrink: 0 }}>Mark reviewed</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
