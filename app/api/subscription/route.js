import { createClient } from '../../../lib/supabase/server';
import { supabase as adminSupabase } from '../../../lib/supabase';
import { TRIAL_LAUNCH_DATE } from '../../../lib/trialConfig';

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

  const isPro = process.env.NODE_ENV === 'development' || data?.manual_override === true || PRO_STATUSES.includes(data?.status);
  const needsTrial = !data && new Date(user.created_at) >= TRIAL_LAUNCH_DATE;

  return Response.json({ isPro, needsTrial });
}
