import { supabase } from '../../../lib/supabase';
import { getUserId } from '../../../lib/auth';
import { fetchYahooRecommendationTrend } from '../../../lib/yahooFinance';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const ticker = searchParams.get('ticker')?.toUpperCase();

    const userId = await getUserId();

    // If no ticker, return all votes for the authenticated user (for profile page)
    if (!ticker) {
      if (!userId) return Response.json({ error: 'Not authenticated' }, { status: 401 });

      const { data: userVotes, error } = await supabase
        .from('votes')
        .select('ticker, vote, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return Response.json({ votes: userVotes || [], count: userVotes?.length || 0 });
    }

    // Return vote percentages for a ticker
    const { data: votes, error } = await supabase
      .from('votes')
      .select('vote')
      .eq('ticker', ticker);

    if (error) throw error;

    let userVote = null;
    if (userId) {
      const { data: userVotes } = await supabase
        .from('votes')
        .select('vote')
        .eq('ticker', ticker)
        .eq('user_id', userId)
        .single();
      if (userVotes) userVote = userVotes.vote;
    }

    const userTotal = votes.length;
    const COMMUNITY_THRESHOLD = 5;

    // Enough community votes — use them
    if (userTotal >= COMMUNITY_THRESHOLD) {
      const counts = { BUY: 0, HOLD: 0, SELL: 0 };
      votes.forEach(v => counts[v.vote]++);
      const total = userTotal;
      const percentages = {
        BUY: Math.round((counts.BUY / total) * 100),
        HOLD: Math.round((counts.HOLD / total) * 100),
        SELL: Math.round((counts.SELL / total) * 100),
      };
      return Response.json({ percentages, userVote, total, source: 'community' });
    }

    // Few votes — seed with analyst recommendations. Finnhub's free plan only covers
    // US-listed tickers, so international ones (LLOY.L, SAP.DE, ...) fall back to Yahoo's
    // recommendation trend, which reports the same strongBuy/buy/hold/sell/strongSell shape.
    let rec = null;
    try {
      const fhRes = await fetch(
        `https://finnhub.io/api/v1/stock/recommendation?symbol=${ticker}&token=${process.env.FINNHUB_API_KEY}`,
        { next: { revalidate: 3600 } }
      );
      const fhData = await fhRes.json();
      rec = Array.isArray(fhData) && fhData[0] ? fhData[0] : null;
    } catch { /* try Yahoo below */ }

    if (!rec) {
      rec = await fetchYahooRecommendationTrend(ticker);
    }

    if (rec) {
      const buy  = (rec.strongBuy || 0) + (rec.buy || 0);
      const hold = rec.hold || 0;
      const sell = (rec.sell || 0) + (rec.strongSell || 0);
      const total = buy + hold + sell;
      if (total > 0) {
        const percentages = {
          BUY:  Math.round((buy  / total) * 100),
          HOLD: Math.round((hold / total) * 100),
          SELL: Math.round((sell / total) * 100),
        };
        return Response.json({ percentages, userVote, total, source: 'analysts' });
      }
    }

    // No analyst coverage — fall back to whatever real community votes exist, even
    // below the "trust community over analysts" threshold, rather than hiding them.
    if (userTotal > 0) {
      const counts = { BUY: 0, HOLD: 0, SELL: 0 };
      votes.forEach(v => counts[v.vote]++);
      const percentages = {
        BUY: Math.round((counts.BUY / userTotal) * 100),
        HOLD: Math.round((counts.HOLD / userTotal) * 100),
        SELL: Math.round((counts.SELL / userTotal) * 100),
      };
      return Response.json({ percentages, userVote, total: userTotal, source: 'community' });
    }

    // No community votes, no analyst data either — nothing to show a split for.
    return Response.json({ percentages: { BUY: 0, HOLD: 0, SELL: 0 }, userVote, total: 0, source: 'none' });
  } catch (error) {
    console.error('votes GET error:', error);
    return Response.json({ error: 'Error fetching votes' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return Response.json({ error: 'Not signed in' }, { status: 401 });
    }

    const { ticker, vote } = await req.json();
    if (!ticker || !['BUY', 'HOLD', 'SELL'].includes(vote)) {
      return Response.json({ error: 'Invalid ticker or vote' }, { status: 400 });
    }

    const { data: existingVote } = await supabase
      .from('votes')
      .select('id')
      .eq('ticker', ticker)
      .eq('user_id', userId)
      .single();

    const isNewVote = !existingVote;

    const { error } = await supabase
      .from('votes')
      .upsert([{ ticker: ticker.toUpperCase(), user_id: userId, vote }], {
        onConflict: 'ticker,user_id',
      });

    if (error) throw error;

    const { data: allUserVotes } = await supabase
      .from('votes')
      .select('id')
      .eq('user_id', userId);

    const voteCount = allUserVotes?.length || 0;

    return Response.json({ success: true, voteCount, isNewVote });
  } catch (error) {
    console.error('votes POST error:', error);
    return Response.json({ error: 'Error saving vote' }, { status: 500 });
  }
}
