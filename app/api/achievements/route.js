import { createClient } from '@supabase/supabase-js';
import { auth } from '@clerk/nextjs/server';

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

    if (!userId) {
      return Response.json({ error: 'userId required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('user_achievements')
      .select('*')
      .eq('user_id', userId)
      .order('unlocked_at', { ascending: false });

    if (error) throw error;

    return Response.json({ achievements: data || [] });
  } catch (e) {
    console.error('GET achievements error:', e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const supabase = getSupabase();
    const body = await req.json();
    const { userId, achievementKey } = body;

    if (!userId || !achievementKey) {
      return Response.json({ error: 'userId and achievementKey required' }, { status: 400 });
    }

    // Define all possible achievements
    const achievements = {
      'first_vote': {
        title: 'First Vote',
        desc: 'Cast your first vote on Stock of the Week',
        icon: '🗳️',
        rarity: 'common'
      },
      'serial_voter': {
        title: 'Serial Voter',
        desc: 'Vote 5 times on Stock of the Week',
        icon: '🔄',
        rarity: 'uncommon'
      },
      'contrarian': {
        title: 'Contrarian',
        desc: 'Vote opposite to the community consensus',
        icon: '⚡',
        rarity: 'uncommon'
      },
      'stock_explorer': {
        title: 'Explorer',
        desc: 'Search 20+ different stocks',
        icon: '🔍',
        rarity: 'common'
      },
      'watchlist_builder': {
        title: 'Watchlist Builder',
        desc: 'Add 5 stocks to your watchlist',
        icon: '⭐',
        rarity: 'common'
      }
    };

    const achievement = achievements[achievementKey];
    if (!achievement) {
      return Response.json({ error: 'Invalid achievementKey' }, { status: 400 });
    }

    // Check if already unlocked
    const { data: existing } = await supabase
      .from('user_achievements')
      .select('id')
      .eq('user_id', userId)
      .eq('achievement_key', achievementKey)
      .single();

    if (existing) {
      return Response.json({ already_unlocked: true });
    }

    // Insert achievement
    const { data, error } = await supabase
      .from('user_achievements')
      .insert([{
        user_id: userId,
        achievement_key: achievementKey,
        title: achievement.title,
        description: achievement.desc,
        icon: achievement.icon,
        rarity: achievement.rarity,
        unlocked_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;

    return Response.json({ unlocked: true, achievement: data });
  } catch (e) {
    console.error('POST achievements error:', e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
