import { auth, clerkClient } from '@clerk/nextjs/server';
import { supabase } from '../../../lib/supabase';
import { TRIAL_LAUNCH_DATE } from '../../../lib/trialConfig';

const PRO_STATUSES = ['trialing', 'active'];

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ isPro: false, needsTrial: false });

  const { data } = await supabase
    .from('subscriptions')
    .select('status')
    .eq('user_id', userId)
    .single();

  const isPro = PRO_STATUSES.includes(data?.status);

  let needsTrial = false;
  if (!data) {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    needsTrial = new Date(user.createdAt) >= TRIAL_LAUNCH_DATE;
  }

  return Response.json({ isPro, needsTrial });
}
