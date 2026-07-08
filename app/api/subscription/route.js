import { createClient } from '../../../lib/supabase/server';
import { supabase as adminSupabase } from '../../../lib/supabase';
import { TRIAL_LAUNCH_DATE, TRIAL_DAYS } from '../../../lib/trialConfig';

const PRO_STATUSES = ['trialing', 'active'];

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ isPro: false, needsTrial: false });

  const { data } = await adminSupabase
    .from('subscriptions')
    .select('status, manual_override')
    .eq('user_id', user.id)
    .single();

  const userCreatedAt = new Date(user.created_at);
  const trialEndsAt = new Date(userCreatedAt.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  const isUnderTrial = new Date() < trialEndsAt;
  const isGrandfathered = userCreatedAt < TRIAL_LAUNCH_DATE;

  const isPro = process.env.NODE_ENV === 'development' || 
                data?.manual_override === true || 
                PRO_STATUSES.includes(data?.status) ||
                isUnderTrial ||
                isGrandfathered;

  const needsTrial = false;

  return Response.json({ isPro, needsTrial });
}

