import { supabase } from '../../../lib/supabase';
import { getUserId } from '../../../lib/auth';

const ACHIEVEMENTS = {
  stock_explorer:    { title: 'Explorer',            description: 'Search 20+ different stocks',            icon: '🔍', rarity: 'common' },
  watchlist_builder: { title: 'Watchlist Builder',  description: 'Add 5 stocks to your watchlist',         icon: '⭐', rarity: 'common' },
  pro_subscriber:    { title: 'Pro Member',          description: 'Upgraded to Bulltrace Pro',                icon: '💎', rarity: 'uncommon' },
};

export async function GET(req) {
  try {
    // userId always comes from the session, never the query string — this route used to
    // trust a client-supplied userId against a service-role client, letting anyone read or
    // (in POST) write any other user's achievements. See the matching note on POST.
    const userId = await getUserId();
    if (!userId) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const { data, error } = await supabase
      .from('user_achievements')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const achievements = (data || []).map(row => ({
      id: row.id,
      achievement_key: row.achievement_type,
      unlocked_at: row.created_at,
      ...(ACHIEVEMENTS[row.achievement_type] || { title: row.achievement_type, description: '', icon: '🏆', rarity: 'common' }),
    }));

    return Response.json({ achievements });
  } catch (e) {
    console.error('GET achievements error:', e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const userId = await getUserId();
    if (!userId) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    // Only achievementKey comes from the body — userId is never trusted from the client (see
    // the note on GET), so a caller can only ever unlock achievements for their own session.
    const { achievementKey } = await req.json();
    if (!achievementKey) {
      return Response.json({ error: 'achievementKey required' }, { status: 400 });
    }

    const achievement = ACHIEVEMENTS[achievementKey];
    if (!achievement) return Response.json({ error: 'Invalid achievementKey' }, { status: 400 });

    // Check if already unlocked
    const { data: existing } = await supabase
      .from('user_achievements')
      .select('id')
      .eq('user_id', userId)
      .eq('achievement_type', achievementKey)
      .single();

    if (existing) return Response.json({ already_unlocked: true });

    const { data, error } = await supabase
      .from('user_achievements')
      .insert([{ user_id: userId, achievement_type: achievementKey }])
      .select()
      .single();

    if (error) throw error;

    return Response.json({ unlocked: true, achievement: { ...achievement, achievement_key: achievementKey, id: data.id } });
  } catch (e) {
    console.error('POST achievements error:', e);
    return Response.json({ error: e.message, unlocked: false }, { status: 500 });
  }
}
