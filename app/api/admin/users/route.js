import { checkIsAdmin } from '../../../../lib/isAdmin';
import { supabase } from '../../../../lib/supabase';
import { TRIAL_LAUNCH_DATE, TRIAL_DAYS } from '../../../../lib/trialConfig';

const PRO_STATUSES = ['trialing', 'active'];

// Same pagination loop app/api/admin/user-stats/route.js already uses — Supabase's admin
// listUsers() has no email-substring filter in this project's SDK version, so a search here
// means listing everyone and filtering in JS. Fine at this app's current user count; revisit
// (a dedicated users table mirrored from auth.users, or a real filter) if that stops being true.
async function listAllUsers() {
  const perPage = 1000;
  let page = 1;
  let all = [];
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    all = all.concat(data.users);
    if (data.users.length < perPage) break;
    page += 1;
  }
  return all;
}

// Same rules lib/isPro.js#checkIsPro uses for the signed-in user, applied here to an arbitrary
// looked-up user instead of the current session — so admin sees the actual effective status
// (what the user's own app would show them), not just the raw subscriptions row.
function effectiveStatus(user, sub) {
  const userCreatedAt = new Date(user.created_at);
  const trialEndsAt = new Date(userCreatedAt.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  const isUnderTrial = new Date() < trialEndsAt;
  const isGrandfathered = userCreatedAt < TRIAL_LAUNCH_DATE;
  const isPro = sub?.manual_override === true || PRO_STATUSES.includes(sub?.status) || isUnderTrial || isGrandfathered;
  let reason;
  if (sub?.manual_override === true) reason = 'manual';
  else if (PRO_STATUSES.includes(sub?.status)) reason = sub.status;
  else if (isUnderTrial) reason = 'trial';
  else if (isGrandfathered) reason = 'grandfathered';
  else reason = 'none';
  return { isPro, reason, trialEndsAt: trialEndsAt.toISOString() };
}

export async function GET(request) {
  const isAdmin = await checkIsAdmin();
  if (!isAdmin) return Response.json({ error: 'Not authorized' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim().toLowerCase();
  if (!q) return Response.json({ users: [] });

  const all = await listAllUsers();
  const matches = all.filter(u => u.email?.toLowerCase().includes(q)).slice(0, 25);
  if (matches.length === 0) return Response.json({ users: [] });

  const ids = matches.map(u => u.id);
  const { data: subs, error } = await supabase.from('subscriptions').select('*').in('user_id', ids);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const subByUser = Object.fromEntries((subs || []).map(s => [s.user_id, s]));

  const users = matches.map(u => {
    const sub = subByUser[u.id] || null;
    return {
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      subscription: sub && {
        status: sub.status,
        manual_override: sub.manual_override,
        trial_end: sub.trial_end,
        stripe_customer_id: sub.stripe_customer_id,
      },
      ...effectiveStatus(u, sub),
    };
  });

  return Response.json({ users });
}

export async function PATCH(request) {
  const isAdmin = await checkIsAdmin();
  if (!isAdmin) return Response.json({ error: 'Not authorized' }, { status: 403 });

  const { user_id, manual_override } = await request.json().catch(() => ({}));
  if (!user_id || typeof manual_override !== 'boolean') {
    return Response.json({ error: 'Missing user_id or manual_override' }, { status: 400 });
  }

  // A user with no Stripe history at all has no subscriptions row yet — upsert rather than
  // update so comping a never-subscribed user doesn't silently no-op.
  const { error } = await supabase
    .from('subscriptions')
    .upsert({ user_id, manual_override, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true });
}
