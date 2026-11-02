'use client';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import NewNav from '../../components/new/NewNav';
import { NEW_COLORS as C } from '../../components/new/theme';

const dateLabel = (d) => new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

export default function NewAprendePage() {
  const [posts, setPosts] = useState(null); // null = loading
  const [tag, setTag] = useState('Todo');

  useEffect(() => {
    let active = true;
    fetch('/api/blog').then(r => r.json()).then(d => {
      if (active) setPosts(d.posts || []);
    }).catch(() => { if (active) setPosts([]); });
    return () => { active = false; };
  }, []);

  const tags = useMemo(() => {
    if (!posts) return [];
    return ['Todo', ...new Set(posts.map(p => p.tag).filter(Boolean))];
  }, [posts]);

  const visible = useMemo(() => {
    if (!posts) return [];
    return tag === 'Todo' ? posts : posts.filter(p => p.tag === tag);
  }, [posts, tag]);

  return (
    <div style={{ width: '100%', minHeight: '100vh', boxSizing: 'border-box', background: C.bg, color: C.ink, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 'min(1200px, 92vw)', margin: '0 auto', padding: '32px 24px 96px', display: 'flex', flexDirection: 'column', gap: '24px', boxSizing: 'border-box' }}>

        <NewNav active="aprende" />

        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em' }}>Aprende</h1>
          <div style={{ fontSize: '13px', color: C.text2 }}>Lo justo para entender qué estás mirando antes de invertir.</div>
        </div>

        {tags.length > 2 && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {tags.map(t => (
              <button key={t} type="button" onClick={() => setTag(t)} style={{
                height: '34px', padding: '0 16px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
                border: tag === t ? 'none' : `1px solid ${C.border}`,
                background: tag === t ? C.ink : 'transparent',
                color: tag === t ? '#FFFFFF' : C.text2,
              }}>
                {t}
              </button>
            ))}
          </div>
        )}

        {posts === null ? (
          <div style={{ fontSize: '13px', color: C.text3 }}>Cargando…</div>
        ) : visible.length === 0 ? (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '28px', textAlign: 'center', fontSize: '13px', color: C.text2 }}>
            Todavía no hay artículos{tag !== 'Todo' ? ` en "${tag}"` : ''}.
          </div>
        ) : (
          <div className="new-card-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '16px' }}>
            {visible.map(post => (
              <Link key={post.slug} href={`/aprende/${post.slug}`} style={{
                textDecoration: 'none', color: 'inherit', background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: '16px', padding: '22px', display: 'flex', flexDirection: 'column', gap: '10px', boxSizing: 'border-box',
              }}>
                {post.tag && (
                  <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.04em', color: '#2E6B3A', background: '#E4F3DE', borderRadius: '20px', padding: '4px 10px', width: 'fit-content' }}>
                    {post.tag.toUpperCase()}
                  </span>
                )}
                <div style={{ fontSize: '15px', fontWeight: 800, lineHeight: 1.35 }}>{post.title}</div>
                <div style={{ fontSize: '12px', color: C.text2, lineHeight: 1.55, flex: 1 }}>{post.description}</div>
                <div style={{ fontSize: '11px', color: C.text3, marginTop: '4px' }}>
                  {post.read_time}{post.date ? ` · ${dateLabel(post.date)}` : ''}
                </div>
              </Link>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
