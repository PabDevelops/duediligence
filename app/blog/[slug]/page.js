'use client';
import { useRouter } from 'next/navigation';
import { use, useState, useEffect } from 'react';
import Topbar from '../../components/Topbar';
import TradingViewChart from '../../components/TradingViewChart';
import NewsletterForm from '../../components/NewsletterForm';
import { useUser } from '../../components/AuthProvider';

const CHART_PATTERN = /<p>\s*\[chart:([A-Za-z0-9.\-]+)\]\s*<\/p>/gi;

function renderHtmlContent(html) {
  const parts = html.split(CHART_PATTERN);
  // parts alternates: [html, ticker, html, ticker, ..., html]
  const nodes = [];
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      if (parts[i]) nodes.push(<div key={`h-${i}`} dangerouslySetInnerHTML={{ __html: parts[i] }} />);
    } else {
      nodes.push(<TradingViewChart key={`c-${i}`} ticker={parts[i].toUpperCase()} />);
    }
  }
  return nodes;
}

export default function BlogPost({ params }) {
  const { slug } = use(params);
  const router = useRouter();
  const { isSignedIn } = useUser();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`/api/blog/${slug}`).then(r => r.json()).then(d => setPost(d.post || null)).finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (!isSignedIn) return;
    fetch('/api/saved').then(r => r.json()).then(d => setSaved((d.posts || []).some(p => p.slug === slug)));
  }, [isSignedIn, slug]);

  const toggleSave = async () => {
    if (!isSignedIn) { router.push('/sign-in'); return; }
    await fetch('/api/saved', { method: saved ? 'DELETE' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug }) });
    setSaved(!saved);
  };

  if (loading) {
    return <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text-3)', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>;
  }

  if (!post) {
    return (
      <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', fontFamily: 'Inter, sans-serif' }}>
        <Topbar />
        <div style={{ maxWidth: '600px', margin: '0 auto', padding: '100px 24px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '12px' }}>Post not found</h1>
          <a href="/blog" className="btn-primary" style={{ display: 'inline-block', marginTop: '12px' }}>Back to blog →</a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', fontFamily: 'Inter, sans-serif' }}>
      <Topbar />
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '60px 24px 100px' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
          <button onClick={() => router.push('/blog')}
            style={{ background: 'none', border: 'none', color: 'var(--text-3)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif', padding: 0 }}>
            ← Back to blog
          </button>
          <button onClick={toggleSave}
            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '8px', color: saved ? 'var(--accent)' : 'var(--text-3)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif', padding: '6px 12px' }}>
            {saved ? 'Saved' : 'Save'}
          </button>
        </div>

        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: post.title,
          description: post.description,
          datePublished: post.date,
          author: { '@type': (!post.author || post.author === 'Traqcker Team') ? 'Organization' : 'Person', name: post.author || 'Traqcker Team' },
          publisher: { '@type': 'Organization', name: 'Traqcker', logo: { '@type': 'ImageObject', url: 'https://traqcker.com/favicon.png' } },
          mainEntityOfPage: { '@type': 'WebPage', '@id': `https://traqcker.com/blog/${post.slug}` },
        }) }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <span style={{ color: 'var(--accent)', fontSize: '10px', fontWeight: 700, letterSpacing: '1.5px', background: 'var(--accent-dim)', padding: '3px 10px', borderRadius: '20px' }}>{post.tag.toUpperCase()}</span>
          <span style={{ color: 'var(--text-3)', fontSize: '12px' }}>{post.read_time}</span>
          <span style={{ color: 'var(--text-3)', fontSize: '12px' }}>· {new Date(post.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
        </div>

        <h1 style={{ fontSize: '34px', fontWeight: 900, letterSpacing: '-1px', lineHeight: 1.15, marginBottom: '16px' }}>{post.title}</h1>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '32px' }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #0f766e, #2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800, color: '#fff', flexShrink: 0 }}>
            {(post.author || 'T').charAt(0).toUpperCase()}
          </div>
          <span style={{ color: 'var(--text-2)', fontSize: '13px', fontWeight: 700 }}>{post.author || 'Traqcker Team'}</span>
        </div>

        <div className="blog-post-body">
          {post.content_html
            ? renderHtmlContent(post.content_html)
            : (() => {
                const content = typeof post.content === 'string' ? JSON.parse(post.content) : post.content;
                return content.map((block, i) => {
                  if (block.type === 'h2') {
                    return <h2 key={i} style={{ fontSize: '21px', fontWeight: 800, marginTop: '36px', marginBottom: '14px', letterSpacing: '-0.3px' }}>{block.text}</h2>;
                  }
                  return <p key={i} style={{ color: 'var(--text-2)', fontSize: '16px', lineHeight: 1.9, marginBottom: '18px' }}>{block.text}</p>;
                });
              })()}
        </div>

        <style>{`
          .blog-post-body { color: var(--text-2); font-size: 16px; line-height: 1.9; }
          .blog-post-body h2 { font-size: 21px; font-weight: 800; margin: 36px 0 14px; color: var(--text); letter-spacing: -0.3px; }
          .blog-post-body h3 { font-size: 18px; font-weight: 800; margin: 28px 0 12px; color: var(--text); }
          .blog-post-body p { margin: 0 0 18px; }
          .blog-post-body ul, .blog-post-body ol { margin: 0 0 18px; padding-left: 24px; }
          .blog-post-body li { margin-bottom: 6px; }
          .blog-post-body blockquote { border-left: 3px solid var(--accent); margin: 0 0 18px; padding-left: 16px; color: var(--text-3); }
          .blog-post-body pre { background: var(--bg-1); border: 1px solid var(--border); border-radius: 10px; padding: 14px; overflow-x: auto; margin-bottom: 18px; }
          .blog-post-body img { max-width: 100%; border-radius: 14px; margin: 8px 0 18px; }
          .blog-post-body a { color: var(--accent); }
          .blog-post-body hr { border-color: var(--border); margin: 28px 0; }
        `}</style>

        <div className="glass" style={{ padding: '24px', marginTop: '40px', textAlign: 'center' }}>
          <div style={{ fontSize: '16px', fontWeight: 800, marginBottom: '6px' }}>Want to see the numbers, not just the theory?</div>
          <div style={{ color: 'var(--text-3)', fontSize: '14px', marginBottom: '16px' }}>Search thousands of global equities and get the quality score, fair value, and financial statements.</div>
          <a href="/pricing" className="btn-primary">Start Traqcker Pro Trial →</a>
        </div>

        <div style={{ marginTop: '20px' }}>
          <NewsletterForm source="blog-post" />
        </div>

      </div>
    </div>
  );
}
