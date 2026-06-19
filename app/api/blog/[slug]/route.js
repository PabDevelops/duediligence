import { supabase } from '../../../../lib/supabase';
import { checkIsAdmin } from '../../../../lib/isAdmin';

export async function GET(req, { params }) {
  const { slug } = await params;
  const { data, error } = await supabase.from('blog_posts').select('*').eq('slug', slug).single();

  if (error || !data) return Response.json({ error: 'Post not found' }, { status: 404 });
  return Response.json({ post: data });
}

export async function PUT(req, { params }) {
  const isAdmin = await checkIsAdmin();
  if (!isAdmin) return Response.json({ error: 'Not authorized' }, { status: 403 });

  const { slug } = await params;
  const body = await req.json();
  const { title, description, date, readTime, tag, tickers, sentiment, author, content, published } = body;

  const { error } = await supabase.from('blog_posts').update({
    title, description, date, read_time: readTime, tag, tickers, sentiment, author, content, published,
  }).eq('slug', slug);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}

export async function DELETE(req, { params }) {
  const isAdmin = await checkIsAdmin();
  if (!isAdmin) return Response.json({ error: 'Not authorized' }, { status: 403 });

  const { slug } = await params;
  const { error } = await supabase.from('blog_posts').delete().eq('slug', slug);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}
