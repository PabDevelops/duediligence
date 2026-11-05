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
// manual_override_until null = a permanent comp; set = a timed trial (e.g. "30 días",
// app/admin/users/page.js) that expires on its own — overrideExpired tells GET below when to
// lazily clear a stale row instead of leaving manual_override sitting at true forever.
function effectiveStatus(user, sub) {
  const userCreatedAt = new Date(user.created_at);
  const trialEndsAt = new Date(userCreatedAt.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  const isUnderTrial = new Date() < trialEndsAt;
  const isGrandfathered = userCreatedAt < TRIAL_LAUNCH_DATE;
  const overrideExpired = sub?.manual_override === true && sub?.manual_override_until != null && new Date(sub.manual_override_until) <= new Date();
  const overrideActive = sub?.manual_override === true && !overrideExpired;
  const isPro = overrideActive || PRO_STATUSES.includes(sub?.status) || isUnderTrial || isGrandfathered;
  let reason;
  if (overrideActive) reason = sub.manual_override_until ? 'manual_trial' : 'manual';
  else if (PRO_STATUSES.includes(sub?.status)) reason = sub.status;
  else if (isUnderTrial) reason = 'trial';
  else if (isGrandfathered) reason = 'grandfathered';
  else reason = 'none';
  return { isPro, reason, overrideExpired, trialEndsAt: trialEndsAt.toISOString() };
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
    const status = effectiveStatus(u, sub);
    // Lazy cleanup: a timed trial that has already lapsed is left as manual_override=true in the
    // row until something notices — best-effort, fire-and-forget, never blocks the response.
    if (status.overrideExpired) {
      supabase.from('subscriptions').update({ manual_override: false, manual_override_until: null }).eq('user_id', u.id).then(() => {});
    }
    return {
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      subscription: sub && {
        status: sub.status,
        manual_override: sub.manual_override,
        manual_override_until: sub.manual_override_until,
        trial_end: sub.trial_end,
        stripe_customer_id: sub.stripe_customer_id,
      },
      ...status,
    };
  });

  return Response.json({ users });
}

export async function PATCH(request) {
  const isAdmin = await checkIsAdmin();
  if (!isAdmin) return Response.json({ error: 'Not authorized' }, { status: 403 });

  const { user_id, manual_override, manual_override_until } = await request.json().catch(() => ({}));
  if (!user_id || typeof manual_override !== 'boolean') {
    return Response.json({ error: 'Missing user_id or manual_override' }, { status: 400 });
  }
  if (manual_override_until != null && Number.isNaN(new Date(manual_override_until).getTime())) {
    return Response.json({ error: 'Invalid manual_override_until' }, { status: 400 });
  }

  // A user with no Stripe history at all has no subscriptions row yet — upsert rather than
  // update so comping a never-subscribed user doesn't silently no-op. Turning the override off
  // always clears manual_override_until too, even if the caller didn't pass one, so there's
  // never a lingering expiry date sitting on a row that's no longer overridden.
  const { error } = await supabase
    .from('subscriptions')
    .upsert({
      user_id, manual_override,
      manual_override_until: manual_override ? (manual_override_until ?? null) : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true });
}
