'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useUser } from '../../components/AuthProvider';
import { NEW_COLORS as C } from '../../components/new/theme';
import RichEditor from './RichEditor';

function blocksToHtml(content) {
  return (content || []).map(b => b.type === 'h2' ? `<h2>${b.text}</h2>` : `<p>${b.text}</p>`).join('');
}

function slugify(title) {
  return title.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');
}

const inputStyle = {
  padding: '11px 14px', borderRadius: '10px', border: `1px solid ${C.border}`, background: '#FDFBF6',
  color: C.ink, fontFamily: 'inherit', fontSize: '14px', outline: 'none', boxSizing: 'border-box', width: '100%',
};
const labelStyle = { fontSize: '11px', color: C.text3, fontWeight: 700, letterSpacing: '0.04em', marginBottom: '6px', display: 'block' };

function Shell({ children }) {
  return (
    <div style={{ width: '100%', minHeight: '100vh', boxSizing: 'border-box', background: C.bg, color: C.ink, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <div style={{ maxWidth: '820px', margin: '0 auto', padding: '32px 24px 96px', display: 'flex', flexDirection: 'column', gap: '24px', boxSizing: 'border-box' }}>
        <Link href="/aprende" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: C.text2, textDecoration: 'none', width: 'fit-content' }}>
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
          Volver a Aprende
        </Link>
        {children}
      </div>
    </div>
  );
}

export default function AdminBlogPage() {
  const { isLoaded, isSignedIn } = useUser();
  const [isAdmin, setIsAdmin] = useState(null);
  const [posts, setPosts] = useState([]);
  const [editing, setEditing] = useState(null); // null = list, {} = new, post = edit
  const [htmlBody, setHtmlBody] = useState('');
  const [tickersInput, setTickersInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isLoaded) return;
    fetch('/api/admin/check').then(r => r.json()).then(d => setIsAdmin(d.isAdmin)).catch(() => setIsAdmin(false));
  }, [isLoaded]);

  const loadPosts = async () => {
    const res = await fetch('/api/admin/blog');
    const d = await res.json();
    setPosts(d.posts || []);
  };

  useEffect(() => {
    if (isAdmin) loadPosts();
  }, [isAdmin]);

  const startNew = () => {
    setEditing({ slug: '', title: '', description: '', date: new Date().toISOString().slice(0, 10), readTime: '4 min read', tag: 'Fundamentals', sentiment: 'neutral', author: 'Bulltrace Team', published: true });
    setHtmlBody('');
    setTickersInput('');
    setError('');
  };

  const startEdit = (post) => {
    setEditing({ ...post, readTime: post.read_time });
    setHtmlBody(post.content_html || blocksToHtml(post.content));
    setTickersInput((post.tickers || []).join(', '));
    setError('');
  };

  const save = async () => {
    setSaving(true);
    setError('');
    const tickers = tickersInput.split(',').map(t => t.trim().toUpperCase()).filter(Boolean);
    const isNew = !posts.some(p => p.slug === editing.slug);
    const slug = editing.slug || slugify(editing.title);

    const payload = {
      slug, title: editing.title, description: editing.description, date: editing.date,
      readTime: editing.readTime, tag: editing.tag, tickers, sentiment: editing.sentiment || 'neutral', author: editing.author || 'Bulltrace Team',
      content: [], contentHtml: htmlBody, published: editing.published,
    };

    const res = await fetch(isNew ? '/api/blog' : `/api/blog/${slug}`, {
      method: isNew ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const d = await res.json();
    setSaving(false);
    if (d.error) { setError(d.error); return; }
    setEditing(null);
    loadPosts();
  };

  const remove = async (slug) => {
    if (!confirm(`¿Eliminar el artículo "${slug}"?`)) return;
    await fetch(`/api/blog/${slug}`, { method: 'DELETE' });
    loadPosts();
  };

  if (!isLoaded || isAdmin === null) {
    return <Shell><div style={{ fontSize: '13px', color: C.text3 }}>Cargando…</div></Shell>;
  }

  if (!isSignedIn || !isAdmin) {
    return (
      <Shell>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '28px', textAlign: 'center' }}>
          <div style={{ fontSize: '17px', fontWeight: 800, marginBottom: '6px' }}>No autorizado</div>
          <div style={{ color: C.text2, fontSize: '13px' }}>Esta página está restringida al equipo de Bulltrace.</div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      {!editing ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em' }}>Blog · Admin</h1>
            <button onClick={startNew} style={{ height: '42px', padding: '0 20px', borderRadius: '12px', border: 'none', background: C.lime, color: C.ink, fontWeight: 700, fontSize: '14px', fontFamily: 'inherit', cursor: 'pointer' }}>
              + Nuevo artículo
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {posts.map(post => (
              <div key={post.slug} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '16px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', boxSizing: 'border-box' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {post.title} {!post.published && <span style={{ color: C.text3, fontSize: '11px', fontWeight: 600 }}>(borrador)</span>}
                  </div>
                  <div style={{ color: C.text2, fontSize: '12px' }}>/{post.slug} · {post.tickers?.length > 0 ? post.tickers.join(', ') : 'sin tickers vinculados'}</div>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  <button onClick={() => startEdit(post)} style={{ padding: '8px 14px', fontSize: '12px', fontWeight: 700, borderRadius: '10px', border: `1px solid ${C.border}`, background: 'transparent', color: C.ink, cursor: 'pointer', fontFamily: 'inherit' }}>Editar</button>
                  <button onClick={() => remove(post.slug)} style={{ padding: '8px 14px', fontSize: '12px', fontWeight: 700, borderRadius: '10px', border: `1px solid ${C.red}55`, background: 'transparent', color: C.red, cursor: 'pointer', fontFamily: 'inherit' }}>Eliminar</button>
                </div>
              </div>
            ))}
            {posts.length === 0 && (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '16px', padding: '40px', textAlign: 'center', color: C.text2, fontSize: '13px' }}>
                Todavía no hay artículos.
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <button onClick={() => setEditing(null)} style={{ background: 'none', border: 'none', color: C.text2, fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', padding: 0, width: 'fit-content', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
            Volver
          </button>

          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, letterSpacing: '-0.02em' }}>{editing.slug ? 'Editar artículo' : 'Nuevo artículo'}</h1>

          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '26px', display: 'flex', flexDirection: 'column', gap: '18px', boxSizing: 'border-box' }}>
            <div>
              <label style={labelStyle}>TÍTULO</label>
              <input style={inputStyle} value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} placeholder="Qué es el ROIC y por qué importa" />
            </div>

            <div>
              <label style={labelStyle}>SLUG (déjalo en blanco para generarlo del título — solo en artículos nuevos)</label>
              <input style={inputStyle} value={editing.slug} onChange={e => setEditing({ ...editing, slug: slugify(e.target.value) })} placeholder="que-es-el-roic" disabled={!!editing.created_at} />
            </div>

            <div>
              <label style={labelStyle}>DESCRIPCIÓN (1-2 frases, se usa en las vistas previas y el SEO)</label>
              <textarea style={{ ...inputStyle, minHeight: '70px', resize: 'vertical' }} value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} />
            </div>

            <div className="new-dash-2col" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px' }}>
              <div>
                <label style={labelStyle}>FECHA</label>
                <input type="date" style={inputStyle} value={editing.date} onChange={e => setEditing({ ...editing, date: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>TIEMPO DE LECTURA</label>
                <input style={inputStyle} value={editing.readTime} onChange={e => setEditing({ ...editing, readTime: e.target.value })} placeholder="4 min" />
              </div>
              <div>
                <label style={labelStyle}>ETIQUETA</label>
                <input style={inputStyle} value={editing.tag} onChange={e => setEditing({ ...editing, tag: e.target.value })} placeholder="Fundamentals" />
              </div>
              <div>
                <label style={labelStyle}>AUTOR</label>
                <input style={inputStyle} value={editing.author || ''} onChange={e => setEditing({ ...editing, author: e.target.value })} placeholder="Bulltrace Team" />
              </div>
            </div>

            <div className="new-dash-2col" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>TICKERS VINCULADOS (separados por comas, opcional — muestra el artículo en esas fichas)</label>
                <input style={inputStyle} value={tickersInput} onChange={e => setTickersInput(e.target.value)} placeholder="AAPL, MSFT" />
              </div>
              <div>
                <label style={labelStyle}>TONO (color del punto en la ficha)</label>
                <select style={inputStyle} value={editing.sentiment || 'neutral'} onChange={e => setEditing({ ...editing, sentiment: e.target.value })}>
                  <option value="positive">🟢 Positivo</option>
                  <option value="neutral">🟡 Neutro</option>
                  <option value="negative">🔴 Negativo</option>
                </select>
              </div>
            </div>

            <div>
              <label style={labelStyle}>CONTENIDO</label>
              <RichEditor html={htmlBody} onChange={setHtmlBody} />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: C.text2, cursor: 'pointer', fontWeight: 600 }}>
              <input type="checkbox" checked={editing.published} onChange={e => setEditing({ ...editing, published: e.target.checked })} />
              Publicado (visible en la web)
            </label>

            {error && <div style={{ color: C.red, fontSize: '13px', background: '#F8DFDA', borderRadius: '10px', padding: '10px 12px' }}>{error}</div>}

            <button onClick={save} disabled={saving || !editing.title} style={{
              height: '46px', padding: '0 24px', borderRadius: '12px', border: 'none', background: C.lime, color: C.ink,
              fontWeight: 700, fontSize: '14px', fontFamily: 'inherit', cursor: saving || !editing.title ? 'not-allowed' : 'pointer',
              opacity: saving || !editing.title ? 0.5 : 1,
            }}>
              {saving ? 'Guardando…' : 'Guardar artículo'}
            </button>
          </div>
        </>
      )}
    </Shell>
  );
}
