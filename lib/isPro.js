import { createClient } from './supabase/server';
import { supabase as adminSupabase } from './supabase';
import { TRIAL_LAUNCH_DATE, TRIAL_DAYS } from './trialConfig';

const PRO_STATUSES = ['trialing', 'active'];

// Single source of truth for "is this signed-in user Pro" — same rules /api/subscription
// uses for the UI (manual override, active/trialing subscription, still inside their
// 14-day trial window, or grandfathered in from before the trial launch date), now reusable
// by anything that needs to gate a feature server-side, not just display a badge client-side.
export async function checkIsPro() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await adminSupabase
    .from('subscriptions')
    .select('status, manual_override')
    .eq('user_id', user.id)
    .single();

  const userCreatedAt = new Date(user.created_at);
  const trialEndsAt = new Date(userCreatedAt.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  const isUnderTrial = new Date() < trialEndsAt;
  const isGrandfathered = userCreatedAt < TRIAL_LAUNCH_DATE;

  return process.env.NODE_ENV === 'development' ||
    data?.manual_override === true ||
    PRO_STATUSES.includes(data?.status) ||
    isUnderTrial ||
    isGrandfathered;
}
