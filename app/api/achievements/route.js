import { createClient } from '@supabase/supabase-js';

const ACHIEVEMENTS = {
  first_vote:        { title: 'First Vote',        description: 'Cast your first community vote',          icon: '🗳️', rarity: 'common' },
  serial_voter:      { title: 'Serial Voter',       description: 'Vote 5 times on stocks',                 icon: '🔄', rarity: 'uncommon' },
  contrarian:        { title: 'Contrarian',          description: 'Vote opposite to community consensus',   icon: '⚡', rarity: 'uncommon' },
  stock_explorer:    { title: 'Explorer',            description: 'Search 20+ different stocks',            icon: '🔍', rarity: 'common' },
  watchlist_builder: { title: 'Watchlist Builder',  description: 'Add 5 stocks to your watchlist',         icon: '⭐', rarity: 'common' },
  pro_subscriber:    { title: 'Pro Member',          description: 'Upgraded to Traqcker Pro',                icon: '💎', rarity: 'uncommon' },
};

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
}

export async function GET(req) {
  try {
    const supabase = getSupabase();
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    if (!userId) return Response.json({ error: 'userId required' }, { status: 400 });

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
    const supabase = getSupabase();
    const { userId, achievementKey } = await req.json();

    if (!userId || !achievementKey) {
      return Response.json({ error: 'userId and achievementKey required' }, { status: 400 });
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
