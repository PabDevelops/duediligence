import { getUserId } from '../../../lib/auth';
import { supabase } from '../../../lib/supabase';

const LIMITS = { anon: 1, free: 3 };

async function getDiscover(userId) {
  const today = new Date().toISOString().slice(0, 10);

  const { data } = await supabase
    .from('usage_tracking')
    .select('count')
    .eq('user_id', userId)
    .eq('date', today)
    .eq('type', 'discover')
    .single();

  return data?.count || 0;
}

async function incrementDiscover(userId) {
  const today = new Date().toISOString().slice(0, 10);

  const { data: existing } = await supabase
    .from('usage_tracking')
    .select('count')
    .eq('user_id', userId)
    .eq('date', today)
    .eq('type', 'discover')
    .single();

  if (existing) {
    await supabase
      .from('usage_tracking')
      .update({ count: existing.count + 1 })
      .eq('user_id', userId)
      .eq('date', today)
      .eq('type', 'discover');
  } else {
    await supabase
      .from('usage_tracking')
      .insert({ user_id: userId, date: today, count: 1, type: 'discover' });
  }
}

async function getRandomTicker() {
  const { data, error } = await supabase
    .from('stock_cache')
    .select('ticker')
    .limit(1000);

  if (error || !data?.length) return 'AAPL';
  return data[Math.floor(Math.random() * data.length)].ticker;
}

export async function GET(request) {
  try {
    const userId = await getUserId();
    const today = new Date().toISOString().slice(0, 10);

    // Pro: ilimitado
    if (userId) {
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('status')
        .eq('user_id', userId)
        .single();

      if (sub?.status === 'active' || sub?.status === 'trialing') {
        const ticker = await getRandomTicker();
        return Response.json({ ticker, remaining: 'unlimited' });
      }
    }

    // Determinar ID para tracking
    const trackId = userId || `ip_${request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'}`;
    const limit = userId ? LIMITS.free : LIMITS.anon;

    const used = await getDiscover(trackId);

    if (used >= limit) {
      return Response.json({
        error: 'limit_reached',
        remaining: 0,
        limit,
        isAnon: !userId,
      }, { status: 429 });
    }

    await incrementDiscover(trackId);
    const ticker = await getRandomTicker();

    return Response.json({
      ticker,
      remaining: limit - used - 1,
      limit,
    });
  } catch (e) {
    console.error('random error:', e);
    return Response.json({ ticker: 'AAPL', remaining: null });
  }
}
