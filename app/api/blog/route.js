import { supabase } from '../../../lib/supabase';
import { checkIsAdmin } from '../../../lib/isAdmin';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get('ticker')?.toUpperCase();

  let query = supabase.from('blog_posts').select('*').eq('published', true).order('date', { ascending: false });
  if (ticker) query = query.contains('tickers', [ticker]);

  const { data, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ posts: data || [] });
}

export async function POST(req) {
  const isAdmin = await checkIsAdmin();
  if (!isAdmin) return Response.json({ error: 'Not authorized' }, { status: 403 });

  const body = await req.json();
  const { slug, title, description, date, readTime, tag, tickers, sentiment, author, content, published } = body;

  if (!slug || !title || !content) {
    return Response.json({ error: 'slug, title and content are required' }, { status: 400 });
  }

  const { error } = await supabase.from('blog_posts').insert({
    slug,
    title,
    description: description || '',
    date: date || new Date().toISOString().slice(0, 10),
    read_time: readTime || '4 min read',
    tag: tag || 'Fundamentals',
    tickers: tickers || [],
    sentiment: sentiment || 'neutral',
    author: author || 'Traqcker Team',
    content,
    published: published !== false,
  });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}
