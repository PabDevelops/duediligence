import { getUserId } from '../../../lib/auth';
import { supabase } from '../../../lib/supabase';

export async function GET() {
  const userId = await getUserId();
  if (!userId) return Response.json({ posts: [] });

  const { data: saved } = await supabase
    .from('saved_posts')
    .select('slug, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (!saved?.length) return Response.json({ posts: [] });

  const slugs = saved.map(s => s.slug);
  const { data: posts } = await supabase
    .from('blog_posts')
    .select('slug, title, description, date, read_time')
    .in('slug', slugs);

  const bySlug = Object.fromEntries((posts || []).map(p => [p.slug, p]));
  const ordered = saved.map(s => bySlug[s.slug]).filter(Boolean);

  return Response.json({ posts: ordered });
}

export async function POST(request) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const { slug } = await request.json();
  if (!slug) return Response.json({ error: 'slug required' }, { status: 400 });

  await supabase.from('saved_posts').upsert({ user_id: userId, slug }, { onConflict: 'user_id,slug' });
  return Response.json({ success: true });
}

export async function DELETE(request) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const { slug } = await request.json();
  if (!slug) return Response.json({ error: 'slug required' }, { status: 400 });

  await supabase.from('saved_posts').delete().eq('user_id', userId).eq('slug', slug);
  return Response.json({ success: true });
}
