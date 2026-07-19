import { getUserId } from '../../../lib/auth';
import { supabase } from '../../../lib/supabase';

export async function GET() {
  const userId = await getUserId();
  if (!userId) return Response.json({ portfolios: [] });

  const { data, error } = await supabase
    .from('portfolios')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('portfolios GET error:', error);
    return Response.json({ portfolios: [], error: error.message }, { status: 500 });
  }

  // If the user has no portfolios but is authenticated, we should probably auto-create a default one
  if (data.length === 0) {
    const { data: newPf, error: createErr } = await supabase
      .from('portfolios')
      .insert({ user_id: userId, name: 'Main' })
      .select()
      .single();

    if (!createErr && newPf) {
      return Response.json({ portfolios: [newPf] });
    }
  }

  return Response.json({ portfolios: data || [] });
}

export async function POST(request) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const { name } = await request.json();
  if (!name || !name.trim()) {
    return Response.json({ error: 'Name is required' }, { status: 400 });
  }

  // Check how many they have
  const { count } = await supabase
    .from('portfolios')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (count >= 3) {
    return Response.json({ error: 'Maximum of 3 portfolios allowed' }, { status: 403 });
  }

  const { data, error } = await supabase
    .from('portfolios')
    .insert({ user_id: userId, name: name.trim() })
    .select()
    .single();

  if (error) {
    console.error('portfolios POST error:', error);
    return Response.json({ error: error.message || 'Failed to create portfolio' }, { status: 500 });
  }

  return Response.json({ success: true, portfolio: data });
}

export async function DELETE(request) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const { id } = await request.json();
  if (!id) return Response.json({ error: 'Portfolio ID required' }, { status: 400 });

  // Prevent deleting the very last portfolio
  const { count } = await supabase
    .from('portfolios')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (count <= 1) {
    return Response.json({ error: 'Cannot delete your last portfolio' }, { status: 400 });
  }

  const { error } = await supabase
    .from('portfolios')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    console.error('portfolios DELETE error:', error);
    return Response.json({ error: error.message || 'Failed to delete portfolio' }, { status: 500 });
  }

  return Response.json({ success: true });
}
