'use client';
import { use, Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import NewNav from '../../../components/new/NewNav';
import StockChart from '../../../components/StockChart';
import { NEW_COLORS as C } from '../../../components/new/theme';

const dateLabel = (d) => new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

// StockChart reads its colors from --ws-* CSS custom properties — same wrapper used on
// /new/stock/[ticker] to drop the real chart into the cream/lime palette without forking it.
const CHART_THEME_VARS = {
  '--ws-bg-1': C.surface, '--ws-bg-2': C.bg, '--ws-accent': C.lime,
  '--ws-text-3': C.text3, '--ws-border': C.border, '--ws-red': C.red,
};

// Same `[chart:TICKER]` convention the existing /blog post body supports — an inline chart
// swapped in wherever the author drops that placeholder in the rich-text editor.
const CHART_PATTERN = /<p>\s*\[chart:([A-Za-z0-9.-]+)\]\s*<\/p>/gi;

function renderBody(post) {
  if (post.content_html) {
    const parts = post.content_html.split(CHART_PATTERN);
    const nodes = [];
    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 0) {
        if (parts[i]) nodes.push(<div key={`h-${i}`} dangerouslySetInnerHTML={{ __html: parts[i] }} />);
      } else {
        nodes.push(
          <div key={`c-${i}`} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '16px', overflow: 'hidden', margin: '8px 0 18px', ...CHART_THEME_VARS }}>
            <StockChart ticker={parts[i].toUpperCase()} height={260} />
          </div>
        );
      }
    }
    return nodes;
  }
  const content = typeof post.content === 'string' ? JSON.parse(post.content) : (post.content || []);
  return content.map((block, i) => block.type === 'h2'
    ? <h2 key={i} style={{ fontSize: '19px', fontWeight: 800, marginTop: '32px', marginBottom: '12px' }}>{block.text}</h2>
    : <p key={i} style={{ margin: '0 0 16px' }}>{block.text}</p>);
}

function Shell({ children }) {
  return (
    <div style={{ width: '100%', minHeight: '100vh', boxSizing: 'border-box', background: C.bg, color: C.ink, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 'min(880px, 92vw)', margin: '0 auto', padding: '32px 24px 96px', display: 'flex', flexDirection: 'column', gap: '24px', boxSizing: 'border-box' }}>
        <NewNav active="aprende" />
        {children}
      </div>
    </div>
  );
}

export default function NewAprendePostPage({ params }) {
  return (
    <Suspense fallback={null}>
      <NewAprendePostContent params={params} />
    </Suspense>
  );
}

function NewAprendePostContent({ params }) {
  const { slug } = use(params);
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/blog/${slug}`).then(r => r.json()).then(d => { if (active) { setPost(d.post || null); setLoading(false); } })
      .catch(() => { if (active) { setPost(null); setLoading(false); } });
    return () => { active = false; };
  }, [slug]);

  if (loading) {
    return <Shell><div style={{ fontSize: '13px', color: C.text3 }}>Cargando…</div></Shell>;
  }
  if (!post) {
    return (
      <Shell>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '28px', textAlign: 'center', fontSize: '13px', color: C.text2 }}>
          No encontramos este artículo.
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <Link href="/new/aprende" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: C.text2, textDecoration: 'none', width: 'fit-content' }}>
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
        Volver a Aprende
      </Link>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
          {post.tag && (
            <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.04em', color: '#2E6B3A', background: '#E4F3DE', borderRadius: '20px', padding: '4px 10px' }}>
              {post.tag.toUpperCase()}
            </span>
          )}
          <span style={{ fontSize: '12px', color: C.text2 }}>{post.read_time}</span>
          {post.date && <span style={{ fontSize: '12px', color: C.text2 }}>· {dateLabel(post.date)}</span>}
        </div>

        <h1 style={{ margin: '0 0 16px', fontSize: '28px', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.2 }}>{post.title}</h1>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div aria-hidden="true" style={{ width: '28px', height: '28px', borderRadius: '50%', background: C.lime, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800, color: C.ink, flexShrink: 0 }}>
            {(post.author || 'B').charAt(0).toUpperCase()}
          </div>
          <span style={{ fontSize: '13px', fontWeight: 700, color: C.text2 }}>{post.author || 'Bulltrace'}</span>
        </div>
      </div>

      {post.tickers?.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {post.tickers.map(t => (
            <Link key={t} href={`/new/stock/${t}`} style={{
              fontSize: '12px', fontWeight: 700, color: C.ink, textDecoration: 'none',
              background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '6px 14px',
            }}>
              {t}
            </Link>
          ))}
        </div>
      )}

      <div className="new-aprende-body">{renderBody(post)}</div>

      <style>{`
        .new-aprende-body { color: #45413A; font-size: 15px; line-height: 1.8; }
        .new-aprende-body h2 { font-size: 19px; font-weight: 800; margin: 32px 0 12px; color: ${C.ink}; }
        .new-aprende-body h3 { font-size: 16px; font-weight: 800; margin: 24px 0 10px; color: ${C.ink}; }
        .new-aprende-body p { margin: 0 0 16px; }
        .new-aprende-body ul, .new-aprende-body ol { margin: 0 0 16px; padding-left: 22px; }
        .new-aprende-body li { margin-bottom: 6px; }
        .new-aprende-body blockquote { border-left: 3px solid ${C.lime}; margin: 0 0 16px; padding-left: 14px; color: ${C.text2}; }
        .new-aprende-body img { max-width: 100%; border-radius: 14px; margin: 8px 0 16px; }
        .new-aprende-body a { color: ${C.ink}; text-decoration: underline; }
      `}</style>
    </Shell>
  );
}
