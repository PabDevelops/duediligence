import { auth } from '@clerk/nextjs/server';
import { supabase } from '../../../lib/supabase';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ tickers: [] });

  const { data } = await supabase
    .from('watchlists')
    .select('ticker, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  return Response.json({ tickers: data || [] });
}

export async function POST(request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const { ticker } = await request.json();
  if (!ticker) return Response.json({ error: 'Ticker required' }, { status: 400 });

  await supabase.from('watchlists').upsert({ user_id: userId, ticker: ticker.toUpperCase() });
  return Response.json({ success: true });
}

export async function DELETE(request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const { ticker } = await request.json();
  await supabase.from('watchlists').delete().eq('user_id', userId).eq('ticker', ticker.toUpperCase());
  return Response.json({ success: true });
}