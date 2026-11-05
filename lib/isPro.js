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
    .select('status, manual_override, manual_override_until')
    .eq('user_id', user.id)
    .single();

  const userCreatedAt = new Date(user.created_at);
  const trialEndsAt = new Date(userCreatedAt.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  const isUnderTrial = new Date() < trialEndsAt;
  const isGrandfathered = userCreatedAt < TRIAL_LAUNCH_DATE;
  // manual_override_until null = permanent comp (the original behavior); set = an admin-granted
  // timed trial (e.g. "30 días") that expires on its own without anyone having to remember to
  // revoke it — see app/admin/users/page.js.
  const overrideActive = data?.manual_override === true &&
    (data?.manual_override_until == null || new Date(data.manual_override_until) > new Date());

  return process.env.NODE_ENV === 'development' ||
    overrideActive ||
    PRO_STATUSES.includes(data?.status) ||
    isUnderTrial ||
    isGrandfathered;
}
