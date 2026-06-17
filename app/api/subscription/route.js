import { auth } from '@clerk/nextjs/server';
import { supabase } from '../../../lib/supabase';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ isPro: false });

  const { data, error } = await supabase
    .from('subscriptions')
    .select('status')
    .eq('user_id', userId)
    .single();

  console.log('subscription check:', { userId, data, error });
  return Response.json({ isPro: data?.status === 'active', debug: { userId, data, error } });
}