'use client';
import { useState, useEffect } from 'react';
import Topbar from '../components/Topbar';
import { useRouter } from 'next/navigation';

export default function BlogIndex() {
  const router = useRouter();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/blog').then(r => r.json()).then(d => setPosts(d.posts || [])).finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', fontFamily: 'Nunito, sans-serif' }}>
      <Topbar />
      <div style={{ maxWidth: '820px', margin: '0 auto', padding: '60px 24px 100px' }}>

        <div style={{ marginBottom: '56px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'var(--accent-dim)', border: '1px solid var(--accent)', padding: '4px 14px', borderRadius: '20px', marginBottom: '20px' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
            <span style={{ color: 'var(--accent)', fontSize: '11px', letterSpacing: '2px', fontWeight: 700 }}>TRAQCKER BLOG</span>
          </div>
          <h1 style={{ fontSize: '42px', fontWeight: 900, letterSpacing: '-1.5px', lineHeight: 1.1, marginBottom: '16px' }}>
            Investing concepts,<br />
            <span className="gradient-text">explained simply.</span>
          </h1>
          <p style={{ color: 'var(--text-2)', fontSize: '16px', lineHeight: 1.8, maxWidth: '600px' }}>
            No jargon, no spreadsheets. Just the fundamentals you need to read a stock like an analyst.
          </p>
        </div>

        {loading ? (
          <div style={{ color: 'var(--text-3)', fontSize: '14px' }}>Loading...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {posts.map(post => (
              <div key={post.slug} className="glass" style={{ padding: '24px', cursor: 'pointer' }}
                onClick={() => router.push(`/blog/${post.slug}`)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                  <span style={{ color: 'var(--accent)', fontSize: '10px', fontWeight: 700, letterSpacing: '1.5px', background: 'var(--accent-dim)', padding: '3px 10px', borderRadius: '20px' }}>{post.tag.toUpperCase()}</span>
                  <span style={{ color: 'var(--text-3)', fontSize: '12px' }}>{post.read_time}</span>
                </div>
                <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '8px', letterSpacing: '-0.3px' }}>{post.title}</h2>
                <p style={{ color: 'var(--text-3)', fontSize: '14px', lineHeight: 1.7, marginBottom: '10px' }}>{post.description}</p>
                <div style={{ color: 'var(--text-3)', fontSize: '12px', fontWeight: 600 }}>By {post.author || 'Traqcker Team'}</div>
              </div>
            ))}
            {posts.length === 0 && <div style={{ color: 'var(--text-3)', fontSize: '14px' }}>No posts yet — check back soon.</div>}
          </div>
        )}

      </div>
    </div>
  );
}
