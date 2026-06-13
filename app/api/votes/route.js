import { supabase } from '../../../lib/supabase';
import { auth } from '@clerk/nextjs/server';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const ticker = searchParams.get('ticker')?.toUpperCase();
    const userId = searchParams.get('userId');

    // If userId provided, return vote count for that user
    if (userId) {
      const { data: userVotes, error } = await supabase
        .from('votes')
        .select('ticker')
        .eq('user_id', userId);

      if (error) throw error;

      return Response.json({ count: userVotes?.length || 0 });
    }

    // Otherwise, return vote percentages for a ticker
    if (!ticker) {
      return Response.json({ error: 'ticker or userId required' }, { status: 400 });
    }

    // Get vote counts for this ticker
    const { data: votes, error } = await supabase
      .from('votes')
      .select('vote')
      .eq('ticker', ticker);

    if (error) throw error;

    const counts = { BUY: 0, HOLD: 0, SELL: 0 };
    votes.forEach(v => counts[v.vote]++);
    const total = votes.length || 1;
    const percentages = {
      BUY: Math.round((counts.BUY / total) * 100),
      HOLD: Math.round((counts.HOLD / total) * 100),
      SELL: Math.round((counts.SELL / total) * 100),
    };

    // Get user's vote if signed in
    let userVote = null;
    try {
      const { userId } = await auth();
      if (userId) {
        const { data: userVotes } = await supabase
          .from('votes')
          .select('vote')
          .eq('ticker', ticker)
          .eq('user_id', userId)
          .single();
        if (userVotes) userVote = userVotes.vote;
      }
    } catch {}

    return Response.json({ percentages, userVote, total });
  } catch (error) {
    console.error('votes GET error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return Response.json({ error: 'Not signed in' }, { status: 401 });
    }

    const { ticker, vote } = await req.json();
    if (!ticker || !['BUY', 'HOLD', 'SELL'].includes(vote)) {
      return Response.json({ error: 'Invalid ticker or vote' }, { status: 400 });
    }

    // Upsert vote (insert or update)
    const { error } = await supabase
      .from('votes')
      .upsert([{ ticker: ticker.toUpperCase(), user_id: userId, vote }], {
        onConflict: 'ticker,user_id',
      });

    if (error) throw error;

    return Response.json({ success: true });
  } catch (error) {
    console.error('votes POST error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
