'use client';
import { useState, useEffect } from 'react';
import { useUser } from '../../components/AuthProvider';
import Topbar from '../../components/Topbar';
import RichEditor from './RichEditor';

function blocksToHtml(content) {
  return (content || []).map(b => b.type === 'h2' ? `<h2>${b.text}</h2>` : `<p>${b.text}</p>`).join('');
}

function slugify(title) {
  return title.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');
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

  useEffect(() => {
    if (isAdmin) loadPosts();
  }, [isAdmin]);

  const loadPosts = async () => {
    const res = await fetch('/api/admin/blog');
    const d = await res.json();
    setPosts(d.posts || []);
  };

  const startNew = () => {
    setEditing({ slug: '', title: '', description: '', date: new Date().toISOString().slice(0, 10), readTime: '4 min read', tag: 'Fundamentals', sentiment: 'neutral', author: 'Traqcker Team', published: true });
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
      readTime: editing.readTime, tag: editing.tag, tickers, sentiment: editing.sentiment || 'neutral', author: editing.author || 'Traqcker Team',
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
    if (!confirm(`Delete post "${slug}"?`)) return;
    await fetch(`/api/blog/${slug}`, { method: 'DELETE' });
    loadPosts();
  };

  if (!isLoaded || isAdmin === null) {
    return <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text-3)', fontFamily: 'Nunito, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>;
  }

  if (!isSignedIn || !isAdmin) {
    return (
      <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', fontFamily: 'Nunito, sans-serif' }}>
        <Topbar />
        <div style={{ maxWidth: '480px', margin: '0 auto', padding: '100px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: '20px', fontWeight: 800, marginBottom: '8px' }}>Not authorized</div>
          <div style={{ color: 'var(--text-3)', fontSize: '14px' }}>This page is restricted.</div>
        </div>
      </div>
    );
  }

  const inputStyle = { width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-1)', color: 'var(--text)', fontSize: '14px', fontFamily: 'Nunito, sans-serif' };
  const labelStyle = { fontSize: '11px', color: 'var(--text-3)', fontWeight: 700, letterSpacing: '1px', marginBottom: '6px', display: 'block' };

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', fontFamily: 'Nunito, sans-serif' }}>
      <Topbar />
      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '40px 24px 100px' }}>

        {!editing ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
              <h1 style={{ fontSize: '26px', fontWeight: 800 }}>Blog admin</h1>
              <button onClick={startNew} className="btn-primary">+ New post</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {posts.map(post => (
                <div key={post.slug} className="glass" style={{ padding: '16px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>
                      {post.title} {!post.published && <span style={{ color: 'var(--text-3)', fontSize: '11px' }}>(draft)</span>}
                    </div>
                    <div style={{ color: 'var(--text-3)', fontSize: '12px' }}>/{post.slug} · {post.tickers?.length > 0 ? post.tickers.join(', ') : 'no tickers linked'}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    <button onClick={() => startEdit(post)} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }}>Edit</button>
                    <button onClick={() => remove(post.slug)} style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '8px', border: '1px solid rgba(248,113,113,0.4)', background: 'transparent', color: 'var(--red)', cursor: 'pointer', fontFamily: 'Nunito, sans-serif' }}>Delete</button>
                  </div>
                </div>
              ))}
              {posts.length === 0 && <div style={{ color: 'var(--text-3)', fontSize: '14px', textAlign: 'center', padding: '40px' }}>No posts yet.</div>}
            </div>
          </>
        ) : (
          <>
            <button onClick={() => setEditing(null)} style={{ background: 'none', border: 'none', color: 'var(--text-3)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', marginBottom: '20px', fontFamily: 'Nunito, sans-serif', padding: 0 }}>← Back</button>

            <h1 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '24px' }}>{editing.slug ? 'Edit post' : 'New post'}</h1>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={labelStyle}>TITLE</label>
                <input style={inputStyle} value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} placeholder="What is ROIC and why it matters" />
              </div>

              <div>
                <label style={labelStyle}>SLUG (leave blank to auto-generate from title, only for new posts)</label>
                <input style={inputStyle} value={editing.slug} onChange={e => setEditing({ ...editing, slug: slugify(e.target.value) })} placeholder="what-is-roic" disabled={!!editing.created_at} />
              </div>

              <div>
                <label style={labelStyle}>DESCRIPTION (1-2 sentences, used in previews and SEO)</label>
                <textarea style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }} value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>DATE</label>
                  <input type="date" style={inputStyle} value={editing.date} onChange={e => setEditing({ ...editing, date: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>READ TIME</label>
                  <input style={inputStyle} value={editing.readTime} onChange={e => setEditing({ ...editing, readTime: e.target.value })} placeholder="4 min read" />
                </div>
                <div>
                  <label style={labelStyle}>TAG</label>
                  <input style={inputStyle} value={editing.tag} onChange={e => setEditing({ ...editing, tag: e.target.value })} placeholder="Fundamentals" />
                </div>
                <div>
                  <label style={labelStyle}>AUTHOR</label>
                  <input style={inputStyle} value={editing.author || ''} onChange={e => setEditing({ ...editing, author: e.target.value })} placeholder="Traqcker Team" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>LINKED TICKERS (comma-separated, optional — shows post on those stock pages)</label>
                  <input style={inputStyle} value={tickersInput} onChange={e => setTickersInput(e.target.value)} placeholder="AAPL, MSFT" />
                </div>
                <div>
                  <label style={labelStyle}>SENTIMENT (dot color on stock page)</label>
                  <select style={inputStyle} value={editing.sentiment || 'neutral'} onChange={e => setEditing({ ...editing, sentiment: e.target.value })}>
                    <option value="positive">🟢 Positive</option>
                    <option value="neutral">🟡 Neutral</option>
                    <option value="negative">🔴 Negative</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={labelStyle}>BODY</label>
                <RichEditor html={htmlBody} onChange={setHtmlBody} />
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-2)', cursor: 'pointer' }}>
                <input type="checkbox" checked={editing.published} onChange={e => setEditing({ ...editing, published: e.target.checked })} />
                Published (visible on the site)
              </label>

              {error && <div style={{ color: 'var(--red)', fontSize: '13px' }}>{error}</div>}

              <button onClick={save} disabled={saving || !editing.title} className="btn-primary" style={{ opacity: saving || !editing.title ? 0.5 : 1 }}>
                {saving ? 'Saving...' : 'Save post'}
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
